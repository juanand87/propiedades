import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../products/product.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { fingerprintIntegrationSecret } from '../common/integration-identity.util';
import { getParisPublicationUrl } from './paris-publication-url';

const PARIS_API_URL = process.env.PARIS_API_URL || 'https://api-developers.ecomm.cencosud.com';
type ParisCategoryRule = { categoryId: string; priceAdjustmentType: 'fixed' | 'percentage'; priceAdjustmentValue: number; titlePrefix: string; titleSuffix: string };
type ParisConfig = { familyId?: string; categoryId?: string; priceTypeId?: string; attributeValues?: Record<string, string>; variantAttributeValues?: Record<string, string>; categoryRules?: ParisCategoryRule[] };

@Injectable()
export class ParisService {
  private readonly tokens = new Map<string, { accessToken: string; expiresAt: number }>();
  private readonly familyCache = new Map<string, { families: any[]; expiresAt: number }>();

  constructor(
    @InjectRepository(VendorSettings) private readonly settings: Repository<VendorSettings>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async getConfiguration(vendorId: string) {
    const settings = await this.settings.findOneBy({ vendorId });
    const config = this.normalizeConfiguration(settings?.parisConfig);
    const products = await this.products.createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .where('product.vendorId = :vendorId', { vendorId })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .getMany();
    const categories = [...new Map(products.flatMap((product) => product.categories || []).map((category) => [category.id, { id: category.id, name: category.name }])).values()];
    return {
      apiKeyConfigured: Boolean(settings?.parisApiKey),
      connected: Boolean(settings?.parisApiKey),
      config,
      categories,
    };
  }

  async saveConfiguration(vendorId: string, data: { apiKey?: string; config?: ParisConfig }) {
    let settings = await this.settings.findOneBy({ vendorId });
    if (!settings && !data.apiKey?.trim()) throw new BadRequestException('La API Key de Marketplace Paris es obligatoria');
    if (!settings) settings = this.settings.create({ vendorId });
    if (data.apiKey?.trim()) {
      const apiKey = data.apiKey.trim();
      const connectionKey = fingerprintIntegrationSecret(apiKey);
      const existingConnection = await this.settings.findOneBy({ parisConnectionKey: connectionKey });
      if (existingConnection && existingConnection.vendorId !== vendorId) {
        throw new ConflictException('Esta cuenta de Marketplace Paris ya está conectada a otra tienda de MundoBeat.');
      }
      settings.parisApiKey = apiKey;
      settings.parisConnectionKey = connectionKey;
      this.tokens.delete(vendorId);
    }
    if (data.config) {
      settings.parisConfig = this.normalizeConfiguration({ ...(settings.parisConfig || {}), ...data.config });
    }
    await this.settings.save(settings);
    return this.getConfiguration(vendorId);
  }

  async testConnection(vendorId: string) {
    await this.getAccessToken(vendorId);
    return { connected: true };
  }

  async getFamilies(vendorId: string) {
    const cached = this.familyCache.get(vendorId);
    if (cached && cached.expiresAt > Date.now()) return cached.families;
    let families: any[] = await this.getPaginatedResults(vendorId, '/v2/families').catch((): any[] => []);
    if (!families.length) {
      const searches = ['Audio', 'HiFi', 'Vinilos', 'Musica', 'Tecnologia', 'Computacion', 'Electronica', 'Instrumentos Musicales'];
      for (const search of searches) {
        try {
          const data = await this.request(vendorId, `/v1/family?limit=100&offset=0&search=${encodeURIComponent(search)}`);
          families.push(...this.extractResults(data));
        } catch (error: any) {
          console.warn(`[Paris] Family fallback search "${search}" failed: ${this.getParisError(error)}`);
        }
      }
    }
    const uniqueFamilies = [...new Map<string, any>(families.map((family: any): [string, any] => [String(family?.id || family?.code || family?.name), family])).values()];
    this.familyCache.set(vendorId, { families: uniqueFamilies, expiresAt: Date.now() + 10 * 60_000 });
    return uniqueFamilies;
  }

  async getPriceTypes(vendorId: string) {
    const data = await this.request(vendorId, '/v2/price-types');
    return data?.results || data || [];
  }

  async getCategories(vendorId: string, familyId: string) {
    const categories = await this.getPaginatedResults(vendorId, `/v2/categories/family/${encodeURIComponent(familyId)}`);
    const selectableCategories = categories.filter((category: any) => category?.isSelectable === true || String(category?.isSelectable).toLowerCase() === 'true');
    return (selectableCategories.length ? selectableCategories : categories)
      .map((category: any) => ({ ...category, name: this.getCategoryPath(category) }));
  }

  async getAttributes(vendorId: string, familyId: string) {
    const [product, variant] = await Promise.all([
      this.request(vendorId, `/v2/attributes/product/family/${encodeURIComponent(familyId)}?limit=100&offset=0`),
      this.request(vendorId, `/v2/attributes/variant/family/${encodeURIComponent(familyId)}?limit=100&offset=0`),
    ]);
    const [productAttributes, variantAttributes] = await Promise.all([
      this.loadAttributeOptions(vendorId, product?.results || product || []),
      this.loadAttributeOptions(vendorId, variant?.results || variant || []),
    ]);
    return { product: productAttributes, variant: variantAttributes };
  }

  async publishProduct(productId: string, vendorId: string) {
    const product = await this.products.findOne({ where: { id: productId, vendor: { id: vendorId } }, relations: ['vendor', 'categories'] });
    if (!product) throw new NotFoundException('Producto no encontrado para esta tienda');
    if (!product.sku?.trim()) throw new BadRequestException('El producto debe tener SKU antes de publicarlo en París');
    const mediaUrls = this.getPublicMediaUrls(product.images);
    if (mediaUrls.length < 2) throw new BadRequestException('París exige al menos dos imágenes públicas para publicar el producto');

    const settings = await this.settings.findOneBy({ vendorId });
    const config = this.normalizeConfiguration(settings?.parisConfig);
    if (!config.familyId || !config.categoryId) throw new BadRequestException('Configura la familia y categoría de París antes de publicar productos');

    const variantSku = product.parisVariantSku || `${product.sku.trim()}-1`;
    const definitions = await this.getAttributes(vendorId, config.familyId);
    const productAttributeValues = { ...(config.attributeValues || {}) };
    const brandAttribute = definitions.product.find((attribute: any) => this.normalizeAttributeName(attribute?.name) === 'marca');
    if (brandAttribute?.id) {
      const genericBrand = (brandAttribute.attributeOptions || []).find((option: any) => this.normalizeAttributeName(option?.name) === 'generico');
      if (!genericBrand?.id) {
        throw new BadRequestException('La familia de París no tiene disponible la marca Generico');
      }
      productAttributeValues[brandAttribute.id] = genericBrand.id;
    }
    this.fillProductAttributeValues(productAttributeValues, definitions.product, product);
    const productAttributes = this.toAttributePayload(productAttributeValues);
    const variantAttributes = this.toAttributePayload(config.variantAttributeValues);
    const rule = this.getCategoryRule(product, config);
    const publicationTitle = this.getPublicationTitle(product.title, rule);
    const publicationPrice = this.getPublicationPrice(product, rule);
    const payload = {
      product: {
        name: publicationTitle,
        sellerSku: product.sku.trim(),
        familyId: config.familyId,
        attributes: productAttributes,
        category: config.categoryId,
      },
      variants: [{
        name: publicationTitle,
        refVariant: product.sku.trim(),
        sku: variantSku,
        skuSeller: product.sku.trim().slice(0, 50),
        status: 'ENABLED',
        attributes: variantAttributes,
        medias: mediaUrls.map((src, index) => ({ src, position: index + 1 })),
      }],
    };
    console.log(`[Paris] Publishing ${product.sku}: ${mediaUrls.length} public media URL(s)`);

    try {
      const data = product.parisProductId
        ? await this.request(vendorId, `/v2/products/${encodeURIComponent(product.parisProductId)}`, 'patch', payload)
        : await this.request(vendorId, '/v2/products', 'post', payload);
      product.parisProductId = String(data?.id || data?.sellerSku || product.parisProductId || product.sku);
      product.parisVariantSku = String(data?.variants?.[0]?.sku || variantSku);
      await this.products.save(product);
      await this.syncPriceAndStock(product, vendorId, publicationPrice);
      return { success: true, productId: product.parisProductId, variantSku: product.parisVariantSku };
    } catch (error: any) {
      throw new BadRequestException(`París rechazó la publicación: ${this.getParisError(error)}`);
    }
  }

  async getPublicationLink(productId: string, vendorId: string) {
    if (!vendorId) throw new BadRequestException('Tu cuenta no está asociada a una tienda');
    const product = await this.products.findOne({ where: { id: productId, vendor: { id: vendorId } } });
    if (!product) throw new NotFoundException('Producto no encontrado para esta tienda');
    if (!product.parisProductId) throw new BadRequestException('El producto todavía no está vinculado a Paris');
    const data = await this.request(vendorId, `/v2/products/${encodeURIComponent(product.parisProductId)}`);
    const url = getParisPublicationUrl(data);
    if (!url) throw new NotFoundException('Paris todavía no entrega un enlace público para este producto. La vinculación no garantiza que la publicación esté visible.');
    return { url };
  }

  private async syncPriceAndStock(product: Product, vendorId: string, publicationPrice: number) {
    const [storePrice, type] = await Promise.all([this.getDefaultStorePrice(vendorId), this.getListPriceType(vendorId, (await this.settings.findOneBy({ vendorId }))?.parisConfig?.priceTypeId)]);
    await this.request(vendorId, `/v2/prices/product/${encodeURIComponent(product.parisProductId)}`, 'patch', {
      prices: [{ value: publicationPrice, type, storePrice, status: 'ENABLED' }],
    });
    const quantity = Math.max(0, Math.trunc(Number(product.stock) || 0));
    let stockResponse: any;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      stockResponse = await this.request(vendorId, '/v1/stock/sku-seller', 'post', {
        skus: [{ sku_seller: product.sku.trim(), quantity }],
      });
      console.log(`[Paris] Stock sync ${product.sku}: attempt=${attempt}, quantity=${quantity}, response=${JSON.stringify(stockResponse)}`);
      if (!this.hasParisErrors(stockResponse)) return;
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
    throw new BadRequestException(this.getParisError({ response: { data: stockResponse } }));
  }

  private hasParisErrors(response: any) {
    if (Array.isArray(response?.errors)) return response.errors.length > 0;
    return Boolean(response?.errors && Object.keys(response.errors).length > 0);
  }

  private normalizeConfiguration(config: any = {}): ParisConfig {
    return {
      familyId: String(config?.familyId || ''),
      categoryId: String(config?.categoryId || ''),
      priceTypeId: String(config?.priceTypeId || ''),
      attributeValues: config?.attributeValues || {},
      variantAttributeValues: config?.variantAttributeValues || {},
      categoryRules: Array.isArray(config?.categoryRules) ? config.categoryRules.map((rule: any) => ({
        categoryId: String(rule?.categoryId || ''),
        priceAdjustmentType: rule?.priceAdjustmentType === 'percentage' ? 'percentage' : 'fixed',
        priceAdjustmentValue: Math.max(0, Number(rule?.priceAdjustmentValue) || 0),
        titlePrefix: String(rule?.titlePrefix || '').trim(),
        titleSuffix: String(rule?.titleSuffix || '').trim(),
      })).filter((rule: ParisCategoryRule) => rule.categoryId) : [],
    };
  }

  private getCategoryRule(product: Product, config: ParisConfig) {
    return config.categoryRules?.find((rule) => product.categories?.some((category) => category.id === rule.categoryId));
  }

  private getPublicationTitle(title: string, rule?: ParisCategoryRule) {
    return [rule?.titlePrefix, title.trim(), rule?.titleSuffix].filter(Boolean).join(' ').slice(0, 255);
  }

  private getPublicationPrice(product: Product, rule?: ParisCategoryRule) {
    const basePrice = Number(product.isOnSale && product.salePrice ? product.salePrice : product.price);
    const adjustment = Number(rule?.priceAdjustmentValue || 0);
    return Math.round(rule?.priceAdjustmentType === 'percentage' ? basePrice * (1 + adjustment / 100) : basePrice + adjustment);
  }

  private getPublicMediaUrls(images: string[] | undefined) {
    const publicApiUrl = (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
    return (images || [])
      .map((image) => String(image || '').trim())
      .filter(Boolean)
      .map((image) => image.startsWith('http://') || image.startsWith('https://')
        ? image
        : `${publicApiUrl}/${image.replace(/^\/+/, '')}`)
      .filter((image) => image.startsWith('https://'));
  }

  private toAttributePayload(values: Record<string, string> | undefined) {
    return Object.entries(values || {})
      .filter(([, value]) => Boolean(String(value || '').trim()))
      .map(([id, value]) => ({ id, value }));
  }

  private async loadAttributeOptions(vendorId: string, attributes: any[]) {
    return Promise.all(attributes.map(async (attribute) => {
      if (Array.isArray(attribute?.attributeOptions) && attribute.attributeOptions.length > 0) return attribute;
      try {
        const data = await this.request(vendorId, `/v2/attributes-options/attribute/${encodeURIComponent(attribute.id)}?limit=100&offset=0`);
        const options = data?.results || data?.attributeOptions || data || [];
        return Array.isArray(options) && options.length > 0 ? { ...attribute, attributeOptions: options } : attribute;
      } catch {
        return attribute;
      }
    }));
  }

  private async getPaginatedResults(vendorId: string, path: string) {
    const separator = path.includes('?') ? '&' : '?';
    const limit = 100;
    const allResults: any[] = [];
    for (let offset = 0; offset < 5_000; offset += limit) {
      const data = await this.request(vendorId, `${path}${separator}limit=${limit}&offset=${offset}`);
      const results = this.extractResults(data);
      allResults.push(...results);
      const total = Number(data?.paging?.total ?? data?.total ?? data?.count ?? 0);
      if (!results.length || (total > 0 && allResults.length >= total) || (total <= 0 && results.length < limit)) break;
    }
    return [...new Map(allResults.map((result: any) => [String(result?.id || result?.code || result?.name), result])).values()];
  }

  private extractResults(data: any): any[] {
    const candidates = [data?.results, data?.data?.results, data?.data, data?.items, data?.content, data?.families, data?.categories, data];
    return candidates.find((candidate) => Array.isArray(candidate)) || [];
  }

  private getCategoryPath(category: any): string {
    const currentName = String(category?.name || category?.categoryName || category?.code || category?.id || 'Sin nombre');
    const hierarchy = category?.parents || category?.ancestors || category?.hierarchy || category?.path || [];
    const names = Array.isArray(hierarchy)
      ? hierarchy.map((item: any) => String(item?.name || item?.categoryName || item || '').trim()).filter(Boolean)
      : String(hierarchy || '').split(/[/>|]/).map((item) => item.trim()).filter(Boolean);
    return [...new Set([...names, currentName])].join(' → ');
  }

  private async getDefaultStorePrice(vendorId: string) {
    const data = await this.request(vendorId, '/v2/store-prices?limit=100&offset=0');
    const stores = data?.results || data?.stores || data || [];
    const store = Array.isArray(stores)
      ? stores.find((item: any) => String(item?.code || '').toLowerCase() === 'default') || stores[0]
      : null;
    const storeId = store?.id || store?.storePriceId || store?.store?.id;
    if (!storeId) throw new BadRequestException('París no devolvió una tienda habilitada para asignar el precio');
    return String(storeId);
  }

  private normalizeAttributeName(value: unknown) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  private fillProductAttributeValues(values: Record<string, string>, definitions: any[], product: Product) {
    for (const definition of definitions) {
      if (!definition?.id || values[definition.id]) continue;
      const name = this.normalizeAttributeName(definition.name);
      let value: string | number | undefined;
      if (name.includes('descripcion corta')) value = product.shortDescription || product.description;
      else if (name.includes('descripcion larga')) value = product.description;
      else if (name.includes('caracteristica')) value = product.technicalSpecs;
      else if (name.includes('numero de piezas')) value = product.mediaQuantity;
      else if (name.includes('peso')) value = product.weight ? Math.round(Number(product.weight) * 1000) : undefined;
      else if (name.includes('ancho')) value = product.width;
      else if (name.includes('largo')) value = product.depth;
      else if (name.includes('alto')) value = product.height;
      if (value !== undefined && value !== null && String(value).trim()) values[definition.id] = String(value);
    }
  }

  private async getListPriceType(vendorId: string, configuredPriceTypeId?: string) {
    if (configuredPriceTypeId) return configuredPriceTypeId;
    const priceTypes = await this.getPriceTypes(vendorId);
    const listPrice = Array.isArray(priceTypes)
      ? priceTypes.find((item: any) => String(item?.code || '').toLowerCase() === 'clp-list-prices')
      : null;
    const priceTypeId = listPrice?.id || listPrice?.code;
    if (!priceTypeId) throw new BadRequestException('París no devolvió el tipo de precio de lista habilitado');
    return String(priceTypeId);
  }

  private async getAccessToken(vendorId: string) {
    const cached = this.tokens.get(vendorId);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;
    const settings = await this.settings.findOneBy({ vendorId });
    if (!settings?.parisApiKey) throw new BadRequestException('La API Key de Marketplace Paris no está configurada');
    try {
      const { data } = await axios.post(`${PARIS_API_URL}/v1/auth/apiKey`, undefined, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.parisApiKey}` },
      });
      if (!data?.accessToken) throw new Error('La respuesta no incluyó un Access Token');
      const expiresIn = Number(data.expiresIn) || 14_400;
      this.tokens.set(vendorId, { accessToken: data.accessToken, expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000 });
      return data.accessToken;
    } catch (error: any) {
      throw new BadRequestException(`No se pudo autenticar con París: ${this.getParisError(error)}`);
    }
  }

  private async request(vendorId: string, path: string, method: 'get' | 'post' | 'patch' = 'get', data?: any) {
    const accessToken = await this.getAccessToken(vendorId);
    try {
      const response = await axios({ method, url: `${PARIS_API_URL}${path}`, data, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` } });
      return response.data;
    } catch (error: any) {
      throw new BadRequestException(`Error en la API de París: ${this.getParisError(error)}`);
    }
  }

  private getParisError(error: any) {
    const data = error?.response?.data;
    const format = (value: any): string => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.map(format).filter(Boolean).join('; ');
      if (value && typeof value === 'object') {
        if (typeof value.message === 'string') return value.message;
        if (typeof value.error === 'string') return value.error;
        return Object.entries(value).map(([key, item]) => `${key}: ${format(item)}`).join('; ');
      }
      return value === undefined || value === null ? '' : String(value);
    };
    return format(data?.errors) || format(data?.message) || format(data?.error) || format(data) || format(error?.message) || 'Error desconocido';
  }
}
