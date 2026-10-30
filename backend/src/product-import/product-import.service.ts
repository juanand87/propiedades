import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Product, ProductStatus } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { Category } from '../categories/category.entity';
import { Format } from '../formats/format.entity';
import { Edition } from '../editions/edition.entity';
import { Genre } from '../genres/genre.entity';
import { StorageService } from '../storage/storage.service';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import { URL } from 'url';

@Injectable()
export class ProductImportService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(VendorSettings)
    private vendorSettingsRepository: Repository<VendorSettings>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Format)
    private formatsRepository: Repository<Format>,
    @InjectRepository(Edition)
    private editionsRepository: Repository<Edition>,
    @InjectRepository(Genre)
    private genresRepository: Repository<Genre>,
    private storageService: StorageService,
  ) {}

  async processImportFile(vendorId: string, filePath: string) {
    // Leer el archivo Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    return this.processImportData(vendorId, data);
  }

  async processImportFileBuffer(vendorId: string, buffer: Buffer, filename: string) {
    // Leer el archivo Excel desde buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    return this.processImportData(vendorId, data);
  }

  private async processImportData(vendorId: string, data: any[]) {

    // Verificar que exista el vendor
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
    });

    if (!vendor || !vendor.discogsToken) {
      throw new BadRequestException('Vendor does not have Discogs integration configured');
    }

    // Procesar cada fila
    const results: any[] = [];
    for (const row of data as any[]) {
      const catalog = row['Catálogo'] || row['Catalogo'] || row['catalog'];
      const precio = parseFloat(row['Precio'] || row['Price'] || '0');
      const categoria = row['Categoría'] || row['Categoria'] || row['category'] || '';
      const condicion = (row['Condición'] || row['Condicion'] || row['condition'] || 'new').toLowerCase();
      const stock = parseInt(row['Stock'] || row['stock'] || '1');
      
      if (!catalog) {
        results.push({
          catalog: 'N/A',
          results: [],
          error: 'Missing catalog number',
        });
        continue;
      }

      try {
        // Buscar en Discogs por número de catálogo
        const searchResults = await this.searchInDiscogs(vendor.discogsToken, catalog);
        
        results.push({
          catalog,
          precio,
          categoria,
          condicion,
          stock,
          results: searchResults,
        });
      } catch (error: any) {
        console.error(`Error searching for catalog ${catalog}:`, error);
        results.push({
          catalog,
          results: [],
          error: error.message,
        });
      }
    }

    return results;
  }

  private async searchInDiscogs(token: string, catalog: string): Promise<any[]> {
    // Intentar múltiples estrategias de búsqueda
    const searchStrategies = [
      // 1. Buscar por número de catálogo
      `catno=${encodeURIComponent(catalog)}`,
      // 2. Buscar por código de barras
      `barcode=${encodeURIComponent(catalog)}`,
      // 3. Buscar por query general (fallback)
      `q=${encodeURIComponent(catalog)}&type=release`,
    ];

    for (const strategy of searchStrategies) {
      try {
        const results = await this.performDiscogsSearch(token, strategy);
        if (results.length > 0) {
          console.log(`✓ Found ${results.length} results with strategy: ${strategy.split('=')[0]}`);
          return results;
        }
      } catch (error) {
        console.error(`Search strategy failed: ${strategy}`, error);
      }
    }

    console.log(`⚠️ No results found for: ${catalog}`);
    return [];
  }

  private async performDiscogsSearch(token: string, queryString: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.discogs.com',
        path: `/database/search?${queryString}&token=${token}&per_page=5`,
        method: 'GET',
        headers: {
          'User-Agent': 'TiendasMusicApp/1.0',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            if (json.results && json.results.length > 0) {
              // Tomar los primeros 5 resultados
              const results = json.results.slice(0, 5).map((item: any) => ({
                id: item.id,
                title: item.title,
                artist: item.title.split(' - ')[0] || 'Unknown',
                year: item.year,
                label: item.label?.[0] || 'Unknown',
                image: item.thumb || item.cover_image || '',
                formats: item.format || [],
              }));
              resolve(results);
            } else {
              resolve([]);
            }
          } catch (error) {
            reject(new Error('Failed to parse Discogs response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  async importProducts(
    vendorId: string,
    products: Array<{ 
      discogsId: string; 
      catalog: string;
      precio?: number;
      categoria?: string;
      condicion?: string;
      stock?: number;
    }>,
  ) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
    });

    if (!vendor || !vendor.discogsToken) {
      throw new BadRequestException('Vendor does not have Discogs integration configured');
    }

    // Obtener el template de descripción corta desde settings del vendor
    const shortDescriptionTemplate = vendor.shortDescriptionTemplate || '';
    console.log('📝 Template configurado:', shortDescriptionTemplate);
    console.log('📝 Template length:', shortDescriptionTemplate.length);

    const importedProducts: Product[] = [];

    for (const item of products) {
      try {
        // Obtener información completa del release desde Discogs
        const releaseData = await this.getDiscogsRelease(vendor.discogsToken, String(item.discogsId));
        
        // Obtener la categoría si se proporcionó
        let categoryObj: Category | null = null;
        if (item.categoria) {
          categoryObj = await this.categoriesRepository.findOne({
            where: { name: item.categoria, usesMusicMetadata: true },
          });
        }
        
        // Generar slug único a partir del título
        const baseSlug = releaseData.title
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '')
          .substring(0, 50);
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.productsRepository.findOne({ where: { slug } })
        ) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        
        // Descargar y guardar imágenes localmente
        const localImages = await this.downloadProductImages(releaseData.images || [], slug);
        
        // Buscar en Spotify automáticamente
        let spotifyAlbumId: string | null = null;
        try {
          spotifyAlbumId = await this.searchSpotify(releaseData.title, releaseData.artists?.[0]?.name, vendor);
        } catch (error) {
          console.error(`Error searching Spotify for ${releaseData.title}:`, error);
          // Continuar sin Spotify ID si la búsqueda falla
        }
        
        // Procesar formatos: normalizar y extraer tamaño de vinilo
        let normalizedFormats: string[] = ['Otro'];
        let vinylSize: string | null = null;
        const discogsMetadata = this.getDiscogsReleaseMetadata(releaseData);
        if (releaseData.formats && releaseData.formats.length > 0) {
          const formatString = releaseData.formats.map((f: any) => f.name).join(', ');
          console.log('🔍 [Import] Format string from Discogs:', formatString);
          normalizedFormats = this.normalizeFormats(formatString);
          console.log('🔍 [Import] Normalized formats:', normalizedFormats);
          
          // Si es vinilo, extraer el tamaño
          if (normalizedFormats.includes('Vinyl')) {
            vinylSize = this.extractVinylSize(formatString);
            console.log('🔍 [Import] Extracted vinyl size:', vinylSize);
          }
        }
        
        // Crear el producto con datos del Excel
        const productData: any = {
          vendor: { id: vendor.id },
          slug,
          title: releaseData.title,
          artist: releaseData.artists?.map((a: any) => a.name).join(', '),
          album: releaseData.title.split(' - ')[1] || releaseData.title,
          label: releaseData.labels?.[0]?.name,
          year: releaseData.year,
          genre: releaseData.genres?.join(', '),
          format: normalizedFormats[0], // Formato principal
          vinylSize: vinylSize,
          country: releaseData.country,
          description: this.buildDescription(releaseData),
          shortDescription: this.buildShortDescription(releaseData, shortDescriptionTemplate), // Descripción corta con template
          tracklist: this.buildTracklist(releaseData.tracklist),
          albumType: discogsMetadata.albumType,
          packageType: discogsMetadata.packageType,
          mediaQuantity: discogsMetadata.mediaQuantity,
          hasBonusTracks: discogsMetadata.hasBonusTracks,
          catalogNumber: discogsMetadata.catalogNumber,
          albumVersion: discogsMetadata.albumVersion,
          totalDurationMinutes: discogsMetadata.totalDurationMinutes,
          includedAccessories: discogsMetadata.includedAccessories,
          technicalSpecs: this.buildTechnicalSpecs(releaseData),
          images: localImages, // Usar imágenes locales
          sku: String(item.catalog).replace(/\s+/g, ''),
          condition: (item.condicion || 'new') as any, // Del Excel
          stock: item.stock || 1, // Del Excel
          price: item.precio || 0, // Del Excel
          discogsId: String(item.discogsId), // ID de Discogs
          spotifyEnabled: true, // Habilitar reproductor de Spotify
          categories: categoryObj ? [categoryObj] : [], // Asignar categoría si existe
        };

        // Solo añadir spotifyAlbumId si existe
        if (spotifyAlbumId) {
          productData.spotifyAlbumId = spotifyAlbumId;
        }

        console.log('🔍 [Import] Product data before save:', {
          title: productData.title,
          format: productData.format,
          vinylSize: productData.vinylSize,
          hasVinylSize: 'vinylSize' in productData
        });

        const product = this.productsRepository.create(productData as any);

        const saved = await this.productsRepository.save(product);
        
        // Guardar relaciones de todos los formatos detectados
        await this.saveProductRelations(saved as any as Product, normalizedFormats);
        
        // Guardar relaciones de ediciones detectadas
        const normalizedEditions = this.normalizeEditions(productData.format || '');
        if (normalizedEditions.length > 0) {
          await this.saveProductEditionRelations(saved as any as Product, normalizedEditions);
          console.log(`✅ [ProductImport] Guardadas ${normalizedEditions.length} ediciones para producto ${(saved as any).id}`);
        }
        
        importedProducts.push(saved as any as Product);
      } catch (error) {
        console.error(`Error importing product ${item.discogsId}:`, error);
      }
    }

    return importedProducts;
  }

  private async getDiscogsRelease(token: string, releaseId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.discogs.com',
        path: `/releases/${releaseId}?token=${token}`,
        method: 'GET',
        headers: {
          'User-Agent': 'TiendasMusicApp/1.0',
          'Accept': 'application/json',
        },
      };

      console.log(`      🔍 Fetching Discogs release: ${releaseId}`);

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            console.log(`      📊 Response keys:`, Object.keys(json));
            console.log(`      🖼️ Images in response: ${json.images?.length || 0}`);
            if (json.master_id) {
              console.log(`      🎯 Has master_id: ${json.master_id}`);
            }
            resolve(json);
          } catch (error) {
            reject(new Error('Failed to parse Discogs response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  private async getDiscogsMaster(token: string, masterId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.discogs.com',
        path: `/masters/${masterId}?token=${token}`,
        method: 'GET',
        headers: {
          'User-Agent': 'TiendasMusicApp/1.0',
          'Accept': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(new Error('Failed to parse Discogs master response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Descarga imágenes desde Discogs y las sube a DigitalOcean Spaces
   * Público para ser usado por ProductsController
   */
  async downloadProductImages(images: any[], slug: string): Promise<string[]> {
    const uploadedImages: string[] = [];
    
    console.log(`      📸 Downloading images for ${slug}`);
    console.log(`         Total images available: ${images?.length || 0}`);
    
    if (!images || images.length === 0) {
      console.log(`         ⚠️ No images to download`);
      return uploadedImages;
    }

    for (let i = 0; i < Math.min(images.length, 6); i++) {
      try {
        const imageUrl = images[i].uri;
        console.log(`         🔄 Downloading image ${i + 1}: ${imageUrl}`);
        
        if (!imageUrl) {
          console.log(`         ⚠️ No URL for image ${i + 1}`);
          continue;
        }

        const urlObj = new URL(imageUrl);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        const fileName = `image-${i + 1}.jpg`;

        // Descargar imagen como buffer
        console.log(`         📥 Fetching image buffer...`);
        const buffer = await this.downloadFileToBuffer(protocol, imageUrl);
        console.log(`         ✓ Buffer downloaded: ${buffer.length} bytes`);
        
        // Crear objeto file-like para StorageService
        const file = {
          buffer,
          originalname: fileName,
          mimetype: 'image/jpeg',
        } as Express.Multer.File;

        // Subir usando StorageService (Spaces en producción, local en desarrollo)
        console.log(`         ☁️ Uploading to storage...`);
        const result = await this.storageService.uploadFile(file, `products/${slug}`);
        console.log(`         ✅ Image ${i + 1} uploaded: ${result.url}`);
        uploadedImages.push(result.url);
      } catch (error) {
        console.error(`         ❌ Error downloading image ${i + 1} from ${images[i]?.uri}:`, error.message);
        // Continuar con las siguientes imágenes si una falla
      }
    }

    console.log(`      📸 Total images uploaded: ${uploadedImages.length}`);
    return uploadedImages;
  }

  private downloadFileToBuffer(protocol: any, url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      const options = {
        timeout: 10000,
        headers: {
          'User-Agent': 'TiendasMusicApp/1.0',
        },
      };
      
      protocol.get(url, options, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  private async getSpotifyToken(clientId: string, clientSecret: string): Promise<string | null> {
    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        console.error('Failed to get Spotify token:', response.status);
        return null;
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting Spotify token:', error);
      return null;
    }
  }

  private async searchSpotify(albumTitle: string, artistName?: string, vendor?: any): Promise<string | null> {
    try {
      // Si el vendor no tiene credenciales de Spotify configuradas, retornar null
      if (!vendor?.spotifyClientId || !vendor?.spotifyClientSecret) {
        console.log('Spotify credentials not configured for vendor');
        return null;
      }

      // Obtener token de acceso
      const token = await this.getSpotifyToken(vendor.spotifyClientId, vendor.spotifyClientSecret);
      if (!token) {
        console.log('Failed to get Spotify access token');
        return null;
      }

      // Construir query de búsqueda
      const query = artistName ? `album:${albumTitle} artist:${artistName}` : `album:${albumTitle}`;
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Spotify search failed:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.albums?.items?.length > 0) {
        const album = data.albums.items[0];
        console.log(`✅ Found Spotify album: ${album.name} - ${album.id}`);
        return album.id;
      }

      console.log(`No Spotify album found for: ${albumTitle}`);
      return null;
    } catch (error) {
      console.error('Error searching Spotify:', error);
      return null;
    }
  }

  private normalizeShortDescriptionLabels(value: string): string {
    return value.replace(/(^|\n)(\s*)Se(?:ñ|n)o(\s*:)/gi, '$1$2Sello$3');
  }
  private buildDescription(release: any): string {
    let description = release.title;
    
    if (release.year) {
      description += ` (${release.year})`;
    }
    
    if (release.labels && release.labels.length > 0) {
      description += `\nSello: ${release.labels.map((l: any) => l.name).join(', ')}`;
    }
    
    if (release.genres && release.genres.length > 0) {
      description += `\nGénero: ${release.genres.join(', ')}`;
    }
    
    if (release.styles && release.styles.length > 0) {
      description += `\nEstilo: ${release.styles.join(', ')}`;
    }
    
    if (release.notes) {
      description += `\n\n${release.notes}`;
    }
    
    return description.trim();
  }

  private buildShortDescription(release: any, template?: string): string {
    console.log('🔍 buildShortDescription called with template:', template);
    console.log('🔍 template is truthy:', !!template);
    
    // Si hay template, usarlo
    if (template) {
      let result = template;
      
      // Reemplazar shortcodes con datos del release
      const replacements: Record<string, string> = {
        '[title]': release.title || '',
        '[artist]': release.artists?.map((a: any) => a.name).join(', ') || '',
        '[year]': release.year?.toString() || '',
        '[format]': release.formats?.map((f: any) => f.name).join(', ') || '',
        '[label]': release.labels?.[0]?.name || '',
        '[country]': release.country || '',
        '[genre]': release.genres?.join(', ') || '',
        '[style]': release.styles?.join(', ') || '',
        '[catalog]': release.labels?.[0]?.catno || '',
        '[barcode]': release.identifiers?.find((id: any) => id.type === 'Barcode')?.value || '',
        '[notes]': release.notes || '',
        '[released]': release.released || '',
        '[credits]': release.extraartists?.map((a: any) => `${a.name} (${a.role})`).join(', ') || '',
      };
      
      // Aplicar todos los reemplazos
      Object.entries(replacements).forEach(([shortcode, value]) => {
        result = result.replace(new RegExp(shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      });
      
      return this.normalizeShortDescriptionLabels(result.trim());
    }
    
    // Fallback: usar formato original
    const artists = release.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
    const year = release.year || 'Unknown Year';
    const formats = release.formats?.map((f: any) => f.name).join(', ') || 'Unknown Format';
    const label = release.labels?.[0]?.name || 'Unknown Label';
    
    return this.normalizeShortDescriptionLabels(`${artists} - ${release.title} (${year}) [${formats}] - ${label}`);
  }

  private getDiscogsReleaseMetadata(release: any) {
    const formats = release.formats || [];
    const descriptions = formats.flatMap((format: any) => format.descriptions || []);
    const normalizedDescriptions = descriptions.map((description: string) => description.toLocaleLowerCase('en-US'));
    const findDescription = (...patterns: RegExp[]) => descriptions.find((description: string) =>
      patterns.some(pattern => pattern.test(description)),
    );
    const albumType = findDescription(
      /^compilation$/i,
      /^mini-album$/i,
      /^maxi-single$/i,
      /^mixtape$/i,
      /^ep$/i,
      /^single$/i,
      /^album$/i,
    ) || null;
    const packageType = formats.map((format: any) => format.text?.trim()).find(Boolean) || null;
    const mediaQuantity = formats.reduce((total: number, format: any) => total + (Number(format.qty) || 1), 0) || null;
    const hasBonusTracks = (release.tracklist || []).some((track: any) => {
      const text = `${track.title || ''} ${track.position || ''}`;
      return track.type_ === 'heading' && /bonus|extra|hidden|unreleased/i.test(text);
    }) || normalizedDescriptions.some((description: string) => /bonus|extra tracks/i.test(description));
    const catalogNumber = release.labels?.find((label: any) => label.catno && label.catno.toLowerCase() !== 'none')?.catno || null;
    const versionDescriptions = descriptions.filter((description: string) =>
      /reissue|repress|remaster|limited edition|numbered|deluxe|promo|test pressing|stereo|mono|picture disc|colored|unofficial|bootleg/i.test(description),
    );
    const albumVersion = [...new Set(versionDescriptions)].join(', ') || null;
    const durations = (release.tracklist || [])
      .filter((track: any) => track.type_ !== 'heading')
      .map((track: any) => this.durationToSeconds(track.duration));
    const totalDurationMinutes = durations.length && durations.every((duration: number | null) => duration !== null)
      ? Math.ceil(durations.reduce((total: number, duration: number) => total + duration, 0) / 60)
      : null;
    const accessorySource = `${formats.map((format: any) => format.text || '').join(' ')} ${release.notes || ''}`;
    const accessories = [
      [/booklet/i, 'Booklet'],
      [/poster/i, 'Póster'],
      [/\binsert\b/i, 'Insert'],
      [/download code/i, 'Código de descarga'],
      [/\bobi\b/i, 'OBI'],
      [/sticker/i, 'Sticker'],
    ].filter(([pattern]) => (pattern as RegExp).test(accessorySource)).map(([, name]) => name as string);
    const includedAccessories = [...new Set(accessories)].join(', ') || null;

    return { albumType, packageType, mediaQuantity, hasBonusTracks, catalogNumber, albumVersion, totalDurationMinutes, includedAccessories };
  }

  private durationToSeconds(duration?: string): number | null {
    const match = duration?.trim().match(/^(\d+):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private buildTracklist(tracklist: any[]): string {
    if (!tracklist || tracklist.length === 0) return '';
    
    return tracklist.map((track) => {
      let trackStr = track.position ? `${track.position}. ` : '';
      trackStr += track.title;
      if (track.duration) {
        trackStr += ` (${track.duration})`;
      }
      return trackStr;
    }).join('\n');
  }

  private buildTechnicalSpecs(release: any): string {
    const specs: string[] = [];
    
    if (release.country) {
      specs.push(`País: ${release.country}`);
    }
    
    if (release.released) {
      specs.push(`Fecha de lanzamiento: ${release.released}`);
    }
    
    if (release.formats) {
      release.formats.forEach((f: any) => {
        if (f.text) specs.push(f.text);
      });
    }
    
    if (release.identifiers && release.identifiers.length > 0) {
      release.identifiers.forEach((id: any) => {
        specs.push(`${id.type}: ${id.value}`);
      });
    }
    
    return specs.join('\n');
  }

  // ==================== NUEVOS MÉTODOS PARA IMPORTACIÓN MASIVA ====================

  /**
   * Valida archivo de importación masiva
   * Lee CSV/Excel, busca en Discogs, valida categorías, precios y stock
   */
  async validateImport(
    vendorId: string,
    buffer: Buffer,
    filename: string,
    config: any,
  ): Promise<any> {
    console.log('🔍 [ValidateImport] Starting validation');
    console.log('   VendorId:', vendorId);
    console.log('   Filename:', filename);
    
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
    });

    console.log('   Vendor found:', vendor ? `${vendor.storeName} (${vendor.slug})` : 'NOT FOUND');

    if (!vendor) {
      throw new BadRequestException(`Vendor not found with ID: ${vendorId}`);
    }

    // Buscar token en vendor_settings
    const vendorSettings = await this.vendorSettingsRepository.findOne({
      where: { vendorId: vendor.id },
    });

    console.log('   VendorSettings found:', !!vendorSettings);
    console.log('   Has Discogs token:', !!vendorSettings?.discogsApiKey);

    if (!vendorSettings?.discogsApiKey) {
      throw new BadRequestException(
        `Vendor "${vendor.storeName}" (${vendor.slug}) does not have Discogs token configured. ` +
        `Please configure it in Dashboard → Settings → Integrations.`
      );
    }

    const discogsToken = vendorSettings.discogsApiKey;

    // Leer archivo (CSV o Excel)
    const data = this.parseImportFile(buffer, filename);

    // Validar estructura del archivo
    if (!data || data.length === 0) {
      throw new BadRequestException('File is empty or has invalid format');
    }

    // Obtener todas las categorías globales
    const globalCategories = await this.categoriesRepository.find();

    const categoryNames = globalCategories.map(c => c.name.toLowerCase());

    // Procesar cada fila
    const results: any[] = [];
    let rowNumber = 1; // Empezar desde 1 (excluyendo encabezado)

    for (const row of data) {
      rowNumber++;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Extraer datos de la fila
      const barcode = String(row['codigo_barras'] || row['Código de Barras'] || row['barcode'] || '').trim();
      const priceRetail = parseFloat(row['precio_detalle'] || row['Precio Detalle'] || row['price'] || '0');
      const priceWholesale = config.includeWholesalePrices 
        ? parseFloat(row['precio_mayorista'] || row['Precio Mayorista'] || row['wholesale'] || '0')
        : null;
      const category = String(row['categoria'] || row['Categoría'] || row['category'] || '').trim();
      const quantity = parseInt(row['cantidad'] || row['Cantidad'] || row['quantity'] || '0');

      // Verificar si el producto ya existe por código de barras
      let existingProduct: Product | null = null;
      if (barcode) {
        existingProduct = await this.productsRepository.findOne({
          where: { 
            barcode: barcode,
            vendor: { id: vendorId }
          }
        });

        if (existingProduct) {
          warnings.push(`Producto ya existe (ID: ${existingProduct.id}). Stock actual: ${existingProduct.stock}. Se actualizará sumando ${quantity} unidades (nuevo total: ${existingProduct.stock + quantity})`);
        }
      }

      // Validaciones bloqueantes
      if (!barcode) {
        errors.push('Código de barras vacío');
      }

      if (!category) {
        errors.push('Categoría vacía');
      } else if (!categoryNames.includes(category.toLowerCase())) {
        errors.push(`Categoría "${category}" no existe`);
      }

      if (!priceRetail || priceRetail <= 0) {
        errors.push('Precio detalle inválido o vacío');
      } else if (priceRetail < config.minimumPrice) {
        errors.push(`Precio ${priceRetail} es menor al mínimo ${config.minimumPrice}`);
      }

      if (config.includeWholesalePrices) {
        if (!priceWholesale || priceWholesale <= 0) {
          errors.push('Precio mayorista vacío (está habilitada la validación)');
        } else if (priceWholesale >= priceRetail) {
          errors.push(`Precio mayorista ${priceWholesale} debe ser menor a precio detalle ${priceRetail}`);
        } else if (priceWholesale < config.minimumPrice) {
          errors.push(`Precio mayorista ${priceWholesale} es menor al mínimo ${config.minimumPrice}`);
        }
      } else if (priceWholesale && priceWholesale > 0) {
        warnings.push('Tiene precio mayorista pero la validación está deshabilitada');
      }

      if (!quantity || quantity <= 0) {
        errors.push('Cantidad vacía o cero');
      }

      // Buscar en Discogs (solo si no hay errores bloqueantes críticos)
      let discogsMatch = null;
      if (barcode && errors.length === 0) {
        try {
          const searchResults = await this.searchInDiscogsByBarcode(discogsToken, barcode);
          if (searchResults && searchResults.length > 0) {
            // Usar el primer resultado (como la web de Discogs)
            discogsMatch = searchResults[0];
          } else if (!config.createIncomplete) {
            errors.push('No se encontró en Discogs (configurado para no crear incompletos)');
          } else {
            warnings.push('No se encontró en Discogs, se creará incompleto');
          }
        } catch (error) {
          console.error(`Error searching Discogs for ${barcode}:`, error);
          if (!config.createIncomplete) {
            errors.push('Error al buscar en Discogs (configurado para no crear incompletos)');
          } else {
            warnings.push('Error al buscar en Discogs, se creará incompleto');
          }
        }
      }

      // Determinar estado
      let status: 'ok' | 'warning' | 'error' = 'ok';
      if (errors.length > 0) {
        status = 'error';
      } else if (warnings.length > 0) {
        status = 'warning';
      }

      results.push({
        rowNumber,
        barcode,
        priceRetail,
        priceWholesale,
        category,
        quantity,
        status,
        errors,
        warnings,
        discogsMatch,
        existingProduct: existingProduct ? {
          id: existingProduct.id,
          title: existingProduct.title,
          currentStock: existingProduct.stock,
        } : null,
      });
    }

    // Calcular resumen
    const summary = {
      total: results.length,
      ok: results.filter(r => r.status === 'ok').length,
      warnings: results.filter(r => r.status === 'warning').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    return {
      valid: summary.errors === 0,
      products: results,
      summary,
    };
  }

  /**
   * Busca en Discogs por código de barras (usa el primer resultado, igual que la web)
   */
  private async searchInDiscogsByBarcode(token: string, barcode: string): Promise<any[]> {
    console.log(`      🔍 Searching Discogs for barcode: ${barcode}`);
    
    try {
      const results = await this.tryDiscogsSearch(token, barcode);
      
      if (results && results.length > 0) {
        console.log(`      ✓ Found ${results.length} result(s), using first one: ${results[0].title}`);
        return [results[0]]; // Solo devolver el primer resultado
      }
      
      console.log(`      ✗ No results found for barcode: ${barcode}`);
      return [];
    } catch (error) {
      // Specific handling for token format errors
      if (error.code === 'ERR_UNESCAPED_CHARACTERS') {
        console.error(`      ⚠️  ERROR: Token de Discogs mal formateado (contiene caracteres no válidos)`);
        console.error(`         Solución: Verifica que el token no tenga espacios, saltos de línea o caracteres especiales`);
        throw new Error('⚠️ Token de Discogs inválido: contiene caracteres no permitidos. Por favor, verifica la configuración en el panel de administración.');
      }
      // Re-throw other errors
      console.error(`Error searching Discogs for ${barcode}:`, error);
      throw error;
    }
  }

  private async tryDiscogsSearch(token: string, barcode: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Clean and encode token to avoid ERR_UNESCAPED_CHARACTERS errors
      const cleanToken = token.trim();
      const options = {
        hostname: 'api.discogs.com',
        path: `/database/search?barcode=${encodeURIComponent(barcode)}&token=${encodeURIComponent(cleanToken)}&per_page=1`,
        method: 'GET',
        headers: {
          'User-Agent': 'TiendasMusicApp/1.0',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            console.log(`      📊 Discogs API Response for barcode ${barcode}:`);
            console.log(`         - Total results: ${json.results?.length || 0}`);
            if (json.results && json.results.length > 0) {
              console.log(`         - First result ID: ${json.results[0].id}`);
              console.log(`         - First result Title: ${json.results[0].title}`);
              console.log(`         - First result Type: ${json.results[0].type}`);
              console.log(`         - First result Year: ${json.results[0].year || 'N/A'}`);
            }
            
            if (json.results && json.results.length > 0) {
              const results = json.results.slice(0, 1).map((item: any) => ({
                id: item.id,
                type: item.type, // Store type: 'master' or 'release'
                title: item.title,
                artist: item.title.split(' - ')[0] || 'Unknown',
                year: item.year,
                label: item.label?.[0] || 'Unknown',
                image: item.thumb || item.cover_image || '',
                formats: item.format || [],
              }));
              resolve(results);
            } else {
              resolve([]);
            }
          } catch (error) {
            reject(new Error('Failed to parse Discogs response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Ejecuta importación masiva (síncrona)
   */
  async executeBulkImport(
    vendorId: string,
    products: Array<{
      rowNumber: number;
      barcode: string;
      priceRetail: number;
      priceWholesale?: number;
      category: string;
      quantity: number;
      discogsMatch?: any;
    }>,
    config: any,
  ): Promise<any> {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new BadRequestException(`Vendor not found with ID: ${vendorId}`);
    }

    // Buscar token en vendor_settings
    const vendorSettings = await this.vendorSettingsRepository.findOne({
      where: { vendorId: vendor.id },
    });

    if (!vendorSettings?.discogsApiKey) {
      throw new BadRequestException(
        `Vendor "${vendor.storeName}" (${vendor.slug}) does not have Discogs token configured. ` +
        `Please configure it in Dashboard → Settings → Integrations.`
      );
    }

    const discogsToken = vendorSettings.discogsApiKey;

    console.log('🚀 [ExecuteBulkImport] Starting import');
    console.log('   Products to import:', products.length);
    console.log('   Config:', config);

    const imported: any[] = [];
    const failed: any[] = [];

    for (const item of products) {
      try {
        console.log(`   📦 Processing product ${item.rowNumber}: ${item.barcode}`);
        
        // Verificar si el producto ya existe
        const existingProduct = await this.productsRepository.findOne({
          where: { 
            barcode: item.barcode,
            vendor: { id: vendorId }
          }
        });

        if (existingProduct) {
          // ACTUALIZAR producto existente (sumar stock)
          console.log(`      ♻️ Product already exists: ${existingProduct.id} (${existingProduct.title})`);
          console.log(`      📊 Current stock: ${existingProduct.stock}, Adding: ${item.quantity}`);
          
          existingProduct.stock = existingProduct.stock + item.quantity;
          
          // Actualizar precios si son diferentes
          if (item.priceRetail !== existingProduct.price) {
            console.log(`      💰 Updating price: ${existingProduct.price} → ${item.priceRetail}`);
            existingProduct.price = Math.round(item.priceRetail);
          }
          
          if (item.priceWholesale && item.priceWholesale !== existingProduct.wholesalePrice) {
            console.log(`      💰 Updating wholesale price: ${existingProduct.wholesalePrice} → ${item.priceWholesale}`);
            existingProduct.wholesalePrice = Math.round(item.priceWholesale);
          }
          
          await this.productsRepository.save(existingProduct);
          console.log(`      ✅ Product updated. New stock: ${existingProduct.stock}`);
          
          imported.push({
            rowNumber: item.rowNumber,
            productId: existingProduct.id,
            title: existingProduct.title,
            updated: true,
            oldStock: existingProduct.stock - item.quantity,
            newStock: existingProduct.stock,
          });
          
          continue; // Pasar al siguiente producto
        }

        // Si no existe, crear nuevo producto
        let productData: any;
        let normalizedFormats: string[] = ['Otro']; // Declarar aquí para que esté disponible en todo el bloque
        let discogsFormatString: string = ''; // Para las ediciones

        if (item.discogsMatch) {
          console.log(`      ✓ Has Discogs match: ${item.discogsMatch.id} (type: ${item.discogsMatch.type || 'release'})`);
          console.log(`      📝 Match details from validation:`, {
            id: item.discogsMatch.id,
            type: item.discogsMatch.type,
            title: item.discogsMatch.title,
            artist: item.discogsMatch.artist,
          });
          // Obtener datos completos de Discogs usando el endpoint correcto según el tipo
          const isMaster = item.discogsMatch.type === 'master';
          const releaseData = isMaster 
            ? await this.getDiscogsMaster(discogsToken, String(item.discogsMatch.id))
            : await this.getDiscogsRelease(discogsToken, String(item.discogsMatch.id));
          console.log(`      📋 Release data received from Discogs:`);
          console.log(`         Title: ${releaseData.title}`);
          console.log(`         ID: ${releaseData.id}`);
          console.log(`         Images array length: ${releaseData.images?.length || 0}`);
          if (releaseData.images && releaseData.images.length > 0) {
            console.log(`         Images:`, releaseData.images.map((img: any, i: number) => `${i + 1}. ${img.type} - ${img.uri}`).join(', '));
          }

          // Si el release tiene pocas imágenes pero tiene master_id, obtener imágenes del master
          let imagesToDownload = releaseData.images || [];
          if (releaseData.master_id && imagesToDownload.length < 3) {
            console.log(`      🎯 Fetching images from Master Release: ${releaseData.master_id}`);
            try {
              const masterData = await this.getDiscogsMaster(discogsToken, String(releaseData.master_id));
              if (masterData.images && masterData.images.length > imagesToDownload.length) {
                console.log(`      ✨ Master has ${masterData.images.length} images (vs ${imagesToDownload.length} in release)`);
                imagesToDownload = masterData.images;
              }
            } catch (error) {
              console.log(`      ⚠️ Could not fetch master images, using release images`);
            }
          }
          
          // Obtener categoría
          const category = await this.categoriesRepository.findOne({
            where: { name: item.category, usesMusicMetadata: true },
          });

          // Generar slug único
          const baseSlug = releaseData.title
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '')
            .substring(0, 50);
          let slug = baseSlug;
          let counter = 1;
          while (await this.productsRepository.findOne({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }

          // Descargar imágenes (primeras 6)
          const localImages = await this.downloadProductImages(imagesToDownload, slug);

          // Buscar en Spotify
          let spotifyAlbumId: string | null = null;
          if (vendor.spotifyClientId && vendor.spotifyClientSecret) {
            try {
              spotifyAlbumId = await this.searchSpotify(
                releaseData.title, 
                releaseData.artists?.[0]?.name, 
                vendor
              );
            } catch (error) {
              console.error(`Error searching Spotify:`, error);
            }
          }

          // Construir título: Artista - Álbum
          const artist = releaseData.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
          const album = releaseData.title.includes(' - ') 
            ? releaseData.title.split(' - ').slice(1).join(' - ')
            : releaseData.title;
          const title = `${artist} - ${album}`;

          // Procesar formatos: normalizar y extraer tamaño de vinilo
          let vinylSize: string | null = null;
          const discogsMetadata = this.getDiscogsReleaseMetadata(releaseData);
          
          if (releaseData.formats && releaseData.formats.length > 0) {
            const formatString = releaseData.formats.map((f: any) => f.name).join(', ');
            discogsFormatString = formatString; // Guardar para las ediciones
            console.log('🔍 [Bulk Import] Format string:', formatString);
            normalizedFormats = this.normalizeFormats(formatString);
            console.log('🔍 [Bulk Import] Normalized formats:', normalizedFormats);
            
            // Si es vinilo, extraer el tamaño
            if (normalizedFormats.includes('Vinyl')) {
              vinylSize = this.extractVinylSize(formatString);
              console.log('🔍 [Bulk Import] Vinyl size:', vinylSize);
            }
          }

          productData = {
            vendor,
            slug,
            title,
            artist,
            album,
            label: releaseData.labels?.[0]?.name,
            year: releaseData.year,
            genre: releaseData.genres?.join(', '),
            format: normalizedFormats[0], // Formato principal
            vinylSize: vinylSize,
            country: releaseData.country,
            description: this.buildDescription(releaseData),
            shortDescription: this.buildShortDescription(releaseData, vendor.shortDescriptionTemplate),
            tracklist: this.buildTracklist(releaseData.tracklist),
            albumType: discogsMetadata.albumType,
            packageType: discogsMetadata.packageType,
            mediaQuantity: discogsMetadata.mediaQuantity,
            hasBonusTracks: discogsMetadata.hasBonusTracks,
            catalogNumber: discogsMetadata.catalogNumber,
            albumVersion: discogsMetadata.albumVersion,
            totalDurationMinutes: discogsMetadata.totalDurationMinutes,
            includedAccessories: discogsMetadata.includedAccessories,
            technicalSpecs: this.buildTechnicalSpecs(releaseData),
            images: localImages,
            sku: item.barcode.replace(/\s+/g, ''),
            barcode: item.barcode,
            condition: config.condition as any,
            mediaGrade: config.mediaGrade || null,
            sleeveGrade: config.sleeveGrade || null,
            stock: item.quantity,
            price: Math.round(item.priceRetail),
            wholesalePrice: item.priceWholesale ? Math.round(item.priceWholesale) : null,
            discogsId: String(item.discogsMatch.id),
            spotifyAlbumId: spotifyAlbumId,
            spotifyEnabled: !!spotifyAlbumId,
            categories: category ? [category] : [],
          };
        } else {
          // Crear producto incompleto (sin Discogs)
          const category = await this.categoriesRepository.findOne({
            where: { name: item.category, usesMusicMetadata: true },
          });

          const slug = `incomplete-${item.barcode}-${Date.now()}`;
          const title = `${item.barcode} (Incompleto)`;

          productData = {
            vendor,
            slug,
            title,
            description: 'Producto importado sin datos de Discogs. Complete manualmente.',
            shortDescription: 'Producto incompleto',
            sku: item.barcode.replace(/\s+/g, ''),
            barcode: item.barcode,
            condition: config.condition as any,
            mediaGrade: config.mediaGrade || null,
            sleeveGrade: config.sleeveGrade || null,
            stock: item.quantity,
            price: Math.round(item.priceRetail),
            wholesalePrice: item.priceWholesale ? Math.round(item.priceWholesale) : null,
            categories: category ? [category] : [],
            images: [],
          };
        }

        const product = this.productsRepository.create(productData);
        console.log(`      💾 Saving new product to database...`);
        const saved = await this.productsRepository.save(product) as unknown as Product;
        console.log(`      ✅ Product created: ${saved.id}`);
        
        // Guardar relaciones de todos los formatos detectados
        await this.saveProductRelations(saved, normalizedFormats);
        
        // Guardar relaciones de ediciones detectadas (solo si hay formato de Discogs)
        if (discogsFormatString) {
          const normalizedEditions = this.normalizeEditions(discogsFormatString);
          if (normalizedEditions.length > 0) {
            await this.saveProductEditionRelations(saved, normalizedEditions);
            console.log(`      ✅ Guardadas ${normalizedEditions.length} ediciones`);
          }
        }
        
        imported.push({
          rowNumber: item.rowNumber,
          productId: saved.id,
          title: saved.title,
          updated: false,
        });
      } catch (error) {
        console.error(`      ❌ Error importing row ${item.rowNumber}:`, error);
        console.error(`      Error details:`, error.message);
        console.error(`      Error stack:`, error.stack);
        failed.push({
          rowNumber: item.rowNumber,
          barcode: item.barcode,
          error: error.message || 'Unknown error',
        });
      }
    }

    console.log(`✅ [ExecuteBulkImport] Import complete`);
    console.log(`   Imported: ${imported.length}`);
    console.log(`   Failed: ${failed.length}`);

    return {
      success: true,
      imported: imported.length,
      failed: failed.length,
      details: {
        imported,
        failed,
      },
    };
  }

  /**
   * Genera plantilla Excel para importación
   */
  async generateTemplate(includeWholesale: boolean): Promise<Buffer> {
    const headers = includeWholesale
      ? ['codigo_barras', 'precio_detalle', 'precio_mayorista', 'categoria', 'cantidad']
      : ['codigo_barras', 'precio_detalle', 'categoria', 'cantidad'];

    const exampleData = includeWholesale
      ? [
          ['123456789012', 15000, 12000, 'CD', 5],
          ['987654321098', 25000, 20000, 'Vinilo', 3],
        ]
      : [
          ['123456789012', 15000, 'CD', 5],
          ['987654321098', 25000, 'Vinilo', 3],
        ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Parse archivo CSV o Excel
   */
  private parseImportFile(buffer: Buffer, filename: string): any[] {
    try {
      if (filename.endsWith('.csv')) {
        // Parse CSV con punto y coma como separador
        const workbook = XLSX.read(buffer, { type: 'buffer', FS: ';' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(worksheet);
      } else {
        // Parse Excel
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(worksheet);
      }
    } catch (error) {
      throw new BadRequestException('Failed to parse file: ' + error.message);
    }
  }

  /**
   * Normaliza el formato de Discogs a uno de los formatos estándar
   * DEPRECATED: Usar normalizeFormats() para detectar múltiples formatos
   */
  private normalizeFormat(discogsFormat: string): string {
    const formats = this.normalizeFormats(discogsFormat);
    return formats.length > 0 ? formats[0] : 'Otro';
  }

  /**
   * Detecta TODOS los formatos presentes en el string de Discogs
   * Retorna array de formatos normalizados
   * Ej: "CD, Box Set, Album" → ["CD", "Box Set", "Album"]
   */
  private normalizeFormats(discogsFormat: string): string[] {
    if (!discogsFormat) return ['Otro'];
    
    const formatLower = discogsFormat.toLowerCase();
    const detectedFormats: string[] = [];
    
    // Detectar todos los formatos presentes (en orden de prioridad)
    if (formatLower.includes('vinyl')) {
      detectedFormats.push('Vinyl');
    }
    
    if (formatLower.includes('cd') && !formatLower.includes('sacd')) {
      detectedFormats.push('CD');
    }
    
    if (formatLower.includes('cassette')) {
      detectedFormats.push('Cassette');
    }
    
    if (formatLower.includes('dvd') || formatLower.includes('hd dvd')) {
      detectedFormats.push('DVD');
    }
    
    if (formatLower.includes('blu-ray') || formatLower.includes('bluray')) {
      detectedFormats.push('Blu-ray');
    }
    
    if (formatLower.includes('box set')) {
      detectedFormats.push('Box Set');
    }
    
    if (formatLower.includes('track cartridge')) {
      detectedFormats.push('8-Track');
    }
    
    if (formatLower.includes('vhs')) {
      detectedFormats.push('VHS');
    }
    
    if (formatLower.includes('minidisc')) {
      detectedFormats.push('Minidisc');
    }
    
    if (formatLower.includes('file')) {
      detectedFormats.push('File');
    }
    
    if (formatLower.includes('sacd')) {
      detectedFormats.push('SACD');
    }
    
    if (formatLower.includes('album')) {
      detectedFormats.push('Album');
    }
    
    // Si no detectó ninguno, retornar 'Otro'
    return detectedFormats.length > 0 ? detectedFormats : ['Otro'];
  }

  /**
   * Extrae el tamaño del vinilo del formato de Discogs
   * Ej: "Vinyl, 7", Single, 45 RPM" → "7"
   */
  private extractVinylSize(discogsFormatString: string): string | null {
    if (!discogsFormatString) return null;
    
    const format = discogsFormatString.toLowerCase();
    
    // Detectar 7 pulgadas
    if (/7["']|7\s*inch/i.test(format)) {
      return '7';
    }
    
    // Detectar 10 pulgadas
    if (/10["']|10\s*inch/i.test(format)) {
      return '10';
    }
    
    // Detectar 12 pulgadas
    if (/12["']|12\s*inch/i.test(format)) {
      return '12';
    }
    
    // Detectar LP (Long Play)
    if (/\bLP\b/i.test(format)) {
      return 'LP';
    }
    
    return null;
  }

  /**
   * Normaliza ediciones desde el string de formato de Discogs
   * Extrae TODAS las ediciones presentes en el string
   * Ej: "Vinyl, 12", LP, Album, Limited Edition, Remastered, Stereo, Promo" 
   *     → ["Edición Limitada", "Remasterizada", "Stereo", "Promo"]
   */
  private normalizeEditions(format: string): string[] {
    if (!format) return [];
    
    const editions: string[] = [];
    
    // Edición Limitada (Ltd, Limited Edition)
    if (/\bLtd\b|\bLimited\s+Edition\b/i.test(format)) {
      editions.push('Edición Limitada');
    }
    
    // Edición Numerada (Num, Numbered)
    if (/\bNum\b|\bNumbered\b/i.test(format)) {
      editions.push('Edición Numerada');
    }
    
    // Vinilo de Color / Picture Disc (Pic, Picture Disc, Colored)
    if (/\bPic\b|\bPicture\s+Disc\b|\bColored\b/i.test(format)) {
      editions.push('Vinilo de Color / Picture Disc');
    }
    
    // Remasterizada (RM, Remastered)
    if (/\bRM\b|\bRemastered\b/i.test(format)) {
      editions.push('Remasterizada');
    }
    
    // Reedición (RE, Reissue, Repress - RP)
    if (/\bRE\b|\bReissue\b|\bRP\b|\bRepress\b/i.test(format)) {
      editions.push('Reedición');
    }
    
    // Edición Deluxe (Dlx, Deluxe)
    if (/\bDlx\b|\bDeluxe\b/i.test(format)) {
      editions.push('Edición Deluxe');
    }
    
    // Promo
    if (/\bPromo\b/i.test(format)) {
      editions.push('Promo');
    }
    
    // Test Pressing (TP, Test Pressing)
    if (/\bTP\b|\bTest\s+Pressing\b/i.test(format)) {
      editions.push('Test Pressing');
    }
    
    // Compilación (Comp, Compilation)
    if (/\bComp\b|\bCompilation\b/i.test(format)) {
      editions.push('Compilación');
    }
    
    // Stereo
    if (/\bStereo\b/i.test(format)) {
      editions.push('Stereo');
    }
    
    // Mono
    if (/\bMono\b/i.test(format)) {
      editions.push('Mono');
    }
    
    // Unofficial Release (Unofficial, Bootleg)
    if (/\bUnofficial\b|\bBootleg\b/i.test(format)) {
      editions.push('Unofficial Release');
    }
    
    // Box Set (ya puede estar en formatos, pero también válido como edición)
    if (/\bBox\s+Set\b/i.test(format)) {
      editions.push('Box Set');
    }
    
    return editions;
  }

  /**
   * Guarda las relaciones de formato y género en las tablas de unión
   * Solo guarda los formatos normalizados que existen en la tabla formats
   * Acepta un array de formatos para crear múltiples relaciones
   */
  private async saveProductRelations(product: Product, normalizedFormats: string | string[]): Promise<void> {
    // Convertir a array si es string
    const formats = Array.isArray(normalizedFormats) ? normalizedFormats : [normalizedFormats];
    
    // Buscar todos los formatos normalizados en la tabla formats
    for (const formatName of formats) {
      if (!formatName) continue;
      
      const formatEntity = await this.formatsRepository.findOne({
        where: { name: formatName }
      });
      
      if (formatEntity) {
        // Crear la relación en product_formats si no existe
        const existingRelation = await this.productsRepository
          .createQueryBuilder()
          .relation(Product, 'formats')
          .of(product)
          .loadMany();
        
        const hasRelation = existingRelation.some((f: any) => f.id === formatEntity.id);
        
        if (!hasRelation) {
          await this.productsRepository
            .createQueryBuilder()
            .relation(Product, 'formats')
            .of(product)
            .add(formatEntity);
        }
      }
    }
  }

  /**
   * Guarda las relaciones de ediciones en la tabla product_editions
   * Solo guarda las ediciones normalizadas que existen en la tabla editions
   * Acepta un array de ediciones para crear múltiples relaciones
   */
  private async saveProductEditionRelations(product: Product, normalizedEditions: string[]): Promise<void> {
    if (!normalizedEditions || normalizedEditions.length === 0) return;
    
    // Buscar todas las ediciones normalizadas en la tabla editions
    for (const editionName of normalizedEditions) {
      if (!editionName) continue;
      
      const editionEntity = await this.editionsRepository.findOne({
        where: { name: editionName }
      });
      
      if (editionEntity) {
        // Crear la relación en product_editions si no existe
        const existingRelation = await this.productsRepository
          .createQueryBuilder()
          .relation(Product, 'editions')
          .of(product)
          .loadMany();
        
        const hasRelation = existingRelation.some((e: any) => e.id === editionEntity.id);
        
        if (!hasRelation) {
          await this.productsRepository
            .createQueryBuilder()
            .relation(Product, 'editions')
            .of(product)
            .add(editionEntity);
        }
      } else {
        console.log(`⚠️ [ProductImport] Edición no encontrada en BD (se omite): ${editionName}`);
      }
    }
  }
}
