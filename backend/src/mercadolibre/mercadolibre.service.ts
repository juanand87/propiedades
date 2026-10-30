import { BadRequestException, ConflictException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Product, ProductCondition, ProductStatus } from '../products/product.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { MercadoLibreOrderSync } from './mercadolibre-order-sync.entity';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import { Order, OrderStatus } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Vendor } from '../vendors/vendor.entity';
import { ProductQuestion } from '../questions/product-question.entity';
import { ProductQuestionMessage } from '../questions/product-question-message.entity';

const API_URL = 'https://api.mercadolibre.com';

@Injectable()
export class MercadoLibreService {
  private readonly tokenRefreshes = new Map<string, Promise<string>>();
  private readonly questionSyncs = new Set<string>();
  private questionCronRunning = false;

  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(VendorSettings) private readonly settings: Repository<VendorSettings>,
    @InjectRepository(MercadoLibreOrderSync) private readonly orderSyncs: Repository<MercadoLibreOrderSync>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
    @InjectRepository(ProductQuestion) private readonly questions: Repository<ProductQuestion>,
    @InjectRepository(ProductQuestionMessage) private readonly questionMessages: Repository<ProductQuestionMessage>,
    private readonly config: ConfigService,
    private readonly marketplaceService: MarketplaceService,
    @Inject(forwardRef(() => WoocommerceService)) private readonly woocommerceService: WoocommerceService,
  ) {}

  private async getAppCredentials() {
    const [storedClientId, storedClientSecret, storedRedirectUri] = await Promise.all([
      this.marketplaceService.getPrivateSetting('mercadolibre_client_id'),
      this.marketplaceService.getPrivateSetting('mercadolibre_client_secret'),
      this.marketplaceService.getPrivateSetting('mercadolibre_redirect_uri'),
    ]);
    const clientId = storedClientId || this.config.get<string>('MERCADOLIBRE_CLIENT_ID') || '';
    const clientSecret = storedClientSecret || this.config.get<string>('MERCADOLIBRE_CLIENT_SECRET') || '';
    const redirectUri = storedRedirectUri || this.config.get<string>('MERCADOLIBRE_REDIRECT_URI') || '';
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('La integración de Mercado Libre aún no está configurada por el administrador.');
    }
    return { clientId, clientSecret, redirectUri };
  }

  private normalizePublicationConfiguration(config: any = {}) {
    config = config || {};
    return {
      freeShipping: Boolean(config.freeShipping),
      listingType: config.listingType === 'gold_pro' ? 'gold_pro' : 'gold_special',
      defaultMusicCategoryId: String(config.defaultMusicCategoryId || '').trim(),
      categoryRules: Array.isArray(config.categoryRules) ? config.categoryRules.map((rule: any) => ({
        categoryId: String(rule.categoryId || ''),
        priceAdjustmentType: rule.priceAdjustmentType === 'percentage' ? 'percentage' : 'fixed',
        priceAdjustmentValue: Math.max(0, Number(rule.priceAdjustmentValue) || 0),
        titlePrefix: String(rule.titlePrefix || '').trim(),
        titleSuffix: String(rule.titleSuffix || '').trim(),
      })).filter((rule: any) => rule.categoryId) : [],
      ...(config.questionSync && typeof config.questionSync === 'object'
        ? { questionSync: config.questionSync }
        : {}),
    };
  }

  async getPublicationConfiguration(vendorId: string) {
    try {
      const settings = await this.settings.findOneBy({ vendorId });
      const products = await this.products.createQueryBuilder('product')
        .leftJoinAndSelect('product.categories', 'category')
        .where('product.vendorId = :vendorId', { vendorId })
        .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
        .getMany();
      const categories = [...new Map(products.flatMap(product => product.categories || []).map(category => [category.id, {
        id: category.id, name: category.name,
      }])).values()];
      return { ...this.normalizePublicationConfiguration(settings?.mercadoLibreConfig), categories };
    } catch (error: any) {
      console.error('[MercadoLibre] Unable to load publication configuration', error);
      throw new BadRequestException(`No se pudo cargar la configuración de Mercado Libre: ${error.message}`);
    }
  }

  async savePublicationConfiguration(vendorId: string, config: any) {
    let settings = await this.settings.findOneBy({ vendorId });
    if (!settings) settings = this.settings.create({ vendorId });
    settings.mercadoLibreConfig = this.normalizePublicationConfiguration(config);
    await this.settings.save(settings);
    return this.getPublicationConfiguration(vendorId);
  }

  async getAppConfiguration() {
    const [clientId, redirectUri, clientSecret] = await Promise.all([
      this.marketplaceService.getPrivateSetting('mercadolibre_client_id'),
      this.marketplaceService.getPrivateSetting('mercadolibre_redirect_uri'),
      this.marketplaceService.getPrivateSetting('mercadolibre_client_secret'),
    ]);
    return { clientId: clientId || '', redirectUri: redirectUri || '', secretConfigured: Boolean(clientSecret) };
  }

  async saveAppConfiguration(data: { clientId: string; clientSecret?: string; redirectUri: string }) {
    if (!data.clientId?.trim() || !data.redirectUri?.trim()) throw new BadRequestException('Client ID y Redirect URI son obligatorios');
    const updates = [
      this.marketplaceService.updatePrivateSetting('mercadolibre_client_id', data.clientId.trim()),
      this.marketplaceService.updatePrivateSetting('mercadolibre_redirect_uri', data.redirectUri.trim()),
    ];
    if (data.clientSecret?.trim()) updates.push(this.marketplaceService.updatePrivateSetting('mercadolibre_client_secret', data.clientSecret.trim()));
    await Promise.all(updates);
    return this.getAppConfiguration();
  }

  async getConnection(vendorId: string) {
    const settings = await this.settings.findOneBy({ vendorId });
    return {
      connected: Boolean(settings?.mercadoLibreRefreshToken && settings?.mercadoLibreUserId),
      userId: settings?.mercadoLibreUserId || null,
      siteId: settings?.mercadoLibreSiteId || 'MLC',
      appConfigured: Boolean((await this.getAppConfiguration()).clientId && (await this.getAppConfiguration()).secretConfigured && (await this.getAppConfiguration()).redirectUri),
    };
  }

  async beginAuthorization(vendorId: string) {
    const credentials = await this.getAppCredentials();
    const settings = await this.settings.findOneBy({ vendorId });
    if (!settings) throw new NotFoundException('Configuración de tienda no encontrada');
    const state = randomBytes(32).toString('hex');
    settings.mercadoLibreOAuthState = state;
    await this.settings.save(settings);
    const authorizationUrl = `https://auth.mercadolibre.cl/authorization?response_type=code&client_id=${encodeURIComponent(credentials.clientId)}&redirect_uri=${encodeURIComponent(credentials.redirectUri)}&state=${state}`;
    return { authorizationUrl };
  }

  async completeAuthorization(code: string, state: string) {
    const credentials = await this.getAppCredentials();
    if (!code || !state) throw new BadRequestException('Autorización inválida');
    const settings = await this.settings.findOneBy({ mercadoLibreOAuthState: state });
    if (!settings) throw new BadRequestException('La autorización expiró o no corresponde a una tienda');
    const response = await axios.post(`${API_URL}/oauth/token`, new URLSearchParams({
      grant_type: 'authorization_code', client_id: credentials.clientId, client_secret: credentials.clientSecret,
      code, redirect_uri: credentials.redirectUri,
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const authorizedUserId = String(response.data.user_id);
    const existingConnection = await this.settings.findOneBy({ mercadoLibreUserId: authorizedUserId });
    if (existingConnection && existingConnection.vendorId !== settings.vendorId) {
      settings.mercadoLibreOAuthState = null;
      await this.settings.save(settings);
      throw new ConflictException('Esta cuenta de Mercado Libre ya está conectada a otra tienda de MundoBeat. Desconéctala allí antes de continuar.');
    }
    const previousUserId = settings.mercadoLibreUserId
      || String(settings.mercadoLibreConfig?.lastDisconnectedUserId || '');
    if (previousUserId && previousUserId !== authorizedUserId) {
      await this.products.createQueryBuilder()
        .update(Product)
        .set({
          mercadoLibreItemId: null as any,
          mercadoLibreUserProductId: null as any,
          mercadoLibreCategoryId: null as any,
          mercadoLibreStatus: null as any,
          mercadoLibreStatusDetail: null as any,
          mercadoLibreStatusUpdatedAt: null as any,
        })
        .where('vendorId = :vendorId', { vendorId: settings.vendorId })
        .execute();
    }
    settings.mercadoLibreAccessToken = response.data.access_token;
    settings.mercadoLibreRefreshToken = response.data.refresh_token;
    settings.mercadoLibreUserId = authorizedUserId;
    settings.mercadoLibreTokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);
    settings.mercadoLibreOAuthState = null;
    settings.mercadoLibreConfig = this.normalizePublicationConfiguration(settings.mercadoLibreConfig);
    await this.settings.save(settings);
    void this.syncQuestions(settings.vendorId, true).catch((error) => {
      console.error(`[MercadoLibre] No se pudieron recuperar las preguntas al reconectar la tienda ${settings.vendorId}`, error);
    });
    return { connected: true, message: 'Cuenta de Mercado Libre conectada. Puedes cerrar esta ventana.' };
  }

  async disconnectAccount(vendorId: string) {
    const settings = await this.settings.findOneBy({ vendorId });
    if (!settings) throw new NotFoundException('Configuración de tienda no encontrada');

    const disconnectedUserId = settings.mercadoLibreUserId;
    let revoked = false;
    let warning = '';
    if (settings.mercadoLibreRefreshToken && disconnectedUserId) {
      try {
        const token = await this.getAccessToken(vendorId);
        const credentials = await this.getAppCredentials();
        await axios.delete(
          `${API_URL}/users/${encodeURIComponent(disconnectedUserId)}/applications/${encodeURIComponent(credentials.clientId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        revoked = true;
      } catch (error: any) {
        warning = `Mercado Libre no confirmó la revocación remota: ${this.getMercadoLibreError(error)}`;
      }
    }

    settings.mercadoLibreConfig = {
      ...this.normalizePublicationConfiguration(settings.mercadoLibreConfig),
      ...(disconnectedUserId ? { lastDisconnectedUserId: disconnectedUserId } : {}),
    };
    settings.mercadoLibreAccessToken = null as any;
    settings.mercadoLibreRefreshToken = null as any;
    settings.mercadoLibreUserId = null as any;
    settings.mercadoLibreTokenExpiresAt = null as any;
    settings.mercadoLibreOAuthState = null;
    await this.settings.save(settings);

    return {
      success: true,
      revoked,
      warning: warning || null,
      message: warning
        ? 'La tienda fue desconectada localmente. Revisa los permisos de la aplicación en Mercado Libre.'
        : 'La tienda fue desconectada de Mercado Libre.',
    };
  }

  async closeAccountPublications(vendorId: string) {
    const products = await this.products.createQueryBuilder('product')
      .innerJoin('product.vendor', 'vendor')
      .where('vendor.id = :vendorId', { vendorId })
      .andWhere('product.mercadoLibreItemId IS NOT NULL')
      .orderBy('product.createdAt', 'ASC')
      .take(1)
      .getMany();

    const failures: Array<{ productId: string; title: string; reason: string }> = [];
    let closed = 0;
    let paused = 0;
    for (const product of products) {
      try {
        const result = await this.disconnectPublishedProduct(product.id, vendorId);
        if (result.action === 'paused') {
          paused++;
          await this.products.update(product.id, {
            mercadoLibreItemId: null as any,
            mercadoLibreUserProductId: null as any,
            mercadoLibreStatus: null as any,
            mercadoLibreStatusDetail: null as any,
            mercadoLibreStatusUpdatedAt: null as any,
          });
        } else {
          closed++;
        }
      } catch (error: any) {
        failures.push({
          productId: product.id,
          title: product.title,
          reason: error?.message || 'No se pudo retirar la publicación',
        });
      }
    }

    const remaining = await this.products.createQueryBuilder('product')
      .innerJoin('product.vendor', 'vendor')
      .where('vendor.id = :vendorId', { vendorId })
      .andWhere('product.mercadoLibreItemId IS NOT NULL')
      .getCount();
    const nextProduct = remaining > 0
      ? await this.products.createQueryBuilder('product')
        .innerJoin('product.vendor', 'vendor')
        .where('vendor.id = :vendorId', { vendorId })
        .andWhere('product.mercadoLibreItemId IS NOT NULL')
        .orderBy('product.createdAt', 'ASC')
        .select(['product.id', 'product.title'])
        .getOne()
      : null;

    return {
      processed: products.length,
      processedProductTitle: products[0]?.title || null,
      closed,
      paused,
      failed: failures.length,
      failures,
      remaining,
      nextProductTitle: nextProduct?.title || null,
    };
  }

  async getAccountPublicationRemovalStatus(vendorId: string) {
    const query = this.products.createQueryBuilder('product')
      .innerJoin('product.vendor', 'vendor')
      .where('vendor.id = :vendorId', { vendorId })
      .andWhere('product.mercadoLibreItemId IS NOT NULL');
    const [total, nextProduct] = await Promise.all([
      query.clone().getCount(),
      query.clone()
        .orderBy('product.createdAt', 'ASC')
        .select(['product.id', 'product.title'])
        .getOne(),
    ]);
    return {
      total,
      nextProductTitle: nextProduct?.title || null,
    };
  }

  private async getAccessToken(vendorId: string) {
    const settings = await this.settings.findOneBy({ vendorId });
    if (!settings?.mercadoLibreRefreshToken) throw new BadRequestException('Conecta primero una cuenta de Mercado Libre');
    if (settings.mercadoLibreAccessToken && settings.mercadoLibreTokenExpiresAt && settings.mercadoLibreTokenExpiresAt > new Date(Date.now() + 60_000)) return settings.mercadoLibreAccessToken;
    const activeRefresh = this.tokenRefreshes.get(vendorId);
    if (activeRefresh) return activeRefresh;

    const refresh = this.refreshAccessToken(vendorId, settings.mercadoLibreRefreshToken)
      .finally(() => {
        if (this.tokenRefreshes.get(vendorId) === refresh) this.tokenRefreshes.delete(vendorId);
      });
    this.tokenRefreshes.set(vendorId, refresh);
    return refresh;
  }

  private async refreshAccessToken(vendorId: string, attemptedRefreshToken: string): Promise<string> {
    const credentials = await this.getAppCredentials();
    try {
      const response = await axios.post(`${API_URL}/oauth/token`, new URLSearchParams({
        grant_type: 'refresh_token', client_id: credentials.clientId, client_secret: credentials.clientSecret,
        refresh_token: attemptedRefreshToken,
      }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const current = await this.settings.findOneBy({ vendorId });
      if (!current) throw new BadRequestException('Configuración de Mercado Libre no encontrada');
      current.mercadoLibreAccessToken = response.data.access_token;
      current.mercadoLibreRefreshToken = response.data.refresh_token;
      current.mercadoLibreTokenExpiresAt = new Date(Date.now() + Number(response.data.expires_in || 0) * 1000);
      await this.settings.save(current);
      return current.mercadoLibreAccessToken;
    } catch (error: any) {
      const errorCode = String(error?.response?.data?.error || '');
      if (errorCode === 'invalid_grant') {
        await new Promise((resolve) => setTimeout(resolve, 350));
        const latest = await this.settings.findOneBy({ vendorId });
        if (latest?.mercadoLibreRefreshToken && latest.mercadoLibreRefreshToken !== attemptedRefreshToken) {
          if (latest.mercadoLibreAccessToken && latest.mercadoLibreTokenExpiresAt && latest.mercadoLibreTokenExpiresAt > new Date(Date.now() + 30_000)) return latest.mercadoLibreAccessToken;
          return this.refreshAccessToken(vendorId, latest.mercadoLibreRefreshToken);
        }
        throw new BadRequestException('La autorización de Mercado Libre expiró o fue revocada. Reconecta la cuenta desde Configuración → Integraciones → Mercado Libre.');
      }
      throw new BadRequestException(`No se pudo renovar la conexión con Mercado Libre: ${this.getMercadoLibreError(error)}`);
    }
  }

  async getCategorySuggestions(productId: string, vendorId: string) {
    const product = await this.findProduct(productId, vendorId);
    const token = await this.getAccessToken(vendorId);
    const siteId = (await this.settings.findOneBy({ vendorId }))?.mercadoLibreSiteId || 'MLC';
    const { data } = await axios.get(`${API_URL}/sites/${siteId}/domain_discovery/search`, {
      params: { q: product.title, limit: 3 }, headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  }

  async getDefaultMusicCategory(vendorId: string) {
    const token = await this.getAccessToken(vendorId);
    const settings = await this.settings.findOneBy({ vendorId });
    const config = this.normalizePublicationConfiguration(settings?.mercadoLibreConfig);

    if (config.defaultMusicCategoryId) {
      const savedCategory = await this.getPublishableCategory(config.defaultMusicCategoryId, token);
      if (savedCategory) {
        return {
          id: savedCategory.id,
          name: savedCategory.name,
          attributes: await this.getCategoryAttributes(savedCategory.id, vendorId),
        };
      }
    }

    const queries = ['disco de musica', 'album musical', 'vinilo musica', 'cd musica'];
    const reviewedCategoryIds = new Set<string>();
    for (const query of queries) {
      const { data: suggestions } = await axios.get(`${API_URL}/sites/MLC/domain_discovery/search`, {
        params: { q: query, limit: 8 }, headers: { Authorization: `Bearer ${token}` },
      });
      for (const suggestion of suggestions) {
        const suggestionText = this.normalizeAttributeName(
          `${suggestion.category_name || ''} ${suggestion.domain_name || ''} ${suggestion.domain_id || ''}`,
        );
        if (!/(musica|music|album|vinil|vinyl|\bcd\b|record)/i.test(suggestionText)) continue;
        if (!suggestion.category_id || reviewedCategoryIds.has(suggestion.category_id)) continue;
        reviewedCategoryIds.add(suggestion.category_id);

        const category = await this.getPublishableCategory(suggestion.category_id, token);
        if (category) {
          await this.rememberDefaultMusicCategory(vendorId, category.id);
          return {
            id: category.id,
            name: category.name || suggestion.category_name,
            attributes: await this.getCategoryAttributes(category.id, vendorId),
          };
        }
      }
    }
    throw new BadRequestException('No se encontró una categoría publicable de Música en Mercado Libre Chile');
  }

  private async getPublishableCategory(categoryId: string, token: string) {
    try {
      const { data } = await this.withMercadoLibreRetry(
        () => axios.get(`${API_URL}/categories/${categoryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        `consultar categoría ${categoryId}`,
      );
      return data?.settings?.listing_allowed ? data : null;
    } catch {
      return null;
    }
  }

  private async rememberDefaultMusicCategory(vendorId: string, categoryId: string) {
    let settings = await this.settings.findOneBy({ vendorId });
    if (!settings) settings = this.settings.create({ vendorId });
    const config = this.normalizePublicationConfiguration(settings.mercadoLibreConfig);
    if (config.defaultMusicCategoryId === categoryId) return;
    settings.mercadoLibreConfig = { ...config, defaultMusicCategoryId: categoryId };
    await this.settings.save(settings);
  }

  async getCategoryAttributes(categoryId: string, vendorId: string) {
    const token = await this.getAccessToken(vendorId);
    const { data } = await axios.get(`${API_URL}/categories/${categoryId}/attributes`, { headers: { Authorization: `Bearer ${token}` } });
    return data.filter((attribute: any) => attribute.tags?.required || attribute.tags?.catalog_required);
  }

  async publishProduct(productId: string, vendorId: string, categoryId?: string) {
    const product = await this.findProduct(productId, vendorId);
    if (!product.artist?.trim() || !product.album?.trim()) {
      throw new BadRequestException('Para publicar música debes completar el artista y el álbum del producto');
    }

    if (!product.images?.length) throw new BadRequestException('El producto necesita al menos una imagen para publicarse');
    const token = await this.getAccessToken(vendorId);
    const publicationConfig = await this.getPublicationConfig(vendorId);
    const preferredCategoryId = categoryId?.trim()
      || product.mercadoLibreCategoryId?.trim()
      || publicationConfig.defaultMusicCategoryId;
    const preferredCategory = preferredCategoryId
      ? await this.getPublishableCategory(preferredCategoryId, token)
      : null;
    const resolvedCategoryId = preferredCategory?.id || (await this.getDefaultMusicCategory(vendorId)).id;
    const categoryRule = this.getCategoryRule(product, publicationConfig);
    const { data: categoryAttributes } = await this.withMercadoLibreRetry(
      () => axios.get(`${API_URL}/categories/${resolvedCategoryId}/attributes`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      `consultar atributos de ${resolvedCategoryId}`,
    );
    const itemCondition = categoryAttributes.find((attribute: any) => attribute.id === 'ITEM_CONDITION');
    const acceptedConditionNames = product.condition === 'used' ? ['usado', 'used'] : ['nuevo', 'new'];
    const itemConditionValue = itemCondition?.values?.find(
      (value: any) => acceptedConditionNames.includes(value.name?.toLocaleLowerCase('es-CL')),
    );

    if (!itemConditionValue?.id) {
      throw new BadRequestException('La categoría de Mercado Libre no permite definir la condición del producto');
    }

    await this.rememberDefaultMusicCategory(vendorId, resolvedCategoryId);

    const attributes = this.buildMusicAttributes(product, categoryAttributes, itemConditionValue.id);
    if (product.mercadoLibreItemId) {
      try {
        await this.updatePublishedProductDetails(product, token, attributes);
        await this.syncProductDescription(product, product.mercadoLibreItemId, token);
        return this.syncPublishedProduct(productId, vendorId);
      } catch (error: any) {
        throw new BadRequestException(`Mercado Libre rechazó la sincronización: ${this.getMercadoLibreError(error)}`);
      }
    }

    const payload = {
      family_name: this.getPublicationTitle(product.title, categoryRule),
      category_id: resolvedCategoryId,
      price: this.getPublicationPrice(product, categoryRule),
      currency_id: 'CLP',
      available_quantity: product.stock,
      buying_mode: 'buy_it_now',
      listing_type_id: publicationConfig.listingType,
      ...(publicationConfig.freeShipping ? { shipping: { mode: 'me2', free_shipping: true } } : {}),
      pictures: product.images.map(source => ({ source })),
      attributes,
    };
    let data: any;
    try {
      const response = await axios.post(`${API_URL}/items`, payload, { headers: { Authorization: `Bearer ${token}` } });
      data = response.data;
    } catch (error: any) {
      const causes = error.response?.data?.cause;
      const causeDetails = Array.isArray(causes)
        ? causes.map((cause: any) => cause.message || cause.code).filter(Boolean).join('; ')
        : '';
      const message = causeDetails || error.response?.data?.message || error.message;
      throw new BadRequestException(`Mercado Libre rechazó la publicación: ${message}`);
    }
    product.mercadoLibreItemId = data.id;
    product.mercadoLibreUserProductId = data.user_product_id || product.mercadoLibreUserProductId;
    product.mercadoLibreCategoryId = resolvedCategoryId;
    await this.persistItemState(product, data);
    await this.syncProductDescription(product, data.id, token);
    return { itemId: data.id, permalink: data.permalink, status: data.status };
  }

  private buildMusicAttributes(product: Product, categoryAttributes: any[], itemConditionId: string) {
    const attributeByName = (name: string) => categoryAttributes.find(
      (attribute: any) => this.normalizeAttributeName(attribute.name) === this.normalizeAttributeName(name),
    );
    const textAttribute = (name: string, value?: string | number) => {
      const attribute = attributeByName(name);
      return attribute && value !== undefined && String(value).trim()
        ? { id: attribute.id, value_name: String(value).trim() }
        : null;
    };
    const selectedAttribute = (name: string, value?: string) => {
      const attribute = attributeByName(name);
      if (!attribute || !value?.trim()) return null;
      const normalizedValue = this.normalizeAttributeName(value);
      const option = attribute.values?.find((item: any) => {
        const optionName = this.normalizeAttributeName(item.name);
        return normalizedValue.includes(optionName) || optionName.includes(normalizedValue);
      });
      return option ? { id: attribute.id, value_id: option.id } : null;
    };
    const booleanAttribute = (name: string, value: boolean) => selectedAttribute(name, value ? 'Sí' : 'No');
    const trackCount = this.countTracks(product.tracklist);
    return [
      { id: 'ITEM_CONDITION', value_id: itemConditionId },
      { id: 'MUSIC_ARTIST_NAME', value_name: product.artist.trim() },
      { id: 'ALBUM_NAME', value_name: product.album.trim() },
      textAttribute('Compañía productora', product.label),
      textAttribute('Tipo de álbum', product.albumType || product.format),
      textAttribute('Versión del álbum', product.albumVersion),
      selectedAttribute('Formato', this.getMercadoLibreFormat(product.format)),
      textAttribute('Año de lanzamiento', product.year),
      textAttribute('Tipo de envase', product.packageType || 'Caja'),
      booleanAttribute('Incluye pistas adicionales', product.hasBonusTracks),
      textAttribute('Cantidad de canciones', trackCount || undefined),
      textAttribute('Cantidad de piezas', product.mediaQuantity),
      textAttribute('Duración total del álbum', product.totalDurationMinutes ? `${product.totalDurationMinutes} m` : undefined),
      textAttribute('Accesorios incluidos', product.includedAccessories) || selectedAttribute('Accesorios incluidos', 'No aplica'),
      textAttribute('Género', product.genre),
      textAttribute('Origen', product.country),
      ...(product.sku ? [{ id: 'SELLER_SKU', value_name: product.sku }] : []),
    ].filter(Boolean);
  }

  private async getPublicationConfig(vendorId: string) {
    const settings = await this.settings.findOneBy({ vendorId });
    return this.normalizePublicationConfiguration(settings?.mercadoLibreConfig);
  }

  private getCategoryRule(product: Product, config: any) {
    return config.categoryRules.find((rule: any) => product.categories?.some(category => category.id === rule.categoryId));
  }

  private getPublicationTitle(title: string, rule?: any) {
    return [rule?.titlePrefix, title.trim(), rule?.titleSuffix].filter(Boolean).join(' ').slice(0, 60);
  }

  private getPublicationPrice(product: Product, rule?: any) {
    const basePrice = Number(product.isOnSale && product.salePrice ? product.salePrice : product.price);
    const adjustment = Number(rule?.priceAdjustmentValue || 0);
    return Math.round(rule?.priceAdjustmentType === 'percentage' ? basePrice * (1 + adjustment / 100) : basePrice + adjustment);
  }

  private async updatePublishedProductDetails(product: Product, token: string, attributes: any[]) {
    await this.withMercadoLibreRetry(
      () => axios.put(`${API_URL}/items/${product.mercadoLibreItemId}`, {
        attributes,
      }, { headers: { Authorization: `Bearer ${token}` } }),
      `actualizar atributos de ${product.mercadoLibreItemId}`,
    );
  }

  private async syncProductDescription(product: Product, itemId: string, token: string) {
    const plainText = (product.shortDescription || product.description || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50000);
    if (!plainText) return;
    try {
      await this.withMercadoLibreRetry(
        () => axios.post(`${API_URL}/items/${itemId}/description`, { plain_text: plainText }, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        `actualizar descripción de ${itemId}`,
      );
    } catch (error: any) {
      if (error.response?.status === 400) {
        await this.withMercadoLibreRetry(
          () => axios.put(`${API_URL}/items/${itemId}/description?api_version=2`, { plain_text: plainText }, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          `reemplazar descripción de ${itemId}`,
        );
        return;
      }
      throw error;
    }
  }

  private countTracks(tracklist?: string) {
    if (!tracklist?.trim()) return 0;
    return tracklist.split(/\r?\n/).filter(track => /\S/.test(track)).length;
  }

  private getMercadoLibreFormat(format?: string) {
    return /digital|file|mp3|flac|streaming/i.test(format || '') ? 'Digital' : 'Físico';
  }

  private normalizeAttributeName(value?: string) {
    return value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CL').trim() || '';
  }

  private getMercadoLibreError(error: any) {
    const causes = error.response?.data?.cause;
    if (Array.isArray(causes)) {
      const messages = causes.map((cause: any) => cause.message || cause.code).filter(Boolean);
      if (messages.length) return messages.join('; ');
    }
    return error.response?.data?.error || error.response?.data?.message || error.message;
  }

  private isTransientMercadoLibreError(error: any) {
    const status = Number(error.response?.status || 0);
    const details = [
      error.response?.data?.error,
      error.response?.data?.message,
      error.message,
    ].filter(Boolean).join(' ').toLowerCase();
    return status === 409
      || status === 429
      || status >= 500
      || details.includes('local_rate_limited')
      || details.includes('too many requests');
  }

  private async withMercadoLibreRetry<T>(operation: () => Promise<T>, context: string, maxAttempts = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        if (!this.isTransientMercadoLibreError(error) || attempt === maxAttempts) throw error;
        const delayMs = 800 * (2 ** (attempt - 1));
        console.warn(
          `[MercadoLibre] Error temporal al ${context}; reintento ${attempt + 1}/${maxAttempts} en ${delayMs} ms`,
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  private async persistItemState(product: Product, item: any) {
    const status = String(item?.status || '').trim().toLowerCase();
    const details = [
      item?.status_detail,
      ...(Array.isArray(item?.sub_status) ? item.sub_status : []),
    ].map(value => String(value || '').trim()).filter(Boolean);

    product.mercadoLibreStatus = (status || null) as any;
    product.mercadoLibreStatusDetail = (details.join(', ') || null) as any;
    product.mercadoLibreStatusUpdatedAt = new Date();
    await this.products.save(product);
  }

  async syncPublishedProduct(productId: string, vendorId: string) {
    const product = await this.products.findOne({ where: { id: productId }, relations: ['vendor', 'categories'] });
    if (!product?.mercadoLibreItemId || product.vendor.id !== vendorId) return null;
    const token = await this.getAccessToken(vendorId);
    const publicationConfig = await this.getPublicationConfig(vendorId);
    const categoryRule = this.getCategoryRule(product, publicationConfig);
    const availableQuantity = Math.max(0, Number(product.stock) || 0);
    const shouldBeActive = product.status === ProductStatus.ACTIVE && availableQuantity > 0;
    const payload: Record<string, any> = {
      price: this.getPublicationPrice(product, categoryRule),
      ...(publicationConfig.freeShipping ? { shipping: { mode: 'me2', free_shipping: true } } : {}),
    };
    if (availableQuantity === 0) {
      // Mercado Libre solo acepta stock 0 para publicaciones nuevas. En usados,
      // pausar impide ventas sin provocar el error de validación de cantidad.
      if (product.condition === ProductCondition.NEW) payload.available_quantity = 0;
      else payload.status = 'paused';
    } else {
      payload.available_quantity = availableQuantity;
      payload.status = shouldBeActive ? 'active' : 'paused';
    }
    const { data } = await this.withMercadoLibreRetry(
      () => axios.put(`${API_URL}/items/${product.mercadoLibreItemId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      `sincronizar ${product.mercadoLibreItemId}`,
    );
    await this.persistItemState(product, data);
    if (data.listing_type_id !== publicationConfig.listingType) {
      await this.withMercadoLibreRetry(
        () => axios.post(`${API_URL}/items/${product.mercadoLibreItemId}/listing_type`, { id: publicationConfig.listingType }, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        `actualizar tipo de publicación de ${product.mercadoLibreItemId}`,
      );
    }
    return { itemId: data.id, status: data.status };
  }

  async syncStockFromLocal(productId: string) {
    const product = await this.products.findOne({ where: { id: productId }, relations: ['vendor'] });
    if (!product?.mercadoLibreItemId || !product.vendor?.id) return null;
    return this.syncPublishedProduct(productId, product.vendor.id);
  }

  async closePublishedProduct(productId: string, vendorId: string) {
    const product = await this.products.findOne({ where: { id: productId }, relations: ['vendor'] });
    if (!product || product.vendor?.id !== vendorId) {
      throw new NotFoundException('Producto no encontrado para la tienda');
    }
    if (!product.mercadoLibreItemId) {
      return { success: true, skipped: true, message: 'Producto no publicado en Mercado Libre' };
    }

    const token = await this.getAccessToken(vendorId);
    try {
      const { data: currentItem } = await axios.get(`${API_URL}/items/${product.mercadoLibreItemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (currentItem?.status !== 'closed') {
        await axios.put(
          `${API_URL}/items/${product.mercadoLibreItemId}`,
          { status: 'closed' },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }
      product.mercadoLibreStatus = 'closed';
      product.mercadoLibreStatusDetail = null as any;
      product.mercadoLibreStatusUpdatedAt = new Date();
      await this.products.save(product);
      return { success: true, skipped: false, itemId: product.mercadoLibreItemId };
    } catch (error: any) {
      throw new BadRequestException(
        `No se pudo cerrar la publicación en Mercado Libre: ${this.getMercadoLibreError(error)}`,
      );
    }
  }

  async disconnectPublishedProduct(productId: string, vendorId: string) {
    const product = await this.products.findOne({ where: { id: productId }, relations: ['vendor'] });
    if (!product || product.vendor?.id !== vendorId) {
      throw new NotFoundException('Producto no encontrado para la tienda');
    }
    if (!product.mercadoLibreItemId) {
      return {
        success: true,
        action: 'disconnected',
        message: 'El producto ya está desconectado de Mercado Libre.',
      };
    }

    const itemId = product.mercadoLibreItemId;
    const token = await this.getAccessToken(vendorId);
    const headers = { Authorization: `Bearer ${token}` };
    let closeError: any = null;

    try {
      const { data: currentItem } = await axios.get(`${API_URL}/items/${itemId}`, { headers });
      if (currentItem?.status !== 'closed') {
        await axios.put(`${API_URL}/items/${itemId}`, { status: 'closed' }, { headers });
      }
    } catch (error: any) {
      closeError = error;
    }

    if (!closeError) {
      product.mercadoLibreItemId = null as any;
      product.mercadoLibreUserProductId = null as any;
      product.mercadoLibreStatus = null as any;
      product.mercadoLibreStatusDetail = null as any;
      product.mercadoLibreStatusUpdatedAt = null as any;
      await this.products.save(product);
      return {
        success: true,
        action: 'closed',
        itemId,
        message: 'La publicación fue finalizada y el producto quedó desconectado de Mercado Libre.',
      };
    }

    try {
      const { data } = await axios.put(`${API_URL}/items/${itemId}`, { status: 'paused' }, { headers });
      await this.persistItemState(product, { ...data, status: data?.status || 'paused' });
      return {
        success: true,
        action: 'paused',
        itemId,
        status: data?.status || 'paused',
        message: 'Mercado Libre no permitió finalizar la publicación; quedó pausada y puede reconectarse sin duplicarla.',
      };
    } catch (pauseError: any) {
      throw new BadRequestException(
        `No se pudo finalizar ni pausar la publicación en Mercado Libre. Cierre: ${this.getMercadoLibreError(closeError)}. Pausa: ${this.getMercadoLibreError(pauseError)}`,
      );
    }
  }

  async reconnectPublishedProduct(productId: string, vendorId: string) {
    const product = await this.findProduct(productId, vendorId);
    if (!product.mercadoLibreItemId) {
      const published = await this.publishProduct(productId, vendorId, product.mercadoLibreCategoryId);
      return {
        ...published,
        action: 'published',
        message: 'El producto fue publicado nuevamente en Mercado Libre.',
      };
    }

    const itemId = product.mercadoLibreItemId;
    const token = await this.getAccessToken(vendorId);
    let currentItem: any;
    try {
      const response = await axios.get(`${API_URL}/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      currentItem = response.data;
    } catch (error: any) {
      throw new BadRequestException(
        `No se pudo revisar la publicación en Mercado Libre: ${this.getMercadoLibreError(error)}`,
      );
    }

    if (currentItem?.status === 'closed') {
      product.mercadoLibreItemId = null as any;
      product.mercadoLibreUserProductId = null as any;
      product.mercadoLibreStatus = null as any;
      product.mercadoLibreStatusDetail = null as any;
      product.mercadoLibreStatusUpdatedAt = null as any;
      await this.products.save(product);
      const published = await this.publishProduct(productId, vendorId, product.mercadoLibreCategoryId);
      return {
        ...published,
        action: 'published',
        previousItemId: itemId,
        message: 'La publicación anterior estaba finalizada; se creó una nueva en Mercado Libre.',
      };
    }

    const synced = await this.syncPublishedProduct(productId, vendorId);
    return {
      ...synced,
      action: synced?.status === 'active' ? 'reactivated' : 'paused',
      message: synced?.status === 'active'
        ? 'La publicación fue reactivada y sincronizada con Mercado Libre.'
        : 'La publicación fue sincronizada, pero permanece pausada porque el producto no tiene stock disponible.',
    };
  }

  acceptNotification(payload: unknown) {
    void this.processNotification(payload)
      .then((result) => console.log('[MercadoLibre] Notificación procesada', result))
      .catch((error) => console.error('[MercadoLibre] Error procesando notificación', error));
    return { received: true };
  }

  async processNotification(payload: unknown) {
    const notification = payload as { topic?: string; resource?: string; user_id?: string | number };
    if (!notification.resource || !notification.user_id) {
      console.warn('[MercadoLibre] Notificación ignorada por formato incompleto', notification);
      return { received: true, ignored: true };
    }

    if (notification.topic === 'questions') {
      return this.syncQuestionNotification(notification);
    }

    if (notification.topic === 'items') {
      return this.syncItemNotification(notification);
    }

    if (notification.topic !== 'orders_v2') return { received: true, ignored: true };

    const orderId = notification.resource.match(/^\/orders\/([^/?]+)/)?.[1];
    if (!orderId) return { received: true, ignored: true };

    const settings = await this.settings.findOneBy({ mercadoLibreUserId: String(notification.user_id) });
    if (!settings?.vendorId) {
      console.warn(`[MercadoLibre] Notification for unknown seller ${notification.user_id}`);
      return { received: true, ignored: true };
    }

    const token = await this.getAccessToken(settings.vendorId);
    const { data: order } = await axios.get(`${API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return this.syncOrder(settings.vendorId, String(orderId), order, token);
  }

  async answerQuestion(vendorId: string, questionId: string, text: string) {
    const token = await this.getAccessToken(vendorId);
    try {
      const { data } = await axios.post(`${API_URL}/answers`, {
        question_id: Number(questionId),
        text,
      }, { headers: { Authorization: `Bearer ${token}` } });
      return data;
    } catch (error: any) {
      throw new BadRequestException(`Mercado Libre rechazó la respuesta: ${this.getMercadoLibreError(error)}`);
    }
  }

  async getQuestionSyncStatus(vendorId: string) {
    const settings = await this.settings.findOneBy({ vendorId });
    const questionSync = settings?.mercadoLibreConfig?.questionSync || null;
    return {
      connected: Boolean(settings?.mercadoLibreRefreshToken && settings?.mercadoLibreUserId),
      running: this.questionSyncs.has(vendorId),
      ...(questionSync || {}),
    };
  }

  async syncQuestions(vendorId: string, full = false) {
    if (this.questionSyncs.has(vendorId)) {
      return { ...(await this.getQuestionSyncStatus(vendorId)), skipped: true, message: 'Ya hay una sincronización en curso.' };
    }

    const settings = await this.settings.findOneBy({ vendorId });
    if (!settings?.mercadoLibreUserId || !settings.mercadoLibreRefreshToken) {
      throw new BadRequestException('Conecta primero una cuenta de Mercado Libre');
    }

    this.questionSyncs.add(vendorId);
    const attemptedAt = new Date().toISOString();
    await this.saveQuestionSyncStatus(vendorId, { lastAttemptAt: attemptedAt, lastError: null });

    try {
      const token = await this.getAccessToken(vendorId);
      const limit = 50;
      const maxPages = full ? 20 : 1;
      let offset = 0;
      let total = 0;
      let fetched = 0;
      let imported = 0;
      let updated = 0;
      let unchanged = 0;
      let unlinked = 0;

      for (let page = 0; page < maxPages; page++) {
        const { data } = await axios.get(`${API_URL}/questions/search`, {
          params: {
            seller_id: settings.mercadoLibreUserId,
            api_version: 4,
            limit,
            offset,
            sort_fields: 'date_created',
            sort_types: 'DESC',
            status: full ? undefined : 'UNANSWERED',
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        const rows = Array.isArray(data?.questions) ? data.questions : [];
        total = Number(data?.total || rows.length);
        fetched += rows.length;

        for (const questionData of rows) {
          const outcome = await this.upsertQuestion(settings, questionData);
          if (outcome === 'imported') imported++;
          else if (outcome === 'updated') updated++;
          else if (outcome === 'unchanged') unchanged++;
          else if (outcome === 'unlinked') unlinked++;
        }

        offset += rows.length;
        if (!rows.length || rows.length < limit || offset >= total) break;
      }

      const result = {
        connected: true,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: new Date().toISOString(),
        total,
        fetched,
        imported,
        updated,
        unchanged,
        unlinked,
        truncated: fetched < total,
        lastError: null,
      };
      await this.saveQuestionSyncStatus(vendorId, result);
      console.log(`[MercadoLibre] Preguntas sincronizadas para ${vendorId}`, result);
      return result;
    } catch (error: any) {
      const message = this.getMercadoLibreError(error);
      await this.saveQuestionSyncStatus(vendorId, {
        lastAttemptAt: attemptedAt,
        lastError: message,
      });
      console.error(`[MercadoLibre] Falló la sincronización de preguntas para ${vendorId}: ${message}`);
      throw new BadRequestException(`No se pudieron sincronizar las preguntas de Mercado Libre: ${message}`);
    } finally {
      this.questionSyncs.delete(vendorId);
    }
  }

  @Cron('15 */15 * * * *')
  async syncQuestionsAutomatically() {
    if (this.questionCronRunning) return;
    this.questionCronRunning = true;
    try {
      const connectedStores = await this.settings.createQueryBuilder('settings')
        .select(['settings.vendorId'])
        .where('settings.mercadoLibreUserId IS NOT NULL')
        .andWhere('settings.mercadoLibreRefreshToken IS NOT NULL')
        .getMany();
      for (const store of connectedStores) {
        try {
          await this.syncQuestions(store.vendorId, false);
        } catch (error) {
          console.error(`[MercadoLibre] Sincronización automática fallida para ${store.vendorId}`, error);
        }
      }
    } finally {
      this.questionCronRunning = false;
    }
  }

  private async saveQuestionSyncStatus(vendorId: string, status: Record<string, unknown>) {
    const settings = await this.settings.findOneBy({ vendorId });
    if (!settings) return;
    settings.mercadoLibreConfig = {
      ...(settings.mercadoLibreConfig || {}),
      questionSync: {
        ...(settings.mercadoLibreConfig?.questionSync || {}),
        ...status,
      },
    };
    await this.settings.save(settings);
  }

  private async syncQuestionNotification(notification: { resource?: string; user_id?: string | number }) {
    const questionId = notification.resource?.match(/^\/questions\/(\d+)/)?.[1];
    if (!questionId) {
      console.warn('[MercadoLibre] Notificación de pregunta con recurso inválido', notification);
      return { received: true, ignored: true };
    }

    const settings = await this.settings.findOneBy({ mercadoLibreUserId: String(notification.user_id) });
    if (!settings?.vendorId) {
      console.warn(`[MercadoLibre] Pregunta ${questionId} ignorada: vendedor ${notification.user_id} no conectado`);
      return { received: true, ignored: true };
    }

    const token = await this.getAccessToken(settings.vendorId);
    const { data } = await axios.get(`${API_URL}/questions/${questionId}`, {
      params: { api_version: 4 },
      headers: { Authorization: `Bearer ${token}` },
    });
    const outcome = await this.upsertQuestion(settings, data);
    return { received: true, synchronized: outcome !== 'unlinked', outcome, questionId };
  }

  private async syncItemNotification(notification: { resource?: string; user_id?: string | number }) {
    const itemId = notification.resource?.match(/(?:^|\/)items\/([A-Z]{3}-?\d+)/i)?.[1]?.replace('-', '').toUpperCase();
    if (!itemId) {
      console.warn('[MercadoLibre] Notificacion de item con recurso invalido', notification);
      return { received: true, ignored: true };
    }

    const settings = await this.settings.findOneBy({ mercadoLibreUserId: String(notification.user_id) });
    if (!settings?.vendorId) {
      console.warn(`[MercadoLibre] Item ${itemId} ignorado: vendedor ${notification.user_id} no conectado`);
      return { received: true, ignored: true };
    }

    const product = await this.products.findOne({
      where: { mercadoLibreItemId: itemId, vendor: { id: settings.vendorId } },
    });
    if (!product) {
      console.warn(`[MercadoLibre] Item ${itemId} ignorado: no existe un producto vinculado en la tienda ${settings.vendorId}`);
      return { received: true, ignored: true, itemId };
    }

    const token = await this.getAccessToken(settings.vendorId);
    const { data } = await axios.get(`${API_URL}/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await this.persistItemState(product, data);

    return {
      received: true,
      synchronized: true,
      itemId,
      productId: product.id,
      status: product.mercadoLibreStatus,
    };
  }

  private async upsertQuestion(settings: VendorSettings, data: any): Promise<'imported' | 'updated' | 'unchanged' | 'unlinked'> {
    const questionId = String(data?.id || '');
    if (!questionId) throw new BadRequestException('Mercado Libre devolvió una pregunta sin identificador');

    const product = await this.products.findOne({
      where: { mercadoLibreItemId: String(data.item_id || ''), vendor: { id: settings.vendorId } },
    });
    if (!product) {
      console.warn(`[MercadoLibre] Pregunta ${questionId} ignorada: publicación ${data.item_id} sin producto vinculado`);
      return 'unlinked';
    }

    let question = await this.questions.findOne({
      where: { externalQuestionId: questionId },
      relations: ['messages'],
    });
    const imported = !question;
    if (!question) {
      question = await this.questions.save(this.questions.create({
        productId: product.id,
        vendorId: settings.vendorId,
        customerId: null,
        source: 'mercadolibre',
        externalQuestionId: questionId,
        externalBuyerId: String(data.buyer_id || data.from?.id || ''),
        externalStatus: String(data.status || ''),
        status: data.answer ? 'answered' : 'pending',
        reviewStatus: data.answer ? 'pending_review' : 'awaiting_response',
        createdAt: data.date_created ? new Date(data.date_created) : new Date(),
      }));
      question.messages = [];
    }

    const hasQuestion = (question.messages || []).some((message) => message.authorType === 'customer');
    if (!hasQuestion) {
      await this.questionMessages.save(this.questionMessages.create({
        questionId: question.id,
        authorId: null,
        authorType: 'customer',
        content: String(data.text || 'Pregunta no disponible'),
        createdAt: data.date_created ? new Date(data.date_created) : new Date(),
      }));
    }

    const nextExternalStatus = String(data.status || '');
    const nextStatus = data.answer ? 'answered' : 'pending';
    const nextReviewStatus = data.answer && question.reviewStatus === 'awaiting_response'
      ? 'pending_review'
      : question.reviewStatus;
    const questionChanged = imported
      || question.productId !== product.id
      || question.vendorId !== settings.vendorId
      || question.externalStatus !== nextExternalStatus
      || question.status !== nextStatus
      || question.reviewStatus !== nextReviewStatus;

    question.productId = product.id;
    question.vendorId = settings.vendorId;
    question.externalStatus = nextExternalStatus;
    question.status = nextStatus;
    question.reviewStatus = nextReviewStatus;
    if (!imported && questionChanged) await this.questions.save(question);

    const hasAnswer = (question.messages || []).some((message) => message.authorType === 'vendor');
    let answerImported = false;
    if (data.answer?.text && !hasAnswer) {
      const vendor = await this.vendors.findOne({ where: { id: settings.vendorId }, relations: ['user'] });
      await this.questionMessages.save(this.questionMessages.create({
        questionId: question.id,
        authorId: vendor?.user?.id || null,
        authorType: 'vendor',
        content: String(data.answer.text),
        createdAt: data.answer.date_created ? new Date(data.answer.date_created) : new Date(),
      }));
      answerImported = true;
    }

    if (imported) return 'imported';
    return questionChanged || answerImported || !hasQuestion ? 'updated' : 'unchanged';
  }

  private async syncOrder(vendorId: string, mercadoLibreOrderId: string, orderData: any, token: string) {
    let shipment: any = null;
    let pack: any = null;
    let relatedOrders = [orderData];
    const packId = orderData?.pack_id ? String(orderData.pack_id) : null;

    if (packId) {
      try {
        pack = (await axios.get(`${API_URL}/packs/${packId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })).data;
        const relatedOrderIds = (pack?.orders || [])
          .map((packOrder: any) => String(packOrder?.id || ''))
          .filter(Boolean);
        if (relatedOrderIds.length > 0) {
          relatedOrders = await Promise.all(relatedOrderIds.map(async (relatedOrderId: string) => {
            if (relatedOrderId === mercadoLibreOrderId) return orderData;
            return (await axios.get(`${API_URL}/orders/${relatedOrderId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })).data;
          }));
        }
      } catch (error: any) {
        console.warn(`[MercadoLibre] Pack ${packId} could not be loaded: ${this.getMercadoLibreError(error)}`);
      }
    }

    const shipmentId = pack?.shipment?.id || orderData?.shipping?.id;
    if (shipmentId) {
      try {
        shipment = (await axios.get(`${API_URL}/shipments/${shipmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })).data;
      } catch (error: any) {
        console.warn(`[MercadoLibre] Shipment ${shipmentId} could not be loaded: ${this.getMercadoLibreError(error)}`);
      }
    }

    await this.upsertLocalOrder(vendorId, packId || mercadoLibreOrderId, relatedOrders, shipment, pack);
    return this.syncOrderStock(vendorId, mercadoLibreOrderId, orderData);
  }

  private mapOrderStatus(status: string, shipmentStatus?: string): OrderStatus {
    const normalized = String(status || '').toLowerCase();
    const normalizedShipment = String(shipmentStatus || '').toLowerCase();
    if (normalized === 'cancelled') return OrderStatus.CANCELLED;
    if (normalized === 'refunded') return OrderStatus.REFUNDED;
    if (normalizedShipment === 'delivered') return OrderStatus.DELIVERED;
    if (['shipped', 'in_transit'].includes(normalizedShipment)) return OrderStatus.SHIPPED;
    if (['paid', 'confirmed'].includes(normalized)) return OrderStatus.PROCESSING;
    return OrderStatus.PENDING;
  }

  private getEffectiveShipmentStatus(shipment: any, shipmentEvents: any[] = []): string {
    if (shipmentEvents.some((event) => String(event?.status || '').toLowerCase() === 'delivered')) return 'delivered';
    const history = shipment?.status_history || shipment?.statusHistory || {};
    if (history?.date_delivered || history?.delivered || shipment?.delivered_date || shipment?.date_delivered) return 'delivered';
    const status = String(shipment?.status || shipment?.substatus || '').toLowerCase();
    return status;
  }

  private isShipmentCancellationLocked(shipment: any): boolean {
    const status = this.getEffectiveShipmentStatus(shipment);
    const substatus = String(shipment?.substatus || '').toLowerCase();
    return ['shipped', 'in_transit', 'delivered'].includes(status)
      || substatus.includes('printed')
      || (status === 'ready_to_ship' && substatus !== 'ready_to_print');
  }

  private async upsertLocalOrder(vendorId: string, localOrderId: string, sourceOrders: any[], shipment: any, pack: any) {
    const vendor = await this.vendors.findOneBy({ id: vendorId });
    if (!vendor) throw new NotFoundException('Tienda vinculada a Mercado Libre no encontrada');

    const ordersData = sourceOrders.length > 0 ? sourceOrders : [];
    const primaryOrder = ordersData[0] || {};
    const orderIds = ordersData.map((data) => String(data?.id || '')).filter(Boolean);
    const checkoutSessionId = pack?.id ? `pack:${localOrderId}` : localOrderId;
    let order = await this.orders.findOne({
      where: { vendorId, orderSource: 'mercadolibre', checkoutSessionId },
      relations: ['items'],
    });

    // Consolida órdenes locales antiguas que se guardaron una por cada ítem del mismo pack.
    if (!order && pack?.id && orderIds.length > 0) {
      const legacyOrders = await this.orders.createQueryBuilder('order')
        .where('order.vendorId = :vendorId', { vendorId })
        .andWhere('order.orderSource = :orderSource', { orderSource: 'mercadolibre' })
        .andWhere('order.externalOrderId IN (:...orderIds)', { orderIds })
        .orderBy('order.createdAt', 'ASC')
        .getMany();
      order = legacyOrders.shift() || null;
      const duplicateIds = legacyOrders.map((legacyOrder) => legacyOrder.id);
      if (duplicateIds.length > 0) {
        await this.orderItems.createQueryBuilder().delete().where('orderId IN (:...duplicateIds)', { duplicateIds }).execute();
        await this.orders.delete(duplicateIds);
      }
      if (order) order.items = await this.orderItems.find({ where: { order: { id: order.id } } });
    }

    const isNew = !order;
    const receiver = shipment?.receiver_address || primaryOrder?.shipping?.receiver_address || {};
    const buyer = primaryOrder?.buyer || {};
    const payments = ordersData.flatMap((data) => Array.isArray(data?.payments) ? data.payments : []);
    const approvedPayment = payments.find((payment: any) => ['approved', 'accredited'].includes(String(payment?.status || '').toLowerCase()));
    const subtotal = ordersData.reduce((total, data) => total + Number(data?.total_amount ?? data?.paid_amount ?? 0), 0);
    const shippingCost = Number(shipment?.shipping_option?.cost ?? primaryOrder?.shipping?.cost ?? 0);

    if (!order) {
      order = this.orders.create({
        orderNumber: `ML-${localOrderId}`,
        checkoutSessionId,
        vendorId,
        vendorSlug: vendor.slug,
        subtotal,
        shippingCost,
        tax: 0,
        total: ordersData.reduce((total, data) => total + Number(data?.paid_amount ?? data?.total_amount ?? 0), 0) || subtotal + shippingCost,
        paymentMethod: 'mercadolibre',
        paymentStatus: approvedPayment ? 'approved' : String(payments[0]?.status || 'pending'),
        paymentTransactionId: approvedPayment?.id ? String(approvedPayment.id) : null,
        shippingName: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || buyer.nickname || 'Comprador Mercado Libre',
        shippingAddress: receiver.address_line || receiver.street_name || 'Dirección protegida por Mercado Libre',
        shippingNumber: receiver.street_number ? String(receiver.street_number) : null,
        shippingCity: receiver.city?.name || receiver.city_name || 'Sin informar',
        shippingCountry: receiver.country?.name || 'Chile',
        shippingRegion: receiver.state?.name || receiver.state_name || null,
        shippingCommune: receiver.city?.name || receiver.city_name || null,
        shippingRut: receiver.receiver_id || 'No informado',
        shippingPhone: receiver.receiver_phone || buyer.phone?.number || 'No informado',
        shippingMethod: 'Mercado Envíos',
        shippingMethodCode: 'mercadolibre',
        orderSource: 'mercadolibre',
        isMarketplaceSale: false,
        commissionPercentage: 0,
        commissionAmount: 0,
        commissionStatus: 'external',
      } as Partial<Order>);
    }

    order.orderNumber = `ML-${localOrderId}`;
    order.checkoutSessionId = checkoutSessionId;
    order.subtotal = subtotal;
    order.shippingCost = shippingCost;
    order.total = ordersData.reduce((total, data) => total + Number(data?.paid_amount ?? data?.total_amount ?? 0), 0) || subtotal + shippingCost;
    order.status = this.mapOrderStatus(primaryOrder?.status, this.getEffectiveShipmentStatus(shipment));
    order.paymentStatus = approvedPayment ? 'approved' : String(payments[0]?.status || order.paymentStatus || 'pending');
    order.paymentTransactionId = approvedPayment?.id ? String(approvedPayment.id) : order.paymentTransactionId;
    order.externalOrderId = String(primaryOrder?.id || localOrderId);
    order.externalShippingId = shipment?.id ? String(shipment.id) : (primaryOrder?.shipping?.id ? String(primaryOrder.shipping.id) : null);
    order.externalShippingStatus = this.getEffectiveShipmentStatus(shipment) || shipment?.substatus || null;
    order.externalOrderData = { pack, orders: ordersData, shipment };
    order.trackingNumber = shipment?.tracking_number || order.trackingNumber || null;
    if (primaryOrder?.date_created) order.createdAt = new Date(primaryOrder.date_created);
    order = await this.orders.save(order);

    const incomingItems = ordersData.flatMap((data) => Array.isArray(data?.order_items) ? data.order_items : []);
    const existingItems = isNew ? [] : (order.items || []);
    for (const sourceItem of incomingItems) {
      const mlItemId = String(sourceItem?.item?.id || sourceItem?.item_id || '');
      const product = mlItemId ? await this.products.findOne({
        where: { mercadoLibreItemId: mlItemId, vendor: { id: vendorId } }, relations: ['vendor'],
      }) : null;
      let item = existingItems.find(existing => existing.productId === product?.id);
      if (!item) item = this.orderItems.create({ order, productId: product?.id || null, vendorId });
      item.quantity = Math.max(1, Number(sourceItem?.quantity) || 1);
      item.price = Number(sourceItem?.unit_price ?? sourceItem?.full_unit_price ?? 0);
      item.subtotal = item.price * item.quantity;
      item.productTitle = sourceItem?.item?.title || product?.title || `Producto Mercado Libre ${mlItemId}`;
      item.productImage = product?.images?.[0] || '';
      await this.orderItems.save(item);
    }
    console.log(`[MercadoLibre] Local order ${order.orderNumber} ${isNew ? 'created' : 'updated'}`);
  }

  async getOrderShipping(orderId: string, vendorId: string) {
    const order = await this.findLocalMercadoLibreOrder(orderId, vendorId);
    const token = await this.getAccessToken(vendorId);
    if (!order.externalShippingId) return { eligible: false, message: 'La venta aún no tiene un envío de Mercado Libre asociado.' };
    const { data: shipment } = await axios.get(`${API_URL}/shipments/${order.externalShippingId}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-format-new': 'true' },
    });
    let shipmentHistory: any[] = [];
    try {
      const { data } = await axios.get(`${API_URL}/shipments/${order.externalShippingId}/history`, {
        headers: { Authorization: `Bearer ${token}`, 'x-format-new': 'true' },
      });
      shipmentHistory = Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.warn(`[MercadoLibre] Shipment history ${order.externalShippingId} could not be loaded: ${this.getMercadoLibreError(error)}`);
    }
    const status = this.getEffectiveShipmentStatus(shipment, shipmentHistory);
    order.externalShippingStatus = status || shipment?.substatus || null;
    order.trackingNumber = shipment?.tracking_number || order.trackingNumber;
    order.externalOrderData = { ...(order.externalOrderData || {}), shipment, shipmentHistory };
    if (status === 'delivered') order.status = OrderStatus.DELIVERED;
    else if (['shipped', 'in_transit'].includes(status)) order.status = OrderStatus.SHIPPED;
    await this.orders.save(order);
    const eligible = shipment?.status === 'ready_to_ship' && ['ready_to_print', 'printed'].includes(String(shipment?.substatus || '').toLowerCase());
    return { eligible, shipmentId: order.externalShippingId, status, rawStatus: shipment?.status, substatus: shipment?.substatus, trackingNumber: shipment?.tracking_number || null };
  }

  async getShippingLabel(orderId: string, vendorId: string) {
    const shipping = await this.getOrderShipping(orderId, vendorId);
    if (!shipping.shipmentId) throw new BadRequestException('La venta no tiene un envío de Mercado Libre asociado');
    if (!shipping.eligible) throw new BadRequestException(`La etiqueta aún no está disponible (${shipping.status || 'sin estado'} / ${shipping.substatus || 'sin subestado'})`);
    const token = await this.getAccessToken(vendorId);
    try {
      const response = await axios.get(`${API_URL}/shipment_labels`, {
        params: { shipment_ids: shipping.shipmentId, response_type: 'pdf' },
        headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      throw new BadRequestException(`Mercado Libre no pudo entregar la etiqueta: ${this.getMercadoLibreError(error)}`);
    }
  }

  async cancelOrder(orderId: string, vendorId: string, reason: string) {
    const order = await this.findLocalMercadoLibreOrder(orderId, vendorId);
    const allowedReasons = ['OUT_OF_STOCK', 'BUYER_REGRETS', 'BUYER_NOT_ENOUGH_MONEY', 'OTHER_THEIR_RESPONSIBILITY'];
    if (!allowedReasons.includes(reason)) throw new BadRequestException('Motivo de cancelación de Mercado Libre inválido');
    const token = await this.getAccessToken(vendorId);
    try {
      if (order.externalShippingId) {
        const { data: shipment } = await axios.get(`${API_URL}/shipments/${order.externalShippingId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (this.isShipmentCancellationLocked(shipment)) {
          throw new BadRequestException('La etiqueta ya fue impresa o el envío fue despachado. Las cancelaciones posteriores deben gestionarse con soporte de Mercado Libre.');
        }
      }
      await axios.post(`${API_URL}/orders/${order.externalOrderId}/feedback`, {
        fulfilled: false,
        reason,
        restock_item: reason !== 'OUT_OF_STOCK',
      }, { headers: { Authorization: `Bearer ${token}` } });
      const { data } = await axios.get(`${API_URL}/orders/${order.externalOrderId}`, { headers: { Authorization: `Bearer ${token}` } });
      await this.syncOrder(vendorId, String(order.externalOrderId), data, token);
      return { success: true, status: data?.status, message: 'Cancelación enviada a Mercado Libre.' };
    } catch (error: any) {
      throw new BadRequestException(`Mercado Libre rechazó la cancelación: ${this.getMercadoLibreError(error)}`);
    }
  }

  private async findLocalMercadoLibreOrder(orderId: string, vendorId: string) {
    const order = await this.orders.findOneBy({ id: orderId, vendorId });
    if (!order || order.orderSource !== 'mercadolibre' || !order.externalOrderId) {
      throw new NotFoundException('Venta de Mercado Libre no encontrada');
    }
    return order;
  }

  private async syncOrderStock(vendorId: string, mercadoLibreOrderId: string, order: any) {
    let sync = await this.orderSyncs.findOneBy({ vendorId, mercadoLibreOrderId });
    if (!sync) {
      try {
        sync = await this.orderSyncs.save(this.orderSyncs.create({ vendorId, mercadoLibreOrderId }));
      } catch (error: any) {
        if (error?.code !== 'ER_DUP_ENTRY') throw error;
        sync = await this.orderSyncs.findOneByOrFail({ vendorId, mercadoLibreOrderId });
      }
    }

    const status = String(order?.status || '').toLowerCase();
    const paymentApproved = Array.isArray(order?.payments) && order.payments.some((payment: any) =>
      ['approved', 'accredited'].includes(String(payment?.status || '').toLowerCase()),
    );
    const shouldApplyStock = ['paid', 'confirmed'].includes(status) || paymentApproved;
    const cancellationCode = String(order?.cancel_detail?.code || order?.cancel_detail?.group || '').toUpperCase();
    const shouldRestoreStock = ['cancelled', 'invalid', 'refunded'].includes(status)
      && cancellationCode !== 'OUT_OF_STOCK';
    const orderItems = Array.isArray(order?.order_items) ? order.order_items : [];

    sync.status = status || null;
    sync.orderData = order;

    if (shouldApplyStock && !sync.stockApplied) {
      const updatedProducts = await this.changeOrderStock(vendorId, orderItems, -1);
      sync.stockApplied = true;
      sync.stockRestored = false;
      await this.orderSyncs.save(sync);
      await this.syncExternalStock(updatedProducts);
      console.log(`[MercadoLibre] Order ${mercadoLibreOrderId}: stock deducted for ${updatedProducts.length} product(s)`);
      return { received: true, processed: true, action: 'stock_deducted' };
    }

    if (shouldRestoreStock && sync.stockApplied && !sync.stockRestored) {
      const updatedProducts = await this.changeOrderStock(vendorId, orderItems, 1);
      sync.stockRestored = true;
      await this.orderSyncs.save(sync);
      await this.syncExternalStock(updatedProducts);
      console.log(`[MercadoLibre] Order ${mercadoLibreOrderId}: stock restored for ${updatedProducts.length} product(s)`);
      return { received: true, processed: true, action: 'stock_restored' };
    }

    await this.orderSyncs.save(sync);
    return { received: true, processed: false, action: 'already_processed_or_pending' };
  }

  private async changeOrderStock(vendorId: string, orderItems: any[], direction: 1 | -1) {
    const updatedProducts: Product[] = [];
    for (const item of orderItems) {
      const mercadoLibreItemId = String(item?.item?.id || item?.item_id || '');
      const quantity = Math.max(0, Number(item?.quantity) || 0);
      if (!mercadoLibreItemId || !quantity) continue;

      const product = await this.products.findOne({
        where: { mercadoLibreItemId, vendor: { id: vendorId } },
        relations: ['vendor'],
      });
      if (!product) {
        console.warn(`[MercadoLibre] No local product linked to item ${mercadoLibreItemId}`);
        continue;
      }

      product.stock = direction === -1
        ? Math.max(0, Number(product.stock || 0) - quantity)
        : Number(product.stock || 0) + quantity;
      await this.products.save(product);
      updatedProducts.push(product);
    }
    return updatedProducts;
  }

  private async syncExternalStock(products: Product[]) {
    await Promise.all(products.map(async (product) => {
      const syncs: Promise<unknown>[] = [this.syncStockFromLocal(product.id)];
      if (product.woocommerceId) syncs.push(this.woocommerceService.updateStock(product.id, product.stock));
      const results = await Promise.allSettled(syncs);
      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.error(`[MercadoLibre] External stock sync failed for ${product.title}: ${result.reason?.message || result.reason}`);
        }
      });
    }));
  }

  private async findProduct(productId: string, vendorId: string) {
    const product = await this.products.findOne({ where: { id: productId }, relations: ['vendor', 'categories'] });
    if (!product || product.vendor.id !== vendorId || product.status !== ProductStatus.ACTIVE) throw new NotFoundException('Producto activo no encontrado');
    return product;
  }
}
