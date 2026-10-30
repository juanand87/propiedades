import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { Product, ProductStatus, ProductCondition } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { Category } from '../categories/category.entity';
import { Format } from '../formats/format.entity';
import { DiscogsService } from '../vendors/discogs.service';
import { WooCommercePluginConnectDto } from './dto/plugin-connect.dto';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Order, OrderStatus } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { ShippingService } from '../shipping/shipping.service';
import { SmtpSettings } from '../marketplace/smtp-settings.entity';
import { EmailService, SmtpConfig } from '../email/email.service';
import { withStoreSender } from '../email/store-sender';
import { normalizeWooCommerceStoreUrl } from '../common/integration-identity.util';

@Injectable()
export class WoocommerceService {
  private readonly logger = new Logger(WoocommerceService.name);
  private readonly orderSyncs = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(VendorSettings)
    private vendorSettingsRepository: Repository<VendorSettings>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Format)
    private formatRepository: Repository<Format>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(SmtpSettings)
    private smtpSettingsRepository: Repository<SmtpSettings>,
    private shippingService: ShippingService,
    private discogsService: DiscogsService,
    private emailService: EmailService,
  ) {}

  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async getMarketplaceSmtpConfig(): Promise<SmtpConfig | null> {
    const settings = (await this.smtpSettingsRepository.find({ order: { updatedAt: 'DESC' } }))
      .find((item) => item.smtpHost && item.smtpUser && item.smtpPassword);
    if (!settings) return null;
    return {
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      user: settings.smtpUser,
      password: settings.smtpPassword,
      fromEmail: settings.smtpFromEmail || settings.smtpUser,
      fromName: settings.smtpFromName || 'MundoBeat',
    };
  }

  private async notifyVendorOfWooCommerceOrder(order: Order, vendor: Vendor): Promise<void> {
    const recipient = vendor.user?.email || vendor.email || vendor.paymentEmail;
    if (!recipient) {
      this.logger.warn(`WooCommerce order ${order.orderNumber} imported without email: vendor has no recipient`);
      return;
    }
    const smtp = await this.getMarketplaceSmtpConfig();
    if (!smtp) {
      this.logger.warn(`WooCommerce order ${order.orderNumber} imported without email: marketplace SMTP is not configured`);
      return;
    }

    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const amount = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(Number(order.total || 0));
    const html = `
      <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#10213d">
        <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #dce5ef;border-radius:8px;overflow:hidden">
          <div style="background:#071a35;padding:22px 28px;color:#fff"><strong style="font-size:21px">MundoBeat</strong><div style="margin-top:4px;color:#b9c9dc;font-size:13px">Nueva venta desde WooCommerce</div></div>
          <div style="padding:28px">
            <p>Hola, administrador de <strong>${this.escapeHtml(vendor.storeName)}</strong>:</p>
            <p style="line-height:1.55">Se importó correctamente una nueva venta realizada en WooCommerce.</p>
            <table style="width:100%;border-collapse:collapse;margin:22px 0">
              <tr><td style="padding:9px 0;color:#607089;border-bottom:1px solid #e6edf5">Pedido</td><td style="padding:9px 0;text-align:right;font-weight:700;border-bottom:1px solid #e6edf5">${this.escapeHtml(order.orderNumber)}</td></tr>
              <tr><td style="padding:9px 0;color:#607089;border-bottom:1px solid #e6edf5">Cliente</td><td style="padding:9px 0;text-align:right;border-bottom:1px solid #e6edf5">${this.escapeHtml(order.shippingName)}</td></tr>
              <tr><td style="padding:12px 0;font-weight:700">Total</td><td style="padding:12px 0;text-align:right;font-size:19px;font-weight:700;color:#087fb8">${amount}</td></tr>
            </table>
            <div style="text-align:center"><a href="${baseUrl}/dashboard/orders/${order.id}" style="display:inline-block;padding:11px 20px;background:#087fb8;color:#fff;text-decoration:none;border-radius:5px;font-weight:700">Ver pedido</a></div>
          </div>
        </div>
      </div>`;
    try {
      await this.emailService.sendEmail(withStoreSender(smtp, vendor.storeName), recipient, `Nueva venta WooCommerce ${order.orderNumber}`, html);
    } catch (error) {
      this.logger.error(`WooCommerce order ${order.orderNumber} was imported, but email failed: ${error.message}`);
    }
  }

  generatePluginConnectionCode(vendorId: string): { success: true; code: string; expiresAt: string } {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const payload = Buffer.from(JSON.stringify({
      vendorId,
      exp: expiresAt.getTime(),
      nonce: randomBytes(12).toString('hex'),
    })).toString('base64url');
    const signature = this.signPluginPayload(payload);

    return { success: true, code: `${payload}.${signature}`, expiresAt: expiresAt.toISOString() };
  }

  async connectPlugin(dto: WooCommercePluginConnectDto): Promise<any> {
    this.verifyPluginConnectionCode(dto.connectionCode, dto.vendorId);

    const settings = await this.vendorSettingsRepository.findOne({ where: { vendorId: dto.vendorId } });
    if (!settings) {
      throw new NotFoundException('Configuración de tienda no encontrada');
    }

    let normalizedStore: { storeUrl: string; identity: string };
    try {
      normalizedStore = normalizeWooCommerceStoreUrl(dto.storeUrl);
    } catch (error: any) {
      throw new BadRequestException(error.message || 'La URL de WooCommerce no es válida');
    }
    const existingConnection = await this.vendorSettingsRepository.findOne({
      where: { wooStoreIdentity: normalizedStore.identity },
    });
    if (existingConnection && existingConnection.vendorId !== dto.vendorId) {
      throw new ConflictException('Esta tienda WooCommerce ya está conectada a otra tienda de MundoBeat.');
    }

    settings.wooStoreUrl = normalizedStore.storeUrl;
    settings.wooStoreIdentity = normalizedStore.identity;
    settings.wooClientKey = dto.consumerKey;
    settings.wooClientSecret = dto.consumerSecret;
    settings.wooWebhookSecret = dto.webhookSecret;
    await this.vendorSettingsRepository.save(settings);

    const connection = await this.testConnection(dto.vendorId);
    if (!connection.success) {
      throw new BadRequestException(`WooCommerce rechazó la conexión: ${connection.message}`);
    }

    return {
      success: true,
      message: 'WooCommerce conectado correctamente con MundoBeat',
      webhookUrl: `${(process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '')}/api/woocommerce/webhook/${dto.vendorId}`,
    };
  }

  async getPluginShippingRates(secret: string, body: { vendorId: string; city: string; postcode?: string; items: Array<{ productId?: string; wooProductId?: string; quantity: number }>; declaredValue: number }) {
    const settings = await this.vendorSettingsRepository.findOne({ where: { vendorId: body.vendorId } });
    if (!settings?.wooWebhookSecret || !secret || settings.wooWebhookSecret !== secret) throw new UnauthorizedException('Plugin no autorizado');
    const resolvedItems: Array<{ productId: string; quantity: number }> = [];
    for (const item of body.items || []) {
      let productId = item.productId;
      if (!productId && item.wooProductId) {
        const product = await this.productRepository.findOne({
          where: { woocommerceId: String(item.wooProductId), vendor: { id: body.vendorId } },
        });
        productId = product?.id;
      }
      if (productId) resolvedItems.push({ productId, quantity: item.quantity });
    }
    if (!resolvedItems.length) return [];
    return this.shippingService.calculateWooCommerceShipping(body.vendorId, body.city, body.postcode, resolvedItems, body.declaredValue);
  }

  async getPluginLocations(secret: string, vendorId: string) {
    const settings = await this.vendorSettingsRepository.findOne({ where: { vendorId } });
    if (!settings?.wooWebhookSecret || !secret || settings.wooWebhookSecret !== secret) {
      throw new UnauthorizedException('Plugin no autorizado');
    }

    const [regions, communes] = await Promise.all([
      this.shippingService.getAllRegions(),
      this.shippingService.getAllCommunes(),
    ]);
    return regions.map((region) => ({
      id: region.id,
      name: region.name,
      code: region.code,
      communes: communes
        .filter((commune) => commune.regionId === region.id)
        .map((commune) => ({
          id: commune.id,
          name: commune.name,
          code: commune.code,
          postcode: commune.enviaPostalCode,
        })),
    }));
  }

  async syncPluginOrder(secret: string, vendorId: string, order: any) {
    const settings = await this.vendorSettingsRepository.findOne({ where: { vendorId } });
    if (!settings?.wooWebhookSecret || !secret || settings.wooWebhookSecret !== secret) {
      throw new UnauthorizedException('Plugin no autorizado');
    }
    await this.handleOrderWebhook(vendorId, order, 'plugin.order.sync');
    return { success: true };
  }

  private signPluginPayload(payload: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET no está configurado');
    }
    return createHmac('sha256', secret).update(`woocommerce-plugin:${payload}`).digest('base64url');
  }

  private verifyPluginConnectionCode(code: string, vendorId: string): void {
    const [payload, signature] = code.split('.');
    if (!payload || !signature) {
      throw new UnauthorizedException('Código de conexión inválido');
    }

    const expected = this.signPluginPayload(payload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Código de conexión inválido');
    }

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (decoded.vendorId !== vendorId || !decoded.exp || decoded.exp < Date.now()) {
        throw new UnauthorizedException('El código de conexión expiró o pertenece a otra tienda');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Código de conexión inválido');
    }
  }

  private createWooClient(storeUrl: string, consumerKey: string, consumerSecret: string) {
    // Fix common URL issues
    let fixedUrl = storeUrl.trim();
    
    // Fix missing colon after https
    if (fixedUrl.startsWith('https//')) {
      fixedUrl = fixedUrl.replace('https//', 'https://');
      console.log('🔧 [WooCommerce] Fixed URL from https// to https://');
    }
    if (fixedUrl.startsWith('http//')) {
      fixedUrl = fixedUrl.replace('http//', 'http://');
      console.log('🔧 [WooCommerce] Fixed URL from http// to http://');
    }
    
    // Add https:// if missing protocol
    if (!fixedUrl.startsWith('http://') && !fixedUrl.startsWith('https://')) {
      fixedUrl = 'https://' + fixedUrl;
      console.log('🔧 [WooCommerce] Added https:// prefix to URL');
    }
    
    // Remove trailing slash
    fixedUrl = fixedUrl.replace(/\/$/, '');
    
    console.log('🔧 [WooCommerce] Creating client with:', {
      originalUrl: storeUrl,
      fixedUrl: fixedUrl,
      consumerKey: consumerKey ? `${consumerKey.substring(0, 10)}...` : 'empty',
      consumerSecret: consumerSecret ? `${consumerSecret.substring(0, 10)}...` : 'empty',
      version: 'wc/v3',
    });
    
    return new WooCommerceRestApi({
      url: fixedUrl,
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      version: 'wc/v3',
    });
  }

  async testConnection(vendorId: string): Promise<{ success: boolean; message: string }> {
    console.log('🔌 [WooCommerce] Testing connection for vendorId:', vendorId);
    
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    if (!vendor || !vendor.settings) {
      console.log('❌ [WooCommerce] Vendor or settings not found');
      throw new NotFoundException('Vendor not found');
    }

    const { wooStoreUrl, wooClientKey, wooClientSecret } = vendor.settings;

    console.log('🔌 [WooCommerce] Credentials:', {
      wooStoreUrl: wooStoreUrl,
      wooClientKey: wooClientKey ? `${wooClientKey.substring(0, 10)}...` : 'null',
      wooClientSecret: wooClientSecret ? `${wooClientSecret.substring(0, 10)}...` : 'null',
    });

    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      console.log('❌ [WooCommerce] Missing credentials');
      return {
        success: false,
        message: 'WooCommerce credentials not configured',
      };
    }

    try {
      console.log('🔌 [WooCommerce] Creating API client...');
      const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);
      console.log('🔌 [WooCommerce] Making test request to /products...');
      await wooCommerce.get('products', { per_page: 1 });
      console.log('✅ [WooCommerce] Connection successful!');
      return {
        success: true,
        message: 'Connection successful',
      };
    } catch (error) {
      console.error('❌ [WooCommerce] Connection error:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
      });
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  async exportProduct(productId: string, vendorId: string): Promise<any> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['vendor', 'vendor.settings'],
    });

    if (!product || product.vendor.id !== vendorId) {
      throw new NotFoundException('Product not found');
    }

    const { wooStoreUrl, wooClientKey, wooClientSecret } = product.vendor.settings;

    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);

    const wooProduct = this.mapProductToWoo(product);

    let result;
    if (product.woocommerceId) {
      // Update existing
      result = await wooCommerce.put(`products/${product.woocommerceId}`, wooProduct);
    } else {
      // Create new
      result = await wooCommerce.post('products', wooProduct);
      product.woocommerceId = result.data.id.toString();
      await this.productRepository.save(product);
    }

    return result.data;
  }

  async updateStock(productId: string, newStock: number): Promise<any> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['vendor', 'vendor.settings'],
    });

    if (!product || !product.woocommerceId) {
      return null; // Product not synced with WooCommerce
    }

    const { wooStoreUrl, wooClientKey, wooClientSecret } = product.vendor.settings;

    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      return null;
    }

    try {
      const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);
      const result = await wooCommerce.put(`products/${product.woocommerceId}`, {
        stock_quantity: newStock,
      });
      return result.data;
    } catch (error) {
      console.error('WooCommerce stock update failed:', error.message);
      return null;
    }
  }

  async moveProductToTrash(productId: string, vendorId: string): Promise<{
    success: boolean;
    skipped?: boolean;
    productId: string;
    woocommerceId?: string;
    title?: string;
    message: string;
    error?: string;
  }> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['vendor', 'vendor.settings'],
    });

    if (!product || product.vendor.id !== vendorId) {
      throw new NotFoundException('Product not found');
    }

    if (!product.woocommerceId) {
      return {
        success: false,
        skipped: true,
        productId,
        title: product.title,
        message: 'Producto sin ID de WooCommerce',
      };
    }

    const { wooStoreUrl, wooClientKey, wooClientSecret } = product.vendor.settings;

    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      return {
        success: false,
        skipped: true,
        productId,
        woocommerceId: product.woocommerceId,
        title: product.title,
        message: 'WooCommerce no configurado',
      };
    }

    try {
      const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);
      await wooCommerce.delete(`products/${product.woocommerceId}`, { force: false });

      return {
        success: true,
        productId,
        woocommerceId: product.woocommerceId,
        title: product.title,
        message: 'Producto movido a papelera en WooCommerce',
      };
    } catch (error) {
      return {
        success: false,
        productId,
        woocommerceId: product.woocommerceId,
        title: product.title,
        message: 'No se pudo mover a papelera en WooCommerce',
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async permanentlyDeleteProduct(productId: string, vendorId: string): Promise<{
    success: boolean;
    skipped?: boolean;
    alreadyDeleted?: boolean;
    productId: string;
    woocommerceId?: string;
    title?: string;
    message: string;
    error?: string;
  }> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['vendor', 'vendor.settings'],
    });

    if (!product || product.vendor.id !== vendorId) {
      throw new NotFoundException('Product not found');
    }

    if (!product.woocommerceId) {
      return {
        success: true,
        skipped: true,
        productId,
        title: product.title,
        message: 'Producto sin vínculo con WooCommerce',
      };
    }

    const { wooStoreUrl, wooClientKey, wooClientSecret } = product.vendor.settings || {};
    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      return {
        success: false,
        productId,
        woocommerceId: product.woocommerceId,
        title: product.title,
        message: 'WooCommerce no está configurado; el producto se conservó en la papelera de MundoBeat',
      };
    }

    try {
      const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);
      await wooCommerce.delete(`products/${product.woocommerceId}`, { force: true });
      return {
        success: true,
        productId,
        woocommerceId: product.woocommerceId,
        title: product.title,
        message: 'Producto eliminado definitivamente de WooCommerce',
      };
    } catch (error: any) {
      if (Number(error?.response?.status) === 404) {
        return {
          success: true,
          alreadyDeleted: true,
          productId,
          woocommerceId: product.woocommerceId,
          title: product.title,
          message: 'El producto ya no existía en WooCommerce',
        };
      }

      return {
        success: false,
        productId,
        woocommerceId: product.woocommerceId,
        title: product.title,
        message: 'No se pudo eliminar definitivamente el producto de WooCommerce',
        error: error?.response?.data?.message || error?.message,
      };
    }
  }

  async cancelWooCommerceOrder(localOrderId: string, reason: string, preserveReducedStock: boolean): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: localOrderId },
      relations: ['items'],
    });
    if (!order || order.orderSource !== 'woocommerce' || !order.externalOrderId) return;

    const settings = await this.vendorSettingsRepository.findOne({ where: { vendorId: order.vendorId } });
    if (!settings?.wooStoreUrl || !settings.wooClientKey || !settings.wooClientSecret) {
      throw new Error('WooCommerce no está configurado para esta tienda');
    }

    const wooCommerce = this.createWooClient(
      settings.wooStoreUrl,
      settings.wooClientKey,
      settings.wooClientSecret,
    );
    let stockSnapshots: Array<{ woocommerceId: string; stock: number }> = [];
    if (preserveReducedStock) {
      const productIds = [...new Set((order.items || []).map((item) => item.productId).filter(Boolean))];
      if (productIds.length) {
        const products = await this.productRepository.find({
          where: { id: In(productIds), vendor: { id: order.vendorId } },
        });
        stockSnapshots = products
          .filter((product) => Boolean(product.woocommerceId))
          .map((product) => ({
            woocommerceId: product.woocommerceId,
            stock: Math.max(0, Number(product.stock) || 0),
          }));
      }
    }

    await wooCommerce.put(`orders/${order.externalOrderId}`, { status: 'cancelled' });
    try {
      await wooCommerce.post(`orders/${order.externalOrderId}/notes`, {
        note: `Pedido cancelado desde MundoBeat. Motivo: ${reason}`,
        customer_note: false,
      });
    } catch (error: any) {
      this.logger.warn(
        `Pedido WooCommerce ${order.externalOrderId} cancelado, pero no se pudo registrar la nota: ${error.message}`,
      );
    }

    if (preserveReducedStock) {
      for (const snapshot of stockSnapshots) {
        await wooCommerce.put(`products/${snapshot.woocommerceId}`, {
          stock_quantity: snapshot.stock,
        });
      }
    }
  }

  async importProducts(vendorId: string): Promise<any[]> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    if (!vendor || !vendor.settings) {
      throw new NotFoundException('Vendor not found');
    }

    const { wooStoreUrl, wooClientKey, wooClientSecret } = vendor.settings;

    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);

    const result = await wooCommerce.get('products', {
      per_page: 50,
    });

    return result.data;
  }

  async getCategories(vendorId: string): Promise<any[]> {
    console.log('📂 [WooCommerce] Getting categories for vendorId:', vendorId);
    
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    if (!vendor || !vendor.settings) {
      throw new NotFoundException('Vendor not found');
    }

    const { wooStoreUrl, wooClientKey, wooClientSecret } = vendor.settings;

    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);

    const result = await wooCommerce.get('products/categories', {
      per_page: 100,
    });

    console.log(`✅ [WooCommerce] Retrieved ${result.data.length} categories`);
    return result.data;
  }

  async getProducts(vendorId: string, categoryId?: string, page: number = 1, perPage: number = 50): Promise<any> {
    console.log('📦 [WooCommerce] Getting products for vendorId:', vendorId, 'categoryId:', categoryId, 'page:', page, 'perPage:', perPage);
    
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    if (!vendor || !vendor.settings) {
      throw new NotFoundException('Vendor not found');
    }

    const { wooStoreUrl, wooClientKey, wooClientSecret } = vendor.settings;

    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);

    // WooCommerce API hard limit is 100 per_page.
    // perPage === 0 means "fetch all" → iterate pages with per_page=100.
    const WOO_MAX = 100;
    const isAll = perPage === 0;
    const effectivePerPage = isAll ? WOO_MAX : Math.min(perPage, WOO_MAX);

    const baseParams: any = { per_page: effectivePerPage };
    if (categoryId) baseParams.category = categoryId;

    let allProducts: any[] = [];
    let totalProducts = 0;
    let totalPages = 1;

    if (isAll) {
      // Fetch first page to know total
      const first = await wooCommerce.get('products', { ...baseParams, page: 1 });
      totalProducts = parseInt(first.headers['x-wp-total'] || '0');
      totalPages = parseInt(first.headers['x-wp-totalpages'] || '1');
      allProducts = [...first.data];

      // Fetch remaining pages in sequence
      for (let p = 2; p <= totalPages; p++) {
        const res = await wooCommerce.get('products', { ...baseParams, page: p });
        allProducts = [...allProducts, ...res.data];
      }
      totalPages = 1; // All products on one virtual page
      totalProducts = allProducts.length;
    } else {
      const result = await wooCommerce.get('products', { ...baseParams, page });
      allProducts = result.data;
      totalProducts = parseInt(result.headers['x-wp-total'] || '0');
      totalPages = parseInt(result.headers['x-wp-totalpages'] || '1');
    }

    console.log(`✅ [WooCommerce] Retrieved ${allProducts.length} products (total: ${totalProducts})`);

    // Find which WooCommerce IDs are already imported for this vendor
    const wooIds = allProducts.map((p: any) => p.id.toString());
    const alreadyImported = await this.productRepository.find({
      where: { vendor: { id: vendorId } },
      select: ['woocommerceId'],
    });
    const importedSet = new Set(alreadyImported.map(p => p.woocommerceId).filter(Boolean));
    const importedWooIds = wooIds.filter((id: string) => importedSet.has(id));

    return {
      products: allProducts,
      total: totalProducts,
      totalPages,
      currentPage: isAll ? 1 : page,
      importedWooIds,
    };
  }

  async importSelectedProducts(
    vendorId: string,
    productsConfig: Array<{
      productId: number;
      condition: string;
      mediaGrade?: string;
      sleeveGrade?: string;
      categoryIds?: string[];
      enableSpotify?: boolean;
    }>,
  ): Promise<any> {
    console.log('📥 [WooCommerce] ========================================');
    console.log('📥 [WooCommerce] Starting import process');
    console.log('📥 [WooCommerce] Products to import:', productsConfig.length);
    console.log('📥 [WooCommerce] ========================================');
    
    // IMPORTANTE: Cargar vendor con QueryBuilder asegurando ALL columns
    const vendorWithToken = await this.vendorRepository
      .createQueryBuilder('vendor')
      .select('vendor')  // Select all vendor columns explicitly
      .leftJoinAndSelect('vendor.settings', 'settings')
      .where('vendor.id = :vendorId', { vendorId })
      .getOne();

    if (!vendorWithToken || !vendorWithToken.settings) {
      throw new NotFoundException('Vendor not found');
    }

    console.log('✅ [WooCommerce] Vendor loaded:', vendorWithToken.storeName);

    const finalVendor = vendorWithToken;

    const { wooStoreUrl, wooClientKey, wooClientSecret } = finalVendor.settings;

    if (!wooStoreUrl || !wooClientKey || !wooClientSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    const wooCommerce = this.createWooClient(wooStoreUrl, wooClientKey, wooClientSecret);

    const imported: Array<{ woocommerceId: number; name: string; success: boolean }> = [];
    const errors: Array<{ productId: number; error: string }> = [];

    for (const productConfig of productsConfig) {
      const productId = productConfig.productId;
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔄 [WooCommerce] Processing product ID: ${productId}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 Configuration received:');
      console.log(`   Condition: ${productConfig.condition}`);
      if (productConfig.condition === 'used') {
        console.log(`   Media Grade: ${productConfig.mediaGrade || 'N/A'}`);
        console.log(`   Sleeve Grade: ${productConfig.sleeveGrade || 'N/A'}`);
      }
      console.log(`   Category IDs: ${productConfig.categoryIds?.join(', ') || 'none'}`);
      console.log(`   Spotify Enabled: ${productConfig.enableSpotify || false}`);
      try {
        const result = await wooCommerce.get(`products/${productId}`);
        const wooProduct = result.data;
        
        console.log('📦 [WooCommerce] Full product data from WooCommerce:', JSON.stringify(wooProduct, null, 2));
        
        // Check if product already exists
        const existingProduct = await this.productRepository.findOne({
          where: { woocommerceId: wooProduct.id.toString() },
        });

        if (existingProduct) {
          console.log(`⚠️ Product already exists: ${wooProduct.name} (ID: ${existingProduct.id})`);
          errors.push({
            productId,
            error: 'Product already imported',
          });
          continue;
        }

        // Map WooCommerce product to MundoBeat product
        console.log('🔄 [WooCommerce] Mapping fields:');
        console.log('   WooCommerce → MundoBeat');
        console.log(`   id: ${wooProduct.id} → woocommerceId: ${wooProduct.id}`);
        console.log(`   name: "${wooProduct.name}" → title: "${wooProduct.name}"`);
        console.log(`   sku: "${wooProduct.sku || 'N/A'}" → sku: "${wooProduct.sku || ''}"`);
        console.log(`   price: ${wooProduct.price} → price: ${wooProduct.price || wooProduct.regular_price || 0}`);
        console.log(`   stock_quantity: ${wooProduct.stock_quantity} → stock: ${wooProduct.stock_quantity || 0}`);
        console.log(`   description: ${wooProduct.description ? 'YES' : 'NO'} → description`);
        console.log(`   short_description: ${wooProduct.short_description ? 'YES' : 'NO'} → shortDescription`);
        console.log(`   images: ${wooProduct.images?.length || 0} images → images array`);
        console.log(`   status: "${wooProduct.status}" → status: "${this.mapWooStatus(wooProduct.status)}"`);

        // Generate slug
        const baseSlug = wooProduct.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        let slug = baseSlug;
        let counter = 1;
        while (await this.productRepository.findOne({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Load categories if provided
        let categories: Category[] = [];
        if (productConfig.categoryIds && productConfig.categoryIds.length > 0) {
          categories = await this.categoryRepository.find({
            where: {
              id: In(productConfig.categoryIds),
              isActive: true,
            },
          });
          console.log(`📂 [WooCommerce] Categories loaded: ${categories.map(c => c.name).join(', ')}`);
        }

        // DISCOGS SEARCH - Extract artist and album from product title
        let discogsInfo: any = null;
        let formats: Format[] = [];
        let artist: string | undefined;
        let album: string | undefined;
        
        // Limpiar título removiendo palabras de formato
        const cleanedTitle = this.cleanProductTitle(wooProduct.name);
        console.log(`🧹 [Discogs] Original title: "${wooProduct.name}"`);
        console.log(`🧹 [Discogs] Cleaned title: "${cleanedTitle}"`);
        
        // Extraer artista y álbum del título limpio (formato: "Artista - Álbum")
        const artistAlbum = this.extractArtistAlbum(cleanedTitle);
        if (artistAlbum) {
          console.log(`🎤 [Discogs] Extracted artist: "${artistAlbum.artist}"`);
          console.log(`💿 [Discogs] Extracted album: "${artistAlbum.album}"`);
          
          // Buscar en Discogs si hay token configurado
          if (finalVendor.settings.discogsApiKey) {
            const searchQuery = `${artistAlbum.artist} - ${artistAlbum.album}`;
            discogsInfo = await this.searchDiscogsForProduct(
              finalVendor.settings.discogsApiKey,
              searchQuery,
            );
            
            if (discogsInfo) {
              // Asignar artista y álbum extraídos
              artist = artistAlbum.artist;
              album = artistAlbum.album;
              
              console.log(`✅ [Discogs] Found release: "${discogsInfo.title}"`);
              console.log(`   🏷️ Label: ${discogsInfo.label?.join(', ') || 'N/A'}`);
              console.log(`   📅 Year: ${discogsInfo.year || 'N/A'}`);
              console.log(`   🎼 Genre: ${discogsInfo.genre?.join(', ') || 'N/A'}`);
              console.log(`   🌍 Country: ${discogsInfo.country || 'N/A'}`);
              
              // Validar y filtrar formatos
              if (discogsInfo.format) {
                const validatedFormats = this.validateAndFilterFormats(
                  discogsInfo.format,
                  wooProduct.name,
                  wooProduct.short_description || '',
                  wooProduct.description || '',
                );
                
                if (validatedFormats.length > 0) {
                  console.log(`🎵 [Discogs] Validated formats: ${validatedFormats.join(', ')}`);
                  formats = await this.findOrCreateFormats(validatedFormats);
                  console.log(`✅ [Discogs] Format entities created/found: ${formats.map(f => f.name).join(', ')}`);
                } else {
                  console.log('⚠️ [Discogs] No formats matched WooCommerce product text');
                }
              }
            } else {
              console.log('⚠️ [Discogs] No matching release found');
            }
          } else {
            console.log('ℹ️ [Discogs] No API key configured, skipping search');
          }
        } else {
          console.log('⚠️ [Discogs] Could not extract artist-album from title');
        }
        // SPOTIFY SEARCH - Buscar álbum usando datos de Discogs
        let spotifyAlbumId: string | undefined;
        if (productConfig.enableSpotify && artist && album) {
          console.log('\ud83c\udfb5 [Spotify] Searching for album using Discogs data...');
          spotifyAlbumId = await this.searchSpotifyAlbum(
            album,
            artist,
            finalVendor.settings,
          );
          
          if (spotifyAlbumId) {
            console.log(`\u2705 [Spotify] Found album: ${spotifyAlbumId}`);
          } else {
            console.log('\u26a0\ufe0f [Spotify] No album found');
          }
        } else if (productConfig.enableSpotify) {
          console.log('\u2139\ufe0f [Spotify] Skipping search - no artist/album from Discogs');
        }
        // Create product (without relations first)
        console.log('📝 [WooCommerce] Creating product data...');
        console.log(`   📂 Categories to assign: ${categories.length} (${categories.map(c => `${c.id}:${c.name}`).join(', ')})`);
        console.log(`   🎵 Formats to assign: ${formats.length} (${formats.map(f => `${f.id}:${f.name}`).join(', ')})`);
        console.log(`   🎧 Spotify enabled: ${productConfig.enableSpotify}`);
        
        const productData = {
          title: wooProduct.name,
          slug: slug,
          description: this.stripHtmlTags(wooProduct.description || ''),
          shortDescription: this.stripHtmlTags(wooProduct.short_description || ''),
          sku: wooProduct.sku || null,
          price: parseFloat(wooProduct.price || wooProduct.regular_price || '0'),
          stock: wooProduct.stock_quantity || 0,
          images: wooProduct.images?.map((img: any) => img.src) || [],
          status: this.mapWooStatus(wooProduct.status),
          woocommerceId: wooProduct.id.toString(),
          vendor: finalVendor,
          condition: productConfig.condition === 'used' ? ProductCondition.USED : ProductCondition.NEW,
          mediaGrade: productConfig.condition === 'used' ? (productConfig.mediaGrade || undefined) : undefined,
          sleeveGrade: productConfig.condition === 'used' ? (productConfig.sleeveGrade || undefined) : undefined,
          spotifyEnabled: productConfig.enableSpotify || false,
          spotifyAlbumId: spotifyAlbumId,
          // Discogs musical information
          artist: artist,
          album: album,
          label: discogsInfo?.label?.join(', '),
          year: discogsInfo?.year ? parseInt(discogsInfo.year) : undefined,
          genre: discogsInfo?.genre?.join(', '),
          country: discogsInfo?.country,
        };

        const newProduct = this.productRepository.create(productData);
        
        // Assign relations separately (TypeORM ManyToMany requirement)
        newProduct.categories = categories;
        newProduct.formats = formats;

        console.log('💾 [WooCommerce] Saving product to database...');
        await this.productRepository.save(newProduct);
        
        console.log(`✅ [WooCommerce] Product saved with ID: ${newProduct.id}`);
        
        // Verify what was saved by reloading
        const savedProduct = await this.productRepository.findOne({
          where: { id: newProduct.id },
          relations: ['categories', 'formats', 'vendor'],
        });
        
        if (savedProduct) {
          console.log('🔍 [WooCommerce] Verification of saved product:');
          console.log(`   ✓ Title: ${savedProduct.title}`);
          console.log(`   ✓ Categories: ${savedProduct.categories?.length || 0} (${savedProduct.categories?.map(c => c.name).join(', ') || 'none'})`);
          console.log(`   ✓ Formats: ${savedProduct.formats?.length || 0} (${savedProduct.formats?.map(f => f.name).join(', ') || 'none'})`);
          console.log(`   ✓ Spotify enabled: ${savedProduct.spotifyEnabled}`);
          console.log(`   ✓ Artist: ${savedProduct.artist || 'N/A'}`);
          console.log(`   ✓ Album: ${savedProduct.album || 'N/A'}`);
          console.log(`   ✓ Label: ${savedProduct.label || 'N/A'}`);
          console.log(`   ✓ Year: ${savedProduct.year || 'N/A'}`);
          console.log(`   ✓ Genre: ${savedProduct.genre || 'N/A'}`);
          console.log(`   ✓ Country: ${savedProduct.country || 'N/A'}`);
          console.log(`   ✓ Condition: ${savedProduct.condition}`);
          if (savedProduct.condition === 'used') {
            console.log(`   ✓ Media Grade: ${savedProduct.mediaGrade || 'N/A'}`);
            console.log(`   ✓ Sleeve Grade: ${savedProduct.sleeveGrade || 'N/A'}`);
          }
        } else {
          console.error('❌ [WooCommerce] ERROR: Product was not saved correctly!');
        }
        
        console.log(`✅ Product created successfully: ${newProduct.title} (ID: ${newProduct.id})`);
        
        imported.push({
          woocommerceId: wooProduct.id,
          name: wooProduct.name,
          success: true,
        });
      } catch (error) {
        console.error(`❌ Failed to import product ${productId}:`, error.message);
        console.error('Full error:', error);
        errors.push({
          productId,
          error: error.message,
        });
      }
    }

    console.log(`📊 [WooCommerce] Import summary: ${imported.length} imported, ${errors.length} errors`);

    return {
      imported: imported.length,
      errors: errors.length,
      details: { imported, errors },
    };
  }

  private mapWooStatus(wooStatus: string): ProductStatus {
    switch (wooStatus) {
      case 'publish':
        return ProductStatus.ACTIVE;
      case 'draft':
      case 'pending':
        return ProductStatus.INACTIVE;
      case 'trash':
        return ProductStatus.TRASH;
      default:
        return ProductStatus.INACTIVE;
    }
  }

  private stripHtmlTags(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Sanitiza texto para evitar problemas con caracteres especiales
   * Normaliza espacios, saltos de línea y caracteres problemáticos
   */
  private sanitizeText(text: string): string {
    if (!text) return '';
    
    return text
      // Normalizar saltos de línea
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Limpiar múltiples saltos de línea consecutivos
      .replace(/\n{3,}/g, '\n\n')
      // Limpiar múltiples espacios
      .replace(/  +/g, ' ')
      // Trim cada línea
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }

  private mapProductToWoo(product: Product): any {
    return {
      name: product.title,
      type: 'simple',
      regular_price: product.price.toString(),
      description: product.description || '',
      short_description: product.shortDescription || '',
      stock_quantity: product.stock,
      manage_stock: true,
      images: product.images?.map((img) => ({ src: img })) || [],
      meta_data: [
        { key: 'mundobeat_product_id', value: product.id },
      ],
    };
  }

  async syncShippingToWooCommerce(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order || order.orderSource !== 'woocommerce' || !order.externalOrderId) return;

    const settings = await this.vendorSettingsRepository.findOne({
      where: { vendorId: order.vendorId },
    });
    if (!settings?.wooStoreUrl || !settings.wooClientKey || !settings.wooClientSecret) {
      throw new Error('WooCommerce no está configurado para esta tienda');
    }

    const wooCommerce = this.createWooClient(
      settings.wooStoreUrl,
      settings.wooClientKey,
      settings.wooClientSecret,
    );
    const trackingUrl = order.enviaTrackingUrl || '';
    const carrier = order.enviaCarrier || order.shippingMethod || 'MundoBeat';
    const trackingNumber = String(order.enviaTrackingNumber || '').trim();

    const currentOrder = await wooCommerce.get(`orders/${order.externalOrderId}`);
    const currentMeta = new Map<string, any>(
      (currentOrder.data?.meta_data || []).map((entry: any) => [String(entry.key), entry]),
    );
    const shippingMeta = {
      _mundobeat_tracking_number: trackingNumber,
      _mundobeat_tracking_url: trackingUrl,
      _mundobeat_carrier: carrier,
      _mundobeat_label_url: order.enviaLabelUrl || '',
      _mundobeat_shipping_status: order.enviaShippingStatus || 'generated',
    };
    const orderUpdate: any = {
      meta_data: Object.entries(shippingMeta).map(([key, value]) => ({
        ...(currentMeta.get(key)?.id ? { id: currentMeta.get(key).id } : {}),
        key,
        value,
      })),
    };
    if (order.enviaShippingStatus === 'delivered' && !['cancelled', 'refunded'].includes(currentOrder.data?.status)) {
      orderUpdate.status = 'completed';
    }
    await wooCommerce.put(`orders/${order.externalOrderId}`, orderUpdate);

    if (!trackingNumber) return;

    const notificationMetaKey = '_mundobeat_label_notified_tracking';
    const notifiedTracking = String(currentMeta.get(notificationMetaKey)?.value || '').trim();
    if (notifiedTracking === trackingNumber) return;

    const trackingLink = trackingUrl ? ` Seguimiento: ${trackingUrl}` : '';
    const noteText = `Etiqueta de envío generada en MundoBeat. ${carrier}: ${trackingNumber}.${trackingLink}`;
    const notesResponse = await wooCommerce.get(`orders/${order.externalOrderId}/notes`, {
      per_page: 100,
    });
    const noteAlreadyExists = (notesResponse.data || []).some((note: any) => {
      const content = String(note?.note || '');
      return content.includes('Etiqueta de envío generada en MundoBeat')
        && content.includes(trackingNumber);
    });

    if (!noteAlreadyExists) {
      await wooCommerce.post(`orders/${order.externalOrderId}/notes`, {
        note: noteText,
        customer_note: true,
      });
    }

    const existingNotificationMeta = currentMeta.get(notificationMetaKey);
    await wooCommerce.put(`orders/${order.externalOrderId}`, {
      meta_data: [{
        ...(existingNotificationMeta?.id ? { id: existingNotificationMeta.id } : {}),
        key: notificationMetaKey,
        value: trackingNumber,
      }],
    });
  }

  private getConditionCategoryConfig(condition: ProductCondition | string) {
    const isUsed = condition === ProductCondition.USED || condition === 'used';

    return {
      cacheKey: isUsed ? '__mundobeat_condition_used' : '__mundobeat_condition_new',
      name: isUsed ? 'Usados' : 'Nuevos',
      slug: isUsed ? 'usados' : 'nuevos',
    };
  }

  private async ensureWooConditionCategory(
    wooCommerce: any,
    settings: VendorSettings,
    condition: ProductCondition | string,
  ): Promise<number | null> {
    const config = this.getConditionCategoryConfig(condition);
    settings.wooCategoryMapping = settings.wooCategoryMapping || {};

    const cachedId = settings.wooCategoryMapping[config.cacheKey];
    if (cachedId && Number.isInteger(parseInt(cachedId, 10))) {
      return parseInt(cachedId, 10);
    }

    try {
      const existing = await wooCommerce.get('products/categories', {
        search: config.name,
        per_page: 100,
      });

      const found = (existing.data || []).find((category: any) => {
        const name = String(category.name || '').trim().toLowerCase();
        const slug = String(category.slug || '').trim().toLowerCase();
        return name === config.name.toLowerCase() || slug === config.slug;
      });

      const categoryId = found?.id || (await wooCommerce.post('products/categories', {
        name: config.name,
        slug: config.slug,
      })).data?.id;

      if (categoryId) {
        settings.wooCategoryMapping[config.cacheKey] = String(categoryId);
        await this.vendorSettingsRepository.save(settings);
        console.log('[WooCommerce] Condition category ' + config.name + ': ' + categoryId);
        return Number(categoryId);
      }
    } catch (error) {
      console.warn(
        '[WooCommerce] Could not ensure condition category ' + config.name + ':',
        error.response?.data?.message || error.message,
      );
    }

    return null;
  }

  private async buildWooCategories(
    product: Product,
    settings: VendorSettings,
    wooCommerce: any,
    options?: { condition?: ProductCondition | string; categoryIds?: string[] },
  ): Promise<Array<{ id: number }>> {
    const categoryIds = new Set<number>();
    const mundobeatCategoryId = options?.categoryIds?.[0] || product.categories?.[0]?.id;

    if (mundobeatCategoryId) {
      const wooCategoryId = settings.wooCategoryMapping?.[mundobeatCategoryId];
      console.log(
        '   Category mapping: ' + (product.categories?.[0]?.name || mundobeatCategoryId) + ' (' + mundobeatCategoryId + ') -> ' + wooCategoryId,
      );

      if (wooCategoryId) {
        categoryIds.add(parseInt(wooCategoryId, 10));
      } else {
        console.warn('[WooCommerce Sync] No mapping found for category: ' + (product.categories?.[0]?.name || mundobeatCategoryId));
      }
    } else {
      console.log('   No categories found');
    }

    const conditionCategoryId = await this.ensureWooConditionCategory(
      wooCommerce,
      settings,
      options?.condition || product.condition || ProductCondition.NEW,
    );

    if (conditionCategoryId) {
      categoryIds.add(conditionCategoryId);
    }

    return Array.from(categoryIds)
      .filter((id) => Number.isInteger(id))
      .map((id) => ({ id }));
  }

  /**
   * Busca un producto en Discogs y devuelve el resultado que mejor coincida
   */
  private async searchDiscogsForProduct(
    discogsToken: string,
    productTitle: string,
  ): Promise<any | null> {
    try {
      console.log(`🔍 [Discogs] Searching for: "${productTitle}"`);
      
      const results = await this.discogsService.search(discogsToken, {
        query: productTitle,
        per_page: 10,
      });

      if (!results.results || results.results.length === 0) {
        console.log('⚠️ [Discogs] No results found');
        return null;
      }

      console.log(`✅ [Discogs] Found ${results.results.length} results`);

      // Buscar mejor coincidencia (título más similar)
      const productTitleLower = productTitle.toLowerCase();
      let bestMatch = results.results[0];
      let bestScore = 0;

      for (const result of results.results) {
        const resultTitleLower = result.title.toLowerCase();
        
        // Score simple: contar palabras coincidentes
        const productWords = productTitleLower.split(/\s+/);
        const matchingWords = productWords.filter(word => 
          word.length > 2 && resultTitleLower.includes(word)
        );
        const score = matchingWords.length / productWords.length;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = result;
        }
      }

      console.log(`🎯 [Discogs] Best match (${Math.round(bestScore * 100)}%): "${bestMatch.title}"`);
      return bestMatch;
    } catch (error) {
      console.error('❌ [Discogs] Search error:', error.message);
      return null;
    }
  }

  /**
   * Valida y filtra formatos de Discogs contra los campos de WooCommerce
   * Busca coincidencias en inglés y español (case-insensitive)
   */
  private validateAndFilterFormats(
    discogsFormats: string[],
    title: string,
    shortDescription: string,
    description: string,
  ): string[] {
    const searchText = `${title} ${shortDescription} ${description}`.toLowerCase();
    
    // Mapeo de formatos en inglés y español
    const formatTranslations: { [key: string]: string[] } = {
      'Vinyl': ['vinyl', 'vinilo', 'lp', 'ep'],
      'CD': ['cd', 'compact disc', 'disco compacto'],
      'Cassette': ['cassette', 'casete', 'tape', 'cinta'],
      'DVD': ['dvd'],
      'Blu-ray': ['blu-ray', 'bluray', 'blu ray'],
      'LP': ['lp', 'long play'],
      'Album': ['album', 'álbum'],
      '7"': ['7"', '7 inch', '7 pulgadas'],
      '10"': ['10"', '10 inch', '10 pulgadas'],
      '12"': ['12"', '12 inch', '12 pulgadas'],
    };

    const validFormats: string[] = [];

    // Procesar cada formato de Discogs
    for (const discogsFormat of discogsFormats) {
      // Limpiar formato (remover cantidades como "2 ×")
      const cleanFormat = discogsFormat.replace(/^\d+\s*×\s*/i, '').trim();
      
      // Buscar si el formato o sus traducciones aparecen en WooCommerce
      const formatLower = cleanFormat.toLowerCase();
      let found = searchText.includes(formatLower);

      // Si no se encontró directo, buscar traducciones
      if (!found) {
        const translations = formatTranslations[cleanFormat] || [];
        found = translations.some(translation => searchText.includes(translation));
      }

      if (found) {
        console.log(`✅ [Discogs] Format "${cleanFormat}" found in WooCommerce fields`);
        if (!validFormats.includes(cleanFormat)) {
          validFormats.push(cleanFormat);
        }
      } else {
        console.log(`❌ [Discogs] Format "${cleanFormat}" NOT found, skipping`);
      }
    }

    return validFormats;
  }

  /**
   * Encuentra o crea Format entities en la base de datos
   */
  private async findOrCreateFormats(formatNames: string[]): Promise<Format[]> {
    const formats: Format[] = [];

    for (const name of formatNames) {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Buscar si ya existe
      let format = await this.formatRepository.findOne({ where: { slug } });

      // Si no existe, crearlo
      if (!format) {
        format = this.formatRepository.create({ name, slug });
        await this.formatRepository.save(format);
        console.log(`🆕 [Discogs] Created new format: ${name}`);
      } else {
        console.log(`🔗 [Discogs] Using existing format: ${name}`);
      }

      formats.push(format);
    }

    return formats;
  }

  /**
   * Limpia el título del producto removiendo palabras de formato
   * Elimina: Vinilo, CD, Blue Ray, Vinyl, LP, etc.
   */
  private cleanProductTitle(title: string): string {
    const formatWords = [
      'vinilo',
      'vinyl',
      'cd',
      'blue ray',
      'bluray',
      'blu-ray',
      'blu ray',
      'lp',
      'ep',
      'dvd',
      'cassette',
      'casete',
      'tape',
      'cinta',
    ];

    let cleanedTitle = title;
    
    // Remover cada palabra de formato (case-insensitive)
    formatWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      cleanedTitle = cleanedTitle.replace(regex, '');
    });

    // Limpiar espacios múltiples y guiones redundantes
    cleanedTitle = cleanedTitle
      .replace(/\s+/g, ' ')  // Múltiples espacios a uno solo
      .replace(/\s*-\s*/g, ' - ')  // Normalizar espacios alrededor de guiones
      .replace(/-+/g, '-')  // Múltiples guiones a uno solo
      .trim();

    return cleanedTitle;
  }

  /**
   * Extrae artista y álbum del título
   * Formato esperado: "Artista - Álbum" (ignora todo después del segundo guion)
   */
  private extractArtistAlbum(title: string): { artist: string; album: string } | null {
    // Buscar el primer guion
    const firstDashIndex = title.indexOf(' - ');
    
    if (firstDashIndex === -1) {
      console.log('⚠️ [Discogs] No dash found in title, cannot extract artist-album');
      return null;
    }

    const artist = title.substring(0, firstDashIndex).trim();
    
    // Buscar el segundo guion
    const remainingText = title.substring(firstDashIndex + 3);
    const secondDashIndex = remainingText.indexOf(' - ');
    
    let album: string;
    if (secondDashIndex !== -1) {
      // Si hay segundo guion, solo tomar hasta ahí
      album = remainingText.substring(0, secondDashIndex).trim();
      console.log(`ℹ️ [Discogs] Ignoring text after second dash: "${remainingText.substring(secondDashIndex + 3)}"`);
    } else {
      // Si no hay segundo guion, tomar todo lo que queda
      album = remainingText.trim();
    }

    if (!artist || !album) {
      console.log('⚠️ [Discogs] Artist or album is empty after extraction');
      return null;
    }

    return { artist, album };
  }

  /**
   * Obtiene token de acceso de Spotify
   */
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
        console.error('\u274c [Spotify] Failed to get token:', response.status);
        return null;
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('\u274c [Spotify] Error getting token:', error.message);
      return null;
    }
  }

  /**
   * Busca un álbum en Spotify usando artista y nombre de álbum
   * Retorna el Spotify Album ID si lo encuentra
   */
  private async searchSpotifyAlbum(
    albumTitle: string,
    artistName: string,
    vendorSettings: VendorSettings,
  ): Promise<string | undefined> {
    try {
      // Verificar credenciales de Spotify
      if (!vendorSettings.spotifyClientId || !vendorSettings.spotifyClientSecret) {
        console.log('\u2139\ufe0f [Spotify] Credentials not configured');
        return undefined;
      }

      // Obtener token de acceso
      const token = await this.getSpotifyToken(
        vendorSettings.spotifyClientId,
        vendorSettings.spotifyClientSecret,
      );
      
      if (!token) {
        console.log('\u274c [Spotify] Failed to get access token');
        return undefined;
      }

      // Construir query de búsqueda
      const query = `album:${albumTitle} artist:${artistName}`;
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`;
      
      console.log(`\ud83d\udd0d [Spotify] Searching: "${query}"`);
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('\u274c [Spotify] Search failed:', response.status);
        return undefined;
      }

      const data = await response.json();
      
      if (data.albums?.items?.length > 0) {
        const album = data.albums.items[0];
        console.log(`\u2705 [Spotify] Found: "${album.name}" by ${album.artists.map((a: any) => a.name).join(', ')}`);
        return album.id;
      }

      console.log(`\u26a0\ufe0f [Spotify] No album found for: "${albumTitle}" by "${artistName}"`);
      return undefined;
    } catch (error) {
      console.error('\u274c [Spotify] Search error:', error.message);
      return undefined;
    }
  }

  /**
   * Sincroniza solo los campos modificados en bulk update a WooCommerce
   * Más eficiente que syncProductToWooCommerce para ediciones masivas
   */
  async syncBulkFieldsToWooCommerce(
    productId: string, 
    vendorId: string, 
    updates: {
      status?: string;
      condition?: string;
      mediaGrade?: string;
      sleeveGrade?: string;
      stock?: number;
      categoryIds?: string[];
      formatName?: string;
    }
  ): Promise<any> {
    console.log(`🔄 [WooCommerce Bulk Sync] Starting partial sync for product ${productId}`);

    // Cargar producto con relaciones mínimas necesarias
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['vendor', 'vendor.settings', 'categories'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendor.id !== vendorId) {
      throw new Error('Product does not belong to this vendor');
    }

    if (!product.woocommerceId) {
      console.log(`⚠️ [WooCommerce Bulk Sync] Product ${productId} has no woocommerceId, skipping`);
      return;
    }

    const settings = product.vendor.settings;

    if (!settings.wooStoreUrl || !settings.wooClientKey || !settings.wooClientSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    const wooCommerce = this.createWooClient(
      settings.wooStoreUrl,
      settings.wooClientKey,
      settings.wooClientSecret,
    );

    try {
      // Construir payload solo con campos modificados
      const partialData: any = {};

      // Mapear status
      if (updates.status !== undefined) {
        if (updates.status === ProductStatus.ACTIVE) {
          partialData.status = 'publish';
        } else if (updates.status === ProductStatus.INACTIVE) {
          partialData.status = 'draft';
        } else if (updates.status === ProductStatus.TRASH) {
          partialData.status = 'trash';
        }
        console.log(`   Status: ${updates.status} -> ${partialData.status}`);
      }

      // Stock
      if (updates.stock !== undefined) {
        partialData.manage_stock = true;
        partialData.stock_quantity = updates.stock;
        console.log(`   Stock: ${updates.stock}`);
      }

      // Categoria normal + categoria automatica de condicion (Nuevos/Usados)
      if (updates.categoryIds !== undefined || updates.condition !== undefined) {
        const categories = await this.buildWooCategories(product, settings, wooCommerce, {
          categoryIds: updates.categoryIds,
          condition: updates.condition || product.condition,
        });

        if (categories.length > 0) {
          partialData.categories = categories;
          console.log('   Categories: ' + categories.map((category) => category.id).join(', '));
        }
      }
      // Meta data para condición y goldmine scales
      const metaUpdates: any[] = [];
      
      if (updates.condition !== undefined) {
        const conditionLabel = updates.condition === ProductCondition.NEW ? 'New' : 'Used';
        metaUpdates.push({ key: 'condition', value: conditionLabel });
        console.log(`   Condition: ${conditionLabel}`);
      }

      if (updates.mediaGrade !== undefined) {
        metaUpdates.push({ key: 'media_grade', value: updates.mediaGrade || '' });
        console.log(`   Media Grade: ${updates.mediaGrade}`);
      }

      if (updates.sleeveGrade !== undefined) {
        metaUpdates.push({ key: 'sleeve_grade', value: updates.sleeveGrade || '' });
        console.log(`   Sleeve Grade: ${updates.sleeveGrade}`);
      }

      if (metaUpdates.length > 0) {
        partialData.meta_data = metaUpdates;
      }

      // Formato (tags)
      if (updates.formatName) {
        const formatNames = updates.formatName.split(',').map(f => f.trim());
        partialData.tags = formatNames.map(name => ({ name }));
        console.log(`   Formats: ${formatNames.join(', ')}`);
      }

      console.log(`📤 [WooCommerce Bulk Sync] Partial payload (${Object.keys(partialData).length} fields):`);
      console.log(JSON.stringify(partialData, null, 2));

      // Actualizar solo los campos modificados
      const result = await wooCommerce.put(`products/${product.woocommerceId}`, partialData);
      console.log(`✅ [WooCommerce Bulk Sync] Product ${product.woocommerceId} updated successfully`);

      return result.data;
    } catch (error) {
      console.error(`❌ [WooCommerce Bulk Sync] Error updating product ${product.woocommerceId}:`, error.message);
      if (error.response?.data) {
        console.error('WooCommerce API Error:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Sincroniza un producto de MundoBeat a WooCommerce
   * Crea o actualiza el producto según si ya existe
   */
  async syncProductToWooCommerce(productId: string, vendorId: string): Promise<any> {
    console.log(`🔄 [WooCommerce Sync] Starting sync for product ${productId}`);

    // Cargar producto con todas las relaciones
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['vendor', 'vendor.settings', 'categories', 'formats'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    
    console.log(`📦 [WooCommerce Sync] Product loaded:`);
    console.log(`   ID: ${product.id}`);
    console.log(`   Title: ${product.title}`);
    console.log(`   Price: ${product.price} (type: ${typeof product.price})`);
    console.log(`   Stock: ${product.stock}`);
    console.log(`   Status: ${product.status}`);

    if (product.vendor.id !== vendorId) {
      throw new Error('Product does not belong to this vendor');
    }

    // Solo validar que el producto no esté en estado desconocido
    // Permitir sincronización de productos activos, inactivos y en papelera
    const validStatuses = [ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.TRASH];
    if (!validStatuses.includes(product.status)) {
      throw new Error(`Invalid product status: ${product.status}`);
    }

    const settings = product.vendor.settings;

    if (!settings.wooStoreUrl || !settings.wooClientKey || !settings.wooClientSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    // Verificar mapeo de categorías
    if (!settings.wooCategoryMapping || Object.keys(settings.wooCategoryMapping).length === 0) {
      throw new Error('Category mapping not configured. Please configure it in WooCommerce settings.');
    }

    const wooCommerce = this.createWooClient(
      settings.wooStoreUrl,
      settings.wooClientKey,
      settings.wooClientSecret,
    );

    try {
      // Construir datos del producto para WooCommerce
      console.log(`📦 [WooCommerce Sync] Building product data for: ${product.title}`);
      const productData = await this.buildWooProductData(product, settings, wooCommerce);

      // Log del payload completo que se enviará
      console.log(`📤 [WooCommerce Sync] Payload to send:`);
      console.log(JSON.stringify(productData, null, 2));
      
      // Log específico de Spotify metadata
      const spotifyMeta = productData.meta_data?.find((m: any) => m.key === 'spotify_album_id');
      if (spotifyMeta) {
        console.log(`🎵 [Spotify] spotify_album_id in meta_data: ${spotifyMeta.value}`);
      } else {
        console.log(`⚠️ [Spotify] No spotify_album_id in meta_data`);
      }

      let wooProduct: any;
      let syncAction: string;

      if (product.woocommerceId) {
        // Actualizar producto existente
        console.log(`🔄 [WooCommerce Sync] Updating existing product: ${product.woocommerceId}`);
        const result = await wooCommerce.put(`products/${product.woocommerceId}`, productData);
        wooProduct = result.data;
        syncAction = 'updated';
      } else {
        // Crear nuevo producto
        console.log(`✨ [WooCommerce Sync] Creating new product`);
        const result = await wooCommerce.post('products', productData);
        wooProduct = result.data;
        syncAction = 'created';

        // Guardar el ID de WooCommerce en MundoBeat
        product.woocommerceId = wooProduct.id.toString();
        await this.productRepository.save(product);
      }

      console.log(`✅ [WooCommerce Sync] Product ${syncAction}: ${wooProduct.id}`);

      return {
        success: true,
        action: syncAction,
        woocommerceId: wooProduct.id,
        woocommerceUrl: wooProduct.permalink,
      };
    } catch (error) {
      console.error(`❌ [WooCommerce Sync] Error details:`, {
        message: error.message,
        response: error.response?.data || 'No response data',
        status: error.response?.status || 'No status',
        statusText: error.response?.statusText || 'No status text',
      });

      // Manejar caso especial: SKU duplicado pero producto creado exitosamente
      if (error.response?.data?.code === 'product_invalid_sku' && error.response?.data?.data?.resource_id) {
        const createdProductId = error.response.data.data.resource_id;
        console.log(`⚠️ [WooCommerce Sync] SKU duplicate error, but product was created: ${createdProductId}`);
        
        // Guardar el ID de WooCommerce en MundoBeat
        product.woocommerceId = createdProductId.toString();
        await this.productRepository.save(product);
        
        console.log(`✅ [WooCommerce Sync] Product created: ${createdProductId}`);
        
        return {
          success: true,
          action: 'created',
          woocommerceId: createdProductId,
          woocommerceUrl: `${settings.wooStoreUrl}/product/${product.slug || product.id}`,
        };
      }

      throw new Error(`Failed to sync product: ${error.message}`);
    }
  }

  /**
   * Construye el objeto de datos para enviar a WooCommerce
   */
  private async buildWooProductData(product: Product, settings: VendorSettings, wooCommerce: any): Promise<any> {
    console.log(`🔨 [WooCommerce] Building data for product: ${product.id}`);
    
    // Generar SKU automático si no existe
    const sku = product.sku || `MB-${product.id}`;
    console.log(`   SKU: ${sku}`);

    const wooCategories = await this.buildWooCategories(product, settings, wooCommerce);

    // Construir tags con formatos (sanitizar para evitar problemas de encoding)
    const tags = product.formats?.map(f => ({ 
      name: this.sanitizeText(f.name) 
    })) || [];
    console.log(`   Tags sanitized: ${tags.map(t => t.name).join(', ')}`);

    // Construir meta data con información musical y condición (sanitizar valores)
    const metaData: any[] = [];
    metaData.push({ key: 'mundobeat_product_id', value: product.id });

    if (product.artist) {
      metaData.push({ key: 'artist', value: this.sanitizeText(product.artist) });
    }
    if (product.album) {
      metaData.push({ key: 'album', value: this.sanitizeText(product.album) });
    }
    if (product.label) {
      metaData.push({ key: 'label', value: this.sanitizeText(product.label) });
    }
    if (product.year) {
      metaData.push({ key: 'year', value: product.year.toString() });
    }
    if (product.genre) {
      metaData.push({ key: 'genre', value: this.sanitizeText(product.genre) });
    }
    if (product.country) {
      metaData.push({ key: 'country', value: this.sanitizeText(product.country) });
    }

    // Agregar condición y grados
    metaData.push({
      key: 'condition',
      value: product.condition === ProductCondition.USED ? 'Used' : 'New',
    });

    if (product.condition === ProductCondition.USED) {
      if (product.mediaGrade) {
        metaData.push({ key: 'media_grade', value: product.mediaGrade });
      }
      if (product.sleeveGrade) {
        metaData.push({ key: 'sleeve_grade', value: product.sleeveGrade });
      }
    }

    // Agregar flag de visibilidad del reproductor Spotify
    metaData.push({
      key: 'spotify_enabled',
      value: product.spotifyEnabled ? 'yes' : 'no',
    });

    // Agregar Spotify Album ID si existe
    if (product.spotifyAlbumId) {
      metaData.push({ 
        key: 'spotify_album_id', 
        value: product.spotifyAlbumId 
      });
      console.log(`   🎵 Spotify Album ID added to meta_data: ${product.spotifyAlbumId} (enabled: ${product.spotifyEnabled})`);
    }
    
    // Agregar tracklist (canciones de Discogs) si existe
    if (product.tracklist) {
      // Limitar a 5000 caracteres para evitar problemas
      const tracklistLimited = product.tracklist.length > 5000 
        ? product.tracklist.substring(0, 5000) + '...' 
        : product.tracklist;
      
      metaData.push({
        key: 'tracklist',
        value: this.sanitizeText(tracklistLimited)
      });
      console.log(`   🎼 Tracklist added to meta_data (${tracklistLimited.length} chars)`);
    }
    
    // Agregar especificaciones técnicas si existe
    if (product.technicalSpecs) {
      // Limitar a 5000 caracteres
      const specsLimited = product.technicalSpecs.length > 5000 
        ? product.technicalSpecs.substring(0, 5000) + '...' 
        : product.technicalSpecs;
      
      metaData.push({
        key: 'technical_specs',
        value: this.sanitizeText(specsLimited)
      });
      console.log(`   📊 Technical Specs added to meta_data (${specsLimited.length} chars)`);
    }
    
    // =============================================================================
    // 📦 DIMENSIONES Y PESO PARA ENVÍO
    // =============================================================================
    // Lógica de herencia: Si el producto no tiene dimensiones propias, usar las de la categoría
    const dimensions = this.getProductDimensions(product);
    
    if (dimensions) {
      console.log(`   📦 Dimensions: ${dimensions.width}x${dimensions.depth}x${dimensions.height}cm, ${dimensions.weight}kg`);
      console.log(`      Source: ${dimensions.source === 'product' ? 'Product override' : 'Category default'}`);
    } else {
      console.log(`   ⚠️ No dimensions available (no product dimensions and no category with dimensions)`);
    }
    // =============================================================================

    // Limpiar shortDescription de HTML (iframes, scripts, etc.)
    const rawShortDescription = product.shortDescription || '';
    let cleanShortDescription = this.stripHtmlTags(rawShortDescription);
    cleanShortDescription = this.sanitizeText(cleanShortDescription);
    
    console.log(`   Short description (raw): ${rawShortDescription.substring(0, 100)}...`);
    console.log(`   Short description (clean): ${cleanShortDescription.substring(0, 100)}...`);
    console.log(`   Images count: ${product.images?.length || 0}`);
    console.log(`   Stock: ${product.stock}`);
    console.log(`   Price (raw): ${product.price} (type: ${typeof product.price})`);
    console.log(`   Tags: ${product.formats?.map(f => f.name).join(', ') || 'none'}`);
    console.log(`   Meta data items: ${metaData.length}`);

    // Validar que el producto tenga precio
    if (!product.price || product.price <= 0) {
      console.error(`❌ Price validation failed - price: ${product.price}, type: ${typeof product.price}`);
      throw new Error(`Product must have a valid price greater than 0. Current price: ${product.price}`);
    }
    
    // Convertir precio a entero (sin decimales) para formato chileno
    // WooCommerce mostrará con separador de miles según su configuración
    const priceNumber = typeof product.price === 'number' ? product.price : parseFloat(String(product.price));
    const priceString = Math.round(priceNumber).toString(); // Siempre redondear a entero
    console.log(`   Price (original): ${priceNumber} → (rounded): ${priceString}`);

    // Mapear status de MundoBeat a WooCommerce
    let wooStatus = 'draft';
    if (product.status === ProductStatus.ACTIVE) {
      wooStatus = 'publish';
    } else if (product.status === ProductStatus.INACTIVE) {
      wooStatus = 'draft';
    } else if (product.status === ProductStatus.TRASH) {
      wooStatus = 'trash';
    }
    console.log(`   Status mapping: ${product.status} -> ${wooStatus}`);

    // Construir objeto de producto para WooCommerce
    const productData: any = {
      name: this.sanitizeText(product.title),
      type: 'simple',
      status: wooStatus,
      regular_price: priceString,
      description: this.sanitizeText(product.description || ''),
      short_description: cleanShortDescription,
      sku: sku,
      manage_stock: true,
      stock_quantity: product.stock,
      images: product.images?.map(img => ({ src: img })) || [],
      tags: tags,
      meta_data: metaData,
    };

    // Agregar dimensiones y peso si están disponibles
    if (dimensions) {
      productData.weight = dimensions.weight.toString();
      productData.dimensions = {
        length: dimensions.depth.toString(),  // Profundidad en WooCommerce es "length"
        width: dimensions.width.toString(),
        height: dimensions.height.toString(),
      };
      console.log(`   🚚 Shipping data added to WooCommerce product`);
    }

    // Agregar categoria principal y categoria automatica de condicion si estan disponibles
    if (wooCategories.length > 0) {
      productData.categories = wooCategories;
    }

    return productData;
  }

  /**
   * Obtiene las dimensiones efectivas del producto
   * Lógica de herencia: product dimensions > category dimensions > null
   */
  private getProductDimensions(product: Product): { 
    weight: number; 
    height: number; 
    width: number; 
    depth: number;
    source: 'product' | 'category';
  } | null {
    // Si el producto tiene todas sus dimensiones, usarlas
    if (product.weight && product.height && product.width && product.depth) {
      return {
        weight: product.weight,
        height: product.height,
        width: product.width,
        depth: product.depth,
        source: 'product',
      };
    }

    // Si no, intentar heredar de la primera categoría
    if (product.categories && product.categories.length > 0) {
      const category = product.categories[0];
      
      if (category.weight && category.height && category.width && category.depth) {
        return {
          weight: product.weight || category.weight,
          height: product.height || category.height,
          width: product.width || category.width,
          depth: product.depth || category.depth,
          source: 'category',
        };
      }
    }

    // No hay dimensiones disponibles
    return null;
  }

  /**
   * Sincroniza todos los productos publicados de un vendor
   */
  async syncAllProducts(vendorId: string): Promise<any> {
    console.log(`🔄 [WooCommerce Sync] Starting bulk sync for vendor ${vendorId}`);

    // Obtener vendor y configuración
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    if (!vendor || !vendor.settings) {
      throw new NotFoundException('Vendor not found');
    }

    if (!vendor.settings.wooStoreUrl || !vendor.settings.wooClientKey || !vendor.settings.wooClientSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    if (!vendor.settings.wooCategoryMapping || Object.keys(vendor.settings.wooCategoryMapping).length === 0) {
      throw new Error('Category mapping not configured. Please configure it in WooCommerce settings.');
    }

    // Obtener todos los productos publicados del vendor
    const products = await this.productRepository.find({
      where: {
        vendor: { id: vendorId },
        status: ProductStatus.ACTIVE,
      },
      relations: ['vendor', 'vendor.settings', 'categories', 'formats'],
    });

    console.log(`📦 [WooCommerce Sync] Found ${products.length} products to sync`);

    const results = {
      total: products.length,
      synced: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const product of products) {
      try {
        const result = await this.syncProductToWooCommerce(product.id, vendorId);
        results.synced++;
        results.details.push({
          productId: product.id,
          title: product.title,
          success: true,
          ...result,
        });
      } catch (error) {
        results.errors++;
        results.details.push({
          productId: product.id,
          title: product.title,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`✅ [WooCommerce Sync] Bulk sync completed: ${results.synced} synced, ${results.errors} errors`);

    return results;
  }

  async handleWebhook(
    vendorId: string,
    payload: any,
    meta: { signature?: string; topic?: string; rawBody?: Buffer } = {},
  ): Promise<void> {
    const { signature, topic, rawBody } = meta;
    console.log(`📦 [WC Webhook] Processing topic="${topic}" for vendor=${vendorId}`);

    // 1. Load vendor settings
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    if (!vendor || !vendor.settings) throw new NotFoundException(`Vendor ${vendorId} not found`);

    // 2. Validate HMAC signature if webhook secret is configured
    const { wooWebhookSecret } = vendor.settings;
    if (wooWebhookSecret && rawBody) {
      const crypto = await import('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', wooWebhookSecret)
        .update(rawBody)
        .digest('base64');

      if (signature !== expectedSignature) {
        throw new UnauthorizedException(`Invalid WooCommerce webhook signature for vendor ${vendorId}`);
      }
      console.log(`✅ [WC Webhook] HMAC signature valid`);
    }

    // 3. Handle ping (WooCommerce sends a ping when webhook is first created)
    if (!topic || topic === 'ping') {
      console.log(`🏓 [WC Webhook] Ping received for vendor ${vendorId}`);
      return;
    }

    // 4. Process based on topic
    if (topic === 'order.created' || topic === 'order.updated') {
      await this.handleOrderWebhook(vendorId, payload, topic);
    } else if (topic === 'product.updated') {
      await this.handleProductWebhook(vendorId, payload);
    } else {
      console.log(`ℹ️ [WC Webhook] Ignoring topic="${topic}"`);
    }
  }

  private async handleOrderWebhook(vendorId: string, order: any, topic: string): Promise<void> {
    const key = `${vendorId}:${order?.id || 'unknown'}`;
    const running = this.orderSyncs.get(key);
    if (running) {
      await running;
      return;
    }
    const task = this.persistOrderWebhook(vendorId, order, topic).finally(() => this.orderSyncs.delete(key));
    this.orderSyncs.set(key, task);
    await task;
  }

  private async persistOrderWebhook(vendorId: string, order: any, topic: string): Promise<void> {
    const orderId = order?.id;
    const status = order?.status;
    const lineItems = order?.line_items;

    console.log(`📦 [WC Webhook] Order #${orderId} status="${status}" items=${lineItems?.length || 0}`);

    if (!lineItems || lineItems.length === 0) {
      console.log(`ℹ️ [WC Webhook] No line items in order #${orderId}, skipping`);
      return;
    }

    // Solo se incorporan ventas cuyo pago ya fue confirmado por WooCommerce.
    const saleStatuses = ['processing', 'completed'];
    if (!saleStatuses.includes(status)) {
      console.log(`ℹ️ [WC Webhook] Order #${orderId} status="${status}" is not a sale, skipping`);
      return;
    }

    const vendor = await this.vendorRepository.findOne({ where: { id: vendorId }, relations: ['user'] });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const checkoutSessionId = `woocommerce:${orderId}`;
    let localOrder = await this.orderRepository.findOne({
      where: { vendorId, orderSource: 'woocommerce', checkoutSessionId },
      relations: ['items'],
    });
    const isNew = !localOrder;
    const shipping = order.shipping || {};
    const billing = order.billing || {};
    const shippingLine = Array.isArray(order.shipping_lines) ? order.shipping_lines[0] : null;
    const normalizeMeta = (entries: any[] = []) => Object.fromEntries(
      entries
        .filter((entry: any) => entry?.key)
        .map((entry: any) => [String(entry.key).replace(/^_+/, ''), entry.value]),
    );
    const shippingMeta = {
      ...normalizeMeta(shippingLine?.meta_data),
      ...normalizeMeta(order.meta_data),
    };
    const subtotal = lineItems.reduce((sum: number, item: any) => sum + Number(item.subtotal ?? item.total ?? 0), 0);
    const shippingCost = Number(order.shipping_total ?? shippingLine?.total ?? 0);

    if (!localOrder) {
      localOrder = this.orderRepository.create({
        orderNumber: `WC-${order.number || orderId}`,
        checkoutSessionId,
        vendorId,
        vendorSlug: vendor.slug,
        // paymentMethod is varchar(50); WooCommerce gateway labels can be much longer.
        paymentMethod: String(order.payment_method || 'woocommerce').slice(0, 50),
        shippingName: `${shipping.first_name || billing.first_name || ''} ${shipping.last_name || billing.last_name || ''}`.trim() || 'Cliente WooCommerce',
        shippingAddress: shipping.address_1 || billing.address_1 || 'Sin informar',
        shippingNumber: shipping.address_2 || billing.address_2 || undefined,
        shippingCity: shipping.city || billing.city || 'Sin informar',
        shippingCountry: shipping.country || billing.country || 'CL',
        shippingRegion: shipping.state || billing.state || null,
        shippingCommune: shipping.city || billing.city || null,
        shippingRut: billing.company || 'No informado',
        shippingPhone: billing.phone || 'No informado',
        orderSource: 'woocommerce',
        isMarketplaceSale: false,
        commissionPercentage: 0,
        commissionAmount: 0,
        commissionStatus: 'external',
      } as Partial<Order>);
    }
    localOrder.shippingName = `${shipping.first_name || billing.first_name || ''} ${shipping.last_name || billing.last_name || ''}`.trim() || localOrder.shippingName || 'Cliente WooCommerce';
    localOrder.shippingAddress = shipping.address_1 || billing.address_1 || localOrder.shippingAddress || 'Sin informar';
    localOrder.shippingNumber = shipping.address_2 || billing.address_2 || localOrder.shippingNumber;
    localOrder.shippingCity = shipping.city || billing.city || localOrder.shippingCity || 'Sin informar';
    localOrder.shippingCountry = shipping.country || billing.country || localOrder.shippingCountry || 'CL';
    localOrder.shippingRegion = shipping.state || billing.state || localOrder.shippingRegion;
    localOrder.shippingCommune = shipping.city || billing.city || localOrder.shippingCommune;
    localOrder.shippingPhone = shipping.phone || billing.phone || localOrder.shippingPhone || 'No informado';
    localOrder.notes = order.customer_note || localOrder.notes;
    localOrder.subtotal = subtotal;
    localOrder.shippingCost = shippingCost;
    localOrder.tax = Number(order.total_tax || 0);
    localOrder.total = Number(order.total || subtotal + shippingCost);
    localOrder.status = status === 'completed' ? OrderStatus.DELIVERED : OrderStatus.PROCESSING;
    localOrder.paymentStatus = 'approved';
    localOrder.paymentTransactionId = order.transaction_id ? String(order.transaction_id) : `woocommerce:${orderId}`;
    localOrder.customerEmail = billing.email || null;
    localOrder.shippingMethod = shippingLine?.method_title || 'Envío WooCommerce';
    localOrder.shippingMethodCode = shippingLine?.method_id || null;
    localOrder.enviaCarrier = shippingMeta.mundobeat_carrier || localOrder.enviaCarrier;
    localOrder.enviaService = shippingMeta.mundobeat_service || localOrder.enviaService;
    localOrder.enviaServiceDescription = shippingMeta.mundobeat_service_description
      || localOrder.enviaServiceDescription
      || shippingLine?.method_title
      || null;
    if (shippingMeta.mundobeat_quoted_price !== undefined) {
      localOrder.enviaQuotedPrice = Number(shippingMeta.mundobeat_quoted_price);
    }
    localOrder.enviaTrackingNumber = shippingMeta.mundobeat_tracking_number || localOrder.enviaTrackingNumber;
    localOrder.enviaTrackingUrl = shippingMeta.mundobeat_tracking_url || localOrder.enviaTrackingUrl;
    localOrder.enviaLabelUrl = shippingMeta.mundobeat_label_url || localOrder.enviaLabelUrl;

    const incomingShippingStatus = String(shippingMeta.mundobeat_shipping_status || '')
      .trim()
      .toLowerCase();
    const validShippingStatuses = new Set([
      'pending',
      'generated',
      'picked_up',
      'in_transit',
      'delivered',
      'failed',
      'unknown',
    ]);
    if (validShippingStatuses.has(incomingShippingStatus)) {
      localOrder.enviaShippingStatus = incomingShippingStatus;
    } else if (isNew && localOrder.enviaCarrier && !localOrder.enviaShippingStatus) {
      localOrder.enviaShippingStatus = 'pending';
    }
    localOrder.externalOrderId = String(orderId);
    localOrder.externalOrderData = order;
    localOrder = await this.orderRepository.save(localOrder);

    const existingItems = isNew ? [] : (localOrder.items || []);
    for (const item of lineItems) {
      const wooProductId = item.product_id?.toString();
      const quantity = item.quantity || 1;

      if (!wooProductId) continue;

      try {
        const product = await this.productRepository.findOne({
          where: { woocommerceId: wooProductId },
        });

        if (!product) {
          console.warn(`⚠️ [WC Webhook] No MB product found for WC product_id=${wooProductId}`);
          continue;
        }

        let localItem = existingItems.find((candidate) => candidate.productId === product.id);
        if (!localItem) localItem = this.orderItemRepository.create({ order: localOrder, productId: product.id, vendorId });
        localItem.quantity = Math.max(1, Number(quantity) || 1);
        localItem.price = Number(item.price ?? item.total ?? 0);
        localItem.subtotal = Number(item.total ?? localItem.price * localItem.quantity);
        localItem.productTitle = item.name || product.title;
        localItem.productImage = item.image?.src || product.images?.[0] || '';
        await this.orderItemRepository.save(localItem);
      } catch (error) {
        console.error(
          `❌ [WC Webhook] Error updating stock for WC product_id=${wooProductId}: ${error.message}`,
        );
      }
    }

    console.log(`✅ [WC Webhook] Local order ${localOrder.orderNumber} ${isNew ? 'created' : 'updated'} without commission`);
    if (isNew) await this.notifyVendorOfWooCommerceOrder(localOrder, vendor);
  }

  private async handleProductWebhook(vendorId: string, wooProduct: any): Promise<void> {
    const wooProductId = wooProduct?.id?.toString();
    let stockQuantity = wooProduct?.stock_quantity;

    console.log(`[WC Webhook] Product #${wooProductId} stock="${stockQuantity}"`);

    if (!wooProductId) {
      console.log('[WC Webhook] Product payload has no id, skipping');
      return;
    }

    const product = await this.productRepository.findOne({
      where: {
        woocommerceId: wooProductId,
        vendor: { id: vendorId },
      },
      relations: ['vendor', 'vendor.settings'],
    });

    if (!product) {
      console.warn(`[WC Webhook] No MB product found for WC product_id=${wooProductId}`);
      return;
    }

    if (stockQuantity === null || stockQuantity === undefined) {
      console.log(`[WC Webhook] Product #${wooProductId} has no stock_quantity, fetching from WooCommerce API`);

      const settings = product.vendor?.settings;
      if (!settings?.wooStoreUrl || !settings?.wooClientKey || !settings?.wooClientSecret) {
        console.log(`[WC Webhook] WooCommerce credentials missing for vendor ${vendorId}, skipping stock fetch`);
        return;
      }

      try {
        const wooCommerce = this.createWooClient(
          settings.wooStoreUrl,
          settings.wooClientKey,
          settings.wooClientSecret,
        );
        const result = await wooCommerce.get(`products/${wooProductId}`);
        stockQuantity = result.data?.stock_quantity;
        console.log(`[WC Webhook] Product #${wooProductId} fetched stock="${stockQuantity}"`);
      } catch (error) {
        console.error(`[WC Webhook] Error fetching WC product #${wooProductId}: ${error.message}`);
        return;
      }
    }

    const nextStock = Number(stockQuantity);
    if (!Number.isFinite(nextStock)) {
      console.log(`[WC Webhook] Product #${wooProductId} stock_quantity is not numeric, skipping`);
      return;
    }

    const previousStock = product.stock || 0;
    product.stock = Math.max(0, Math.trunc(nextStock));
    await this.productRepository.save(product);

    console.log(
      `[WC Webhook] Product stock synced: "${product.title}" ${previousStock} -> ${product.stock}`,
    );
  }
}
