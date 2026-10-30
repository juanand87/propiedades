import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiImageGeneration, AiImageGenerationStatus } from './ai-image-generation.entity';
import { GenerateAiImagesDto } from './dto';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { StorageService } from '../storage/storage.service';
import { UserRole } from '../users/user.entity';
import sharp from 'sharp';

const MAX_PRODUCTS_PER_BATCH = 10;
const ECONOMY_IMAGE_MODEL = 'gpt-image-1-mini';
const ECONOMY_IMAGE_QUALITY = 'medium';
const ECONOMY_IMAGE_SIZE = '1024x1024';
const ALLOWED_IMAGE_MODELS = ['gpt-image-1-mini', 'gpt-image-1'] as const;
const ALLOWED_IMAGE_QUALITIES = ['low', 'medium', 'high', 'auto'] as const;

const SCENARIO_PROMPTS: Record<string, string> = {
  music_store: 'inside an independent vintage music store, wooden counter, shelves full of vinyl records and CDs softly blurred in the background, warm editorial lighting',
  audiophile_living: 'in an audiophile living room, on a wooden table near a turntable, speakers, plants and a warm lamp, premium cozy atmosphere',
  jazz_bar: 'on a small table in a nocturnal jazz bar, subtle warm lights, tasteful glassware, elegant musical mood, cinematic background blur',
  urban_city: 'in an urban city setting, near a music shop window or mural wall, modern editorial street photography atmosphere',
  nature: 'on a rustic surface outdoors with a calm nature background, sunset light, beach or forest feeling, relaxed editorial composition',
  collector_setup: 'in a collector music setup, surrounded by subtle headphones, turntable details, sleeves and music accessories, clean premium product photography',
};

const STYLE_PROMPTS: Record<string, string> = {
  realistic: 'realistic premium product photography, sharp subject, natural shadows, professional commercial lighting',
  vintage: 'nostalgic vintage analog photo style, warm tones, tasteful grain, classic music magazine mood',
  editorial: 'modern editorial campaign style, clean composition, high-end lifestyle product photography',
  dramatic: 'dramatic but elegant lighting, deep contrast, premium music collectible mood',
  bright: 'bright clean commercial style, clear details, fresh and inviting atmosphere',
};

const DECORATION_PROMPTS: Record<string, string> = {
  none: 'no extra decoration, keep the scene clean',
  beer: 'include a tasteful craft beer glass or bottle in the background, not covering the product',
  wine: 'include a glass of wine in the background, elegant and subtle, not covering the product',
  turntable: 'include a turntable detail in the background, softly blurred',
  headphones: 'include headphones as subtle music decoration near the product',
  plants: 'include tasteful plants as subtle decoration',
  posters: 'include blurred music posters in the background',
};

@Injectable()
export class AiImagesService {
  constructor(
    @InjectRepository(AiImageGeneration)
    private readonly historyRepository: Repository<AiImageGeneration>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Vendor)
    private readonly vendorsRepository: Repository<Vendor>,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  async getAccessStatus(user: any) {
    const vendor = await this.getUserVendor(user);
    const apiConfigured = Boolean(this.configService.get<string>('OPENAI_API_KEY'));

    return {
      enabled: Boolean(vendor.aiImageGenerationEnabled),
      apiConfigured,
      maxBatchSize: MAX_PRODUCTS_PER_BATCH,
      canGenerate: Boolean(vendor.aiImageGenerationEnabled && apiConfigured),
      message: !vendor.aiImageGenerationEnabled
        ? 'La generaciÃ³n de imÃ¡genes con IA no estÃ¡ habilitada para esta tienda.'
        : !apiConfigured
          ? 'OPENAI_API_KEY no estÃ¡ configurada en el backend.'
          : 'GeneraciÃ³n de imÃ¡genes habilitada.',
    };
  }

  async findHistory(user: any, limit = 40) {
    const vendor = await this.getUserVendor(user);
    return this.historyRepository.find({
      where: { vendorId: vendor.id },
      relations: ['product'],
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(Number(limit) || 40, 1), 100),
    });
  }

  async generateImages(user: any, dto: GenerateAiImagesDto) {
    const vendor = await this.getUserVendor(user);
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!vendor.aiImageGenerationEnabled) {
      throw new ForbiddenException('La generaciÃ³n de imÃ¡genes con IA no estÃ¡ habilitada para esta tienda.');
    }

    if (!apiKey) {
      throw new BadRequestException('OPENAI_API_KEY no estÃ¡ configurada en el backend.');
    }

    if (!dto.productIds?.length || dto.productIds.length > MAX_PRODUCTS_PER_BATCH) {
      throw new BadRequestException(`Puedes generar imÃ¡genes para un mÃ¡ximo de ${MAX_PRODUCTS_PER_BATCH} productos por lote.`);
    }

    const uniqueProductIds = [...new Set(dto.productIds)];
    const products = await this.productsRepository.find({
      where: {
        id: In(uniqueProductIds),
        vendor: { id: vendor.id },
      },
      relations: ['vendor', 'formats', 'genres'],
    });

    if (products.length !== uniqueProductIds.length) {
      throw new BadRequestException('Uno o mÃ¡s productos no pertenecen a esta tienda o no existen.');
    }

    const results = [] as AiImageGeneration[];

    for (const product of products) {
      const history = this.historyRepository.create({
        vendorId: vendor.id,
        productId: product.id,
        userId: user.userId || null,
        scenario: dto.scenario,
        style: dto.style,
        decoration: dto.decoration || 'none',
        size: ECONOMY_IMAGE_SIZE,
        sourceImageUrl: this.getFirstProductImage(product),
        prompt: this.buildPrompt(product, dto),
        status: AiImageGenerationStatus.PENDING,
        productSnapshot: this.buildProductSnapshot(product),
      });

      const saved = await this.historyRepository.save(history);

      try {
        const generatedUrl = await this.generateSingleImage(apiKey, saved.prompt, saved.sourceImageUrl, saved.size, product, dto.model, dto.quality);
        saved.generatedImageUrl = generatedUrl;
        saved.status = AiImageGenerationStatus.COMPLETED;
      } catch (error) {
        saved.status = AiImageGenerationStatus.FAILED;
        saved.errorMessage = error?.message || 'Error generando imagen con IA';
      }

      results.push(await this.historyRepository.save(saved));
    }

    return { results };
  }

  async setVendorAccess(vendorId: string, enabled: boolean) {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Tienda no encontrada');

    vendor.aiImageGenerationEnabled = Boolean(enabled);
    await this.vendorsRepository.save(vendor);

    return {
      vendorId: vendor.id,
      enabled: vendor.aiImageGenerationEnabled,
    };
  }

  private async getUserVendor(user: any): Promise<Vendor> {
    if (user.role === UserRole.ADMIN && user.vendorId) {
      const vendor = await this.vendorsRepository.findOne({ where: { id: user.vendorId } });
      if (vendor) return vendor;
    }

    const vendor = await this.vendorsRepository.findOne({
      where: { user: { id: user.userId } },
      relations: ['user'],
    });

    if (!vendor) {
      throw new ForbiddenException('Usuario sin tienda asociada.');
    }

    return vendor;
  }

  private buildPrompt(product: Product, dto: GenerateAiImagesDto): string {
    const format = this.getProductFormat(product);
    const scenario = SCENARIO_PROMPTS[dto.scenario] || dto.scenario;
    const style = STYLE_PROMPTS[dto.style] || dto.style;
    const decoration = DECORATION_PROMPTS[dto.decoration || 'none'] || dto.decoration || DECORATION_PROMPTS.none;

    return [
      'Create only a realistic empty background for a music product photograph.',
      'Important: do not include any album cover, CD case, vinyl record, cassette, product packaging, readable text, logos or watermarks.',
      'Leave a clean central foreground area on a table or surface where a product image will be placed later by software.',
      `The product format that will be composited later is: ${format}.`,
      this.getProductGenre(product) ? `Mood can subtly match this genre: ${this.getProductGenre(product)}.` : '',
      `Scene: ${scenario}.`,
      `Visual style: ${style}.`,
      `Decoration: ${decoration}. Keep decorations in the background or edges, never in the central placement area.`,
      'Professional product photography background, natural perspective, tasteful depth of field, no fake typography.',
    ].filter(Boolean).join(' ');
  }
  private buildProductSnapshot(product: Product) {
    return {
      id: product.id,
      title: product.title,
      artist: product.artist,
      album: product.album,
      format: this.getProductFormat(product),
      price: product.price,
      image: this.getFirstProductImage(product),
    };
  }

  private getProductFormat(product: Product): string {
    return product.formats?.[0]?.name || product.format || product.type || 'CD';
  }

  private getProductGenre(product: Product): string {
    return product.genres?.[0]?.name || product.genre || '';
  }

  private getFirstProductImage(product: Product): string | null {
    const images = Array.isArray(product.images) ? product.images : [];
    return images[0] || null;
  }

  private async generateSingleImage(apiKey: string, prompt: string, sourceImageUrl: string | null, _size: string, product: Product, model?: string, quality?: string): Promise<string> {
    if (!sourceImageUrl) {
      throw new BadRequestException('El producto no tiene imagen de referencia.');
    }

    const [backgroundBuffer, productBuffer] = await Promise.all([
      this.generateBackgroundImage(apiKey, prompt, ECONOMY_IMAGE_SIZE, model, quality),
      this.downloadImageBuffer(sourceImageUrl),
    ]);

    const composedBuffer = await this.composeProductOnBackground(backgroundBuffer, productBuffer, ECONOMY_IMAGE_SIZE, this.getProductFormat(product));
    const upload = await this.storageService.uploadFile({
      originalname: 'ai-composed.png',
      mimetype: 'image/png',
      buffer: composedBuffer,
    }, 'ai-images');

    return upload.url;
  }

  private async generateBackgroundImage(apiKey: string, prompt: string, size: string, model?: string, quality?: string): Promise<Buffer> {
    const selectedModel = ALLOWED_IMAGE_MODELS.includes(model as any) ? model : ECONOMY_IMAGE_MODEL;
    const selectedQuality = ALLOWED_IMAGE_QUALITIES.includes(quality as any) ? quality : ECONOMY_IMAGE_QUALITY;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        size,
        quality: selectedQuality,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalServerErrorException(`OpenAI respondió con error ${response.status}: ${errorText.substring(0, 500)}`);
    }

    const data: any = await response.json();
    const base64 = data?.data?.[0]?.b64_json;
    if (!base64) {
      throw new InternalServerErrorException('OpenAI no devolvió una imagen válida.');
    }

    return Buffer.from(base64, 'base64');
  }

  private async downloadImageBuffer(imageUrl: string): Promise<Buffer> {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new BadRequestException('No se pudo descargar la imagen de referencia del producto.');
    }

    return Buffer.from(await imageResponse.arrayBuffer());
  }

  private async composeProductOnBackground(backgroundBuffer: Buffer, productBuffer: Buffer, size: string, format: string): Promise<Buffer> {
    const { width, height } = this.parseImageSize(size);
    const normalizedFormat = (format || '').toLowerCase();
    const isVinyl = normalizedFormat.includes('vinyl') || normalizedFormat.includes('vinilo');
    const isCassette = normalizedFormat.includes('cassette');

    if (!isVinyl && !isCassette) {
      return this.composeCdJewelCase(backgroundBuffer, productBuffer, width, height);
    }

    return this.composeFlatCover(backgroundBuffer, productBuffer, width, height, isVinyl, isCassette);
  }

  private async composeCdJewelCase(backgroundBuffer: Buffer, productBuffer: Buffer, width: number, height: number): Promise<Buffer> {
    const caseWidth = Math.round(width * 0.58);
    const caseHeight = Math.round(caseWidth * 0.84);
    const spineWidth = Math.round(caseWidth * 0.115);
    const coverWidth = caseWidth - spineWidth - Math.round(caseWidth * 0.035);
    const coverHeight = Math.round(caseHeight * 0.91);
    const coverLeft = spineWidth + Math.round(caseWidth * 0.02);
    const coverTop = Math.round(caseHeight * 0.045);

    const cover = await sharp(productBuffer)
      .rotate()
      .resize({ width: coverWidth, height: coverHeight, fit: 'cover' })
      .png()
      .toBuffer();

    const caseSvg = Buffer.from(`
      <svg width="${caseWidth}" height="${caseHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="plastic" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="rgba(255,255,255,0.46)"/>
            <stop offset="0.45" stop-color="rgba(255,255,255,0.10)"/>
            <stop offset="1" stop-color="rgba(255,255,255,0.28)"/>
          </linearGradient>
          <linearGradient id="spine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="rgba(15,15,15,0.88)"/>
            <stop offset="0.32" stop-color="rgba(48,48,48,0.82)"/>
            <stop offset="0.68" stop-color="rgba(10,10,10,0.86)"/>
            <stop offset="1" stop-color="rgba(60,60,60,0.72)"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${caseWidth}" height="${caseHeight}" rx="5" fill="rgba(255,255,255,0.08)"/>
        <rect x="1" y="1" width="${caseWidth - 2}" height="${caseHeight - 2}" rx="5" fill="url(#plastic)" stroke="rgba(255,255,255,0.62)" stroke-width="2"/>
        <rect x="${Math.round(caseWidth * 0.018)}" y="${Math.round(caseHeight * 0.055)}" width="${spineWidth}" height="${Math.round(caseHeight * 0.89)}" rx="2" fill="url(#spine)" stroke="rgba(255,255,255,0.34)" stroke-width="1"/>
        <line x1="${spineWidth + Math.round(caseWidth * 0.025)}" y1="6" x2="${spineWidth + Math.round(caseWidth * 0.025)}" y2="${caseHeight - 6}" stroke="rgba(255,255,255,0.48)" stroke-width="2"/>
        <rect x="${coverLeft - 3}" y="${coverTop - 3}" width="${coverWidth + 6}" height="${coverHeight + 6}" fill="none" stroke="rgba(255,255,255,0.48)" stroke-width="2"/>
        <path d="M ${Math.round(caseWidth * 0.08)} ${Math.round(caseHeight * 0.03)} L ${Math.round(caseWidth * 0.92)} ${Math.round(caseHeight * 0.03)}" stroke="rgba(255,255,255,0.52)" stroke-width="2"/>
        <path d="M ${Math.round(caseWidth * 0.09)} ${Math.round(caseHeight * 0.97)} L ${Math.round(caseWidth * 0.9)} ${Math.round(caseHeight * 0.97)}" stroke="rgba(0,0,0,0.28)" stroke-width="2"/>
        <circle cx="${Math.round(caseWidth * 0.86)}" cy="${Math.round(caseHeight * 0.18)}" r="${Math.round(caseWidth * 0.008)}" fill="rgba(255,255,255,0.7)"/>
        <circle cx="${Math.round(caseWidth * 0.86)}" cy="${Math.round(caseHeight * 0.82)}" r="${Math.round(caseWidth * 0.008)}" fill="rgba(255,255,255,0.55)"/>
        <path d="M ${Math.round(caseWidth * 0.18)} 0 L ${Math.round(caseWidth * 0.5)} 0 L ${Math.round(caseWidth * 0.32)} ${caseHeight}" stroke="rgba(255,255,255,0.24)" stroke-width="18" opacity="0.55"/>
      </svg>
    `);

    const caseImage = await sharp(caseSvg)
      .composite([{ input: cover, left: coverLeft, top: coverTop }])
      .png()
      .toBuffer();

    const caseOverlay = await sharp(caseImage)
      .composite([{ input: caseSvg, left: 0, top: 0 }])
      .png()
      .toBuffer();

    const shadow = await sharp({
      create: {
        width: caseWidth,
        height: caseHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.48 },
      },
    }).blur(Math.round(width * 0.018)).png().toBuffer();

    const left = Math.round((width - caseWidth) / 2);
    const top = Math.round(height * 0.42);

    return sharp(backgroundBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite([
        { input: shadow, left: left + Math.round(width * 0.025), top: top + Math.round(height * 0.032) },
        { input: caseOverlay, left, top },
      ])
      .png()
      .toBuffer();
  }

  private async composeFlatCover(backgroundBuffer: Buffer, productBuffer: Buffer, width: number, height: number, isVinyl: boolean, isCassette: boolean): Promise<Buffer> {
    const productWidth = Math.round(width * (isVinyl ? 0.42 : isCassette ? 0.46 : 0.38));
    const productHeight = Math.round(height * (isCassette ? 0.28 : isVinyl ? 0.42 : 0.38));

    const product = await sharp(productBuffer)
      .rotate()
      .resize({
        width: productWidth,
        height: productHeight,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    const productMeta = await sharp(product).metadata();
    const framePadding = Math.max(6, Math.round(width * 0.006));
    const frameWidth = (productMeta.width || productWidth) + framePadding * 2;
    const frameHeight = (productMeta.height || productHeight) + framePadding * 2;

    const frameSvg = Buffer.from(`
      <svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${frameWidth}" height="${frameHeight}" rx="8" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.34)" stroke-width="1.5"/>
      </svg>
    `);

    const framedProduct = await sharp(frameSvg)
      .composite([{ input: product, left: framePadding, top: framePadding }])
      .png()
      .toBuffer();

    const shadow = await sharp({
      create: {
        width: frameWidth,
        height: frameHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.42 },
      },
    }).blur(Math.round(width * 0.018)).png().toBuffer();

    const left = Math.round((width - frameWidth) / 2);
    const top = Math.round(height * (isCassette ? 0.43 : 0.35));

    return sharp(backgroundBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite([
        { input: shadow, left: left + Math.round(width * 0.018), top: top + Math.round(height * 0.025) },
        { input: framedProduct, left, top },
      ])
      .png()
      .toBuffer();
  }
  private parseImageSize(size: string): { width: number; height: number } {
    const [rawWidth, rawHeight] = String(size || '1024x1024').split('x').map(Number);
    return {
      width: Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1024,
      height: Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 1024,
    };
  }
}
