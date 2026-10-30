import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { createHmac, randomBytes } from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { Repository } from 'typeorm';
import { Product, ProductCondition, ProductStatus } from '../products/product.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { Vendor } from '../vendors/vendor.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { FalabellaOrderSync } from './falabella-order-sync.entity';
import { MercadoLibreService } from '../mercadolibre/mercadolibre.service';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import { ParisService } from '../paris/paris.service';

const FALABELLA_API_URL = process.env.FALABELLA_API_URL || 'https://sellercenter-api.falabella.com';
type FalabellaConfig = { primaryCategory?: string; brand?: string; conditionType?: string; packageHeight?: number; packageWidth?: number; packageLength?: number; packageWeight?: number };

@Injectable()
export class FalabellaService {
  private readonly xmlParser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true });

  constructor(
    @InjectRepository(VendorSettings) private readonly settings: Repository<VendorSettings>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(FalabellaOrderSync) private readonly orderSyncs: Repository<FalabellaOrderSync>,
    private readonly moduleRef: ModuleRef,
  ) {}

  async getConfiguration(vendorId: string) {
    const settings = await this.settings.findOneBy({ vendorId });
    return { userId: settings?.falabellaUserId || '', country: settings?.falabellaCountry || 'cl', apiKeyConfigured: Boolean(settings?.falabellaApiKey), connected: Boolean(settings?.falabellaUserId && settings?.falabellaApiKey), webhookConfigured: Boolean(settings?.falabellaConfig?.webhookId), config: this.normalizeConfig(settings?.falabellaConfig) };
  }

  async saveConfiguration(vendorId: string, data: { userId?: string; apiKey?: string; country?: string; config?: FalabellaConfig }) {
    const userId = data.userId?.trim();
    let settings = await this.settings.findOneBy({ vendorId });
    if (!settings) settings = this.settings.create({ vendorId });
    if (userId) settings.falabellaUserId = userId;
    if (!settings.falabellaUserId) throw new BadRequestException('El UserID de Falabella es obligatorio');
    settings.falabellaCountry = data.country === 'pe' || data.country === 'co' ? data.country : 'cl';
    const existingConnection = await this.settings.findOneBy({
      falabellaCountry: settings.falabellaCountry,
      falabellaUserId: settings.falabellaUserId,
    });
    if (existingConnection && existingConnection.vendorId !== vendorId) {
      throw new ConflictException('Esta cuenta de Falabella ya está conectada a otra tienda de MundoBeat.');
    }
    if (data.apiKey?.trim()) settings.falabellaApiKey = data.apiKey.trim();
    if (!settings.falabellaApiKey) throw new BadRequestException('La API Key de Falabella es obligatoria');
    if (data.config) settings.falabellaConfig = { ...(settings.falabellaConfig || {}), ...this.normalizeConfig({ ...(settings.falabellaConfig || {}), ...data.config }) };
    await this.settings.save(settings);
    return this.getConfiguration(vendorId);
  }

  async testConnection(vendorId: string) { await this.request(vendorId, 'GetCategoryTree'); return { connected: true }; }

  async processWebhook(vendorId: string, secret: string, payload: any) {
    const settings = await this.settings.findOneBy({ vendorId });
    if (!settings?.falabellaConfig?.webhookSecret || settings.falabellaConfig.webhookSecret !== secret) throw new NotFoundException('Webhook Falabella no encontrado');
    const event = String(payload?.event || 'unknown');
    const orderId = String(payload?.payload?.OrderId || '');
    if (!['onOrderCreated', 'onOrderItemsStatusChanged'].includes(event) || !orderId) return { received: true, ignored: true };
    console.log(`[Falabella] Webhook ${event} recibido para orden ${orderId}`);
    await this.syncOrder(vendorId, orderId);
    return { received: true, processed: true, orderId };
  }

  async registerOrderWebhook(vendorId: string) {
    const settings = await this.settings.findOneByOrFail({ vendorId });
    if (settings.falabellaConfig?.webhookId && settings.falabellaConfig?.webhookUrl) return { success: true, webhookId: settings.falabellaConfig.webhookId, existing: true };
    const callbackBase = (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
    const webhookSecret = randomBytes(24).toString('hex');
    const callbackUrl = `${callbackBase}/api/falabella/webhook/${vendorId}/${webhookSecret}`;
    const body = `<Request><Webhook><CallbackUrl>${this.xml(callbackUrl)}</CallbackUrl><Events><Event>onOrderCreated</Event><Event>onOrderItemsStatusChanged</Event></Events></Webhook></Request>`;
    const response = await this.request(vendorId, 'CreateWebhook', body);
    const webhookId = this.findValue(response, ['WebhookId']);
    if (!webhookId) throw new BadRequestException('Falabella no devolvió el identificador del webhook');
    settings.falabellaConfig = { ...(settings.falabellaConfig || {}), webhookId, webhookUrl: callbackUrl, webhookSecret };
    await this.settings.save(settings);
    return { success: true, webhookId };
  }

  @Cron('0 */5 * * * *')
  async reconcileOrders() {
    const connected = await this.settings.createQueryBuilder('settings')
      .select('settings.vendorId', 'vendorId')
      .where('settings.falabellaUserId IS NOT NULL')
      .andWhere('settings.falabellaApiKey IS NOT NULL')
      .getRawMany<{ vendorId: string }>();
    for (const { vendorId } of connected) {
      try {
        const response = await this.request(vendorId, 'GetOrders', undefined, { Limit: '100', Version: '2.0' });
        const orderIds = [...new Set(this.getXmlValues(response, 'OrderId'))];
        for (const orderId of orderIds) {
          try { await this.syncOrder(vendorId, orderId); }
          catch (error: any) { console.error(`[Falabella] Orden ${orderId} no pudo reconciliarse: ${this.getError(error)}`); }
        }
        console.log(`[Falabella] Reconciliación ${vendorId}: ${orderIds.length} orden(es) procesadas`);
      } catch (error: any) {
        console.error(`[Falabella] Reconciliación ${vendorId} falló: ${this.getError(error)}`);
      }
    }
  }

  async syncOrdersNow(vendorId: string) {
    const response = await this.request(vendorId, 'GetOrders', undefined, { Limit: '100', Version: '2.0' });
    const orderIds = [...new Set(this.getXmlValues(response, 'OrderId'))];
    const errors: Array<{ orderId: string; message: string }> = [];
    let processed = 0;
    for (const orderId of orderIds) {
      try { await this.syncOrder(vendorId, orderId); processed += 1; }
      catch (error: any) { errors.push({ orderId, message: this.getError(error) }); }
    }
    return { success: errors.length === 0, processed, failed: errors.length, errors };
  }

  async getOrderLabel(orderId: string, vendorId: string) {
    const order = await this.orders.findOneBy({ id: orderId, vendorId });
    if (!order || order.orderSource !== 'falabella') throw new NotFoundException('Pedido Falabella no encontrado');
    const itemIds = this.asArray(order.externalOrderData?.items).map((item) => String(item?.OrderItemId || '')).filter(Boolean);
    if (!itemIds.length) throw new BadRequestException('El pedido no tiene ítems Falabella para generar etiqueta');
    const response = await this.request(vendorId, 'GetDocument', undefined, { DocumentType: 'shippingParcel', OrderItemIds: JSON.stringify(itemIds) });
    const encoded = this.findValue(response, ['File']);
    if (!encoded) throw new BadRequestException('Falabella todavía no habilita la etiqueta para este pedido');
    return { buffer: Buffer.from(encoded.replace(/\s+/g, ''), 'base64'), mimeType: this.findValue(response, ['MimeType']) || 'application/pdf' };
  }

  private async syncOrder(vendorId: string, falabellaOrderId: string) {
    const [orderResponse, itemsResponse, vendor] = await Promise.all([
      this.request(vendorId, 'GetOrder', undefined, { OrderId: falabellaOrderId, Version: '2.0' }),
      this.request(vendorId, 'GetOrderItems', undefined, { OrderId: falabellaOrderId }),
      this.vendors.findOneBy({ id: vendorId }),
    ]);
    if (!vendor) throw new NotFoundException('Tienda Falabella no encontrada');
    const orderData = this.parseXml(orderResponse)?.SuccessResponse?.Body?.Orders?.Order;
    const sourceOrder = Array.isArray(orderData) ? orderData[0] : orderData;
    if (!sourceOrder) throw new BadRequestException(`Falabella no devolvió la orden ${falabellaOrderId}`);
    const parsedItems = this.parseXml(itemsResponse)?.SuccessResponse?.Body?.OrderItems?.OrderItem;
    const sourceItems = this.asArray(parsedItems);
    const checkoutSessionId = `falabella:${falabellaOrderId}`;
    let localOrder = await this.orders.findOne({ where: { vendorId, orderSource: 'falabella', checkoutSessionId }, relations: ['items'] });
    const isNew = !localOrder;
    const total = this.number(sourceOrder.GrandTotal ?? sourceOrder.Price);
    const shippingCost = this.number(sourceOrder.ShippingFeeTotal);
    const subtotal = this.number(sourceOrder.ProductTotal) || Math.max(0, total - shippingCost);
    const status = this.mapFalabellaStatus(this.asArray(sourceOrder.Statuses?.Status)[0] || sourceItems[0]?.Status);
    const shipping = sourceOrder.AddressShipping || sourceOrder.AddressBilling || {};
    if (!localOrder) localOrder = this.orders.create({ checkoutSessionId, vendorId, vendorSlug: vendor.slug, orderSource: 'falabella' } as Partial<Order>);
    Object.assign(localOrder, {
      orderNumber: `FAL-${sourceOrder.OrderNumber || falabellaOrderId}`,
      status,
      subtotal,
      shippingCost,
      tax: this.number(sourceOrder.TaxAmount),
      total: total || subtotal + shippingCost,
      paymentMethod: String(sourceOrder.PaymentMethod || 'falabella'),
      paymentStatus: status === OrderStatus.CANCELLED ? 'cancelled' : 'approved',
      shippingName: `${shipping.FirstName || sourceOrder.CustomerFirstName || ''} ${shipping.LastName || sourceOrder.CustomerLastName || ''}`.trim() || 'Cliente Falabella',
      shippingAddress: String(shipping.Address1 || 'Dirección informada en Falabella'),
      shippingNumber: [shipping.Address2, shipping.Address3].filter(Boolean).join(' ') || null,
      shippingCity: String(shipping.City || 'Sin informar'),
      shippingCountry: String(shipping.Country || 'CL'),
      shippingRegion: String(shipping.Region || '') || null,
      shippingCommune: String(shipping.Ward || shipping.City || '') || null,
      shippingRut: String(sourceOrder.NationalRegistrationNumber || sourceOrder.LegalId || 'No informado'),
      shippingPhone: String(shipping.Phone || shipping.Phone2 || 'No informado'),
      customerEmail: String(shipping.CustomerEmail || sourceOrder.ExtraBillingAttributes?.ReceiverEmail || '') || null,
      notes: [sourceOrder.Remarks, sourceOrder.DeliveryInfo].filter(Boolean).join(' · ') || null,
      shippingMethod: String(sourceOrder.ShippingType || sourceItems[0]?.ShippingType || 'Falabella'),
      shippingMethodCode: 'falabella',
      externalOrderId: falabellaOrderId,
      externalShippingStatus: String(sourceItems[0]?.Status || ''),
      trackingNumber: String(sourceItems[0]?.TrackingCode || '') || null,
      externalOrderData: { order: sourceOrder, items: sourceItems },
      isMarketplaceSale: false,
      commissionPercentage: 0,
      commissionAmount: 0,
      commissionStatus: 'external',
    });
    if (sourceOrder.CreatedAt) localOrder.createdAt = new Date(String(sourceOrder.CreatedAt).replace(' ', 'T'));
    localOrder = await this.orders.save(localOrder);
    await this.orderItems.createQueryBuilder().delete().where('orderId = :orderId', { orderId: localOrder.id }).execute();
    const matched: Array<{ product: Product; quantity: number }> = [];
    for (const sourceItem of sourceItems) {
      const sku = String(sourceItem.SellerSku || sourceItem.Sku || '').trim();
      const product = sku ? await this.products.findOne({ where: { sku, vendor: { id: vendorId } }, relations: ['vendor'] }) : null;
      const quantity = Math.max(1, this.number(sourceItem.Quantity) || 1);
      const price = this.number(sourceItem.PaidPrice ?? sourceItem.UnitPrice ?? sourceItem.ItemPrice);
      await this.orderItems.save(this.orderItems.create({ order: localOrder, productId: product?.id || null, vendorId, quantity, price, subtotal: price * quantity, productTitle: String(sourceItem.Name || product?.title || `Producto Falabella ${sku}`), productImage: product?.images?.[0] || '' }));
      if (product) matched.push({ product, quantity });
    }
    await this.applyOrderStock(vendorId, falabellaOrderId, sourceOrder, sourceItems, matched);
    console.log(`[Falabella] Orden ${falabellaOrderId} ${isNew ? 'creada' : 'actualizada'} en MundoBeat`);
    return localOrder;
  }

  private async applyOrderStock(vendorId: string, orderId: string, order: any, items: any[], matched: Array<{ product: Product; quantity: number }>) {
    let sync = await this.orderSyncs.findOneBy({ vendorId, falabellaOrderId: orderId });
    if (!sync) {
      try { sync = await this.orderSyncs.save(this.orderSyncs.create({ vendorId, falabellaOrderId: orderId })); }
      catch (error: any) { if (error?.code !== 'ER_DUP_ENTRY') throw error; sync = await this.orderSyncs.findOneByOrFail({ vendorId, falabellaOrderId: orderId }); }
    }
    const rawStatus = String(this.asArray(order.Statuses?.Status)[0] || items[0]?.Status || '').toLowerCase();
    const shippingType = String(order.ShippingType || items[0]?.ShippingType || '').toLowerCase();
    const shouldApply = shippingType === 'dropshipping' && !['canceled', 'cancelled', 'refunded'].includes(rawStatus);
    const shouldRestore = ['canceled', 'cancelled', 'refunded'].includes(rawStatus);
    const allItemsMatched = items.length > 0 && matched.length === items.length;
    const changedIds = await this.orderSyncs.manager.transaction(async (manager) => {
      const locked = await manager.findOneOrFail(FalabellaOrderSync, { where: { id: sync.id }, lock: { mode: 'pessimistic_write' } });
      const ids: string[] = [];
      if (shouldApply && !locked.stockApplied && allItemsMatched) {
        for (const { product, quantity } of matched) {
          const current = await manager.findOneOrFail(Product, { where: { id: product.id }, lock: { mode: 'pessimistic_write' } });
          current.stock = Math.max(0, Number(current.stock || 0) - quantity);
          await manager.save(current);
          ids.push(current.id);
        }
        locked.stockApplied = true;
        locked.stockRestored = false;
      } else if (shouldRestore && locked.stockApplied && !locked.stockRestored && allItemsMatched) {
        for (const { product, quantity } of matched) {
          const current = await manager.findOneOrFail(Product, { where: { id: product.id }, lock: { mode: 'pessimistic_write' } });
          current.stock = Number(current.stock || 0) + quantity;
          await manager.save(current);
          ids.push(current.id);
        }
        locked.stockRestored = true;
      }
      locked.status = rawStatus || null;
      locked.orderData = { order, items };
      await manager.save(locked);
      return ids;
    });
    if (shouldApply && !sync.stockApplied && !allItemsMatched) console.warn(`[Falabella] Stock de orden ${orderId} pendiente: ${matched.length}/${items.length} SKU(s) asociados`);
    if (changedIds.length) {
      const changed = await this.products.createQueryBuilder('product').where('product.id IN (:...ids)', { ids: changedIds }).getMany();
      await this.propagateStock(changed, vendorId);
    }
  }

  private async propagateStock(products: Product[], vendorId: string) {
    for (const product of products) {
      const tasks: Promise<unknown>[] = [];
      let mercadoLibre: MercadoLibreService | undefined;
      let woocommerce: WoocommerceService | undefined;
      let paris: ParisService | undefined;
      try { mercadoLibre = this.moduleRef.get(MercadoLibreService, { strict: false }); } catch {}
      try { woocommerce = this.moduleRef.get(WoocommerceService, { strict: false }); } catch {}
      try { paris = this.moduleRef.get(ParisService, { strict: false }); } catch {}
      if (product.mercadoLibreItemId && mercadoLibre) tasks.push(mercadoLibre.syncStockFromLocal(product.id));
      if (product.woocommerceId && woocommerce) tasks.push(woocommerce.updateStock(product.id, product.stock));
      if (product.parisProductId && paris) tasks.push(paris.publishProduct(product.id, vendorId));
      const results = await Promise.allSettled(tasks);
      results.filter((result) => result.status === 'rejected').forEach((result: PromiseRejectedResult) => console.error(`[Falabella] Error propagando stock ${product.sku}: ${result.reason?.message || result.reason}`));
    }
  }

  async getCategories(vendorId: string) {
    const response = await this.request(vendorId, 'GetCategoryTree');
    const categories = new Map<string, { id: string; name: string }>();
    if (typeof response === 'string') this.collectXmlLeafCategories(response, categories);
    else this.collectCategories(response, categories);
    if (!categories.size) throw new BadRequestException('Falabella no devolvió categorías publicables para esta cuenta');
    return [...categories.values()].sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  async publishProduct(productId: string, vendorId: string) {
    const product = await this.products.findOne({ where: { id: productId, vendor: { id: vendorId } }, relations: ['vendor'] });
    if (!product) throw new NotFoundException('Producto no encontrado para esta tienda');
    if (!product.sku?.trim()) throw new BadRequestException('El producto debe tener SKU antes de sincronizarlo con Falabella');
    const settings = await this.settings.findOneBy({ vendorId });
    const config = this.normalizeConfig(settings?.falabellaConfig);
    if (!config.primaryCategory) throw new BadRequestException('Configura la categoría primaria de Falabella antes de publicar');
    if (!config.brand) throw new BadRequestException('Configura la marca predeterminada de Falabella antes de publicar');
    try {
      const productExists = await this.wasLastFeedSuccessful(vendorId, product.falabellaFeedId);
      const action = productExists ? 'ProductUpdate' : 'ProductCreate';
      const response = await this.request(vendorId, action, this.buildProductXml(product, config, this.getOperatorCode(settings?.falabellaCountry)));
      const requestId = this.findValue(response, ['RequestId']);
      if (!requestId) throw new BadRequestException('Falabella no devolvió un RequestId para el feed. La publicación no fue confirmada.');
      product.falabellaFeedId = requestId;
      product.falabellaSyncedAt = new Date();
      await this.products.save(product);
      let imageFeedId = '';
      const images = this.getPublicImageUrls(product.images).slice(0, 8);
      if (images.length && !productExists) {
        const creation = await this.waitForFeedCompletion(vendorId, requestId);
        if (creation.state === 'failed') throw new BadRequestException(`Falabella rechazó la creación: ${creation.errors || 'revisa el detalle del feed.'}`);
        if (creation.state === 'pending') return { success: true, feedId: requestId, imageFeedId, imagesPending: true, pending: true };
      }
      if (images.length) {
        const imageResponse = await this.request(vendorId, 'Image', this.buildImageXml(product.sku.trim(), images));
        imageFeedId = this.findValue(imageResponse, ['RequestId']);
        if (!imageFeedId) throw new BadRequestException('Falabella no devolvió un RequestId para el feed de imágenes.');
      }
      console.log(`[Falabella] ${action} aceptado para ${product.sku}: requestId=${requestId}`);
      return { success: true, feedId: product.falabellaFeedId, imageFeedId, imagesPending: false, pending: true };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Falabella rechazó la publicación: ${this.getError(error)}`);
    }
  }

  private async request(vendorId: string, action: string, body?: string, extraParams: Record<string, string> = {}) {
    const settings = await this.settings.findOneBy({ vendorId });
    if (!settings?.falabellaUserId || !settings?.falabellaApiKey) throw new BadRequestException('Configura UserID y API Key de Falabella');
    const params: Record<string, string> = { Action: action, Format: 'XML', Timestamp: new Date().toISOString(), UserID: settings.falabellaUserId, Version: '1.0', ...extraParams };
    const signatureInput = Object.keys(params).sort().map((key) => `${this.encode(key)}=${this.encode(params[key])}`).join('&');
    params.Signature = createHmac('sha256', settings.falabellaApiKey).update(signatureInput).digest('hex');
    const query = Object.keys(params).sort().map((key) => `${this.encode(key)}=${this.encode(params[key])}`).join('&');
    const response = await axios.request({ method: body ? 'POST' : 'GET', url: `${FALABELLA_API_URL}/?${query}`, data: body, headers: body ? { 'Content-Type': 'application/xml; charset=utf-8' } : undefined, timeout: 30_000 });
    const responseError = this.getResponseError(response.data);
    if (responseError) throw new BadRequestException(`Falabella rechazó la solicitud ${action}: ${responseError}`);
    return response.data;
  }

  private buildProductXml(product: Product, config: FalabellaConfig, operatorCode: string) {
    const price = Math.max(0, Math.round(Number(product.isOnSale && product.salePrice ? product.salePrice : product.price) || 0));
    const stock = Math.max(0, Math.trunc(Number(product.stock) || 0));
    const dimension = (value: number | undefined, fallback: number | undefined) => Math.max(0.01, Number(value || fallback || 1));
    const description = [product.shortDescription, product.description].map((value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ').slice(0, 25_000);
    if (description.split(/\s+/).filter(Boolean).length < 50) throw new BadRequestException('La descripción para Falabella debe tener al menos 50 palabras. Completa primero la descripción corta y luego la descripción larga del producto.');
    return `<Request><Product><SellerSku>${this.xml(product.sku.trim())}</SellerSku><Name>${this.xml(product.title.slice(0, 255))}</Name><Variation>${this.xml(product.sku.trim())}</Variation><PrimaryCategory>${this.xml(config.primaryCategory || '')}</PrimaryCategory><Description>${this.xml(description)}</Description><Brand>${this.xml(config.brand || '')}</Brand><BusinessUnits><BusinessUnit><OperatorCode>${operatorCode}</OperatorCode><Price>${price}</Price><Stock>${stock}</Stock><Status>${product.status === ProductStatus.ACTIVE ? 'active' : 'inactive'}</Status></BusinessUnit></BusinessUnits><ProductData><ConditionType>${this.xml(config.conditionType || (product.condition === ProductCondition.USED ? 'Usado' : 'Nuevo'))}</ConditionType><PackageHeight>${dimension(product.height, config.packageHeight)}</PackageHeight><PackageWidth>${dimension(product.width, config.packageWidth)}</PackageWidth><PackageLength>${dimension(product.depth, config.packageLength)}</PackageLength><PackageWeight>${dimension(product.weight, config.packageWeight)}</PackageWeight></ProductData></Product></Request>`;
  }
  private buildImageXml(sku: string, images: string[]) { return `<Request><ProductImage><SellerSku>${this.xml(sku)}</SellerSku><Images>${images.map((image) => `<Image>${this.xml(image)}</Image>`).join('')}</Images></ProductImage></Request>`; }
  private getPublicImageUrls(images: string[] | undefined) { const publicApiUrl = (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, ''); return (images || []).map((image) => String(image || '').trim()).filter(Boolean).map((image) => image.startsWith('http') ? image : `${publicApiUrl}/${image.replace(/^\/+/, '')}`).filter((image) => image.startsWith('https://')); }
  private collectCategories(value: any, categories: Map<string, { id: string; name: string }>) {
    if (!value) return;
    if (Array.isArray(value)) { value.forEach((item) => this.collectCategories(item, categories)); return; }
    if (typeof value !== 'object') return;
    const id = value.CategoryId || value.categoryId || value.id || value.ID;
    const name = value.Name || value.name || value.CategoryName || value.categoryName;
    if (id && name) categories.set(String(id), { id: String(id), name: String(name) });
    Object.values(value).forEach((item) => this.collectCategories(item, categories));
  }
  private collectXmlLeafCategories(xml: string, categories: Map<string, { id: string; name: string }>) {
    const stack: Array<{ contentStart: number; hasChildren: boolean }> = [];
    const tagPattern = /<\/?Category\b[^>]*>/gi;
    let tag: RegExpExecArray | null;
    while ((tag = tagPattern.exec(xml))) {
      if (!tag[0].startsWith('</')) {
        if (stack.length) stack[stack.length - 1].hasChildren = true;
        stack.push({ contentStart: tag.index + tag[0].length, hasChildren: false });
        continue;
      }
      const category = stack.pop();
      if (!category || category.hasChildren) continue;
      const content = xml.slice(category.contentStart, tag.index);
      const id = content.match(/<CategoryId>([^<]+)<\/CategoryId>/i)?.[1]?.trim();
      const name = content.match(/<Name>([^<]+)<\/Name>/i)?.[1]?.trim();
      if (id && name) categories.set(id, { id, name: this.decodeXml(name) });
    }
  }
  private normalizeConfig(config: any = {}): FalabellaConfig { const condition = String(config?.conditionType || 'Nuevo').trim().toLowerCase(); return { primaryCategory: String(config?.primaryCategory || '').trim(), brand: String(config?.brand || '').trim(), conditionType: condition === 'new' || condition === 'nuevo' ? 'Nuevo' : condition === 'used' || condition === 'usado' ? 'Usado' : String(config?.conditionType || 'Nuevo').trim(), packageHeight: this.positive(config?.packageHeight), packageWidth: this.positive(config?.packageWidth), packageLength: this.positive(config?.packageLength), packageWeight: this.positive(config?.packageWeight) }; }
  private positive(value: unknown) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : undefined; }
  private getOperatorCode(country?: string) { return country === 'pe' ? 'fape' : country === 'co' ? 'faco' : 'facl'; }
  private async wasLastFeedSuccessful(vendorId: string, feedId?: string | null) {
    if (!feedId) return false;
    try {
      const response = await this.request(vendorId, 'FeedStatus', undefined, { FeedID: feedId });
      return this.findValue(response, ['Status']) === 'Finished' && Number(this.findValue(response, ['FailedRecords'])) === 0 && Number(this.findValue(response, ['ProcessedRecords'])) > 0;
    } catch {
      return false;
    }
  }
  private async waitForFeedCompletion(vendorId: string, feedId: string): Promise<{ state: 'success' | 'failed' | 'pending'; errors: string }> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 2_000));
      const response = await this.request(vendorId, 'FeedStatus', undefined, { FeedID: feedId });
      const status = this.findValue(response, ['Status']);
      const failedRecords = Number(this.findValue(response, ['FailedRecords']));
      if (status === 'Finished') return failedRecords > 0 ? { state: 'failed', errors: this.getFeedErrors(response) } : { state: 'success', errors: '' };
      if (status === 'Canceled' || status === 'Error') return { state: 'failed', errors: this.getFeedErrors(response) };
    }
    return { state: 'pending', errors: '' };
  }
  private getFeedErrors(response: any) { if (typeof response !== 'string') return ''; return [...response.matchAll(/<Message>([^<]+)<\/Message>/gi)].map((match) => this.decodeXml(match[1].trim())).join(' · '); }
  private getXmlValues(data: any, tag: string) { return typeof data === 'string' ? [...data.matchAll(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'gi'))].map((match) => this.decodeXml(match[1].trim())).filter(Boolean) : []; }
  private parseXml(data: any) { return typeof data === 'string' ? this.xmlParser.parse(data) : data; }
  private asArray<T = any>(value: T | T[] | undefined | null): T[] { return value == null ? [] : Array.isArray(value) ? value : [value]; }
  private number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  private mapFalabellaStatus(status: unknown): OrderStatus {
    const normalized = String(status || '').toLowerCase();
    if (['canceled', 'cancelled'].includes(normalized)) return OrderStatus.CANCELLED;
    if (normalized === 'refunded') return OrderStatus.REFUNDED;
    if (['delivered'].includes(normalized)) return OrderStatus.DELIVERED;
    if (['shipped'].includes(normalized)) return OrderStatus.SHIPPED;
    if (['ready_to_ship', 'processing', 'packed'].includes(normalized)) return OrderStatus.PROCESSING;
    return OrderStatus.PENDING;
  }
  private encode(value: string) { return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`); }
  private decodeXml(value: string) { return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
  private xml(value: unknown) { return String(value ?? '').replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character] || character)); }
  private findValue(data: any, keys: string[]): string { if (!data) return ''; if (typeof data === 'string') { for (const key of keys) { const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const value = data.match(new RegExp(`<${escapedKey}>([^<]+)</${escapedKey}>`, 'i'))?.[1]?.trim(); if (value) return this.decodeXml(value); } return ''; } if (typeof data !== 'object') return ''; const entries = Object.entries(data); for (const candidate of keys) { const entry = entries.find(([key, value]) => candidate.toLowerCase() === key.toLowerCase() && typeof value !== 'object'); if (entry) return String(entry[1] || '').trim(); } for (const [, value] of entries) { const nested = this.findValue(value, keys); if (nested) return nested; } return ''; }
  private getResponseError(data: any): string {
    if (!data) return '';
    if (typeof data === 'string') {
      if (!/<(?:ErrorResponse|Error)>/i.test(data)) return '';
      return this.findValue(data, ['ErrorMessage', 'Message', 'ErrorCode']) || data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (typeof data !== 'object') return '';
    const error = data.ErrorResponse || data.errorResponse || data.Error || data.error || data.errors;
    if (!error) return '';
    return this.findValue(error, ['ErrorMessage', 'errorMessage', 'Message', 'message', 'ErrorCode', 'code']) || JSON.stringify(error);
  }
  private getError(error: any) { const data = error?.response?.data || error?.message || error; return typeof data === 'string' ? data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : JSON.stringify(data); }
}
