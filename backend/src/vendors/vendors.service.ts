import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Vendor } from './vendor.entity';
import { VendorSettings } from './vendor-settings.entity';
import { VendorCategorySettings } from './vendor-category-settings.entity';
import { ApplicationStatus, VendorApplication } from './vendor-application.entity';
import { Category } from '../categories/category.entity';
import { User, UserRole } from '../users/user.entity';
import { Page } from '../pages/page.entity';
import { Product, ProductStatus } from '../products/product.entity';
import { ProductSpotifyTrack } from '../products/product-spotify-track.entity';
import { ProductSpotifySyncStatus } from '../products/product-spotify-sync-status.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { VendorShippingMethod } from '../shipping/vendor-shipping-method.entity';
import { CustomerProfile } from '../customers/customer-profile.entity';
import { MediaFile } from '../media/media-file.entity';
import { MediaFolder } from '../media/media-folder.entity';
import { PagesService } from '../pages/pages.service';
import { StorageService } from '../storage/storage.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { UpdateVendorSettingsDto } from './dto/vendor-settings.dto';
import { SmtpSettingsService } from '../marketplace/smtp-settings.service';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { promisify } from 'util';
import sharp from 'sharp';
import { normalizeWooCommerceStoreUrl } from '../common/integration-identity.util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const MARKETPLACE_VENDOR_ID = '00000000-0000-0000-0000-000000000001';

const buildDefaultPolicies = () => ({
  returnsPolicy: {
    version: 1,
    additionalConditions: '',
    withdrawalReturnPaidBy: 'buyer',
  },
});

interface ProductImageVariantMeta {
  originalUrl: string;
  large700Url: string;
  thumb300Url: string;
  width: number;
  height: number;
  format: string;
}

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(VendorSettings)
    private settingsRepository: Repository<VendorSettings>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(VendorCategorySettings)
    private vendorCategorySettingsRepository: Repository<VendorCategorySettings>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Page)
    private pagesRepository: Repository<Page>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(VendorShippingMethod)
    private vendorShippingMethodsRepository: Repository<VendorShippingMethod>,
    @InjectRepository(MediaFile)
    private mediaFilesRepository: Repository<MediaFile>,
    @InjectRepository(MediaFolder)
    private mediaFoldersRepository: Repository<MediaFolder>,
    @InjectRepository(CustomerProfile)
    private customerProfileRepository: Repository<CustomerProfile>,
    @InjectRepository(ProductSpotifyTrack)
    private productSpotifyTrackRepository: Repository<ProductSpotifyTrack>,
    @InjectRepository(ProductSpotifySyncStatus)
    private productSpotifySyncStatusRepository: Repository<ProductSpotifySyncStatus>,
    @InjectRepository(VendorApplication)
    private vendorApplicationsRepository: Repository<VendorApplication>,
    @Inject(forwardRef(() => PagesService))
    private pagesService: PagesService,
    @Inject(forwardRef(() => SmtpSettingsService))
    private smtpSettingsService: SmtpSettingsService,
    private emailTemplatesService: EmailTemplatesService,
    private emailService: EmailService,
    private storageService: StorageService,
  ) {}

  async findAll() {
    return await this.vendorsRepository.find({
      where: { isActive: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id },
      relations: ['user', 'products'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async findByUserId(userId: string) {
    return await this.vendorsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  async findBySlug(slug: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { slug, isActive: true },
      relations: ['user', 'settings'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async create(createVendorDto: CreateVendorDto, userId: string) {
    // Verificar si el usuario ya tiene una tienda
    const existingVendor = await this.findByUserId(userId);
    if (existingVendor) {
      throw new ConflictException('User already has a vendor account');
    }

    const slug = this.generateSlug(createVendorDto.storeName);

    // Template por defecto para descripción corta de productos
    const defaultShortDescriptionTemplate = `Titulo: [artist] - [title]
Formato: [format]
País: [country]
Año: [year]
Sello: [label]`;

    const vendor = this.vendorsRepository.create({
      ...createVendorDto,
      slug,
      shortDescriptionTemplate: defaultShortDescriptionTemplate,
      user: { id: userId },
    });

    const savedVendor = await this.vendorsRepository.save(vendor);

    // Actualizar el rol del usuario a VENDOR
    await this.usersRepository.update(userId, { role: UserRole.VENDOR });

    // Crear páginas predefinidas y agregarlas al menú footer
    await this.createDefaultPages(savedVendor.id, savedVendor.storeName);
    await this.ensureDefaultFooterLayoutForNewStore(savedVendor.id);

    return savedVendor;
  }

  async update(id: string, updateVendorDto: UpdateVendorDto, userId: string, userRole: string) {
    const vendor = await this.findOne(id);

    // Solo el vendedor dueño o admin pueden editar
    if (userRole !== 'admin' && vendor.user.id !== userId) {
      throw new ForbiddenException('You can only edit your own vendor account');
    }

    // Si se proporciona un slug manualmente, usarlo; si no, generar desde storeName
    if (updateVendorDto.slug) {
      vendor.slug = this.generateSlug(updateVendorDto.slug);
    } else if (updateVendorDto.storeName && !updateVendorDto.slug) {
      vendor.slug = this.generateSlug(updateVendorDto.storeName);
    }

    Object.assign(vendor, updateVendorDto);

    return await this.vendorsRepository.save(vendor);
  }

    async getBillingProfile(id: string, userId: string, userRole: string) {
      const vendor = await this.vendorsRepository
        .createQueryBuilder('vendor')
        .leftJoinAndSelect('vendor.user', 'user')
        .addSelect([
          'vendor.taxpayerType',
          'vendor.billingRut',
          'vendor.billingLegalName',
          'vendor.billingBusinessActivity',
          'vendor.billingAddress',
          'vendor.billingRegion',
          'vendor.billingCommune',
          'vendor.billingEmail',
        ])
        .where('vendor.id = :id', { id })
        .getOne();
      if (!vendor) throw new NotFoundException('Vendor not found');
      if (userRole !== 'admin' && vendor.user?.id !== userId) {
        throw new ForbiddenException('No puedes ver los datos de facturación de otra tienda');
      }
      const required = [
        vendor.taxpayerType,
        vendor.billingRut,
        vendor.billingLegalName,
        vendor.billingBusinessActivity,
        vendor.billingAddress,
        vendor.billingRegion,
        vendor.billingCommune,
        vendor.billingEmail,
      ];
      return {
        taxpayerType: vendor.taxpayerType || '',
        billingRut: vendor.billingRut || '',
        billingLegalName: vendor.billingLegalName || '',
        billingBusinessActivity: vendor.billingBusinessActivity || '',
        billingAddress: vendor.billingAddress || '',
        billingRegion: vendor.billingRegion || '',
        billingCommune: vendor.billingCommune || '',
        billingEmail: vendor.billingEmail || '',
        isComplete: required.every((value) => Boolean(value?.trim())),
      };
    }

    async updateBillingProfile(id: string, data: UpdateVendorDto, userId: string, userRole: string) {
      const vendor = await this.findOne(id);
      if (userRole !== 'admin' && vendor.user.id !== userId) {
        throw new ForbiddenException('No puedes editar los datos de facturación de otra tienda');
      }
      if (data.taxpayerType && !['natural', 'company'].includes(data.taxpayerType)) {
        throw new BadRequestException('Tipo de contribuyente inválido');
      }
      const fields: (keyof UpdateVendorDto)[] = [
        'taxpayerType', 'billingRut', 'billingLegalName', 'billingBusinessActivity',
        'billingAddress', 'billingRegion', 'billingCommune', 'billingEmail',
      ];
      for (const field of fields) {
        if (data[field] !== undefined) (vendor as any)[field] = String(data[field]).trim();
      }
      await this.vendorsRepository.save(vendor);
      return this.getBillingProfile(id, userId, userRole);
    }

  async remove(id: string) {
    try {
      console.log('🗑️ Starting vendor deletion process for ID:', id);
      const vendor = await this.findOne(id);
      console.log('✅ Vendor found:', vendor.slug);
      
      // Verificar dependencias antes de eliminar
      const ordersCount = await this.ordersRepository.count({ where: { vendorId: id } });
      const shippingMethodsCount = await this.vendorShippingMethodsRepository.count({ where: { vendorId: id } });
      const productsCount = await this.productsRepository.count({ where: { vendor: { id } } });
      const pagesCount = await this.pagesRepository.count({ where: { vendor: { id } } });
      const categorySettingsCount = await this.vendorCategorySettingsRepository.count({ where: { vendorId: id } });
      const settingsCount = await this.settingsRepository.count({ where: { vendor: { id } } });
      const usersCount = await this.usersRepository.count({ where: { vendor: { id } } });
      
      console.log('📊 Dependencies count:', {
        orders: ordersCount,
        shippingMethods: shippingMethodsCount,
        products: productsCount,
        pages: pagesCount,
        categorySettings: categorySettingsCount,
        settings: settingsCount,
        users: usersCount,
      });
      
      // Eliminar todas las relaciones en orden antes de eliminar el vendor
      
      // 1. Primero obtener todos los IDs de las órdenes del vendor
      const vendorOrders = await this.ordersRepository.find({ 
        where: { vendorId: id },
        select: ['id']
      });
      const orderIds = vendorOrders.map(order => order.id);
      console.log('📄 Found', orderIds.length, 'orders to delete');
      
      // 2. Eliminar order_items de esas órdenes
      if (orderIds.length > 0) {
        console.log('Deleting order items...');
        const orderItemsResult = await this.orderItemsRepository
          .createQueryBuilder()
          .delete()
          .where('orderId IN (:...orderIds)', { orderIds })
          .execute();
        console.log('✅ Order items deleted:', orderItemsResult.affected);
      }
      
      // 3. Ahora eliminar las órdenes del vendor
      console.log('Deleting orders...');
      const ordersResult = await this.ordersRepository.delete({ vendorId: id });
      console.log('✅ Orders deleted:', ordersResult.affected);
      
      // 4. Eliminar métodos de envío del vendor
      console.log('Deleting shipping methods...');
      const shippingResult = await this.vendorShippingMethodsRepository.delete({ vendorId: id });
      console.log('✅ Shipping methods deleted:', shippingResult.affected);
      
      // 5. Actualizar productId a NULL en order_items que referencian productos de este vendor
      // (para preservar historial de órdenes de otros vendors)
      console.log('Unlinking products from order items...');
      const productsToDelete = await this.productsRepository.find({
        where: { vendor: { id } },
        select: ['id']
      });
      const productIds = productsToDelete.map(p => p.id);
      if (productIds.length > 0) {
        await this.orderItemsRepository
          .createQueryBuilder()
          .update()
          .set({ productId: null })
          .where('productId IN (:...productIds)', { productIds })
          .execute();
        console.log('✅ Products unlinked from order items');
      }
      
      // 6. Eliminar archivos de media del vendor
      console.log('Deleting media files...');
      const mediaFilesResult = await this.mediaFilesRepository.delete({ vendorId: id });
      console.log('✅ Media files deleted:', mediaFilesResult.affected);
      
      // 7. Eliminar carpetas de media del vendor
      console.log('Deleting media folders...');
      const mediaFoldersResult = await this.mediaFoldersRepository.delete({ vendorId: id });
      console.log('✅ Media folders deleted:', mediaFoldersResult.affected);
      
      // 8. Eliminar datos Spotify de los productos del vendor (DB + playlist)
      if (productIds.length > 0) {
        // Gather all track URIs and remove from Spotify playlist first
        if (vendor.spotifyPlaylistId && vendor.spotifyRefreshToken) {
          try {
            const allTracks = await this.productSpotifyTrackRepository
              .createQueryBuilder('t')
              .where('t.product_id IN (:...productIds)', { productIds })
              .getMany();
            if (allTracks.length > 0) {
              const uris = allTracks.map(t => t.spotifyTrackUri);
              await this.removeTracksFromPlaylist(id, vendor.spotifyPlaylistId, uris);
              console.log(`✅ Removed ${uris.length} tracks from Spotify playlist`);
            }
          } catch (err: any) {
            console.warn(`⚠️ Could not remove tracks from Spotify playlist during vendor delete: ${err.message}`);
          }
        }
        await this.productSpotifyTrackRepository
          .createQueryBuilder()
          .delete()
          .where('product_id IN (:...productIds)', { productIds })
          .execute();
        await this.productSpotifySyncStatusRepository.delete({ vendorId: id });
        console.log('✅ Spotify track data deleted for vendor products');
      }

      // 9. Eliminar productos del vendor
      console.log('Deleting products...');
      const productsResult = await this.productsRepository.delete({ vendor: { id } });
      console.log('✅ Products deleted:', productsResult.affected);
      
      // 9. Eliminar páginas del vendor
      console.log('Deleting pages...');
      const pagesResult = await this.pagesRepository.delete({ vendor: { id } });
      console.log('✅ Pages deleted:', pagesResult.affected);
      
      // 10. Eliminar configuraciones de categorías del vendor
      console.log('Deleting category settings...');
      const categorySettingsResult = await this.vendorCategorySettingsRepository.delete({ vendorId: id });
      console.log('✅ Category settings deleted:', categorySettingsResult.affected);
      
      // 11. Eliminar configuraciones del vendor
      console.log('Deleting vendor settings...');
      const settingsResult = await this.settingsRepository.delete({ vendor: { id } });
      console.log('✅ Vendor settings deleted:', settingsResult.affected);
      
      // 12. Guardar referencia al usuario antes de eliminar vendor
      console.log('Saving user reference...');
      const userToDelete = vendor.user;
      const userId = userToDelete?.id;
      console.log('User ID to delete:', userId);
      
      // 13. Desvincular órdenes donde el vendor user sea el customer
      // (en caso de que el vendedor haya hecho pedidos como cliente)
      if (userId) {
        console.log('Unlinking orders where vendor user is customer...');
        await this.ordersRepository
          .createQueryBuilder()
          .update()
          .set({ customer: () => 'NULL' })
          .where('customerId = :userId', { userId })
          .execute();
        console.log('✅ Orders unlinked from user');
      }
      
      // 14. Eliminar el vendor (antes que el usuario, porque vendor tiene FK a user)
      console.log('Deleting vendor...');
      await this.vendorsRepository.remove(vendor);
      console.log('✅ Vendor deleted successfully');
      
      // 15. Eliminar CustomerProfile si existe
      if (userId) {
        console.log('Deleting customer profile if exists...');
        const customerProfile = await this.customerProfileRepository.findOne({ where: { userId } });
        if (customerProfile) {
          await this.customerProfileRepository.remove(customerProfile);
          console.log('✅ Customer profile deleted');
        } else {
          console.log('ℹ️ No customer profile found');
        }
      }
      
      // 16. Ahora eliminar el usuario asociado
      console.log('Deleting user...');
      if (userToDelete) {
        try {
          await this.usersRepository.remove(userToDelete);
          console.log('✅ User deleted successfully');
        } catch (error) {
          console.error('❌ Error deleting user:', error.message);
          console.error('This user may have remaining dependencies that need to be cleaned up');
          throw new BadRequestException(`Cannot delete user: ${error.message}`);
        }
      } else {
        console.log('⚠️ No user to delete');
      }
      
      return { message: 'Vendor deleted successfully' };
    } catch (error) {
      console.error('❌ Error deleting vendor:', error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  async checkDeletionDependencies(id: string) {
    try {
      const vendor = await this.findOne(id);
      
      const ordersCount = await this.ordersRepository.count({ where: { vendorId: id } });
      const shippingMethodsCount = await this.vendorShippingMethodsRepository.count({ where: { vendorId: id } });
      const productsCount = await this.productsRepository.count({ where: { vendor: { id } } });
      const pagesCount = await this.pagesRepository.count({ where: { vendor: { id } } });
      const categorySettingsCount = await this.vendorCategorySettingsRepository.count({ where: { vendorId: id } });
      const settingsCount = await this.settingsRepository.count({ where: { vendor: { id } } });
      const usersCount = await this.usersRepository.count({ where: { vendor: { id } } });
      
      return {
        vendor: {
          id: vendor.id,
          slug: vendor.slug,
          name: vendor.storeName,
        },
        dependencies: {
          orders: ordersCount,
          shippingMethods: shippingMethodsCount,
          products: productsCount,
          pages: pagesCount,
          categorySettings: categorySettingsCount,
          settings: settingsCount,
          users: usersCount,
        },
        total: ordersCount + shippingMethodsCount + productsCount + pagesCount + categorySettingsCount + settingsCount + usersCount,
      };
    } catch (error) {
      console.error('❌ Error checking deletion dependencies:', error);
      throw error;
    }
  }

  /**
   * Generate random password for new vendor
   */
  private generateRandomPassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    return password;
  }

  /**
   * Create vendor by admin with email and temporary password
   */
  async createByAdmin(createVendorDto: any) {
    const requestedFormats = String(createVendorDto.mainFormats || '').trim();
    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: createVendorDto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Generate temporary password
    const temporaryPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create user with temporary password
    const user = this.usersRepository.create({
      email: createVendorDto.email,
      password: hashedPassword,
      firstName: createVendorDto.storeName,
      lastName: '',
      role: UserRole.VENDOR,
      requirePasswordChange: true,
    });
    const savedUser = await this.usersRepository.save(user);

    // Generate slug
    const slug = createVendorDto.slug 
      ? this.generateSlug(createVendorDto.slug) 
      : this.generateSlug(createVendorDto.storeName);

    // Check if slug already exists
    const existingVendor = await this.vendorsRepository.findOne({ where: { slug } });
    if (existingVendor) {
      // Add random suffix to make it unique
      const randomSuffix = Math.floor(Math.random() * 1000);
      createVendorDto.slug = `${slug}-${randomSuffix}`;
    }

    // Create vendor
    const vendor = this.vendorsRepository.create({
      ...createVendorDto,
      slug: existingVendor ? `${slug}-${Math.floor(Math.random() * 1000)}` : slug,
      user: savedUser,
      isActive: createVendorDto.isActive !== undefined ? createVendorDto.isActive : true,
      // Envia.com siempre habilitado (es el único método de envío)
      enviaEnabled: true,
      enviaOriginName: createVendorDto.enviaOriginName || null,
      enviaOriginPhone: createVendorDto.enviaOriginPhone || null,
      enviaOriginStreet: createVendorDto.enviaOriginStreet || null,
      enviaOriginCity: createVendorDto.enviaOriginCity || null,
      enviaOriginState: createVendorDto.enviaOriginState || null,
      enviaOriginCountry: 'CL',
      enviaOriginPostalCode: createVendorDto.enviaOriginPostalCode || null,
      enviaOriginRegionId: createVendorDto.enviaOriginRegionId || null,
      enviaOriginCommuneId: createVendorDto.enviaOriginCommuneId || null,
      enviaEnabledCarriers: createVendorDto.enviaEnabledCarriers || ['chilexpress', 'correoschile', 'blueexpress', 'starken'],
    });
    const savedVendor = await this.vendorsRepository.save(vendor) as unknown as Vendor;
    
    console.log('✅ Vendor created with Envia.com always enabled:', {
      enviaEnabled: savedVendor.enviaEnabled,
      enviaOriginCity: savedVendor.enviaOriginCity,
      enviaOriginState: savedVendor.enviaOriginState,
      enviaOriginPostalCode: savedVendor.enviaOriginPostalCode,
    });

    // Create default vendor settings with Header Tipo 2
    const storeName = createVendorDto.storeName;
    const defaultSlides = this.buildDefaultSliderItems(storeName);

    const defaultSettings = this.settingsRepository.create({
      vendorId: savedVendor.id,
      headerType: 2, // Header Tipo 2 por defecto
      gridConfig: [],
      headerConfig: { logo: createVendorDto.logo || '' },
      banners: [],
      slides: [
        {
          id: `slider-${Date.now()}`,
          name: 'Slider Portada',
          showInHomepage: true,
          order: 0,
          items: defaultSlides,
        },
      ],
      menus: {},
      customMenus: {},
      footerConfig: { enabled: false, rows: [] },
      policies: buildDefaultPolicies(),
      onboardingCompleted: false,
    });
    await this.settingsRepository.save(defaultSettings);
    console.log('✅ Default vendor settings created with modern header, default slider, and empty design grids');

    const activeCategories = await this.activateInitialCategories(savedVendor, requestedFormats);

    // Crear páginas predefinidas y agregarlas al menú footer
    await this.createDefaultPages(savedVendor.id, savedVendor.storeName);
    await this.ensureDefaultFooterLayoutForNewStore(savedVendor.id);
    await this.addCategoriesToPrimaryMenu(savedVendor.id, activeCategories);

    // Crear 12 productos de ejemplo copiados de CDmania/marketplace con stock 0
    await this.createExampleProducts(savedVendor.id);

    // Send welcome email with credentials
    try {
      await this.sendVendorWelcomeEmail(
        savedVendor,
        createVendorDto.email,
        temporaryPassword,
      );
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't fail the vendor creation if email fails
    }

    return {
      ...savedVendor,
      temporaryPassword, // Return password so admin can see it
    };
  }

  private normalizeCategorySelection(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private async activateInitialCategories(vendor: Vendor, requestedFormats: string): Promise<Category[]> {
    try {
      const rootCategories = await this.categoriesRepository.find({
        where: { parentId: IsNull(), isActive: true },
        order: { name: 'ASC' },
      });

      if (rootCategories.length === 0) {
        console.warn('[VendorSetup] No hay categorías principales activas');
        return [];
      }

      const aliases: Record<string, string[]> = {
        vinilos: ['vinilo', 'vinilos', 'vinyl'],
        cds: ['cd', 'cds'],
        cassettes: ['cassette', 'cassettes', 'casete'],
        'blu ray': ['blu ray', 'bluray'],
        'ropa y coleccionables': ['merchandising', 'ropa y coleccionables'],
        merchandising: ['merchandising', 'ropa y coleccionables'],
        'equipos de audio': ['equipamiento', 'equipos de audio'],
        videojuegos: ['videojuegos', 'juegos de video'],
        'accesorios y cuidado': ['accesorios y cuidado'],
        otros: ['otros'],
      };
      const requestedAliases = requestedFormats
        .split(',')
        .map((item) => this.normalizeCategorySelection(item))
        .filter(Boolean)
        .flatMap((item) => aliases[item] || [item]);

      const selectedCategories = requestedAliases.length === 0
        ? rootCategories
        : rootCategories.filter((category) => {
            const values = [category.slug, category.name, category.format]
              .filter(Boolean)
              .map((value) => this.normalizeCategorySelection(String(value)));
            return requestedAliases.some((alias) => values.includes(alias));
          });

      vendor.categories = selectedCategories;
      await this.vendorsRepository.save(vendor);

      const categorySettings = selectedCategories.map((category, index) =>
        this.vendorCategorySettingsRepository.create({
          vendorId: vendor.id,
          categoryId: category.id,
          isActive: true,
          displayOrder: index,
        }),
      );
      if (categorySettings.length > 0) {
        await this.vendorCategorySettingsRepository.save(categorySettings);
      }

      console.log(`[VendorSetup] Categorías activadas: ${selectedCategories.map((category) => category.name).join(', ')}`);
      return selectedCategories;
    } catch (error) {
      console.error('[VendorSetup] No se pudieron activar las categorías iniciales:', error);
      return [];
    }
  }

  private async addCategoriesToPrimaryMenu(vendorId: string, categories: Category[]): Promise<void> {
    if (categories.length === 0) return;

    const settings = await this.settingsRepository.findOne({ where: { vendorId } });
    if (!settings) return;

    const customMenus = settings.customMenus && typeof settings.customMenus === 'object'
      ? settings.customMenus
      : {};
    const currentItems = Array.isArray(customMenus.principal?.items)
      ? customMenus.principal.items.filter((item: any) => item.linkType !== 'category')
      : [];
    const categoryItems = categories.map((category) => ({
      id: `principal-category-${category.slug}`,
      label: category.name,
      linkType: 'category',
      categoryId: category.id,
      categorySlug: category.slug,
      isVisible: true,
    }));

    settings.customMenus = {
      ...customMenus,
      principal: { ...(customMenus.principal || {}), items: [...currentItems, ...categoryItems] },
    };
    await this.settingsRepository.save(settings);
  }

  /**
   * Send welcome email to new vendor
   */
  private async sendVendorWelcomeEmail(
    vendor: Vendor,
    email: string,
    temporaryPassword: string,
  ) {
    // Get marketplace SMTP settings
    const smtpConfig = await this.smtpSettingsService.getSmtpConfig();
    if (!smtpConfig) {
      console.log('SMTP not configured, skipping welcome email');
      return;
    }

    // Get email template
    const template = await this.emailTemplatesService.findByKey('vendor_welcome');
    
    // Prepare template data
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const storeUrl = `${baseUrl.replace(/\/$/, '')}/tiendas/${vendor.slug}`;
    const loginUrl = `${baseUrl}/dashboard`;

    const templateData = {
      vendorName: vendor.storeName,
      storeUrl,
      loginUrl,
      email,
      temporaryPassword,
    };

    // Render template
    const renderedBody = await this.emailTemplatesService.sendPreview(template.id, templateData);
    const renderedSubject = this.renderTemplate(template.subject, templateData);

    // Send email
    const transporter = this.emailService.createTransporter(smtpConfig);
    await transporter.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to: email,
      subject: renderedSubject,
      html: renderedBody,
    });

    console.log(`Welcome email sent to ${email}`);
  }

  /**
   * Simple template renderer
   */
  private renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    return rendered;
  }

  async getVendorStats(vendorId: string, days = 30, startDate?: string, endDate?: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['products'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const totalProducts = vendor.products.length;
    const activeProducts = vendor.products.filter(p => p.status === 'active').length;
    const totalStock = vendor.products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const outOfStock = vendor.products.filter(p => Number(p.stock || 0) === 0).length;
    const lowStock = vendor.products.filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 3).length;

    const to = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();
    const from = startDate ? new Date(`${startDate}T00:00:00`) : new Date(to);
    if (!startDate) from.setDate(from.getDate() - Math.max(days - 1, 0));
    from.setHours(0, 0, 0, 0);
    const duration = Math.max(to.getTime() - from.getTime() + 1, 1);
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - duration + 1);

    const loadOrders = (rangeStart: Date, rangeEnd: Date, withItems = false) => {
      const query = this.ordersRepository.createQueryBuilder('order')
        .where('order.vendorId = :vendorId', { vendorId })
        .andWhere('order.createdAt BETWEEN :rangeStart AND :rangeEnd', { rangeStart, rangeEnd })
        .orderBy('order.createdAt', 'DESC');
      if (withItems) query.leftJoinAndSelect('order.items', 'items');
      return query.getMany();
    };
    const [orders, previousOrders] = await Promise.all([
      loadOrders(from, to, true),
      loadOrders(previousFrom, previousTo, true),
    ]);
    const revenueStatuses = new Set([OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]);
    const validOrders = orders.filter(order => revenueStatuses.has(order.status));
    const previousValidOrders = previousOrders.filter(order => revenueStatuses.has(order.status));
    const totalRevenue = validOrders.reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
    const previousRevenue = previousValidOrders.reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
    const unitsSold = validOrders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
    const previousUnits = previousValidOrders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
    const variation = (current: number, previous: number) => previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : current > 0 ? 100 : 0;

    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    for (const order of validOrders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(key) || { revenue: 0, orders: 0 };
      entry.revenue += Number(order.subtotal || 0);
      entry.orders += 1;
      dailyMap.set(key, entry);
    }
    const dailySales: Array<{ date: string; revenue: number; orders: number }> = [];
    for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      dailySales.push({ date, ...(dailyMap.get(date) || { revenue: 0, orders: 0 }) });
    }

    const channelMap = new Map<string, { orders: number; revenue: number }>();
    const statusCounts: Record<string, number> = {};
    for (const order of orders) statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    for (const order of validOrders) {
      const source = order.orderSource || 'direct_store';
      const entry = channelMap.get(source) || { orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += Number(order.subtotal || 0);
      channelMap.set(source, entry);
    }

    const productMap = new Map<string, { id: string; title: string; image: string | null; unitsSold: number; revenue: number }>();
    for (const order of validOrders) for (const item of order.items || []) {
      const key = item.productId || item.productTitle || item.id;
      const entry = productMap.get(key) || { id: item.productId || '', title: item.productTitle || 'Producto', image: item.productImage || null, unitsSold: 0, revenue: 0 };
      entry.unitsSold += Number(item.quantity || 0);
      entry.revenue += Number(item.subtotal || 0);
      productMap.set(key, entry);
    }
    const topProducts = [...productMap.values()].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    const pendingPreparation = orders.filter(order => order.status === OrderStatus.PAID || order.status === OrderStatus.PROCESSING).length;
    const paidWithoutLabel = orders.filter(order => (order.status === OrderStatus.PAID || order.status === OrderStatus.PROCESSING) && !order.trackingNumber && !order.enviaTrackingNumber && !order.senduTrackingUrl).length;

    return {
      totalProducts,
      activeProducts,
      totalStock,
      outOfStock,
      lowStock,
      rating: vendor.rating,
      period: { from: from.toISOString(), to: to.toISOString(), days },
      totalOrders: validOrders.length,
      totalRevenue,
      averageTicket: validOrders.length ? Math.round(totalRevenue / validOrders.length) : 0,
      unitsSold,
      comparison: {
        revenue: variation(totalRevenue, previousRevenue),
        orders: variation(validOrders.length, previousValidOrders.length),
        ticket: variation(validOrders.length ? totalRevenue / validOrders.length : 0, previousValidOrders.length ? previousRevenue / previousValidOrders.length : 0),
        units: variation(unitsSold, previousUnits),
      },
      dailySales,
      salesByChannel: [...channelMap.entries()].map(([source, values]) => ({ source, ...values })).sort((a, b) => b.revenue - a.revenue),
      ordersByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      recentOrders: orders.slice(0, 5).map(order => ({ id: order.id, orderNumber: order.orderNumber, customerName: order.shippingName, total: Number(order.total || 0), status: order.status, createdAt: order.createdAt })),
      topProducts,
      alerts: { outOfStock, lowStock, pendingPreparation, paidWithoutLabel },
    };
  }

  async getSettings(vendorId: string) {
    let settings = await this.settingsRepository.findOne({
      where: { vendorId },
    });

    if (!settings) {
      // Create default settings if they don't exist
      settings = this.settingsRepository.create({
        vendorId,
        headerType: 2,
        gridConfig: [],
        banners: [],
        slides: [],
        menus: {},
        customMenus: {},
        footerConfig: { enabled: false, rows: [] },
        policies: buildDefaultPolicies(),
      });
      await this.settingsRepository.save(settings);
    }

    // Migración automática: Agregar deviceVisibility a banners existentes
    if (settings.banners && Array.isArray(settings.banners)) {
      let needsUpdate = false;
      settings.banners = settings.banners.map((banner: any) => {
        if (!banner.deviceVisibility) {
          needsUpdate = true;
          return {
            ...banner,
            deviceVisibility: {
              mobile: true,
              tablet: true,
              desktop: true,
            },
          };
        }
        return banner;
      });

      // Guardar si hubo cambios
      if (needsUpdate) {
        await this.settingsRepository.save(settings);
      }
    }

    // Obtener campos adicionales del vendor
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      select: ['shortDescriptionTemplate', 'spotifyClientId', 'spotifyClientSecret', 'spotifyRefreshToken', 'spotifyUserId', 'spotifyPlaylistId', 'paykuNotifyUrl', 'paykuReturnUrl', 'paykuCancelUrl', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPassword', 'smtpFromEmail', 'smtpFromName'],
    });

    // 🔥 DEBUG: Log para ver el headerType
    console.log('🔥🔥🔥 SETTINGS - vendorId:', vendorId.substring(0, 8) + '... - headerType:', settings.headerType || 'undefined (default: 1)');

    return {
      ...settings,
      shortDescriptionTemplate: vendor?.shortDescriptionTemplate,
      spotifyClientId: vendor?.spotifyClientId,
      spotifyClientSecret: vendor?.spotifyClientSecret,
      spotifyRefreshToken: vendor?.spotifyRefreshToken,
      spotifyUserId: vendor?.spotifyUserId,
      spotifyPlaylistId: vendor?.spotifyPlaylistId,
      paykuNotifyUrl: vendor?.paykuNotifyUrl,
      paykuReturnUrl: vendor?.paykuReturnUrl,
      paykuCancelUrl: vendor?.paykuCancelUrl,
      smtpHost: vendor?.smtpHost,
      smtpPort: vendor?.smtpPort,
      smtpSecure: vendor?.smtpSecure,
      smtpUser: vendor?.smtpUser,
      smtpPassword: vendor?.smtpPassword,
      smtpFromEmail: vendor?.smtpFromEmail,
      smtpFromName: vendor?.smtpFromName,
    };
  }

  private normalizeReturnsPolicies(policies: any) {
    if (!policies || typeof policies !== 'object') {
      throw new BadRequestException('La configuración de políticas no es válida');
    }

    const additionalConditions = String(
      policies?.returnsPolicy?.additionalConditions || '',
    ).trim();

    if (additionalConditions.length > 4000) {
      throw new BadRequestException('Las condiciones adicionales no pueden superar los 4000 caracteres');
    }

    const normalizedText = additionalConditions
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const restrictedPatterns = [
      /no\s+(aceptamos|se aceptan|realizamos|hay)\s+(cambios|devoluciones|retractos)/,
      /sin\s+(cambios|devoluciones|garantia)/,
      /embalaje original.{0,30}(obligatorio|requisito|indispensable)/,
      /servicio tecnico.{0,40}(obligatorio|requisito|aprobacion previa)/,
      /solo\s+(se\s+)?(acepta|permite|ofrece)\s+(cambio|reparacion)/,
    ];

    if (restrictedPatterns.some((pattern) => pattern.test(normalizedText))) {
      throw new BadRequestException(
        'Las condiciones adicionales no pueden limitar el retracto ni la garantía legal',
      );
    }

    return {
      ...policies,
      returnsPolicy: {
        version: 1,
        additionalConditions,
        withdrawalReturnPaidBy: 'buyer',
      },
    };
  }

  async updateSettings(vendorId: string, updateSettingsDto: UpdateVendorSettingsDto, userId: string, userRole: string) {
    try {
      console.log('🔵 updateSettings called with:', {
        vendorId,
        discogsToken: updateSettingsDto.discogsToken,
        discogsApiKey: updateSettingsDto.discogsApiKey,
        hasToken: !!updateSettingsDto.discogsToken
      });

      const vendor = await this.findOne(vendorId);

      if (updateSettingsDto.policies !== undefined) {
        updateSettingsDto.policies = this.normalizeReturnsPolicies(updateSettingsDto.policies);
      }

      // Solo el vendedor dueño o admin pueden editar
      if (userRole !== 'admin' && vendor.user.id !== userId) {
        throw new ForbiddenException('You can only edit your own vendor settings');
      }

      const wooStore = await this.validateWooCommerceStoreConnection(vendorId, updateSettingsDto.wooStoreUrl);

      // Si se incluye discogsToken, guardarlo directamente en el vendor
      if (updateSettingsDto.discogsToken !== undefined) {
        console.log('✅ Saving discogsToken to vendor:', updateSettingsDto.discogsToken?.substring(0, 10) + '...');
        vendor.discogsToken = updateSettingsDto.discogsToken;
        await this.vendorsRepository.save(vendor);
        console.log('✅ Token saved successfully');
      } else {
        console.log('⚠️ No discogsToken in request');
      }

      let settings = await this.settingsRepository.findOne({
        where: { vendorId },
      });

      if (!settings) {
        settings = this.settingsRepository.create({
          vendorId,
          policies: buildDefaultPolicies(),
          ...updateSettingsDto,
        });
      } else {
        Object.assign(settings, updateSettingsDto);
      }

      if (wooStore) {
        settings.wooStoreUrl = wooStore.storeUrl || null as any;
        settings.wooStoreIdentity = wooStore.identity || null as any;
      }

      const saved = await this.settingsRepository.save(settings);
      console.log('Settings saved successfully:', saved.id);
      return saved;
    } catch (error) {
      console.error('Error in updateSettings:', error);
      throw error;
    }
  }

  async updateSettingsPublic(vendorId: string, updateSettingsDto: UpdateVendorSettingsDto) {
    try {
      console.log('💾 updateSettingsPublic called with:', updateSettingsDto);
      console.log('💾 shortDescriptionTemplate value:', (updateSettingsDto as any).shortDescriptionTemplate);
      console.log('🔍 customMenus value:', (updateSettingsDto as any).customMenus);
      console.log('🔍 menus value:', (updateSettingsDto as any).menus);

      if (updateSettingsDto.policies !== undefined) {
        updateSettingsDto.policies = this.normalizeReturnsPolicies(updateSettingsDto.policies);
      }

      const wooStore = await this.validateWooCommerceStoreConnection(vendorId, updateSettingsDto.wooStoreUrl);
      
      // Campos que van en Vendor en lugar de VendorSettings
      const vendorFields = ['shortDescriptionTemplate', 'spotifyClientId', 'spotifyClientSecret', 'spotifyRefreshToken', 'spotifyUserId', 'spotifyPlaylistId', 'paykuPublicToken', 'paykuNotifyUrl', 'paykuReturnUrl', 'paykuCancelUrl', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPassword', 'smtpFromEmail', 'smtpFromName'];
      const hasVendorFields = vendorFields.some(field => field in updateSettingsDto);
      
      // Si viene algún campo de vendor, actualizarlo
      if (hasVendorFields) {
        const vendor = await this.vendorsRepository.findOne({
          where: { id: vendorId },
        });
        
        if (vendor) {
          if ('shortDescriptionTemplate' in updateSettingsDto) {
            vendor.shortDescriptionTemplate = (updateSettingsDto as any).shortDescriptionTemplate;
            console.log('💾 Setting shortDescriptionTemplate to:', vendor.shortDescriptionTemplate);
          }
          if ('spotifyClientId' in updateSettingsDto) {
            vendor.spotifyClientId = (updateSettingsDto as any).spotifyClientId;
          }
          if ('spotifyClientSecret' in updateSettingsDto) {
            vendor.spotifyClientSecret = (updateSettingsDto as any).spotifyClientSecret;
          }
          if ('spotifyRefreshToken' in updateSettingsDto) {
            vendor.spotifyRefreshToken = (updateSettingsDto as any).spotifyRefreshToken;
          }
          if ('spotifyUserId' in updateSettingsDto) {
            vendor.spotifyUserId = (updateSettingsDto as any).spotifyUserId;
          }
          if ('spotifyPlaylistId' in updateSettingsDto) {
            vendor.spotifyPlaylistId = (updateSettingsDto as any).spotifyPlaylistId;
          }
          // Si se actualiza el paykuPublicToken, también actualizar paykuAffiliationToken en vendor
          if ('paykuPublicToken' in updateSettingsDto) {
            vendor.paykuAffiliationToken = (updateSettingsDto as any).paykuPublicToken;
            console.log('💾 Setting paykuAffiliationToken to:', vendor.paykuAffiliationToken?.substring(0, 10) + '...');
          }
          // URLs de Payku
          if ('paykuNotifyUrl' in updateSettingsDto) {
            vendor.paykuNotifyUrl = (updateSettingsDto as any).paykuNotifyUrl;
            console.log('💾 Setting paykuNotifyUrl to:', vendor.paykuNotifyUrl);
          }
          if ('paykuReturnUrl' in updateSettingsDto) {
            vendor.paykuReturnUrl = (updateSettingsDto as any).paykuReturnUrl;
            console.log('💾 Setting paykuReturnUrl to:', vendor.paykuReturnUrl);
          }
          if ('paykuCancelUrl' in updateSettingsDto) {
            vendor.paykuCancelUrl = (updateSettingsDto as any).paykuCancelUrl;
            console.log('💾 Setting paykuCancelUrl to:', vendor.paykuCancelUrl);
          }
          // SMTP Configuration
          if ('smtpHost' in updateSettingsDto) {
            vendor.smtpHost = (updateSettingsDto as any).smtpHost;
          }
          if ('smtpPort' in updateSettingsDto) {
            vendor.smtpPort = (updateSettingsDto as any).smtpPort;
          }
          if ('smtpSecure' in updateSettingsDto) {
            vendor.smtpSecure = (updateSettingsDto as any).smtpSecure;
          }
          if ('smtpUser' in updateSettingsDto) {
            vendor.smtpUser = (updateSettingsDto as any).smtpUser;
          }
          if ('smtpPassword' in updateSettingsDto) {
            vendor.smtpPassword = (updateSettingsDto as any).smtpPassword;
          }
          if ('smtpFromEmail' in updateSettingsDto) {
            vendor.smtpFromEmail = (updateSettingsDto as any).smtpFromEmail;
          }
          if ('smtpFromName' in updateSettingsDto) {
            vendor.smtpFromName = (updateSettingsDto as any).smtpFromName;
          }
          await this.vendorsRepository.save(vendor);
          console.log('✅ Vendor fields saved successfully');
        }
      }

      let settings = await this.settingsRepository.findOne({
        where: { vendorId },
      });

      if (!settings) {
        settings = this.settingsRepository.create({
          vendorId,
          policies: buildDefaultPolicies(),
          ...updateSettingsDto,
        });
      } else {
        Object.assign(settings, updateSettingsDto);
      }

      if (wooStore) {
        settings.wooStoreUrl = wooStore.storeUrl || null as any;
        settings.wooStoreIdentity = wooStore.identity || null as any;
      }

      const saved = await this.settingsRepository.save(settings);
      console.log('Settings saved successfully (public):', saved.id);
      return saved;
    } catch (error) {
      console.error('Error in updateSettingsPublic:', error);
      throw error;
    }
  }

  private async validateWooCommerceStoreConnection(vendorId: string, storeUrl: string | undefined) {
    if (storeUrl === undefined) return null;

    let normalized: { storeUrl: string; identity: string };
    try {
      normalized = normalizeWooCommerceStoreUrl(storeUrl);
    } catch (error: any) {
      throw new BadRequestException(error.message || 'La URL de WooCommerce no es válida');
    }

    if (!normalized.identity) return normalized;
    const existingConnection = await this.settingsRepository.findOne({
      where: { wooStoreIdentity: normalized.identity },
    });
    if (existingConnection && existingConnection.vendorId !== vendorId) {
      throw new ConflictException('Esta tienda WooCommerce ya está conectada a otra tienda de MundoBeat.');
    }
    return normalized;
  }

  private generateSlug(storeName: string): string {
    return storeName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** Crea 12 productos de ejemplo, priorizando CDmania, con stock 0. */
  private async createExampleProducts(vendorId: string): Promise<void> {
    try {
      console.log('🛍️ Creating example products for new vendor...');

      // Buscar productos activos de vendors que publican en marketplace
      const marketplaceProducts = await this.productsRepository
        .createQueryBuilder('product')
        .innerJoin('product.vendor', 'vendor')
        .innerJoin(VendorSettings, 'settings', 'settings.vendorId = vendor.id')
        .leftJoinAndSelect('product.categories', 'categories')
        .leftJoinAndSelect('product.genres', 'genres')
        .leftJoinAndSelect('product.formats', 'formats')
        .where('product.status = :status', { status: ProductStatus.ACTIVE })
        .andWhere('(vendor.slug = :exampleVendor OR settings.publishInMarketplace = :publish)', {
          exampleVendor: 'cdmania',
          publish: true,
        })
        .andWhere('product.images IS NOT NULL')
        .andWhere('vendor.id != :vendorId', { vendorId })
        .orderBy("CASE WHEN vendor.slug = 'cdmania' THEN 0 ELSE 1 END", 'ASC')
        .addOrderBy('RAND()')
        .take(12)
        .getMany();

      if (marketplaceProducts.length === 0) {
        console.warn('⚠️ No marketplace products found to clone as examples');
        return;
      }

      console.log(`📦 Found ${marketplaceProducts.length} products to clone`);

      for (const [index, source] of marketplaceProducts.entries()) {
        const baseSlug = source.slug + '-' + vendorId.substring(0, 8);
        // Asegurar slug único agregando timestamp
        const uniqueSlug = baseSlug + '-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

        const exampleProduct = this.productsRepository.create({
          title: source.title,
          slug: uniqueSlug,
          description: source.description || '',
          shortDescription: source.shortDescription || undefined,
          type: source.type,
          condition: source.condition,
          artist: source.artist,
          album: source.album,
          label: source.label,
          year: source.year,
          genre: source.genre,
          country: source.country,
          format: source.format,
          vinylSize: source.vinylSize,
          tracklist: source.tracklist,
          catalogNumber: source.catalogNumber,
          barcode: source.barcode,
          sku: `DEMO-${source.sku || source.catalogNumber || index + 1}-${vendorId.substring(0, 4)}`,
          price: source.price,
          salePrice: source.salePrice,
          isOnSale: source.isOnSale,
          stock: 0, // Stock 0 para que no se pueda comprar
          images: source.images,
          isFeatured: false,
          status: ProductStatus.ACTIVE,
          vendor: { id: vendorId } as any,
          categories: source.categories || [],
          genres: source.genres || [],
          formats: source.formats || [],
        });

        await this.productsRepository.save(exampleProduct);
      }

      console.log(`✅ Created ${marketplaceProducts.length} example products with stock 0`);
    } catch (error) {
      console.error('❌ Error creating example products:', error.message);
      // No fallar la creación del vendor si los productos de ejemplo fallan
    }
  }

  private buildDefaultSliderItems(storeName: string) {
    return [
      {
        id: `slide-${Date.now()}-1`,
        type: 'image',
        mediaType: 'image',
        imageUrl: '/images/default-home/hero-vinyl-discovery.webp',
        title: `Bienvenido a ${storeName}`,
        description: 'Descubre música y productos elegidos para tu colección',
        subtitle: 'Descubre música y productos elegidos para tu colección',
        buttonText: 'Ver Catálogo',
        buttonLink: '/catalogo',
        imageOpacity: 0.55,
        titleShadow: true,
        showInHomepage: true,
        order: 0,
      },
      {
        id: `slide-${Date.now()}-2`,
        type: 'image',
        mediaType: 'image',
        imageUrl: '/images/default-home/hero-new-arrivals.webp',
        title: 'Nuevos Ingresos',
        description: 'Revisa lo último que llegó en distintos formatos',
        subtitle: 'Revisa lo último que llegó en distintos formatos',
        buttonText: 'Ver Productos',
        buttonLink: '/catalogo',
        imageOpacity: 0.55,
        titleShadow: true,
        showInHomepage: true,
        order: 1,
      },
      {
        id: `slide-${Date.now()}-3`,
        type: 'image',
        mediaType: 'image',
        imageUrl: '/images/default-home/hero-protected-shipping.webp',
        title: 'Envío a todo Chile',
        description: 'Tus compras viajan protegidas hasta su destino',
        subtitle: 'Tus compras viajan protegidas hasta su destino',
        buttonText: 'Cómo Comprar',
        buttonLink: '/paginas/preguntas-frecuentes',
        imageOpacity: 0.55,
        titleShadow: true,
        showInHomepage: true,
        order: 2,
      },
    ];
  }

  private buildDefaultHomepageBlocks(storeName: string, sliderId: string) {
    const categoryBanners = [
      { title: 'Vinilos', slug: 'vinilo', imageUrl: 'http://localhost:3001/media/f904572c-e3d9-4792-8c6d-7eb2b3735973.png' },
      { title: 'CDs', slug: 'cd', imageUrl: 'http://localhost:3001/media/14b65ca9-993a-4e48-87c8-ca977a26d558.png' },
      { title: 'Cassettes', slug: 'cassette', imageUrl: 'http://localhost:3001/media/00640570-890e-4f54-9a47-541da9db4280.png' },
      { title: 'Ropa y coleccionables', slug: 'merchandising', imageUrl: 'http://localhost:3001/media/62a75bd4-c5c2-4a7b-a5bd-b5bb93468d7d.png' },
      { title: 'Equipos de audio', slug: 'equipamiento', imageUrl: '/images/default-home/hero-vinyl-discovery.webp' },
      { title: 'Videojuegos', slug: 'videojuegos', imageUrl: '/images/default-home/hero-new-arrivals.webp' },
    ];

    const now = Date.now();

    return [
      {
        id: `homepage-slider-${now}`,
        type: 'slides',
        row: 0,
        column: 1,
        sliderId,
      },
      {
        id: `homepage-benefits-${now}`,
        type: 'component',
        row: 1,
        column: 1,
        componentName: 'store-benefits',
        benefitsConfig: {
          items: [
            { icon: 'truck', title: 'Envíos a todo Chile', description: 'Recibe tu compra donde estés.' },
            { icon: 'payment', title: 'Compra segura', description: 'Paga con medios de pago protegidos.' },
            { icon: 'shield', title: 'Productos protegidos', description: 'Preparamos cada pedido con cuidado.' },
          ],
        },
      },
      ...categoryBanners.map((banner, index) => ({
        id: `homepage-category-${index + 1}-${now}`,
        type: 'image',
        row: index < 3 ? 2 : 3,
        column: (index % 3) + 1,
        imageUrl: banner.imageUrl,
        imageAlt: `${banner.title} en ${storeName}`,
        imageLink: `/categoria/${banner.slug}`,
        imageLinkTarget: '_self',
        title: banner.title,
        buttonText: 'Ver más',
      })),
      {
        id: `homepage-grid-${now}`,
        type: 'grid',
        row: 4,
        column: 1,
        gridConfig: {
          displayMode: 'latest',
          sortBy: 'newest',
          columns: 5,
          rows: 4,
        },
      },
    ];
  }

  private buildDefaultFooterConfig() {
    const now = Date.now();
    return {
      enabled: true,
      rows: [
        {
          id: `footer-row-1-${now}`,
          enabled: true,
          columns: 4,
          items: [
            {
              type: 'image',
              title: 'Logo',
              content: '',
              imageUrl: '',
              imageScale: 60,
              linkUrl: '',
            },
            {
              type: 'menu',
              title: 'Información',
              content: '',
              menuId: 'footer',
            },
            {
              type: 'social',
              title: 'Redes Sociales',
              content: '',
              textAlign: 'left',
            },
            {
              type: 'image',
              title: 'Métodos de pago',
              content: '',
              imageUrl: 'http://localhost:3001/media/44178a20-0810-4ba8-b51d-e28cfaf8fdff.png',
              imageScale: 90,
              linkUrl: '',
            },
          ],
        },
      ],
    };
  }

  private async ensureDefaultFooterLayoutForNewStore(vendorId: string): Promise<void> {
    const settings = await this.settingsRepository.findOne({ where: { vendorId } });
    if (!settings) return;

    settings.footerConfig = this.buildDefaultFooterConfig();
    await this.settingsRepository.save(settings);
  }

  /**
   * Crea la página de inicio + páginas legales predefinidas para una nueva tienda,
   * configura homePageConfig en modo blocks y actualiza menús por defecto.
   */
  private async createDefaultPages(vendorId: string, storeName: string): Promise<void> {
    console.log(`📄 Creating default pages for vendor: ${storeName}`);

    // Ensure vendor settings and one default slider with 3 slides exist
    let settings = await this.settingsRepository.findOne({ where: { vendorId } });
    if (!settings) {
      settings = this.settingsRepository.create({
        vendorId,
        headerType: 2,
        gridConfig: [],
        banners: [],
        slides: [],
        menus: {},
        customMenus: {},
        footerConfig: { enabled: false, rows: [] },
        policies: buildDefaultPolicies(),
        onboardingCompleted: false,
      });
    }

    const hasStructuredSlides = Array.isArray(settings.slides)
      && settings.slides.some((s: any) => s && Array.isArray(s.items));

    if (!hasStructuredSlides) {
      settings.slides = [
        {
          id: `slider-${Date.now()}`,
          name: 'Slider Portada',
          showInHomepage: true,
          position: 'top',
          usePageMargins: false,
          order: 0,
          items: this.buildDefaultSliderItems(storeName),
        },
      ];
    }

    if (!settings.customMenus || typeof settings.customMenus !== 'object') {
      settings.customMenus = {};
    }

    settings = await this.settingsRepository.save(settings);

    const defaultSliderId = String(settings.slides?.[0]?.id || '');
    const homepageSlug = 'inicio';
    const defaultPages = [
      {
        title: `Inicio - ${storeName}`,
        slug: homepageSlug,
        description: `Página principal de ${storeName}`,
        content: '',
        isHomepage: true,
      },
      {
        title: `Políticas de envío de ${storeName}`,
        slug: 'politicas-de-envio',
        description: `Conoce las políticas de envío de ${storeName}`,
        content: `<h2>Políticas de envío</h2>
<p>En <strong>${storeName}</strong> estamos comprometidos con entregarte tus productos de forma rápida y segura.</p>

<h3>Tiempos de entrega</h3>
<p>Una vez confirmado el pago, procesamos tu pedido en un plazo de 24 a 48 horas hábiles.</p>
<p>El tiempo de entrega depende de tu ubicación y del servicio de envío seleccionado:</p>
<ul>
  <li><strong>Santiago y principales ciudades:</strong> 2 a 4 días hábiles</li>
  <li><strong>Regiones:</strong> 3 a 7 días hábiles</li>
  <li><strong>Zonas extremas:</strong> 5 a 10 días hábiles</li>
</ul>

<h3>Costos de envío</h3>
<p>Los costos de envío se calculan automáticamente al momento de finalizar tu compra según tu ubicación.</p>

<h3>Seguimiento de pedido</h3>
<p>Una vez despachado tu pedido, recibirás un correo electrónico con el número de seguimiento para que puedas rastrear tu envío en tiempo real.</p>

<h3>Contacto</h3>
<p>Si tienes dudas sobre tu envío, contáctanos y te ayudaremos a resolver cualquier inquietud.</p>`,
      },
      {
        title: `Preguntas Frecuentes - ${storeName}`,
        slug: 'preguntas-frecuentes',
        description: `Respuestas a las preguntas más comunes sobre ${storeName}`,
        content: `<h2>Preguntas Frecuentes</h2>

<h3>¿Cómo puedo realizar una compra?</h3>
<p>Simplemente agrega los productos que desees al carrito, completa tus datos de envío y procede al pago. Aceptamos múltiples métodos de pago para tu comodidad.</p>

<h3>¿Qué métodos de pago aceptan?</h3>
<p>Aceptamos pagos a través de:</p>
<ul>
  <li>Tarjetas de débito y crédito</li>
  <li>Transferencia bancaria</li>
  <li>Otros métodos de pago disponibles en el checkout</li>
</ul>

<h3>¿Puedo modificar o cancelar mi pedido?</h3>
<p>Si necesitas modificar o cancelar tu pedido, contáctanos lo antes posible. Si el pedido aún no ha sido despachado, haremos todo lo posible para ayudarte.</p>

<h3>¿Los productos tienen garantía?</h3>
<p>Todos nuestros productos cuentan con garantía. Revisa la descripción de cada producto para conocer los detalles específicos.</p>

<h3>¿Cómo puedo contactarlos?</h3>
<p>Puedes contactarnos a través de nuestro formulario de contacto o escribirnos directamente. Respondemos todas las consultas a la brevedad posible.</p>`,
      },
      {
        title: `Términos y Condiciones - ${storeName}`,
        slug: 'terminos-y-condiciones',
        description: `Términos y condiciones de uso de ${storeName}`,
        content: `<h2>Términos y Condiciones</h2>

<h3>1. Aceptación de términos</h3>
<p>Al acceder y utilizar este sitio web, aceptas estar sujeto a estos términos y condiciones de uso.</p>

<h3>2. Uso del sitio</h3>
<p>Este sitio web es operado por <strong>${storeName}</strong>. El contenido de este sitio es solo para tu información general y uso. Está sujeto a cambios sin previo aviso.</p>

<h3>3. Productos y precios</h3>
<p>Nos esforzamos por mantener la información de productos y precios actualizada. Sin embargo, nos reservamos el derecho de modificar precios y disponibilidad sin previo aviso.</p>

<h3>4. Compras</h3>
<p>Al realizar una compra, garantizas que:</p>
<ul>
  <li>Eres mayor de edad</li>
  <li>La información proporcionada es verdadera y precisa</li>
  <li>Tienes autorización para usar el método de pago seleccionado</li>
</ul>

<h3>5. Privacidad</h3>
<p>Respetamos tu privacidad. La información personal que nos proporcionas se utilizará únicamente para procesar tus pedidos y mejorar tu experiencia de compra.</p>

<h3>6. Propiedad intelectual</h3>
<p>Todo el contenido de este sitio web, incluyendo textos, gráficos, logos e imágenes, es propiedad de <strong>${storeName}</strong> o sus proveedores de contenido.</p>

<h3>7. Limitación de responsabilidad</h3>
<p>No seremos responsables de daños directos, indirectos, incidentales o consecuentes que resulten del uso o la imposibilidad de usar este sitio web.</p>

<h3>8. Modificaciones</h3>
<p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Es tu responsabilidad revisar periódicamente estos términos.</p>

<h3>9. Contacto</h3>
<p>Si tienes preguntas sobre estos términos y condiciones, por favor contáctanos.</p>`,
      },
    ];

    const createdPageIds: string[] = [];

    // Crear las páginas
    for (const pageData of defaultPages) {
      try {
        const isHomepage = !!(pageData as any).isHomepage;
        const homepageBlocks = isHomepage
          ? this.buildDefaultHomepageBlocks(storeName, defaultSliderId)
          : [
              {
                id: `text-${Date.now()}`,
                type: 'text',
                text: pageData.content,
                row: 0,
                column: 0,
              },
            ];

        const homepageRowsConfig = isHomepage
          ? [
              { row: 0, columns: 1 },
              { row: 1, columns: 1 },
              { row: 2, columns: 3 },
              { row: 3, columns: 3 },
              { row: 4, columns: 1 },
            ]
          : [{ row: 0, columns: 1 }];

        const page = this.pagesRepository.create({
          title: pageData.title,
          slug: pageData.slug,
          description: pageData.description,
          blocks: homepageBlocks,
          isPublished: true,
          isHomepage,
          vendorId,
          rowsConfig: homepageRowsConfig,
        } as any);

        const savedPage = await this.pagesRepository.save(page as any) as unknown as Page;
        createdPageIds.push(savedPage.id);
        console.log(`✅ Created page: ${pageData.title} (ID: ${savedPage.id})`);
      } catch (error) {
        console.error(`❌ Error creating page ${pageData.title}:`, error.message);
      }
    }

    // Actualizar el menú footer con las páginas creadas
    if (createdPageIds.length > 0) {
      try {
        let settings = await this.settingsRepository.findOne({ where: { vendorId } });
        const homepagePageId = createdPageIds[0];
        
        if (!settings) {
          // Crear settings si no existen
          settings = this.settingsRepository.create({
            vendorId,
            customMenus: {},
          });
        }

        // Asegurar que customMenus existe
        if (!settings.customMenus) {
          settings.customMenus = {};
        }

        // Crear estructura de menú footer si no existe
        if (!settings.customMenus.footer) {
          settings.customMenus.footer = { items: [] };
        }

        // Agregar páginas legales al menú footer (excluye inicio)
        const legalPages = defaultPages.slice(1);
        const legalPageIds = createdPageIds.slice(1);

        const footerItems = legalPages.map((pageData, index) => ({
          id: `footer-page-${index}`,
          label: pageData.title.replace(` de ${storeName}`, '').replace(` - ${storeName}`, ''),
          linkType: 'page',
          pageId: legalPageIds[index],
          pageSlug: pageData.slug,
          isHomepage: false,
          url: '',
          categorySlug: '',
          genreSlug: '',
          isVisible: true,
        }));

        footerItems.push({
          id: 'footer-returns-policy',
          label: 'Políticas de cambios y devoluciones',
          linkType: 'custom',
          pageId: '',
          pageSlug: '',
          isHomepage: false,
          url: '/politicas-de-cambios-y-devoluciones',
          customUrl: '/politicas-de-cambios-y-devoluciones',
          categorySlug: '',
          genreSlug: '',
          isVisible: true,
        } as any);

        // Menú principal con "Inicio" apuntando a la homepage pública
        settings.customMenus.principal = {
          items: [
            {
              id: 'principal-home',
              label: 'Inicio',
              linkType: 'page',
              pageId: homepagePageId,
              pageSlug: homepageSlug,
              isHomepage: true,
              isVisible: true,
            },
          ],
        };

        settings.customMenus.footer.items = footerItems;
        
        settings.footerConfig = this.buildDefaultFooterConfig();

        await this.settingsRepository.save(settings);

        // Enlazar la homepage pública a la página en bloques recién creada
        await this.vendorsRepository.update(vendorId, {
          homePageConfig: {
            type: 'blocks',
            pageId: homepagePageId,
          },
        });
        
        console.log(`✅ Added ${footerItems.length} pages to footer menu`);
      } catch (error) {
        console.error('❌ Error updating footer menu:', error.message);
      }
    }

    console.log(`✅ Default pages creation completed for ${storeName}`);
  }

  async downloadAndSaveImages(vendorId: string, imageUrls: string[]): Promise<string[]> {
    const result = await this.downloadAndSaveImagesWithMeta(vendorId, imageUrls);
    return result.urls;
  }

  async downloadAndSaveImagesWithMeta(
    vendorId: string,
    imageUrls: string[],
  ): Promise<{ urls: string[]; imagesMeta: ProductImageVariantMeta[] }> {
    const vendor = await this.findOne(vendorId);
    const savedImagePaths: string[] = [];
    const imagesMeta: ProductImageVariantMeta[] = [];

    for (const imageUrl of imageUrls) {
      try {
        const optimized = await this.optimizeAndUploadImageVariants(vendor.id, imageUrl);
        savedImagePaths.push(optimized.large700Url);
        imagesMeta.push(optimized);
      } catch (error) {
        console.error(`Error downloading image ${imageUrl}:`, error);
      }
    }

    return {
      urls: savedImagePaths,
      imagesMeta,
    };
  }

  async uploadAndOptimizeFiles(vendorId: string, files: Express.Multer.File[]): Promise<{ urls: string[] }> {
    const vendor = await this.findOne(vendorId);
    const urls: string[] = [];

    for (const file of files) {
      try {
        const optimized = await this.optimizeAndUploadImageVariantsFromBuffer(vendor.id, file.buffer);
        urls.push(optimized.large700Url);
      } catch (error) {
        console.error(`Error optimizing uploaded file ${file.originalname}:`, error);
      }
    }

    return { urls };
  }

  async optimizeProductImagesByVendor(
    vendorId: string,
    options?: { limit?: number; offset?: number; force?: boolean },
  ) {
    const vendor = await this.findOne(vendorId);
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 200);
    const offset = Math.max(options?.offset ?? 0, 0);
    const force = options?.force === true;

    const products = await this.productsRepository.find({
      where: {
        vendor: { id: vendor.id },
        status: ProductStatus.ACTIVE,
      },
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const details: Array<{ productId: string; title: string; status: 'processed' | 'skipped' | 'failed'; reason?: string }> = [];

    for (const product of products) {
      try {
        const currentImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
        if (currentImages.length === 0) {
          skipped += 1;
          details.push({ productId: product.id, title: product.title, status: 'skipped', reason: 'No images' });
          continue;
        }

        const alreadyOptimized = Array.isArray((product as any).imagesMeta) && (product as any).imagesMeta.length > 0;
        if (alreadyOptimized && !force) {
          skipped += 1;
          details.push({ productId: product.id, title: product.title, status: 'skipped', reason: 'Already optimized' });
          continue;
        }

        const largeUrls: string[] = [];
        const imageMeta: ProductImageVariantMeta[] = [];

        for (const imageUrl of currentImages) {
          if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
            continue;
          }
          const optimized = await this.optimizeAndUploadImageVariants(vendor.id, imageUrl);
          largeUrls.push(optimized.large700Url);
          imageMeta.push(optimized);
        }

        if (largeUrls.length === 0) {
          skipped += 1;
          details.push({ productId: product.id, title: product.title, status: 'skipped', reason: 'No valid remote images' });
          continue;
        }

        product.images = largeUrls;
        (product as any).imagesMeta = imageMeta;
        await this.productsRepository.save(product);

        processed += 1;
        details.push({ productId: product.id, title: product.title, status: 'processed' });
      } catch (error) {
        failed += 1;
        details.push({ productId: product.id, title: product.title, status: 'failed', reason: error?.message || 'Unknown error' });
      }
    }

    return {
      vendorId,
      totalCandidates: products.length,
      processed,
      skipped,
      failed,
      limit,
      offset,
      force,
      details,
    };
  }

  private async optimizeAndUploadImageVariants(vendorId: string, sourceUrl: string): Promise<ProductImageVariantMeta> {
    const originalBuffer = await this.downloadImageToBuffer(sourceUrl);
    return this.optimizeAndUploadImageVariantsFromBuffer(vendorId, originalBuffer, sourceUrl);
  }

  private async optimizeAndUploadImageVariantsFromBuffer(
    vendorId: string,
    sourceBuffer: Buffer,
    originalUrl = '',
  ): Promise<ProductImageVariantMeta> {
    const baseName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const image = sharp(sourceBuffer, { failOn: 'none' }).rotate();
    const metadata = await image.metadata();

    const largeBuffer = await image
      .clone()
      .resize({ width: 700, height: 700, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    const thumbBuffer = await image
      .clone()
      .resize({
        width: 300,
        height: 300,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const largeUpload = await this.storageService.uploadFile(
      {
        buffer: largeBuffer,
        originalname: `${baseName}-lg700.jpg`,
        mimetype: 'image/jpeg',
      } as any,
      `vendors/${vendorId}`,
    );

    const thumbUpload = await this.storageService.uploadFile(
      {
        buffer: thumbBuffer,
        originalname: `${baseName}-th300.jpg`,
        mimetype: 'image/jpeg',
      } as any,
      `vendors/${vendorId}`,
    );

    return {
      originalUrl,
      large700Url: largeUpload.url,
      thumb300Url: thumbUpload.url,
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
    };
  }

  private downloadImageToBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const chunks: Buffer[] = [];
      
      const options = {
        headers: {
          'User-Agent': 'MundobeatApp/1.0 +http://localhost:3000'
        }
      };
      
      protocol.get(url, options, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        response.on('error', (err) => {
          reject(err);
        });
      }).on('error', reject);
    });
  }

  // Métodos de Categorías
  async getCategories(vendorId: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['categories', 'categories.parent'],
    });
    
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
    
    const activeRootCategories = vendor.categories.filter(
      category => !category.parentId && category.isActive,
    );
    const activeRootIds = activeRootCategories.map(category => category.id);

    const inheritedChildren = activeRootIds.length > 0
      ? await this.categoriesRepository.find({
          where: { parentId: In(activeRootIds), isActive: true },
          relations: ['parent'],
        })
      : [];

    return [...activeRootCategories, ...inheritedChildren].sort((a, b) => {
      const aGroup = a.parent?.name || a.name;
      const bGroup = b.parent?.name || b.name;
      return aGroup.localeCompare(bGroup)
        || Number(Boolean(a.parentId)) - Number(Boolean(b.parentId))
        || a.name.localeCompare(b.name);
    });
  }

  async getCategoriesWithProducts(vendorId: string) {
    try {
      // Obtener categorías activas del vendor que tienen productos
      const categoriesWithProducts = await this.categoriesRepository
        .createQueryBuilder('category')
        .leftJoin('categories', 'parentCategory', 'parentCategory.id = category.parentId')
        .innerJoin(
          'vendor_categories',
          'vcc',
          'vcc.vendorId = :vendorId AND (vcc.categoryId = category.id OR vcc.categoryId = category.parentId)',
          { vendorId },
        )
        .innerJoin('products_categories_categories', 'pc', 'pc.categoriesId = category.id')
        .innerJoin('products', 'product', 'product.id = pc.productsId')
        .where('category.isActive = :isActive', { isActive: true })
        .andWhere('(category.parentId IS NULL OR parentCategory.isActive = :isActive)', { isActive: true })
        .andWhere('product.vendorId = :vendorId', { vendorId })
        .select([
          'category.id',
          'category.name',
          'category.slug',
          'COUNT(DISTINCT product.id) as productCount'
        ])
        .groupBy('category.id')
        .having('COUNT(DISTINCT product.id) > 0')
        .orderBy('category.name', 'ASC')
        .getRawMany();

      return categoriesWithProducts.map(cat => ({
        id: cat.category_id,
        name: cat.category_name,
        slug: cat.category_slug,
        productCount: parseInt(cat.productCount) || 0,
      }));
    } catch (error) {
      console.error('Error getting categories with products:', error);
      return [];
    }
  }

  async enableCategory(vendorId: string, categoryId: string, displayOrder?: number) {
    // Verificar que la categoría global existe
    const category = await this.categoriesRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (!category.isActive) {
      throw new BadRequestException('Esta categoría no está habilitada por el marketplace');
    }
    if (category.parentId) {
      throw new BadRequestException('Las subcategorías se habilitan automáticamente con su categoría principal');
    }

    // Obtener vendor con sus categorías actuales
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['categories'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Verificar si la categoría ya está activa
    const alreadyEnabled = vendor.categories.some(cat => cat.id === categoryId);
    if (!alreadyEnabled) {
      vendor.categories.push(category);
      await this.vendorsRepository.save(vendor);
    }
    
    return { success: true, message: 'Category enabled' };
  }

  async disableCategory(vendorId: string, categoryId: string) {
    const category = await this.categoriesRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category.parentId) {
      throw new BadRequestException('Las subcategorías no se desactivan de forma independiente');
    }

    // Obtener vendor con sus categorías actuales
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['categories'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Remover la categoría de la lista del vendor
    vendor.categories = vendor.categories.filter(
      cat => cat.id !== categoryId && cat.parentId !== categoryId,
    );
    await this.vendorsRepository.save(vendor);
    
    return { success: true, message: 'Category disabled' };
  }

  // Obtener todas las categorías globales (para que el vendor las active)
  async getAllCategories() {
    return await this.categoriesRepository.find({
      where: { isActive: true, parentId: IsNull() },
      order: { name: 'ASC' },
    });
  }

  // Grid Configuration
  async getGridConfig(vendorId: string) {
    const settings = await this.settingsRepository.findOne({
      where: { vendorId },
    });

    if (!settings) {
      throw new NotFoundException('Vendor settings not found');
    }

    return {
      gridConfig: settings.gridConfig || [],
    };
  }

  async updateGridConfig(
    vendorId: string,
    gridConfig: any[],
    userId: string,
    userRole: string,
  ) {
    // Validate authorization
    const vendor = await this.findOne(vendorId);
    if (userRole === 'vendor' && vendor.user.id !== userId) {
      throw new Error('Unauthorized: You can only update your own vendor settings');
    }

    const settings = await this.settingsRepository.findOne({
      where: { vendorId },
    });

    if (!settings) {
      throw new NotFoundException('Vendor settings not found');
    }

    // Sort by order
    const sortedGridConfig = gridConfig.sort((a, b) => a.order - b.order);

    settings.gridConfig = sortedGridConfig;
    return await this.settingsRepository.save(settings);
  }

  async searchSpotify(vendorId: string, query: string) {
    const settings = await this.getSettings(vendorId);
    
    if (!settings.spotifyClientId || !settings.spotifyClientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    // Obtener access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(settings.spotifyClientId + ':' + settings.spotifyClientSecret).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Spotify access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Buscar álbumes
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search Spotify');
    }

    const searchData = await searchResponse.json();
    
    // Formatear resultados
    return {
      albums: searchData.albums.items.map((album: any) => ({
        id: album.id,
        name: album.name,
        artist: album.artists.map((a: any) => a.name).join(', '),
        releaseDate: album.release_date,
        image: album.images[0]?.url,
        totalTracks: album.total_tracks,
        url: album.external_urls.spotify,
      })),
    };
  }

  async searchSpotifyForPlayer(vendorId: string, query: string, type: string = 'track,album,artist') {
    const settings = await this.getSettings(vendorId);

    if (!settings.spotifyClientId || !settings.spotifyClientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    // Obtener access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(settings.spotifyClientId + ':' + settings.spotifyClientSecret).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Spotify access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const safeType = type || 'track,album,artist';
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(safeType)}&limit=12&market=CL`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search Spotify');
    }

    const data = await searchResponse.json();
    const results: any = {};

    if (data.tracks) {
      results.tracks = data.tracks.items.map((t: any) => ({
        id: t.id,
        name: t.name,
        artist: t.artists.map((a: any) => a.name).join(', '),
        album: t.album?.name,
        durationMs: t.duration_ms,
        image: t.album?.images[0]?.url,
        previewUrl: t.preview_url,
      }));
    }

    if (data.albums) {
      results.albums = data.albums.items.map((a: any) => ({
        id: a.id,
        name: a.name,
        artist: a.artists.map((x: any) => x.name).join(', '),
        releaseDate: a.release_date,
        image: a.images[0]?.url,
        totalTracks: a.total_tracks,
      }));
    }

    if (data.artists) {
      results.artists = data.artists.items.map((a: any) => ({
        id: a.id,
        name: a.name,
        genres: (a.genres || []).slice(0, 3),
        image: a.images[0]?.url,
        followers: a.followers?.total,
      }));
    }

    return results;
  }

  // ─── Spotify OAuth ─────────────────────────────────────────

  getSpotifyAuthUrl(vendorId: string, backendUrl: string): string {
    const settings = { vendorId }; // credentials loaded at runtime
    const redirectUri = `${backendUrl}/api/vendors/${vendorId}/spotify/callback`;
    const scopes = [
      'playlist-read-private',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-private',
      'user-read-currently-playing',
      'user-read-playback-state',
    ].join(' ');
    // vendorId is in state so the callback knows which vendor
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: '__REPLACE_AT_RUNTIME__', // replaced in controller
      scope: scopes,
      redirect_uri: redirectUri,
      state: vendorId,
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async buildSpotifyAuthUrl(vendorId: string, backendUrl: string): Promise<string> {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (!vendor) throw new BadRequestException('Vendor no encontrado');
    if (!vendor.spotifyClientId) throw new BadRequestException('Spotify Client ID no configurado. Guarda las credenciales primero.');
    if (!vendor.spotifyClientSecret) throw new BadRequestException('Spotify Client Secret no configurado. Guarda las credenciales primero.');
    const redirectUri = `${backendUrl}/api/vendors/${vendorId}/spotify/callback`;
    const scopes = [
      'playlist-read-private',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-private',
      'user-read-currently-playing',
      'user-read-playback-state',
    ].join(' ');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: vendor.spotifyClientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state: vendorId,
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async handleSpotifyCallback(vendorId: string, code: string, backendUrl: string): Promise<void> {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (!vendor?.spotifyClientId || !vendor?.spotifyClientSecret) {
      throw new BadRequestException('Spotify credentials not configured');
    }
    const redirectUri = `${backendUrl}/api/vendors/${vendorId}/spotify/callback`;

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${vendor.spotifyClientId}:${vendor.spotifyClientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Spotify token error: ${err}`);
    }

    const tokens = await tokenRes.json();
    vendor.spotifyRefreshToken = tokens.refresh_token;

    // Get Spotify user ID
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      vendor.spotifyUserId = me.id;
    }

    await this.vendorsRepository.save(vendor);
  }

  async getSpotifyUserAccessToken(vendorId: string): Promise<string> {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (!vendor?.spotifyRefreshToken) throw new Error('Spotify no está conectado. Autoriza primero.');
    if (!vendor?.spotifyClientId || !vendor?.spotifyClientSecret) throw new Error('Spotify credentials not configured');

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${vendor.spotifyClientId}:${vendor.spotifyClientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: vendor.spotifyRefreshToken,
      }).toString(),
    });

    if (!tokenRes.ok) throw new Error('Failed to refresh Spotify token');
    const data = await tokenRes.json();
    return data.access_token;
  }

  async getSpotifyPlaylists(vendorId: string): Promise<any[]> {
    const accessToken = await this.getSpotifyUserAccessToken(vendorId);
    const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch playlists');
    const data = await res.json();
    return data.items.map((p: any) => ({
      id: p.id,
      name: p.name,
      total: p.tracks?.total || 0,
      image: p.images?.[0]?.url,
      public: p.public,
    }));
  }

  async getAlbumTopTracks(vendorId: string, albumId: string, limit = 2): Promise<any[]> {
    const settings = await this.getSettings(vendorId);
    if (!settings.spotifyClientId || !settings.spotifyClientSecret) throw new Error('Spotify credentials not configured');

    // Use client credentials for track lookup (no user token needed)
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${settings.spotifyClientId}:${settings.spotifyClientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });
    const { access_token } = await tokenRes.json();

    const tracksRes = await fetch(
      `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`,
      { headers: { 'Authorization': `Bearer ${access_token}` } },
    );
    if (!tracksRes.ok) throw new Error('Failed to fetch album tracks');
    const tracksData = await tracksRes.json();

    // Fetch full track objects to get popularity
    const ids = tracksData.items.map((t: any) => t.id).join(',');
    const fullRes = await fetch(
      `https://api.spotify.com/v1/tracks?ids=${ids}&market=CL`,
      { headers: { 'Authorization': `Bearer ${access_token}` } },
    );
    const fullData = await fullRes.json();
    const sorted = (fullData.tracks || [])
      .filter((t: any) => t)
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

    return sorted.slice(0, limit).map((t: any) => ({
      id: t.id,
      uri: t.uri,
      name: t.name,
      popularity: t.popularity,
      durationMs: t.duration_ms,
      previewUrl: t.preview_url,
    }));
  }

  async addTracksToPlaylist(vendorId: string, playlistId: string, trackUris: string[]): Promise<void> {
    const accessToken = await this.getSpotifyUserAccessToken(vendorId);
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: trackUris }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to add tracks: ${err}`);
    }
  }

  async removeTracksFromPlaylist(vendorId: string, playlistId: string, trackUris: string[]): Promise<void> {
    if (!trackUris.length) return;
    const accessToken = await this.getSpotifyUserAccessToken(vendorId);
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracks: trackUris.map(uri => ({ uri })) }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to remove tracks: ${err}`);
    }
  }

  async disconnectSpotifyOAuth(vendorId: string): Promise<void> {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (vendor) {
      vendor.spotifyRefreshToken = null;
      vendor.spotifyUserId = null;
      await this.vendorsRepository.save(vendor);
    }
  }

  async getCurrentlyPlaying(vendorId: string): Promise<any> {
    const accessToken = await this.getSpotifyUserAccessToken(vendorId);
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (res.status === 204) return { playing: false }; // nothing playing
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403) throw new Error('SCOPE_MISSING');
      throw new Error(`Spotify error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    if (!data || !data.item) return { playing: false };

    const trackId: string = data.item.id;

    // Look up linked marketplace product
    let linkedProduct: any = null;
    const trackRecord = await this.productSpotifyTrackRepository.findOne({
      where: { spotifyTrackId: trackId },
    });
    if (trackRecord) {
      const product = await this.productsRepository.findOne({
        where: { id: trackRecord.productId },
        relations: ['vendor', 'formats'],
      });
      if (product) {
        const formatName = (product as any).formats?.[0]?.name || (product as any).format || null;
        linkedProduct = {
          id: product.id,
          title: product.title,
          artist: (product as any).artist || null,
          album: (product as any).album || null,
          price: product.price,
          salePrice: (product as any).salePrice || null,
          image: product.images?.[0] || null,
          vendorSlug: product.vendor?.slug || null,
          format: formatName,
        };
      }
    }

    return {
      playing: data.is_playing,
      trackId,
      trackName: data.item.name,
      artist: data.item.artists?.map((a: any) => a.name).join(', '),
      albumName: data.item.album?.name,
      albumImage: data.item.album?.images?.[0]?.url,
      uri: data.item.uri,
      durationMs: data.item.duration_ms,
      progressMs: data.progress_ms,
      linkedProduct,
    };
  }

  // ─────────── Spotify Sync ────────────────────────────────────────────────

  /** Lista los productos elegibles: activos, stock > 0, con su estado sync */
  async getSpotifySyncPreview(vendorId: string): Promise<any[]> {
    const products = await this.productsRepository
      .createQueryBuilder('product')
      .innerJoin('product.categories', 'category', 'category.usesMusicMetadata = :usesMusicMetadata', { usesMusicMetadata: true })
      .where('product.vendorId = :vendorId', { vendorId })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.stock > 0')
      .distinct(true)
      .orderBy('product.artist', 'ASC')
      .addOrderBy('product.album', 'ASC')
      .getMany();

    // Load all sync status entries for this vendor in one query
    const statusEntries = await this.productSpotifySyncStatusRepository.find({
      where: { vendorId },
    });
    const statusMap = new Map(statusEntries.map(s => [s.productId, s.status]));

    console.log(`🎵 SYNC PREVIEW | total activos con stock=${products.length}`);

    const results = await Promise.all(products.map(async (p) => {
      const syncStatus = statusMap.get(p.id) || null;

      const tracks = await this.productSpotifyTrackRepository.find({
        where: { productId: p.id },
        order: { popularity: 'DESC' },
      });
      return {
        productId: p.id,
        title: p.title,
        artist: (p as any).artist || '',
        album: (p as any).album || '',
        stock: p.stock,
        image: p.images?.[0] || null,
        spotifyAlbumId: p.spotifyAlbumId || null,
        syncStatus, // 'discarded' | 'deleted' | null
        syncedTracks: tracks.map(t => ({
          uri: t.spotifyTrackUri,
          name: t.spotifyTrackName,
          artist: t.spotifyTrackArtist,
          popularity: t.popularity,
          syncedAt: t.syncedAt,
        })),
        lastSyncedAt: tracks[0]?.syncedAt || null,
      };
    }));

    // Exclude permanently deleted products
    return results.filter(r => r.syncStatus !== 'deleted');
  }

  /** Sincroniza un producto individual: busca en Spotify, guarda tracks, agrega a playlist */
  async syncProductSpotifyTracks(vendorId: string, productId: string, limit = 2): Promise<{
    success: boolean;
    productId: string;
    tracksFound: number;
    addedToPlaylist: boolean;
    error?: string;
    tracks?: any[];
  }> {
    // Check if product is permanently deleted/blacklisted
    const syncStatus = await this.productSpotifySyncStatusRepository.findOne({
      where: { productId, vendorId },
    });
    if (syncStatus?.status === 'deleted') {
      return { success: false, productId, tracksFound: 0, addedToPlaylist: false, error: 'Este disco fue eliminado definitivamente y no puede resincronizarse' };
    }

    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (!vendor) throw new BadRequestException('Vendor no encontrado');

    const product = await this.productsRepository
      .createQueryBuilder('product')
      .innerJoin('product.categories', 'category', 'category.usesMusicMetadata = :usesMusicMetadata', { usesMusicMetadata: true })
      .where('product.id = :productId', { productId })
      .andWhere('product.vendorId = :vendorId', { vendorId })
      .getOne();
    if (!product) throw new BadRequestException('El producto no corresponde al catálogo musical de la tienda');

    try {
      // 1. Obtener top tracks
      let topTracks: any[] = [];
      if (product.spotifyAlbumId) {
        topTracks = await this.getAlbumTopTracks(vendorId, product.spotifyAlbumId, limit);
      } else {
        const artist = (product as any).artist || '';
        const album = (product as any).album || '';
        if (!artist && !album) return { success: false, productId, tracksFound: 0, addedToPlaylist: false, error: 'Sin artista ni álbum' };

        const searchQuery = [artist, album].filter(Boolean).join(' ');
        const settings = await this.getSettings(vendorId);
        if (!settings.spotifyClientId || !settings.spotifyClientSecret) {
          return { success: false, productId, tracksFound: 0, addedToPlaylist: false, error: 'Credenciales Spotify no configuradas' };
        }

        // Client credentials token for search
        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${settings.spotifyClientId}:${settings.spotifyClientSecret}`).toString('base64'),
          },
          body: new URLSearchParams({ grant_type: 'client_credentials' }),
        });
        if (!tokenRes.ok) return { success: false, productId, tracksFound: 0, addedToPlaylist: false, error: 'Error obteniendo token Spotify' };
        const { access_token } = await tokenRes.json();

        // Search for album
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=album&limit=1`,
          { headers: { Authorization: `Bearer ${access_token}` } },
        );
        if (!searchRes.ok) return { success: false, productId, tracksFound: 0, addedToPlaylist: false, error: 'Error buscando en Spotify' };
        const searchData = await searchRes.json();
        const foundAlbum = searchData.albums?.items?.[0];
        if (!foundAlbum) return { success: false, productId, tracksFound: 0, addedToPlaylist: false, error: 'Álbum no encontrado en Spotify' };

        // Save albumId on product for future syncs
        product.spotifyAlbumId = foundAlbum.id;
        await this.productsRepository.save(product);

        topTracks = await this.getAlbumTopTracks(vendorId, foundAlbum.id, limit);
      }

      if (!topTracks?.length) return { success: false, productId, tracksFound: 0, addedToPlaylist: false, error: 'No se encontraron canciones' };

      // 2. Si ya había tracks anteriores en playlist, removerlos primero (re-sync)
      const existingTracks = await this.productSpotifyTrackRepository.find({ where: { productId } });
      if (existingTracks.length && vendor.spotifyPlaylistId && vendor.spotifyRefreshToken) {
        try {
          const oldUris = existingTracks.map(t => t.spotifyTrackUri);
          await this.removeTracksFromPlaylist(vendorId, vendor.spotifyPlaylistId, oldUris);
        } catch (_) {
          // non-critical, continue
        }
      }

      // 3. Guardar en DB (reemplazar tracks anteriores)
      await this.productSpotifyTrackRepository.delete({ productId });
      const entities = topTracks.map(t => this.productSpotifyTrackRepository.create({
        productId,
        spotifyTrackUri: `spotify:track:${t.id}`,
        spotifyTrackId: t.id,
        spotifyTrackName: t.name,
        spotifyTrackArtist: t.artist,
        spotifyAlbumId: t.albumId || product.spotifyAlbumId,
        popularity: t.popularity || 0,
      }));
      await this.productSpotifyTrackRepository.save(entities);

      // 4. Si estaba descartado, quitamos el estado al re-sincronizar
      if (syncStatus?.status === 'discarded') {
        await this.productSpotifySyncStatusRepository.delete({ productId, vendorId });
      }

      // 5. Agregar a playlist si hay una seleccionada y OAuth conectado
      let addedToPlaylist = false;
      if (vendor.spotifyPlaylistId && vendor.spotifyRefreshToken) {
        try {
          const trackUris = topTracks.map(t => `spotify:track:${t.id}`);
          await this.addTracksToPlaylist(vendorId, vendor.spotifyPlaylistId, trackUris);
          addedToPlaylist = true;
        } catch (_) {
          // playlist add failed, not critical
        }
      }

      return {
        success: true,
        productId,
        tracksFound: topTracks.length,
        addedToPlaylist,
        tracks: topTracks.map(t => ({ id: t.id, name: t.name, artist: t.artist, popularity: t.popularity })),
      };
    } catch (err: any) {
      return { success: false, productId, tracksFound: 0, addedToPlaylist: false, error: err.message || 'Error desconocido' };
    }
  }

  /** Sincroniza todos los productos elegibles del vendor */
  async syncAllProductsSpotifyTracks(vendorId: string, limit = 2): Promise<{
    total: number;
    synced: number;
    notFound: number;
    errors: number;
    results: any[];
  }> {
    const preview = await this.getSpotifySyncPreview(vendorId);
    const results: any[] = [];

    for (const p of preview) {
      const result = await this.syncProductSpotifyTracks(vendorId, p.productId, limit);
      results.push({ ...result, artist: p.artist, album: p.album, title: p.title });
      // Small delay to avoid Spotify rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    return {
      total: results.length,
      synced: results.filter(r => r.success).length,
      notFound: results.filter(r => !r.success && r.error?.includes('encontr')).length,
      errors: results.filter(r => !r.success && !r.error?.includes('encontr')).length,
      results,
    };
  }

  /** Descartar un producto: oculta de "No sincronizados", va a tab Descartados */
  async discardProductSync(vendorId: string, productId: string): Promise<void> {
    const existing = await this.productSpotifySyncStatusRepository.findOne({ where: { productId, vendorId } });
    if (existing) {
      existing.status = 'discarded';
      await this.productSpotifySyncStatusRepository.save(existing);
    } else {
      await this.productSpotifySyncStatusRepository.save(
        this.productSpotifySyncStatusRepository.create({ productId, vendorId, status: 'discarded' }),
      );
    }
  }

  /** Restaurar un producto descartado a "No sincronizados" */
  async restoreProductSync(vendorId: string, productId: string): Promise<void> {
    await this.productSpotifySyncStatusRepository.delete({ productId, vendorId });
  }

  /** Obtiene productos del vendor que tienen temas sincronizados pero ya no son elegibles (sin stock o desactivados) */
  async getInactiveButSyncedProducts(vendorId: string): Promise<any[]> {
    // Load blacklisted product IDs
    const deletedEntries = await this.productSpotifySyncStatusRepository.find({
      where: { vendorId, status: 'deleted' as any },
    });
    const deletedIds = new Set(deletedEntries.map(e => e.productId));

    // Get all products that are inactive OR out of stock (exclude TRASH) — same scope as getSpotifySyncPreview
    const inactiveProducts = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.status != :trash', { trash: 'trash' })
      .andWhere('(product.status != :active OR COALESCE(product.stock, 0) <= 0)', { active: ProductStatus.ACTIVE })
      .getMany();

    const results: any[] = [];
    for (const p of inactiveProducts) {
      if (deletedIds.has(p.id)) continue;
      const tracks = await this.productSpotifyTrackRepository.find({ where: { productId: p.id } });
      if (!tracks.length) continue;

      const reason = p.status !== ProductStatus.ACTIVE ? 'desactivado' : 'sin_stock';
      results.push({
        productId: p.id,
        title: p.title,
        artist: (p as any).artist || '',
        album: (p as any).album || '',
        stock: p.stock,
        status: p.status,
        image: p.images?.[0] || null,
        reason,
        syncedTracks: tracks.map(t => ({
          uri: t.spotifyTrackUri,
          name: t.spotifyTrackName,
          artist: t.spotifyTrackArtist,
        })),
      });
    }
    return results;
  }

  /** Saca los temas del playlist y los borra de DB sin blacklistear — el producto vuelve a "Pendientes" cuando se reactive */
  async removeProductFromPlaylistSoft(vendorId: string, productId: string): Promise<{ removedFromPlaylist: boolean }> {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    const existingTracks = await this.productSpotifyTrackRepository.find({ where: { productId } });
    let removedFromPlaylist = false;

    if (existingTracks.length && vendor?.spotifyPlaylistId && vendor?.spotifyRefreshToken) {
      try {
        const uris = existingTracks.map(t => t.spotifyTrackUri);
        await this.removeTracksFromPlaylist(vendorId, vendor.spotifyPlaylistId, uris);
        removedFromPlaylist = true;
      } catch (_) {
        // non-critical
      }
    }

    // Delete tracks from DB (no blacklisting — product can be re-synced when it becomes eligible again)
    await this.productSpotifyTrackRepository.delete({ productId });
    // Clear any discard status too
    await this.productSpotifySyncStatusRepository.delete({ productId, vendorId });

    return { removedFromPlaylist };
  }

  /** Eliminar definitivamente: borra tracks de DB, los quita de la playlist y marca como deleted */
  async deleteProductSyncPermanently(vendorId: string, productId: string): Promise<{ removedFromPlaylist: boolean }> {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });

    // Get existing tracks to remove from playlist
    const existingTracks = await this.productSpotifyTrackRepository.find({ where: { productId } });
    let removedFromPlaylist = false;

    if (existingTracks.length && vendor?.spotifyPlaylistId && vendor?.spotifyRefreshToken) {
      try {
        const uris = existingTracks.map(t => t.spotifyTrackUri);
        await this.removeTracksFromPlaylist(vendorId, vendor.spotifyPlaylistId, uris);
        removedFromPlaylist = true;
      } catch (_) {
        // non-critical
      }
    }

    // Delete tracks from DB
    await this.productSpotifyTrackRepository.delete({ productId });

    // Mark as permanently deleted (blacklist)
    const existing = await this.productSpotifySyncStatusRepository.findOne({ where: { productId, vendorId } });
    if (existing) {
      existing.status = 'deleted';
      await this.productSpotifySyncStatusRepository.save(existing);
    } else {
      await this.productSpotifySyncStatusRepository.save(
        this.productSpotifySyncStatusRepository.create({ productId, vendorId, status: 'deleted' }),
      );
    }

    return { removedFromPlaylist };
  }

  async generateDescriptionWithGemini(vendorId: string, productData: any) {
    try {
      console.log('=== Starting Gemini Description Generation ===');
      console.log('Vendor ID:', vendorId);
      console.log('Product Data:', JSON.stringify(productData));
      
      const settings = await this.getSettings(vendorId);
      console.log('Settings loaded. Gemini enabled:', settings.geminiEnabled);
      console.log('API Key present:', !!settings.geminiApiKey);
      
      if (!settings.geminiEnabled || !settings.geminiApiKey) {
        throw new Error('Gemini AI is not enabled or API key is missing');
      }

    // Prompt por defecto si no hay uno configurado
    const defaultPrompt = `Crea una descripción cautivadora y profesional para este álbum musical.

Información del álbum:
- Artista: {artist}
- Álbum: {album}
- Año: {year}
- Género: {genre}
- Sello: {label}
- País: {country}

La descripción debe:
1. Destacar la importancia histórica o cultural del álbum
2. Mencionar características musicales distintivas
3. Incluir un dato curioso o anécdota interesante sobre su creación o impacto
4. Tener un tono profesional pero accesible
5. Tener entre 150-200 palabras

Formato: Texto corrido en español, sin usar asteriscos ni formato markdown.`;

    // Usar el prompt configurado o el por defecto
    let prompt = settings.geminiPrompt || defaultPrompt;

    // Reemplazar shortcodes con datos reales
    const replacements: Record<string, string> = {
      '{artist}': productData.artist || 'Desconocido',
      '{album}': productData.album || productData.title || 'Sin título',
      '{title}': productData.title || 'Sin título',
      '{year}': productData.year ? productData.year.toString() : 'N/A',
      '{genre}': productData.genre || 'N/A',
      '{label}': productData.label || 'N/A',
      '{country}': productData.country || 'N/A',
      '{format}': productData.format || 'N/A',
      '{styles}': productData.styles || 'N/A',
    };

    // Reemplazar de forma segura escapando caracteres especiales de RegExp
    Object.keys(replacements).forEach(key => {
      // Escapar caracteres especiales en la clave para RegExp
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      prompt = prompt.replace(new RegExp(escapedKey, 'g'), replacements[key]);
    });

    // Llamar a la API de Gemini
    try {
      console.log('Calling Gemini API with prompt:', prompt.substring(0, 200) + '...');
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': settings.geminiApiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API Error Response:', errorData);
        console.error('Gemini API Status:', response.status);
        
        // Intentar parsear el error para obtener más detalles
        try {
          const errorJson = JSON.parse(errorData);
          throw new Error(`Gemini API Error: ${errorJson.error?.message || 'Unknown error'}`);
        } catch {
          throw new Error(`Gemini API Error (${response.status}): ${errorData.substring(0, 200)}`);
        }
      }

      const data = await response.json();
      console.log('Gemini API Response:', JSON.stringify(data).substring(0, 300));
      
      // Extraer el texto generado
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        console.error('No text in response:', data);
        throw new Error('No description generated by Gemini AI');
      }

      console.log('Description generated successfully');
      console.log('=== End Gemini Description Generation ===');
      return {
        description: generatedText.trim(),
      };
    } catch (error) {
      console.error('=== Error in Gemini Generation ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      throw error;
    }
  } catch (outerError) {
    console.error('=== Fatal Error in generateDescriptionWithGemini ===');
    console.error('Outer error:', outerError);
      throw outerError;
  }
  }

  async getHomePageConfig(vendorId: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor.homePageConfig || { type: 'grid' };
  }

  async updateHomePageConfig(
    vendorId: string,
    homePageConfig: any,
    userId: string,
    userRole: UserRole,
  ) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Verificar permiso
    if (userRole !== UserRole.ADMIN && vendor.user.id !== userId) {
      throw new ForbiddenException('You cannot update this vendor');
    }

    vendor.homePageConfig = homePageConfig;
    return await this.vendorsRepository.save(vendor);
  }

  async updateHomePageConfigPublic(vendorId: string, homePageConfig: any) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    vendor.homePageConfig = homePageConfig;
    return await this.vendorsRepository.save(vendor);
  }

  async getVendorPages(vendorId: string) {
    const pages = await this.pagesRepository.find({
      where: { vendor: { id: vendorId } },
      order: { createdAt: 'DESC' },
    });

    return pages;
  }

  async createVendorPage(vendorId: string, createPageDto: any) {
    return this.pagesService.create(vendorId, createPageDto);
  }

  async updateVendorPage(vendorId: string, pageId: string, updatePageDto: any) {
    return this.pagesService.update(vendorId, pageId, updatePageDto);
  }

  async deleteVendorPage(vendorId: string, pageId: string) {
    return this.pagesService.delete(vendorId, pageId);
  }

  // Custom Domain Methods
  async getCustomDomainInfo(vendorId: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      select: ['id', 'slug', 'customDomain', 'customDomainVerified', 'customDomainVerifiedAt'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return {
      subdomain: `${vendor.slug}.mundobeat.cl`,
      customDomain: vendor.customDomain,
      verified: vendor.customDomainVerified,
      verifiedAt: vendor.customDomainVerifiedAt,
    };
  }

  async updateCustomDomain(
    vendorId: string,
    customDomain: string,
    userId: string,
    userRole: string,
  ) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Check permissions
    if (userRole !== UserRole.ADMIN && vendor.user.id !== userId) {
      throw new ForbiddenException('Not authorized to update this vendor');
    }

    // Clean domain (remove protocol, www, trailing slash)
    const cleanDomain = customDomain
      ?.toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '')
      .trim();

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
    if (cleanDomain && !domainRegex.test(cleanDomain)) {
      throw new ConflictException('Invalid domain format');
    }

    // Check if domain is already in use by another vendor
    if (cleanDomain) {
      const existingVendor = await this.vendorsRepository.findOne({
        where: { customDomain: cleanDomain },
      });

      if (existingVendor && existingVendor.id !== vendorId) {
        throw new ConflictException('This domain is already in use by another vendor');
      }
    }

    // Update domain and reset verification
    vendor.customDomain = cleanDomain || null;
    vendor.customDomainVerified = false;
    vendor.customDomainVerifiedAt = null;

    await this.vendorsRepository.save(vendor);

    return {
      success: true,
      message: 'Custom domain updated. Please verify your domain configuration.',
      customDomain: cleanDomain,
    };
  }

  async verifyCustomDomain(
    vendorId: string,
    userId: string,
    userRole: string,
  ) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Check permissions
    if (userRole !== UserRole.ADMIN && vendor.user.id !== userId) {
      throw new ForbiddenException('Not authorized to verify this domain');
    }

    if (!vendor.customDomain) {
      throw new ConflictException('No custom domain configured');
    }

    // Verify DNS configuration
    const dns = require('dns').promises;
    try {
      // Try to resolve the domain
      const addresses = await dns.resolve4(vendor.customDomain).catch(() => []);
      const cnames = await dns.resolveCname(vendor.customDomain).catch(() => []);

      // Check if domain points to mundobeat.cl or has correct CNAME
      const isValid = 
        cnames.some(cname => cname.includes('mundobeat.cl') || cname.includes('vercel.app')) ||
        addresses.length > 0; // Has A records (will be handled by Cloudflare)

      if (isValid) {
        vendor.customDomainVerified = true;
        vendor.customDomainVerifiedAt = new Date();
        await this.vendorsRepository.save(vendor);

        return {
          success: true,
          message: 'Domain verified successfully!',
          verified: true,
          verifiedAt: vendor.customDomainVerifiedAt,
        };
      } else {
        return {
          success: false,
          message: 'Domain DNS not properly configured. Please add a CNAME record pointing to mundobeat.cl',
          verified: false,
        };
      }
    } catch (error) {
      console.error('DNS verification error:', error);
      return {
        success: false,
        message: 'Could not verify domain. Make sure DNS records are properly configured.',
        verified: false,
        error: error.message,
      };
    }
  }

  async findByCustomDomain(domain: string) {
    return this.vendorsRepository.findOne({
      where: { customDomain: domain, customDomainVerified: true },
      relations: ['settings', 'user'],
    });
  }

  // ============================================
  // Commission Settings Methods
  // ============================================

  async updateVendorSettings(
    vendorId: string,
    settings: {
      commissionPercentage?: number;
      wholesaleCommissionPercentage?: number;
      assistedCommissionPercentage?: number;
      assistedCommissionType?: 'percentage' | 'fixed';
      assistedCommissionFixedAmount?: number;
      isWholesaleEnabledByAdmin?: boolean;
    },
  ) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (settings.assistedCommissionType !== undefined && !['percentage', 'fixed'].includes(settings.assistedCommissionType)) {
      throw new BadRequestException('Tipo de comisión de venta asistida inválido');
    }
    if (settings.assistedCommissionPercentage !== undefined && (typeof settings.assistedCommissionPercentage !== 'number' || !Number.isFinite(settings.assistedCommissionPercentage) || settings.assistedCommissionPercentage < 0 || settings.assistedCommissionPercentage > 100)) {
      throw new BadRequestException('El porcentaje debe estar entre 0 y 100');
    }
    if (settings.assistedCommissionFixedAmount !== undefined && (typeof settings.assistedCommissionFixedAmount !== 'number' || !Number.isSafeInteger(settings.assistedCommissionFixedAmount) || settings.assistedCommissionFixedAmount < 0 || settings.assistedCommissionFixedAmount > 9999999999)) {
      throw new BadRequestException('El monto fijo debe ser un número entero de pesos no negativo');
    }
    // Update vendor settings
    if (vendor.settings) {
      if (settings.commissionPercentage !== undefined) {
        vendor.settings.commissionPercentage = settings.commissionPercentage;
      }
      if (settings.wholesaleCommissionPercentage !== undefined) {
        vendor.settings.wholesaleCommissionPercentage = settings.wholesaleCommissionPercentage;
      }
      if (settings.assistedCommissionPercentage !== undefined) {
        vendor.settings.assistedCommissionPercentage = settings.assistedCommissionPercentage;
      }
      if (settings.assistedCommissionType !== undefined) vendor.settings.assistedCommissionType = settings.assistedCommissionType;
      if (settings.assistedCommissionFixedAmount !== undefined) vendor.settings.assistedCommissionFixedAmount = settings.assistedCommissionFixedAmount;
      if (settings.isWholesaleEnabledByAdmin !== undefined) {
        vendor.settings.isWholesaleEnabledByAdmin = settings.isWholesaleEnabledByAdmin;
      }
      await this.settingsRepository.save(vendor.settings);
    } else {
      // Create settings if they don't exist
      const newSettings = this.settingsRepository.create({
        vendor,
        commissionPercentage: settings.commissionPercentage ?? 10,
        wholesaleCommissionPercentage: settings.wholesaleCommissionPercentage ?? 5,
        assistedCommissionPercentage: settings.assistedCommissionPercentage ?? 10,
        assistedCommissionType: settings.assistedCommissionType ?? 'percentage',
        assistedCommissionFixedAmount: settings.assistedCommissionFixedAmount ?? 0,
        isWholesaleEnabledByAdmin: settings.isWholesaleEnabledByAdmin ?? false,
      });
      await this.settingsRepository.save(newSettings);
    }

    return {
      success: true,
      message: 'Configuración de comisiones actualizada correctamente',
    };
  }

  async getVendorSettings(vendorId: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return {
      commissionPercentage: vendor.settings?.commissionPercentage ?? 10,
      wholesaleCommissionPercentage: vendor.settings?.wholesaleCommissionPercentage ?? 5,
      assistedCommissionPercentage: vendor.settings?.assistedCommissionPercentage ?? 10,
      assistedCommissionType: vendor.settings?.assistedCommissionType ?? 'percentage',
      assistedCommissionFixedAmount: vendor.settings?.assistedCommissionFixedAmount ?? 0,
      isWholesaleEnabledByAdmin: vendor.settings?.isWholesaleEnabledByAdmin ?? false,
      isWholesaleEnabled: vendor.settings?.isWholesaleEnabled ?? false,
    };
  }

  async createApplication(data: Partial<VendorApplication>): Promise<VendorApplication> {
    const email = (data.email || '').trim().toLowerCase();
    const rut = (data.rut || '').trim();

    if (
      !email
      || !rut
      || !data.fullName
      || !data.taxpayerType
      || !data.legalName
      || !data.storeName
      || !data.logoUrl
      || !data.region
      || !data.regionId
      || !data.city
      || !data.cityId
      || !data.mainFormats
    ) {
      throw new BadRequestException('Faltan campos obligatorios para la solicitud');
    }
    if (!['natural', 'company'].includes(data.taxpayerType)) {
      throw new BadRequestException('Tipo de contribuyente inválido');
    }
    if (!/^https:\/\//i.test(data.logoUrl) && !data.logoUrl.startsWith('/uploads/')) {
      throw new BadRequestException('La URL del logo no es válida');
    }

    const existingPending = await this.vendorApplicationsRepository.findOne({
      where: [
        { email, status: ApplicationStatus.PENDING },
        { rut, status: ApplicationStatus.PENDING },
      ],
      order: { createdAt: 'DESC' },
    });

    if (existingPending) {
      throw new ConflictException('Ya existe una solicitud pendiente con ese email o RUT');
    }

    const existingApproved = await this.vendorApplicationsRepository.findOne({
      where: [{ email, status: ApplicationStatus.APPROVED }, { rut, status: ApplicationStatus.APPROVED }],
      order: { createdAt: 'DESC' },
    });

    if (existingApproved) {
      throw new ConflictException('Esta cuenta ya fue aprobada anteriormente');
    }

    const application = this.vendorApplicationsRepository.create({
      ...data,
      email,
      rut,
      status: ApplicationStatus.PENDING,
    });

    const saved = await this.vendorApplicationsRepository.save(application);

    // Notificar al correo de contacto del marketplace cuando entra una solicitud nueva.
    await this.notifyAdminNewApplication(saved);

    return saved;
  }

  async findAllApplications(status?: ApplicationStatus): Promise<VendorApplication[]> {
    const where = status ? { status } : {};
    return this.vendorApplicationsRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async approveApplication(applicationId: string, reviewedByEmail: string, adminNotes?: string) {
    const application = await this.vendorApplicationsRepository.findOne({ where: { id: applicationId } });

    if (!application) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (application.status === ApplicationStatus.APPROVED) {
      throw new ConflictException('La solicitud ya fue aprobada');
    }

    const createdVendor = await this.createByAdmin({
      storeName: application.storeName?.trim() || `${application.fullName.trim()} Store`,
      email: application.email,
      slug: application.storeName?.trim() || application.fullName,
      isActive: true,
      enviaOriginName: application.storeName?.trim() || application.fullName,
      enviaOriginPhone: application.phone || '',
      enviaOriginStreet: application.message || 'Por definir',
      enviaOriginCity: application.city || 'Por definir',
      enviaOriginState: application.regionCode || application.region || '',
      enviaOriginPostalCode: application.postalCode || '',
      enviaOriginRegionId: application.regionId || null,
      enviaOriginCommuneId: application.cityId || null,
      enviaEnabledCarriers: ['chilexpress', 'correoschile', 'blueexpress', 'starken'],
      logo: application.logoUrl || null,
      mainFormats: application.mainFormats || '',
        taxpayerType: application.taxpayerType,
        billingRut: application.rut,
        billingLegalName: application.legalName || application.fullName,
        billingRegion: application.region || '',
        billingCommune: application.city || '',
        billingEmail: application.email,
    });

    application.status = ApplicationStatus.APPROVED;
    application.adminNotes = adminNotes?.trim() || '';
    application.reviewedByEmail = reviewedByEmail || '';
    application.reviewedAt = new Date();
    await this.vendorApplicationsRepository.save(application);

    return {
      success: true,
      application,
      vendor: createdVendor,
      message: 'Solicitud aprobada y tienda creada correctamente',
    };
  }

  async rejectApplication(applicationId: string, reviewedByEmail: string, reason: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Debes indicar un motivo de rechazo');
    }

    const application = await this.vendorApplicationsRepository.findOne({ where: { id: applicationId } });

    if (!application) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (application.status === ApplicationStatus.APPROVED) {
      throw new ConflictException('No se puede rechazar una solicitud ya aprobada');
    }

    application.status = ApplicationStatus.REJECTED;
    application.adminNotes = reason.trim();
    application.reviewedByEmail = reviewedByEmail || '';
    application.reviewedAt = new Date();
    const saved = await this.vendorApplicationsRepository.save(application);

    await this.sendApplicationRejectedEmail(saved);

    return {
      success: true,
      application: saved,
      message: 'Solicitud rechazada correctamente',
    };
  }

  private async notifyAdminNewApplication(application: VendorApplication) {
    try {
      const smtpConfig = await this.smtpSettingsService.getSmtpConfig();
      if (!smtpConfig) {
        console.warn('[VendorApplication] SMTP no configurado, no se puede notificar al administrador');
        return;
      }

      const marketplaceVendor = await this.vendorsRepository.findOne({
        where: { id: MARKETPLACE_VENDOR_ID },
        select: ['email'],
      });

      const configuredEnvEmail = process.env.MARKETPLACE_CONTACT_EMAIL?.trim();
      const marketplaceContactEmail = marketplaceVendor?.email?.trim();
      const smtpFromEmail = smtpConfig.fromEmail?.trim();
      const smtpUserEmail = smtpConfig.user?.trim();

      const contactEmail = configuredEnvEmail || marketplaceContactEmail || smtpFromEmail || smtpUserEmail;
      if (!contactEmail) {
        console.warn('[VendorApplication] No se encontró correo destino para notificación de nuevas solicitudes');
        return;
      }

      console.log(`[VendorApplication] Enviando notificación de nueva solicitud a: ${contactEmail}`);

      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style="color: #1f2937;">Nueva solicitud de vendedor</h2>
          <p>Se recibió una nueva solicitud desde el formulario de registro de vendedores.</p>
          <ul>
            <li><strong>Nombre:</strong> ${application.fullName}</li>
            <li><strong>Email:</strong> ${application.email}</li>
            <li><strong>RUT:</strong> ${application.rut}</li>
            <li><strong>Tienda:</strong> ${application.storeName || 'Sin nombre'}</li>
            <li><strong>Región:</strong> ${application.region || 'No indicada'}</li>
            <li><strong>Ciudad:</strong> ${application.city || 'No indicada'}</li>
          </ul>
          <p>Revísala en el panel de administración.</p>
        </div>
      `;

      await this.emailService.sendEmail(
        smtpConfig,
        contactEmail,
        `Nueva solicitud de vendedor: ${application.fullName}`,
        body,
      );
      console.log(`[VendorApplication] Notificación enviada correctamente a: ${contactEmail}`);
    } catch (error) {
      console.error('[VendorApplication] Error enviando notificación al administrador:', error.message);
    }
  }

  private async sendApplicationRejectedEmail(application: VendorApplication) {
    try {
      const smtpConfig = await this.smtpSettingsService.getSmtpConfig();
      if (!smtpConfig) {
        return;
      }

      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style="color: #991b1b;">Estado de tu solicitud de vendedor</h2>
          <p>Hola ${application.fullName},</p>
          <p>Tu solicitud fue rechazada por el siguiente motivo:</p>
          <blockquote style="background: #fef2f2; border-left: 4px solid #ef4444; margin: 12px 0; padding: 12px;">${application.adminNotes}</blockquote>
          <p>Puedes volver a postular cuando quieras desde el formulario de registro.</p>
        </div>
      `;

      await this.emailService.sendEmail(
        smtpConfig,
        application.email,
        'Resultado de tu solicitud de vendedor',
        body,
      );
    } catch (error) {
      console.error('Failed to send rejected application email:', error.message);
    }
  }

  /**
   * Migración: Crear páginas predefinidas para todos los vendors existentes
   * Este método ejecuta la misma lógica que el script migrate-default-pages.ts
   */
  async migrateDefaultPagesForAllVendors(): Promise<any> {
    console.log('🚀 Starting default pages migration for all vendors...\n');

    const vendors = await this.vendorsRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });

    console.log(`📊 Found ${vendors.length} active vendors\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results: Array<{
      vendor: string;
      status: 'success' | 'skipped' | 'error';
      reason?: string;
      pagesCreated?: number;
      error?: string;
    }> = [];

    for (const vendor of vendors) {
      console.log(`\n📦 Processing vendor: ${vendor.storeName} (${vendor.slug})`);

      try {
        // Verificar si ya tiene las páginas predefinidas
        const existingPages = await this.pagesRepository.find({
          where: { vendorId: vendor.id },
        });

        const hasDefaultPages = existingPages.some(p => 
          p.slug === 'politicas-de-envio' ||
          p.slug === 'preguntas-frecuentes' ||
          p.slug === 'politicas-de-cambios-y-devoluciones' ||
          p.slug === 'terminos-y-condiciones'
        );

        if (hasDefaultPages) {
          console.log(`⏭️  Vendor already has default pages, skipping...`);
          skippedCount++;
          results.push({
            vendor: vendor.storeName,
            status: 'skipped',
            reason: 'Already has default pages',
          });
          continue;
        }

        // Llamar a la función createDefaultPages
        await this.createDefaultPages(vendor.id, vendor.storeName);
        await this.ensureDefaultFooterLayoutForNewStore(vendor.id);

        processedCount++;
        console.log(`✅ Vendor ${vendor.storeName} completed successfully`);
        results.push({
          vendor: vendor.storeName,
          status: 'success',
          pagesCreated: 4,
        });

      } catch (error) {
        console.error(`❌ Error processing vendor ${vendor.storeName}:`, error.message);
        errorCount++;
        results.push({
          vendor: vendor.storeName,
          status: 'error',
          error: error.message,
        });
      }
    }

    const summary = {
      totalVendors: vendors.length,
      successfullyProcessed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      results,
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Migration Summary:');
    console.log(`   Total vendors: ${summary.totalVendors}`);
    console.log(`   ✅ Successfully processed: ${summary.successfullyProcessed}`);
    console.log(`   ⏭️  Skipped (already had pages): ${summary.skipped}`);
    console.log(`   ❌ Errors: ${summary.errors}`);
    console.log(`${'='.repeat(60)}\n`);

    return summary;
  }
}
