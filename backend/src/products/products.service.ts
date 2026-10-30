import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, In } from 'typeorm';
import { Product, ProductStatus } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Category } from '../categories/category.entity';
import { GenresService } from '../genres/genres.service';
import { FormatsService } from '../formats/formats.service';
import { EditionsService } from '../editions/editions.service';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { Genre } from '../genres/genre.entity';
import { Format } from '../formats/format.entity';
import { Edition } from '../editions/edition.entity';
import { SkuGeneratorService } from '../sku-counters/sku-generator.service';
import { ProductSpotifyTrack } from './product-spotify-track.entity';
import { ProductSpotifySyncStatus } from './product-spotify-sync-status.entity';
import { StorageService } from '../storage/storage.service';
import { OrderItem } from '../orders/order-item.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { MercadoLibreService } from '../mercadolibre/mercadolibre.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(Genre)
    private genresRepository: Repository<Genre>,
    @InjectRepository(Format)
    private formatsRepository: Repository<Format>,
    @InjectRepository(Edition)
    private editionsRepository: Repository<Edition>,
    @InjectRepository(ProductSpotifyTrack)
    private productSpotifyTrackRepository: Repository<ProductSpotifyTrack>,
    @InjectRepository(ProductSpotifySyncStatus)
    private productSpotifySyncStatusRepository: Repository<ProductSpotifySyncStatus>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    private genresService: GenresService,
    private formatsService: FormatsService,
    private editionsService: EditionsService,
    private skuGeneratorService: SkuGeneratorService,
    private storageService: StorageService,
    @Inject(forwardRef(() => require('../woocommerce/woocommerce.service').WoocommerceService))
    private woocommerceService: any,
    @Optional()
    private mercadoLibreService?: MercadoLibreService,
    @Optional()
    private analyticsService?: AnalyticsService,
  ) {}

  async getVendorIdByUserId(userId: string): Promise<string | null> {
    const vendor = await this.vendorsRepository.findOne({
      where: { user: { id: userId } },
    });
    return vendor?.id || null;
  }

  async findAll(filters?: {
    type?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    vendorId?: string;
    categoryId?: string;
    genreId?: string;
    formatId?: string;
    marketplaceOnly?: boolean;
    limit?: number;
    offset?: number;
    condition?: string;
    isFeatured?: boolean;
    isOnSale?: boolean;
    sortBy?: string;
    format?: string[];
    genre?: string[];
    mediaGrade?: string[];
    sleeveGrade?: string[];
    artist?: string;
    country?: string;
    barcode?: string;
    includeOutOfStock?: boolean;
  }) {
    console.log('🔍 ProductsService.findAll - filters:', JSON.stringify(filters, null, 2));
    const where: FindOptionsWhere<Product> = { status: ProductStatus.ACTIVE };

    if (filters?.type) {
      where.type = filters.type as any;
    }

    if (filters?.vendorId) {
      where.vendor = { id: filters.vendorId };
    }

    const query = this.productsRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.categories', 'categories')
      .leftJoinAndSelect('product.genres', 'genres')
      .leftJoinAndSelect('product.formats', 'formats')
      .leftJoinAndSelect('product.editions', 'editions')
      .leftJoin('vendor.settings', 'settings')
      .where('product.status = :status', { status: ProductStatus.ACTIVE });

    if (!filters?.includeOutOfStock) {
      query.andWhere('product.stock > 0');
    }

    if (filters?.type) {
      query.andWhere('product.type = :type', { type: filters.type });
    }

    if (filters?.search) {
      query.andWhere(
        '(product.title LIKE :search OR product.artist LIKE :search OR product.album LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    if (filters?.minPrice) {
      query.andWhere('product.price >= :minPrice', { minPrice: filters.minPrice });
    }

    if (filters?.maxPrice) {
      query.andWhere('product.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }

    if (filters?.vendorId) {
      query.andWhere('vendor.id = :vendorId', { vendorId: filters.vendorId });
    }

    if (filters?.categoryId) {
      query.andWhere('categories.id = :categoryId', { categoryId: filters.categoryId });
    }

    if (filters?.genreId) {
      query.andWhere('genres.id = :genreId', { genreId: filters.genreId });
    }

    if (filters?.formatId) {
      query.andWhere('formats.id = :formatId', { formatId: filters.formatId });
    }

    // Catálogo: Filtro por formato (IDs de la relación)
    if (filters?.format && filters.format.length > 0) {
      query.andWhere('formats.id IN (:...formatIds)', { formatIds: filters.format });
    }

    // Catálogo: Filtro por género (IDs de la relación)
    if (filters?.genre && filters.genre.length > 0) {
      query.andWhere('genres.id IN (:...genreIds)', { genreIds: filters.genre });
    }

    // Catálogo: Filtro por estado del disco
    if (filters?.mediaGrade && filters.mediaGrade.length > 0) {
      query.andWhere('product.mediaGrade IN (:...mediaGrades)', { mediaGrades: filters.mediaGrade });
    }

    // Catálogo: Filtro por estado de la funda
    if (filters?.sleeveGrade && filters.sleeveGrade.length > 0) {
      query.andWhere('product.sleeveGrade IN (:...sleeveGrades)', { sleeveGrades: filters.sleeveGrade });
    }

    // Catálogo: Filtro por artista
    if (filters?.artist) {
      query.andWhere('product.artist LIKE :artist', { artist: `%${filters.artist}%` });
    }

    // Filtro por código de barras
    if (filters?.country) {
      query.andWhere('product.country LIKE :country', { country: `%${filters.country}%` });
    }

    if (filters?.barcode) {
      query.andWhere('product.barcode = :barcode', { barcode: filters.barcode });
    }

    if (filters?.marketplaceOnly) {
      query.andWhere('settings.publishInMarketplace = :publishInMarketplace', { publishInMarketplace: true });
    }

    // ← NUEVO: Filtro por condición (new/used)
    if (filters?.condition) {
      console.log('🔍 [ProductsService] Applying condition filter:', filters.condition);
      query.andWhere('product.condition = :condition', { condition: filters.condition });
    }

    // ← NUEVO: Filtro por destacados
    if (filters?.isFeatured !== undefined) {
      console.log('🔍 [ProductsService] Applying isFeatured filter:', filters.isFeatured);
      query.andWhere('product.isFeatured = :isFeatured', { isFeatured: filters.isFeatured });
    }

    // ← NUEVO: Filtro por productos en oferta
    if (filters?.isOnSale !== undefined) {
      query.andWhere('product.isOnSale = :isOnSale', { isOnSale: filters.isOnSale });
    }

    if (filters?.limit) {
      query.take(filters.limit);
    }

    if (filters?.offset) {
      query.skip(filters.offset);
    }

    // ← NUEVO: Ordenamiento dinámico
    if (filters?.sortBy) {
      console.log('🔍 [ProductsService] Applying sortBy:', filters.sortBy);
      switch (filters.sortBy) {
        case 'price-asc':
          query.orderBy('product.price', 'ASC');
          break;
        case 'price-desc':
          query.orderBy('product.price', 'DESC');
          break;
        case 'oldest':
          query.orderBy('product.createdAt', 'ASC');
          query.addOrderBy('product.id', 'ASC');
          break;
        case 'newest':
        default:
          query.orderBy('product.createdAt', 'DESC');
          break;
      }
    } else {
      query.orderBy('product.createdAt', 'DESC');
    }

    const [products, total] = await query.getManyAndCount();

    // Map products to include category name and icon for grid display
    const mappedProducts = products.map(product => {
      const firstCategory = product.categories && product.categories.length > 0 
        ? product.categories[0] 
        : null;
      
      const categoryName = firstCategory?.name || null;
      let categoryIcon = firstCategory?.icon || null;
      
      // Si el icono es ? o null, usar emoji de fallback según categoría
      if (categoryName && (!categoryIcon || categoryIcon === '?')) {
        const categoryFallbacks: Record<string, string> = {
          'CDs': '💿',
          'Vinilos': '💿',
          'DVDs': '💽',
          'Cassettes': '📼',
          'VHS': '📼',
          'Blu-ray': '💿'
        };
        categoryIcon = categoryFallbacks[categoryName] || '🏷️';
      }
      
      console.log(`📦 Product "${product.title}" - Categories:`, product.categories?.map(c => c.name), '→ category:', categoryName, 'icon:', categoryIcon);
      
      return {
        ...product,
        category: categoryName,
        categoryIcon: categoryIcon
      };
    });

    return {
      products: mappedProducts,
      total,
      limit: filters?.limit || total,
      offset: filters?.offset || 0,
    };
  }

  async findOne(identifier: string) {
    const relations = ['vendor', 'vendor.user', 'categories', 'genres', 'formats', 'editions'];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const product = await this.productsRepository.findOne({
      where: isUuid ? [{ id: identifier }, { slug: identifier }] : { slug: identifier },
      relations,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(createProductDto: CreateProductDto, vendorId: string) {
    const baseSlug = this.generateSlug(createProductDto.title);
    const slug = await this.generateUniqueSlug(baseSlug);

    const categories = await this.getCategories(createProductDto.categoryIds);
    const usesMusicMetadata = this.categoriesUseMusicMetadata(categories);
    const productData: any = usesMusicMetadata
      ? { ...createProductDto }
      : this.clearMusicMetadata(createProductDto);

    // Generar SKU automático si no viene uno
    let sku = createProductDto.sku;
    if (!sku || sku.trim() === '') {
      sku = await this.skuGeneratorService.generateSku(vendorId, categories);
      console.log(`[ProductsService] Auto-generated SKU: ${sku}`);
    }

    // Manejar géneros y formatos
    let genres: any[] = [];
    let formats: any[] = [];
    let editions: any[] = [];

    // Si vienen como string separado por comas (legacy), convertir a array
    if (usesMusicMetadata && productData.genre && typeof productData.genre === 'string') {
      const genreNames = productData.genre.split(',').map((g: string) => g.trim());
      genres = await this.genresService.findOrCreateByNames(genreNames);
    }

    if (usesMusicMetadata && productData.format && typeof productData.format === 'string') {
      // Normalizar formatos de Discogs a las 13 categorías estándar
      const normalizedFormatNames = this.normalizeFormats(productData.format);
      formats = await this.formatsService.findOrCreateByNames(normalizedFormatNames);
      
      // AUTO-EXTRAER vinylSize si es vinilo
      if (normalizedFormatNames.includes('Vinyl')) {
        const extractedSize = this.extractVinylSize(productData.format);
        if (extractedSize && !productData.vinylSize) {
          productData.vinylSize = extractedSize;
          console.log('[ProductsService] Auto-extracted vinylSize on create:', extractedSize);
        }
      }
      
      // AUTO-EXTRAER ediciones del formato
      const normalizedEditionNames = this.normalizeEditions(productData.format);
      if (normalizedEditionNames.length > 0) {
        editions = await this.editionsService.findByNames(normalizedEditionNames);
        console.log('[ProductsService] Auto-extracted editions on create:', normalizedEditionNames);
      }
    }

    const product = this.productsRepository.create({
      ...productData,
      sku,
      slug,
      vendor: { id: vendorId },
      categories,
      genres,
      formats,
      editions,
    } as any) as unknown as Product;

    const savedProduct = await this.productsRepository.save(product);

    // Auto-sync to WooCommerce if enabled (async, non-blocking)
    this.autoSyncToWooCommerce(savedProduct.id, vendorId).catch(err => {
      console.error('[ProductsService] Auto-sync error on create:', err.message);
    });

    return savedProduct;
  }

  async update(id: string, updateProductDto: UpdateProductDto, userId: string, userRole: string) {
    try {
      console.log('[ProductsService] Updating product:', id);
      console.log('[ProductsService] Update data:', JSON.stringify(updateProductDto, null, 2));
      
      const product = await this.findOne(id);

      // Solo el vendedor dueño o admin puede editar
      if (userRole !== 'admin' && product.vendor.user.id !== userId) {
        throw new ForbiddenException('You can only edit your own products');
      }

      if (updateProductDto.title) {
        const baseSlug = this.generateSlug(updateProductDto.title);
        // Solo generar nuevo slug si es diferente al actual
        if (baseSlug !== product.slug) {
          product.slug = await this.generateUniqueSlug(baseSlug, product.id);
        }
      }

      if (updateProductDto.categoryIds) {
        product.categories = await this.getCategories(updateProductDto.categoryIds);
      }
      const usesMusicMetadata = this.categoriesUseMusicMetadata(product.categories || []);
      const updateData: any = usesMusicMetadata
        ? { ...updateProductDto }
        : this.clearMusicMetadata(updateProductDto);

      // Actualizar géneros si vienen
      if (usesMusicMetadata && updateData.genre && typeof updateData.genre === 'string') {
        try {
          const genreNames = updateData.genre
            .split(',')
            .map((g: string) => g.trim())
            .filter((g: string) => g.length > 0);
          
          const uniqueGenres = Array.from(new Set<string>(genreNames)); // Deduplicar
          
          console.log('[ProductsService] Updating genres:', uniqueGenres);
          product.genres = await this.genresService.findOrCreateByNames(uniqueGenres);
        } catch (genreError) {
          console.error('[ProductsService] Error updating genres:', genreError.message);
          // Continue without failing the whole update
        }
      }

      // Actualizar formatos si vienen
      if (usesMusicMetadata && updateData.format && typeof updateData.format === 'string') {
        try {
          // Normalizar formatos de Discogs a las 13 categorías estándar
          const normalizedFormatNames = this.normalizeFormats(updateData.format);
          
          console.log('[ProductsService] Updating formats:', normalizedFormatNames);
          product.formats = await this.formatsService.findOrCreateByNames(normalizedFormatNames);
          
          // AUTO-EXTRAER vinylSize si es vinilo
          if (normalizedFormatNames.includes('Vinyl')) {
            const extractedSize = this.extractVinylSize(updateData.format);
            if (extractedSize) {
              updateData.vinylSize = extractedSize;
              console.log('[ProductsService] Auto-extracted vinylSize:', extractedSize);
            }
          } else {
            // Si no es vinilo, limpiar vinylSize
            updateData.vinylSize = null;
          }
          
          // AUTO-EXTRAER ediciones del formato
          const normalizedEditionNames = this.normalizeEditions(updateData.format);
          if (normalizedEditionNames.length > 0) {
            product.editions = await this.editionsService.findByNames(normalizedEditionNames);
            console.log('[ProductsService] Auto-extracted editions on update:', normalizedEditionNames);
          } else {
            product.editions = [];
          }
        } catch (formatError) {
          console.error('[ProductsService] Error updating formats:', formatError.message);
          // Continue without failing the whole update
        }
      }

      if (!usesMusicMetadata) {
        product.genres = [];
        product.formats = [];
        product.editions = [];
      }

      Object.assign(product, updateData);

      const saved = await this.productsRepository.save(product);
      console.log('[ProductsService] Product updated successfully:', saved.id);

      // Auto-sync to WooCommerce if enabled (async, non-blocking)
      this.autoSyncToWooCommerce(saved.id, saved.vendor.id).catch(err => {
        console.error('[ProductsService] Auto-sync error on update:', err.message);
      });
      this.autoSyncToMercadoLibre(saved.id, saved.vendor.id).catch(err => {
        console.error('[ProductsService] Mercado Libre auto-sync error on update:', err.message);
      });

      return saved;
    } catch (error) {
      console.error('[ProductsService] Error updating product:', error.message);
      console.error('[ProductsService] Error stack:', error.stack);
      throw error;
    }
  }

  async bulkUpdate(
    vendorId: string,
    productIds: string[],
    updates: {
      status?: string;
      condition?: string;
      mediaGrade?: string;
      sleeveGrade?: string;
      stock?: number;
      categoryIds?: string[];
      formatName?: string;
    },
  ): Promise<{ updated: number; errors: number; syncedToWoo?: number }> {
    const results = { updated: 0, errors: 0, syncedToWoo: 0 };
    const productsToSync: string[] = [];
    const productsToSyncMercadoLibre: string[] = [];

    for (const productId of productIds) {
      try {
        const product = await this.productsRepository.findOne({
          where: { id: productId },
          relations: ['vendor', 'categories', 'formats'],
        });

        if (!product || product.vendor.id !== vendorId) {
          results.errors++;
          continue;
        }

        if (updates.status !== undefined) {
          product.status = updates.status as any;
          if (updates.status === ProductStatus.TRASH) {
            product.deletedAt = new Date();
          } else {
            (product as any).deletedAt = null;
          }
        }
        if (updates.condition !== undefined) {
          product.condition = updates.condition as any;
        }
        if (updates.mediaGrade !== undefined) {
          (product as any).mediaGrade = updates.mediaGrade || null;
        }
        if (updates.sleeveGrade !== undefined) {
          (product as any).sleeveGrade = updates.sleeveGrade || null;
        }
        if (updates.stock !== undefined) {
          product.stock = updates.stock;
        }
        if (updates.categoryIds !== undefined) {
          product.categories = await this.getCategories(updates.categoryIds);
        }
        if (updates.formatName) {
          const normalizedFormatNames = this.normalizeFormats(updates.formatName);
          product.formats = await this.formatsService.findOrCreateByNames(normalizedFormatNames);
        }

        await this.productsRepository.save(product);
        results.updated++;

        // Si el producto tiene woocommerceId, marcarlo para sincronización
        if (product.woocommerceId) {
          productsToSync.push(productId);
        }
        if (product.mercadoLibreItemId) {
          productsToSyncMercadoLibre.push(productId);
        }
      } catch (err) {
        console.error(`[ProductsService] bulkUpdate error for product ${productId}:`, err.message);
        results.errors++;
      }
    }

    // Sincronizar productos con WooCommerce si hay productos marcados
    if (productsToSync.length > 0 && this.woocommerceService) {
      console.log(`🔄 [BulkUpdate] Syncing ${productsToSync.length} products to WooCommerce (partial update)...`);
      
      // Procesar en lotes paralelos de 10 productos a la vez para evitar timeout
      const BATCH_SIZE = 10;
      for (let i = 0; i < productsToSync.length; i += BATCH_SIZE) {
        const batch = productsToSync.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(productsToSync.length / BATCH_SIZE);
        
        console.log(`📦 [BulkUpdate] Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)...`);
        
        // Procesar todos los productos del lote en paralelo
        const syncPromises = batch.map(async (productId) => {
          try {
            await this.woocommerceService.syncBulkFieldsToWooCommerce(productId, vendorId, updates);
            results.syncedToWoo++;
            console.log(`✅ [BulkUpdate] Synced product ${productId} to WooCommerce`);
          } catch (syncError) {
            console.error(`❌ [BulkUpdate] Failed to sync product ${productId} to WooCommerce:`, syncError.message);
            // No incrementar errors, ya que el producto se actualizó en MundoBeat
          }
        });
        
        // Esperar a que termine el lote completo antes de pasar al siguiente
        await Promise.all(syncPromises);
      }
      
      console.log(`✅ [BulkUpdate] WooCommerce sync completed: ${results.syncedToWoo}/${productsToSync.length}`);
    }

    if (productsToSyncMercadoLibre.length > 0 && this.mercadoLibreService) {
      const syncResults = await Promise.allSettled(
        productsToSyncMercadoLibre.map((productId) => this.autoSyncToMercadoLibre(productId, vendorId)),
      );
      syncResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(
            `[BulkUpdate] Mercado Libre sync failed for ${productsToSyncMercadoLibre[index]}:`,
            result.reason?.message || result.reason,
          );
        }
      });
    }

    return results;
  }

  async remove(id: string, userId: string, userRole: string) {
    const product = await this.findOne(id);

    // Solo el vendedor dueño o admin puede eliminar
    if (userRole !== 'admin' && product.vendor.user.id !== userId) {
      throw new ForbiddenException('You can only delete your own products');
    }

    // Si el producto ya está en papelera (TRASH), eliminar permanentemente
    if (product.status === ProductStatus.TRASH) {
      console.log(`🗑️ [Products] Permanently deleting product: ${product.title} (${id})`);

      const woocommerceDelete = await this.permanentlyDeleteProductFromWooCommerce(product);
      const mercadoLibreClose = await this.closeProductOnMercadoLibre(product);
      
      // Clean up Spotify data and remove from playlist
      await this.cleanupSpotifyDataForProduct(id, product.vendor?.id);

      // Preserve sold order snapshots while releasing the product foreign key.
      await this.deleteProductPreservingOrderHistory(product);
      
      console.log(`✅ [Products] Product permanently deleted: ${id}`);
      return { deleted: true, permanent: true, woocommerceDelete, mercadoLibreClose };
    }

    // Si el producto está activo, mover a papelera (soft delete)
    console.log(`📦 [Products] Moving to trash: ${product.title} (${id})`);

    const mercadoLibreClose = await this.closeProductOnMercadoLibre(product);
    
    // Mover localmente primero y luego llamar a WooCommerce de forma explicita.
    // Evita la sincronizacion antigua en segundo plano para no pisar la papelera.
    const updatedProduct = await this.updateStatus(id, ProductStatus.TRASH, userId, userRole, false);
    const woocommerceTrash = await this.moveProductToWooCommerceTrash(updatedProduct.id, product.vendor.id);
    
    console.log(`✅ [Products] Product moved to trash: ${id}`);
    return { deleted: true, permanent: false, product: updatedProduct, woocommerceTrash, mercadoLibreClose };
  }

  private async closeProductOnMercadoLibre(product: Product) {
    if (!product.mercadoLibreItemId || !this.mercadoLibreService) {
      return { success: true, skipped: true, message: 'Producto no publicado en Mercado Libre' };
    }

    const result = await this.mercadoLibreService.closePublishedProduct(product.id, product.vendor.id);
    product.mercadoLibreItemId = null as any;
    product.mercadoLibreUserProductId = null as any;
    product.mercadoLibreStatus = null as any;
    product.mercadoLibreStatusDetail = null as any;
    product.mercadoLibreStatusUpdatedAt = null as any;
    await this.productsRepository.save(product);
    return result;
  }

  private async deleteProductPreservingOrderHistory(product: Product): Promise<void> {
    await this.productsRepository.manager.transaction(async (manager) => {
      await manager.update(OrderItem, { productId: product.id }, { productId: null });
      await manager.remove(Product, product);
    });
  }

  async syncTrashToWooCommerce(vendorId: string, productIds?: string[]) {
    const query = this.productsRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .where('vendor.id = :vendorId', { vendorId })
      .andWhere('product.status = :status', { status: ProductStatus.TRASH })
      .andWhere('product.woocommerceId IS NOT NULL');

    if (productIds && productIds.length > 0) {
      query.andWhere('product.id IN (:...productIds)', { productIds });
    }

    const products = await query.getMany();
    const details: any[] = [];
    const batchSize = 5;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((product) => this.moveProductToWooCommerceTrash(product.id, vendorId)),
      );
      details.push(...batchResults);
    }

    const synced = details.filter((item) => item.success).length;
    const skipped = details.filter((item) => item.skipped).length;
    const failed = details.filter((item) => !item.success && !item.skipped).length;

    return {
      total: products.length,
      synced,
      skipped,
      failed,
      details,
      message: `WooCommerce: ${synced} sincronizado(s), ${skipped} omitido(s), ${failed} fallido(s)`,
    };
  }

  private async moveProductToWooCommerceTrash(productId: string, vendorId: string) {
    if (!this.woocommerceService?.moveProductToTrash) {
      return {
        success: false,
        skipped: true,
        productId,
        message: 'Servicio WooCommerce no disponible',
      };
    }

    return this.woocommerceService.moveProductToTrash(productId, vendorId);
  }

  private async permanentlyDeleteProductFromWooCommerce(product: Product) {
    if (!product.woocommerceId) {
      return {
        success: true,
        skipped: true,
        productId: product.id,
        message: 'Producto sin vínculo con WooCommerce',
      };
    }

    if (!this.woocommerceService?.permanentlyDeleteProduct) {
      throw new BadRequestException('No se pudo verificar la eliminación en WooCommerce. El producto permanece en la papelera.');
    }

    const result = await this.woocommerceService.permanentlyDeleteProduct(product.id, product.vendor.id);
    if (!result.success) {
      throw new BadRequestException(`${result.message}${result.error ? `: ${result.error}` : ''}`);
    }
    return result;
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    // Verificar si el slug ya existe (excluyendo el producto actual si se proporciona)
    while (true) {
      const existing = await this.productsRepository.findOne({ where: { slug } });
      
      // Si no existe o es el mismo producto, usar este slug
      if (!existing || (excludeId && existing.id === excludeId)) {
        break;
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async getCategories(categoryIds?: string[]): Promise<Category[]> {
    if (!categoryIds || categoryIds.length === 0) {
      return [];
    }

    return await this.categoriesRepository.findByIds(categoryIds);
  }

  private categoriesUseMusicMetadata(categories: Category[]): boolean {
    return categories.length === 0 || categories.some(category => category.usesMusicMetadata !== false);
  }

  private clearMusicMetadata<T extends Record<string, any>>(data: T): T {
    return {
      ...data,
      mediaGrade: null,
      sleeveGrade: null,
      artist: null,
      album: null,
      label: null,
      year: null,
      genre: null,
      format: null,
      vinylSize: null,
      country: null,
      tracklist: null,
      albumType: null,
      packageType: null,
      mediaQuantity: null,
      hasBonusTracks: false,
      catalogNumber: null,
      albumVersion: null,
      totalDurationMinutes: null,
      discogsId: null,
      spotifyAlbumId: null,
      spotifyEnabled: false,
    };
  }

  // ==================== GESTIÓN DE ESTADOS ====================

  /**
   * Obtiene productos del vendedor con filtro por estado
   * Para uso en panel de administración
   */
  async findByVendorAndStatus(
    vendorId: string,
    status?: ProductStatus[],
    filters?: {
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const query = this.productsRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.categories', 'categories')
      .where('vendor.id = :vendorId', { vendorId });

    // Si no se especifica status, traer solo active e inactive (excluir trash)
    if (status && status.length > 0) {
      query.andWhere('product.status IN (:...statuses)', { statuses: status });
    } else {
      query.andWhere('product.status IN (:...statuses)', { 
        statuses: [ProductStatus.ACTIVE, ProductStatus.INACTIVE] 
      });
    }

    if (filters?.search) {
      query.andWhere(
        '(product.title LIKE :search OR product.artist LIKE :search OR product.album LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    if (filters?.limit) {
      query.take(filters.limit);
    }

    if (filters?.offset) {
      query.skip(filters.offset);
    }

    query.orderBy('product.updatedAt', 'DESC');

    return await query.getManyAndCount();
  }

  /**
   * Obtiene productos en papelera del vendedor
   */
  async findTrashedByVendor(vendorId: string) {
    return await this.productsRepository.find({
      where: { 
        vendor: { id: vendorId },
        status: ProductStatus.TRASH 
      },
      relations: ['vendor', 'categories'],
      order: { deletedAt: 'DESC' },
    });
  }

  /**
   * Cambia el estado de un producto (active/inactive/trash)
   */
  async updateStatus(id: string, status: ProductStatus, userId: string, userRole: string, syncWooCommerce = true) {
    const product = await this.findOne(id);

    // Solo el vendedor dueño o admin puede cambiar estado
    if (userRole !== 'admin' && product.vendor.user.id !== userId) {
      throw new ForbiddenException('You can only change status of your own products');
    }

    product.status = status;
    
    // Si se mueve a papelera, registrar fecha
    if (status === ProductStatus.TRASH) {
      product.deletedAt = new Date();
    }
    
    // Si se restaura de papelera, limpiar fecha
    if (status !== ProductStatus.TRASH && product.deletedAt) {
      product.deletedAt = null as any;
    }

    const savedProduct = await this.productsRepository.save(product);

    // Auto-sync a WooCommerce si el producto está sincronizado (async, non-blocking)
    if (syncWooCommerce && savedProduct.woocommerceId) {
      this.autoSyncToWooCommerce(savedProduct.id, product.vendor.id).catch(err => {
        console.error(`⚠️ Failed to auto-sync status change to WooCommerce:`, err.message);
      });
    }

    return savedProduct;
  }

  /**
   * Restaura un producto de la papelera (lo pone en inactive)
   */
  async restoreFromTrash(id: string, userId: string, userRole: string) {
    return await this.updateStatus(id, ProductStatus.INACTIVE, userId, userRole);
  }

  /**
   * Elimina permanentemente un producto de la papelera
   */
  async permanentDelete(id: string, userId: string, userRole: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['vendor', 'vendor.user', 'orderItems'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Solo el vendedor dueño o admin puede eliminar
    if (userRole !== 'admin' && product.vendor.user.id !== userId) {
      throw new ForbiddenException('You can only delete your own products');
    }

    // Solo se puede eliminar permanentemente si está en papelera
    if (product.status !== ProductStatus.TRASH) {
      throw new ForbiddenException('Product must be in trash before permanent deletion');
    }

    const woocommerceDelete = await this.permanentlyDeleteProductFromWooCommerce(product);
    await this.closeProductOnMercadoLibre(product);

    // Eliminar imágenes de DigitalOcean Spaces antes de borrar el producto
    if (product.images && product.images.length > 0) {
      console.log(`🗑️  [ProductsService] Deleting ${product.images.length} images for product ${product.id}`);
      
      for (const imageUrl of product.images) {
        try {
          // Extraer el key de la URL
          // Ejemplos:
          // - http://localhost:3001/vendors/xxx/yyy.jpg → vendors/xxx/yyy.jpg
          // - http://localhost:3001/products/slug/image.jpg → products/slug/image.jpg
          // - /uploads/products/slug/image.jpg → products/slug/image.jpg
          
          let key: string | null = null;
          
          if (imageUrl.startsWith('http')) {
            // URL completa de Spaces
            const urlObj = new URL(imageUrl);
            // El key es el pathname sin el "/" inicial
            key = urlObj.pathname.substring(1);
          } else if (imageUrl.startsWith('/uploads/')) {
            // URL local relativa
            key = imageUrl.replace('/uploads/', '');
          }
          
          if (key) {
            console.log(`   Deleting image: ${key}`);
            await this.storageService.deleteFile(key);
          } else {
            console.warn(`   ⚠️  Could not extract key from URL: ${imageUrl}`);
          }
        } catch (error) {
          console.error(`   ❌ Error deleting image ${imageUrl}:`, error.message);
          // Continuar con las demás imágenes aunque una falle
        }
      }
      
      console.log(`✅ [ProductsService] Images deleted for product ${product.id}`);
    }

    // Clean up Spotify data before removing product
    await this.cleanupSpotifyDataForProduct(id, product.vendor?.id);

    await this.deleteProductPreservingOrderHistory(product);
    return { message: 'Product permanently deleted', woocommerceDelete };
  }

  /** Removes product tracks from Spotify playlist, then cleans DB records */
  async cleanupSpotifyDataForProduct(productId: string, vendorId?: string): Promise<void> {
    try {
      const tracks = await this.productSpotifyTrackRepository.find({ where: { productId } });

      if (tracks.length && vendorId) {
        // Load vendor OAuth credentials
        const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
        if (vendor?.spotifyPlaylistId && vendor?.spotifyRefreshToken && (vendor as any).spotifyClientId && (vendor as any).spotifyClientSecret) {
          try {
            // Get fresh access token
            const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${(vendor as any).spotifyClientId}:${(vendor as any).spotifyClientSecret}`).toString('base64'),
              },
              body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: vendor.spotifyRefreshToken }),
            });
            if (tokenRes.ok) {
              const { access_token } = await tokenRes.json();
              const uris = tracks.map(t => t.spotifyTrackUri);
              await fetch(`https://api.spotify.com/v1/playlists/${vendor.spotifyPlaylistId}/tracks`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ tracks: uris.map(uri => ({ uri })) }),
              });
              console.log(`🎵 [Products] Removed ${uris.length} tracks from Spotify playlist for product ${productId}`);
            }
          } catch (spotifyErr: any) {
            console.warn(`⚠️ [Products] Could not remove tracks from Spotify playlist: ${spotifyErr.message}`);
          }
        }
      }

      await this.productSpotifyTrackRepository.delete({ productId });
      await this.productSpotifySyncStatusRepository.delete({ productId });
    } catch (err: any) {
      console.warn(`⚠️ [Products] cleanupSpotifyDataForProduct error: ${err.message}`);
    }
  }

  /**
   * Limpia papelera (elimina productos en trash con más de X días)
   * Solo elimina productos SIN ventas asociadas
   */
  async emptyTrash(vendorId: string, daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Obtener productos en trash sin order_items asociados
    const productsToDelete = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoin('product.orderItems', 'orderItems')
      .where('product.vendorId = :vendorId', { vendorId })
      .andWhere('product.status = :status', { status: ProductStatus.TRASH })
      .andWhere('product.deletedAt <= :cutoffDate', { cutoffDate })
      .andWhere('orderItems.id IS NULL') // Solo productos sin ventas
      .getMany();

    // Obtener productos que NO se pueden eliminar (tienen ventas)
    const productsWithSales = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('product.orderItems', 'orderItems')
      .where('product.vendorId = :vendorId', { vendorId })
      .andWhere('product.status = :status', { status: ProductStatus.TRASH })
      .andWhere('product.deletedAt <= :cutoffDate', { cutoffDate })
      .andWhere('orderItems.id IS NOT NULL') // Con ventas
      .getCount();

    const deletableProducts: Product[] = [];
    let externalDeleteFailures = 0;
    for (const product of productsToDelete) {
      try {
        await this.permanentlyDeleteProductFromWooCommerce(product);
        if (product.mercadoLibreItemId && this.mercadoLibreService) {
          await this.mercadoLibreService.closePublishedProduct(product.id, vendorId);
        }
        deletableProducts.push(product);
      } catch (error: any) {
        externalDeleteFailures++;
        console.error(`[ProductsService] External deletion failed for ${product.id}:`, error.message);
      }
    }

    // Clean up Spotify data for all products being deleted
    if (deletableProducts.length > 0) {
      const ids = deletableProducts.map(p => p.id);
      await Promise.all(ids.map(id => this.cleanupSpotifyDataForProduct(id, vendorId)));
    }

    await this.productsRepository.remove(deletableProducts);

    const skipped = productsWithSales + externalDeleteFailures;

    return { 
      deleted: deletableProducts.length,
      skipped,
      message: skipped > 0
        ? `Se eliminaron ${deletableProducts.length} producto(s). ${skipped} permanecen en papelera por ventas asociadas o porque no se pudo cerrar su publicación externa.`
        : `Se eliminaron ${deletableProducts.length} producto(s) de la papelera.`,
    };
  }

  // ==================== MIGRATION METHODS ====================

  async migrateProductRelations() {
    const startTime = Date.now();
    const logs: string[] = [];
    
    logs.push('🚀 Iniciando migración de relaciones...');

    try {
      const products = await this.productsRepository.find({
        relations: ['genres', 'formats'],
      });

      logs.push(`📦 Productos encontrados: ${products.length}`);

      let processedCount = 0;
      let skippedCount = 0;
      const errors: any[] = [];

      for (const product of products) {
        try {
          let updated = false;

          // Procesar géneros
          if (product.genre && (!product.genres || product.genres.length === 0)) {
            const genreNames = product.genre.split(',').map(g => g.trim()).filter(g => g);
            const genreEntities: Genre[] = [];

            for (const genreName of genreNames) {
              // Buscar primero por nombre exacto para evitar duplicados
              let genre = await this.genresRepository.findOne({ where: { name: genreName } });
              
              if (!genre) {
                // Si no existe por nombre, buscar por slug
                const slug = this.createSlug(genreName);
                genre = await this.genresRepository.findOne({ where: { slug } });
                
                // Si tampoco existe por slug, crear nuevo
                if (!genre) {
                  genre = this.genresRepository.create({ name: genreName, slug });
                  genre = await this.genresRepository.save(genre);
                  logs.push(`  ✨ Género creado: ${genreName}`);
                }
              }

              genreEntities.push(genre);
            }

            product.genres = genreEntities;
            updated = true;
          }

          // Procesar formatos
          if (product.format && (!product.formats || product.formats.length === 0)) {
            const formatNames = product.format.split(',').map(f => f.trim()).filter(f => f);
            const formatEntities: Format[] = [];

            for (const formatName of formatNames) {
              // Buscar primero por nombre exacto para evitar duplicados
              let format = await this.formatsRepository.findOne({ where: { name: formatName } });
              
              if (!format) {
                // Si no existe por nombre, buscar por slug
                const slug = this.createSlug(formatName);
                format = await this.formatsRepository.findOne({ where: { slug } });
                
                // NO CREAR FORMATOS NUEVOS - Solo usar los 13 formatos normalizados existentes
                // Los formatos basura de Discogs NO deben guardarse
                if (!format) {
                  logs.push(`  ⚠️ Formato ignorado (no normalizado): ${formatName}`);
                  continue; // Saltar este formato
                }
              }

              formatEntities.push(format);
            }

            product.formats = formatEntities;
            updated = true;
          }

          if (updated) {
            await this.productsRepository.save(product);
            processedCount++;
          } else {
            skippedCount++;
          }

        } catch (error) {
          errors.push({ productId: product.id, error: error.message });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const genreCount = await this.genresRepository.count();
      const formatCount = await this.formatsRepository.count();

      return {
        success: true,
        duration: `${duration}s`,
        stats: {
          totalProducts: products.length,
          processed: processedCount,
          skipped: skippedCount,
          errors: errors.length,
          totalGenres: genreCount,
          totalFormats: formatCount,
        },
        errors: errors.length > 0 ? errors : undefined,
        logs,
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        logs,
      };
    }
  }

  async getMigrationStatus() {
    const totalProducts = await this.productsRepository.count();
    
    const productsWithGenres = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('product.genres', 'genre')
      .where('genre.id IS NOT NULL')
      .getCount();

    const productsWithFormats = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('product.formats', 'format')
      .where('format.id IS NOT NULL')
      .getCount();

    const totalGenres = await this.genresRepository.count();
    const totalFormats = await this.formatsRepository.count();

    const productsWithGenreString = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.genre IS NOT NULL')
      .andWhere('product.genre != ""')
      .getCount();

    const productsWithFormatString = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.format IS NOT NULL')
      .andWhere('product.format != ""')
      .getCount();

    const pendingGenreMigration = productsWithGenreString - productsWithGenres;
    const pendingFormatMigration = productsWithFormatString - productsWithFormats;

    return {
      totalProducts,
      genres: {
        totalGenresInDB: totalGenres,
        productsWithRelations: productsWithGenres,
        productsWithStringOnly: productsWithGenreString,
        pendingMigration: pendingGenreMigration > 0 ? pendingGenreMigration : 0,
      },
      formats: {
        totalFormatsInDB: totalFormats,
        productsWithRelations: productsWithFormats,
        productsWithStringOnly: productsWithFormatString,
        pendingMigration: pendingFormatMigration > 0 ? pendingFormatMigration : 0,
      },
      needsMigration: pendingGenreMigration > 0 || pendingFormatMigration > 0,
    };
  }

  /**
   * Normaliza formatos de Discogs a las 13 categorías estándar
   * Detecta TODOS los formatos presentes en un string
   * Ejemplo: "Vinyl, LP, Album" → ["Vinyl", "Album"]
   */
  private normalizeFormats(format: string): string[] {
    if (!format) return ['Otro'];
    
    const normalized: string[] = [];
    const formatLower = format.toLowerCase();
    
    // Orden de prioridad (detectar todos, no solo el primero)
    if (/vinyl/i.test(format)) normalized.push('Vinyl');
    if (/\bcd\b/i.test(format) && !/sacd/i.test(format)) normalized.push('CD');
    if (/cassette/i.test(format)) normalized.push('Cassette');
    if (/\bdvd\b/i.test(format)) normalized.push('DVD');
    if (/blu-?ray/i.test(format)) normalized.push('Blu-ray');
    if (/box set/i.test(format)) normalized.push('Box Set');
    if (/8-?track|track cartridge/i.test(format)) normalized.push('8-Track');
    if (/\bvhs\b/i.test(format)) normalized.push('VHS');
    if (/minidisc/i.test(format)) normalized.push('Minidisc');
    if (/\bfile\b/i.test(format)) normalized.push('File');
    if (/sacd/i.test(format)) normalized.push('SACD');
    
    // Album: SIEMPRE agregar si aparece en el string
    // Puede coexistir con Vinyl, CD, etc. (ej: "Vinyl, LP, Album" → ["Vinyl", "Album"])
    if (/\balbum\b/i.test(format)) {
      normalized.push('Album');
    }
    
    return normalized.length > 0 ? normalized : ['Otro'];
  }

  /**
   * Extrae el tamaño del vinilo del formato
   * Ej: "Vinyl (12", LP)" → "12"
   */
  private extractVinylSize(format: string): string | null {
    if (!format) return null;
    
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

  private createSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Auto-sincroniza un producto a WooCommerce si está habilitado
   * Se ejecuta de forma asíncrona sin bloquear la respuesta
   */
  private async autoSyncToWooCommerce(productId: string, vendorId: string): Promise<void> {
    try {
      // Cargar vendor con settings
      const vendor = await this.vendorsRepository.findOne({
        where: { id: vendorId },
        relations: ['settings'],
      });

      if (!vendor || !vendor.settings) {
        return;
      }

      // Verificar si auto-sync está habilitado
      if (!vendor.settings.wooAutoSync) {
        console.log('[ProductsService] Auto-sync disabled for vendor:', vendorId);
        return;
      }

      // Verificar que las credenciales estén configuradas
      if (!vendor.settings.wooStoreUrl || !vendor.settings.wooClientKey || !vendor.settings.wooClientSecret) {
        console.log('[ProductsService] WooCommerce not configured for vendor:', vendorId);
        return;
      }

      // Verificar que el producto exista y esté sincronizado con WooCommerce
      const product = await this.productsRepository.findOne({
        where: { id: productId },
      });

      if (!product) {
        console.log('[ProductsService] Product not found, skipping auto-sync:', productId);
        return;
      }

      // Solo auto-sincronizar si ya está sincronizado con WooCommerce
      if (!product.woocommerceId) {
        console.log('[ProductsService] Product not synced with WooCommerce, skipping auto-sync:', productId);
        return;
      }

      console.log('[ProductsService] Auto-syncing product to WooCommerce:', productId, '- Status:', product.status);

      // Llamar al servicio de WooCommerce para sincronizar
      await this.woocommerceService.syncProductToWooCommerce(productId, vendorId);

      console.log('[ProductsService] Auto-sync completed successfully:', productId);
    } catch (error) {
      // Log error but don't throw - auto-sync shouldn't break product creation/update
      console.error('[ProductsService] Auto-sync failed:', error.message);
    }
  }

  async syncInventoryStock(productId: string, vendorId: string): Promise<void> {
    await this.autoSyncToWooCommerce(productId, vendorId);
    await this.autoSyncToMercadoLibre(productId, vendorId);
  }

  private async autoSyncToMercadoLibre(productId: string, vendorId: string): Promise<void> {
    if (!this.mercadoLibreService) return;
    await this.mercadoLibreService.syncPublishedProduct(productId, vendorId);
  }

  /**
   * Exporta productos a Excel
   */
  async exportToExcel(vendorId: string, fields: string[], status?: string): Promise<Buffer> {
    // Construir condición de búsqueda
    const where: any = { vendor: { id: vendorId } };
    if (status === 'active') {
      where.status = ProductStatus.ACTIVE;
    } else if (status === 'inactive') {
      where.status = ProductStatus.INACTIVE;
    }
    // Si no viene status o es 'all', no filtra (trae todos excepto trash)
    if (!status || status === 'all') {
      where.status = In([ProductStatus.ACTIVE, ProductStatus.INACTIVE]);
    }

    const products = await this.productsRepository.find({
      where,
      relations: ['categories', 'genres', 'formats', 'editions'],
      order: { createdAt: 'DESC' },
    });

    // Preparar datos para Excel
    const data = products.map(product => {
      const row: any = {};

      fields.forEach(field => {
        switch (field) {
          case 'categories':
            row[field] = product.categories?.map(c => c.name).join(', ') || '';
            break;
          case 'genres':
            row[field] = product.genres?.map(g => g.name).join(', ') || '';
            break;
          case 'formats':
            row[field] = product.formats?.map(f => f.name).join(', ') || '';
            break;
          case 'editions':
            row[field] = product.editions?.map(e => e.name).join(', ') || '';
            break;
          case 'images':
            row[field] = Array.isArray(product.images) ? product.images.join(', ') : '';
            break;
          case 'createdAt':
          case 'updatedAt':
          case 'deletedAt':
          case 'descriptionGeneratedAt':
            row[field] = product[field] ? new Date(product[field]).toISOString() : '';
            break;
          case 'price':
          case 'salePrice':
          case 'wholesalePrice':
          case 'stock':
          case 'rating':
          case 'reviewCount':
          case 'year':
            // Convertir números a string para evitar problemas de formato
            row[field] = product[field] !== null && product[field] !== undefined ? product[field].toString() : '';
            break;
          case 'isOnSale':
          case 'isFeatured':
          case 'spotifyEnabled':
          case 'descriptionGeneratedByAI':
            // Convertir booleanos a Sí/No
            row[field] = product[field] ? 'Sí' : 'No';
            break;
          default:
            row[field] = product[field] !== null && product[field] !== undefined ? product[field].toString() : '';
            break;
        }
      });

      return row;
    });

    // Crear libro de trabajo
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

    // Generar buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer);
  }

  /**
   * Migra todas las imágenes de Discogs a DigitalOcean Spaces
   * @param dryRun Si es true, solo reporta qué se haría sin ejecutar cambios
   * @param vendorId Opcional, filtrar por vendedor específico
   * @returns Resumen de la migración
   */
  async migrateDiscogsImagesToSpaces(dryRun: boolean = false, vendorId?: string) {
    console.log(`\n🔄 [ProductsService] Starting Discogs images migration (dryRun: ${dryRun})`);
    
    const results = {
      migrated: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      details: [] as Array<{
        productId: string;
        title: string;
        slug: string;
        status: 'migrated' | 'failed' | 'skipped';
        message: string;
        oldImages?: string[];
        newImages?: string[];
      }>,
    };

    try {
      // Construir query base
      const queryBuilder = this.productsRepository.createQueryBuilder('product')
        .leftJoinAndSelect('product.vendor', 'vendor');

      // Filtrar por vendorId si se especifica
      if (vendorId) {
        queryBuilder.where('product.vendor.id = :vendorId', { vendorId });
      }

      // Buscar todos los productos con imágenes
      const products = await queryBuilder
        .andWhere('product.images IS NOT NULL')
        .andWhere("product.images != '{}'")
        .getMany();

      console.log(`   Found ${products.length} products with images`);
      results.total = products.length;

      // Inyectar ProductImportService dinámicamente para evitar dependencia circular
      const { ProductImportService } = require('../product-import/product-import.service');
      const productImportService = new ProductImportService(
        this.productsRepository,
        this.vendorsRepository,
        null, // VendorSettings no lo necesitamos
        this.categoriesRepository,
        this.formatsRepository,
        null, // Editions
        this.genresRepository,
        this.storageService,
      );

      // Procesar cada producto
      for (const product of products) {
        try {
          // Filtrar imágenes que vengan de Discogs
          const discogsImages = product.images.filter(img => 
            img.includes('discogs.com') || 
            img.includes('discogs-assets') ||
            img.includes('api-img.discogs')
          );

          if (discogsImages.length === 0) {
            console.log(`   ⏭️  Skipping product ${product.id} (${product.title}) - No Discogs images`);
            results.skipped++;
            results.details.push({
              productId: product.id,
              title: product.title,
              slug: product.slug,
              status: 'skipped',
              message: 'No Discogs images found',
              oldImages: product.images,
            });
            continue;
          }

          console.log(`   📸 Processing product ${product.id} (${product.title})`);
          console.log(`      Found ${discogsImages.length} Discogs images to migrate`);

          if (dryRun) {
            console.log(`      [DRY RUN] Would migrate: ${discogsImages.join(', ')}`);
            results.details.push({
              productId: product.id,
              title: product.title,
              slug: product.slug,
              status: 'skipped',
              message: `[DRY RUN] Would migrate ${discogsImages.length} images`,
              oldImages: discogsImages,
            });
            results.skipped++;
            continue;
          }

          // Preparar array de imágenes para download
          const imagesToDownload = discogsImages.map(url => ({ uri: url }));

          // Descargar y subir a Spaces
          const newImages = await productImportService.downloadProductImages(
            imagesToDownload,
            product.slug,
          );

          if (newImages.length === 0) {
            throw new Error('No images were downloaded');
          }

          console.log(`      ✅ Downloaded ${newImages.length} images`);

          // Actualizar producto: reemplazar imágenes de Discogs con las nuevas
          // Mantener otras imágenes que no sean de Discogs
          const otherImages = product.images.filter(img => !discogsImages.includes(img));
          product.images = [...newImages, ...otherImages];

          await this.productsRepository.save(product);

          console.log(`      ✅ Product ${product.id} migrated successfully`);
          results.migrated++;
          results.details.push({
            productId: product.id,
            title: product.title,
            slug: product.slug,
            status: 'migrated',
            message: `Migrated ${newImages.length} images successfully`,
            oldImages: discogsImages,
            newImages: newImages,
          });

        } catch (error) {
          console.error(`   ❌ Error migrating product ${product.id}:`, error.message);
          results.failed++;
          results.details.push({
            productId: product.id,
            title: product.title,
            slug: product.slug,
            status: 'failed',
            message: error.message || 'Unknown error',
            oldImages: product.images,
          });
        }
      }

      console.log(`\n✅ [ProductsService] Migration completed:`);
      console.log(`   Total: ${results.total}`);
      console.log(`   Migrated: ${results.migrated}`);
      console.log(`   Failed: ${results.failed}`);
      console.log(`   Skipped: ${results.skipped}`);

      return results;

    } catch (error) {
      console.error('❌ [ProductsService] Migration failed:', error);
      throw new BadRequestException(`Migration failed: ${error.message}`);
    }
  }

  // ==================== ESTADÍSTICAS DE PRODUCTO ====================

  async incrementViewCount(productId: string) {
    await this.productsRepository.increment({ id: productId }, 'viewCount', 1);
    return { success: true };
  }

  async incrementCartCount(productId: string) {
    await this.productsRepository.increment({ id: productId }, 'cartCount', 1);
    return { success: true };
  }

  async getVendorProductStats(vendorId: string) {
    // Todos los productos del vendor
    const products = await this.productsRepository.find({
      where: { vendor: { id: vendorId } },
      select: ['id', 'title', 'artist', 'price', 'salePrice', 'isOnSale', 'viewCount', 'cartCount', 'stock', 'images'],
    });

    // Ventas agrupadas por producto desde order_items
    const salesRaw = await this.orderItemsRepository
      .createQueryBuilder('oi')
      .select('oi.productId', 'productId')
      .addSelect('SUM(oi.quantity)', 'totalSold')
      .addSelect('SUM(oi.subtotal)', 'totalRevenue')
      .where('oi.vendorId = :vendorId', { vendorId })
      .groupBy('oi.productId')
      .getRawMany();

    const salesMap = new Map<string, { totalSold: number; totalRevenue: number }>();
    for (const row of salesRaw) {
      salesMap.set(row.productId, {
        totalSold: parseInt(row.totalSold) || 0,
        totalRevenue: parseFloat(row.totalRevenue) || 0,
      });
    }

    return products.map((p) => {
      const sales = salesMap.get(p.id) || { totalSold: 0, totalRevenue: 0 };
      const views = p.viewCount || 0;
      const conversionRate = views > 0 ? ((sales.totalSold / views) * 100).toFixed(1) : '0.0';
      return {
        id: p.id,
        title: p.title,
        artist: p.artist,
        image: Array.isArray(p.images) ? p.images[0] || null : null,
        price: p.isOnSale && p.salePrice ? p.salePrice : p.price,
        stock: p.stock,
        viewCount: views,
        cartCount: p.cartCount || 0,
        totalSold: sales.totalSold,
        totalRevenue: sales.totalRevenue,
        conversionRate,
      };
    });
  }

  /**
   * Obtiene estadísticas de tráfico del sitio del vendor
   * Incluye visitas, tráfico por fuente, regiones, dispositivos, etc.
   */
  async getVendorSiteStats(vendorId: string, days?: number, startDate?: string, endDate?: string) {
    try {
      // Usar AnalyticsService para obtener datos reales del sistema de tracking
      if (this.analyticsService) {
        try {
          const stats = await this.analyticsService.getTrafficStats(vendorId, days || 7, startDate, endDate);
          // Transformar formato para devolver estructura esperada
          return {
            totalVisits: stats.totalVisits,
            avgTimeOnSite: stats.avgTimeOnSite,
            bounceRate: stats.bounceRate,
            trafficBySource: stats.trafficBySource,
            visitsByRegion: stats.visitsByRegion,
            devices: stats.devices,
            browsers: stats.browsers,
            newVsReturning: stats.newVsReturning,
            dailySessions: stats.dailySessions,
            topPages: stats.topPages,
            conversionRate: stats.conversionRate,
            totalPurchases: stats.totalPurchases,
            totalRevenue: stats.totalRevenue,
          };
        } catch (analyticsError) {
          console.warn('Analytics data not available yet:', analyticsError.message);
        }
      }

      // Si no hay datos de analytics, retornar estructura vacía
      // (el sistema va a empezar a rellenar datos cuando comience el tracking)
      return {
        totalVisits: 0,
        avgTimeOnSite: 0,
        bounceRate: 0,
        trafficBySource: [],
        visitsByRegion: [],
        devices: [],
        browsers: [],
        newVsReturning: [],
        dailySessions: [],
        topPages: [],
        conversionRate: 0,
        totalPurchases: 0,
        totalRevenue: 0,
      };
    } catch (error) {
      console.error('Error fetching site stats:', error);
      // Retornar estructura vacía en caso de error
      return {
        totalVisits: 0,
        avgTimeOnSite: 0,
        bounceRate: 0,
        trafficBySource: [],
        visitsByRegion: [],
        devices: [],
        browsers: [],
        newVsReturning: [],
        dailySessions: [],
        topPages: [],
        conversionRate: 0,
        totalPurchases: 0,
        totalRevenue: 0,
      };
    }
  }
}
