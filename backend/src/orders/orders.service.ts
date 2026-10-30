import { canCompleteVendorManagedShipping, canVendorCancelOrder, getExternalShippingReleaseAmount, getVendorSettlement } from './vendor-settlement';
import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order, OrderStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderShipment } from './order-shipment.entity';
import { OrderHistory, OrderHistoryAction } from './order-history.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { ConfirmAssistedTransferDto, CreateAssistedOrderDto } from './dto/create-assisted-order.dto';
import { FlowService } from '../payment/flow.service';
import { PaykuService } from '../payment/payku.service';
import { AuthService } from '../auth/auth.service';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { CustomerAccessService } from '../customers/customer-access.service';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { Liquidacion } from '../liquidaciones/liquidacion.entity';
import { VendorPayment } from '../liquidaciones/vendor-payment.entity';
import { SmtpSettings } from '../marketplace/smtp-settings.entity';
import { MercadoLibreService } from '../mercadolibre/mercadolibre.service';
import { EmailService } from '../email/email.service';
import { OrderRefund } from './order-refund.entity';
import { calculatePackageSummary } from '../shipping/package-calculator';
import { VendorReview } from '../reviews/vendor-review.entity';
import { DiscountsService } from '../discounts/discounts.service';
import { validateSalesReceiptUrl } from './sales-receipt-url';
import { randomBytes } from 'crypto';
import { SalesReceiptDocumentsService, receiptShortUrl } from './sales-receipt-documents.service';
import type { EmailAttachment } from '../email/email.service';
import { withStoreSender } from '../email/store-sender';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(OrderHistory)
    private orderHistoryRepository: Repository<OrderHistory>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(VendorSettings)
    private vendorSettingsRepository: Repository<VendorSettings>,
    @InjectRepository(Liquidacion)
    private liquidacionesRepository: Repository<Liquidacion>,
    @InjectRepository(VendorPayment)
    private vendorPaymentsRepository: Repository<VendorPayment>,
    @InjectRepository(SmtpSettings)
    private smtpSettingsRepository: Repository<SmtpSettings>,
    @InjectRepository(OrderRefund)
    private orderRefundsRepository: Repository<OrderRefund>,
    @InjectRepository(VendorReview)
    private vendorReviewsRepository: Repository<VendorReview>,
    @Inject(forwardRef(() => FlowService))
    private flowService: FlowService,
    @Inject(forwardRef(() => PaykuService))
    private paykuService: PaykuService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    private emailTemplatesService: EmailTemplatesService,
    private customerAccessService: CustomerAccessService,
    @Inject(forwardRef(() => WoocommerceService))
    private woocommerceService: WoocommerceService,
    private mercadoLibreService: MercadoLibreService,
    private emailService: EmailService,
    private readonly discountsService: DiscountsService,
    private readonly receiptDocuments: SalesReceiptDocumentsService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    console.log('📦 [OrdersService.create] Starting order creation...');
    console.log('📦 [OrdersService.create] DTO:', JSON.stringify({
      vendorId: createOrderDto.vendorId,
      vendorSlug: createOrderDto.vendorSlug,
      itemsCount: createOrderDto.items?.length,
      total: createOrderDto.total,
      orderSource: createOrderDto.orderSource,
      orderNumber: createOrderDto.orderNumber,
    }));

    // Determine order source and calculate commission
    const orderSource = createOrderDto.orderSource || 'direct_store';
    const isMarketplaceSale = orderSource === 'marketplace';
    const checkoutSessionId = createOrderDto.checkoutSessionId?.trim();
    const reuseWindowHours = this.getPendingReuseWindowHours();
    let orderNumber = '';
    let savedOrderWithItems: Order | null = null;
    let shouldRefreshReusablePendingOrder = false;

    if (checkoutSessionId) {
      const reusableOrder = await this.ordersRepository.findOne({
        where: {
          vendorId: createOrderDto.vendorId,
          orderSource,
          checkoutSessionId,
        },
        relations: ['items'],
      });

      if (reusableOrder) {
        const reusableStatuses = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING];
        if (reusableStatuses.includes(reusableOrder.status)) {
          console.log('♻️ [OrdersService.create] Reusing existing order for checkout session:', {
            orderId: reusableOrder.id,
            orderNumber: reusableOrder.orderNumber,
            checkoutSessionId,
            status: reusableOrder.status,
            paymentStatus: reusableOrder.paymentStatus,
          });

          orderNumber = reusableOrder.orderNumber;
          savedOrderWithItems = reusableOrder;

          if (reusableOrder.paymentUrl && reusableOrder.paymentTransactionId && reusableOrder.paymentStatus === 'pending') {
            return reusableOrder;
          }

          if (reusableOrder.paymentStatus && reusableOrder.paymentStatus !== 'pending' && reusableOrder.paymentStatus !== 'approved') {
            reusableOrder.paymentUrl = '';
            reusableOrder.paymentTransactionId = '';
            await this.ordersRepository.save(reusableOrder);
          }

          if (reusableOrder.paymentUrl && reusableOrder.paymentTransactionId && reusableOrder.paymentStatus === 'approved') {
            return reusableOrder;
          }

          if (reusableOrder.paymentUrl && reusableOrder.paymentTransactionId && reusableOrder.paymentStatus !== 'failed' && reusableOrder.paymentStatus !== 'payment_error') {
            return reusableOrder;
          }
        }
      }
    }

    if (!savedOrderWithItems && orderSource !== 'assisted_sale' && !createOrderDto.discountCode) {
      const recentPendingOrder = await this.findRecentPendingReusableOrder(
        createOrderDto,
        orderSource,
        reuseWindowHours,
      );

      if (recentPendingOrder) {
        console.log('♻️ [OrdersService.create] Reusing recent pending order within window:', {
          orderId: recentPendingOrder.id,
          orderNumber: recentPendingOrder.orderNumber,
          customerEmail: recentPendingOrder.customerEmail,
          reuseWindowHours,
        });

        savedOrderWithItems = recentPendingOrder;
        orderNumber = recentPendingOrder.orderNumber;
        shouldRefreshReusablePendingOrder = true;
      }
    }

    if (createOrderDto.discountCode) {
      const quote = await this.discountsService.quote({ code: createOrderDto.discountCode, email: createOrderDto.email,
        vendorId: createOrderDto.vendorId, items: createOrderDto.items, orderId: savedOrderWithItems?.id });
      createOrderDto.items.forEach((item) => { item.price = quote.prices.find((p) => p.productId === item.productId)!.price; });
      createOrderDto.subtotal = quote.subtotal;
      createOrderDto.total = quote.subtotal + Number(createOrderDto.shippingCost || 0) + Number(createOrderDto.tax || 0);
    }

    // Use pre-generated order number if provided (for grouped marketplace orders)
    // Otherwise generate a unique one
    if (!orderNumber) {
      if (createOrderDto.orderNumber) {
        orderNumber = createOrderDto.orderNumber;
        console.log('📦 [OrdersService.create] Using pre-generated order number:', orderNumber);
      } else {
        orderNumber = await this.generateUniqueOrderNumber();
        console.log('📦 [OrdersService.create] Generated new order number:', orderNumber);
      }
    }
    
    // Get vendor settings for commission calculation
    let commissionPercentage = 0;
    let vendorAmount = createOrderDto.total;
    let commissionAmount = 0;
    
    if (isMarketplaceSale) {
      try {
        const vendorSettings = await this.vendorSettingsRepository.findOne({
          where: { vendorId: createOrderDto.vendorId },
        });
        
        // Use commission from vendor settings, default 10%
        commissionPercentage = vendorSettings?.commissionPercentage ?? 10;
        // Comisión se calcula sobre el SUBTOTAL (venta sin envío), no sobre el total
        const subtotalForCommission = createOrderDto.subtotal || createOrderDto.total;
        commissionAmount = Math.round((subtotalForCommission * commissionPercentage) / 100);
        const sellerFundedShipping = Number(createOrderDto.shippingCost || 0) === 0
          && String(createOrderDto.shippingMethod || '').toLowerCase().includes('gratis')
          ? Number(createOrderDto.enviaQuotedPrice) || 0
          : 0;
        vendorAmount = Math.max(0, subtotalForCommission - commissionAmount - sellerFundedShipping);
      } catch (error) {
        console.error('Error fetching vendor settings for commission:', error);
        // Continue with default values if settings fetch fails
        commissionPercentage = 10;
        const subtotalForCommission = createOrderDto.subtotal || createOrderDto.total;
        commissionAmount = Math.round((subtotalForCommission * 10) / 100);
        const sellerFundedShipping = Number(createOrderDto.shippingCost || 0) === 0
          && String(createOrderDto.shippingMethod || '').toLowerCase().includes('gratis')
          ? Number(createOrderDto.enviaQuotedPrice) || 0
          : 0;
        vendorAmount = Math.max(0, subtotalForCommission - commissionAmount - sellerFundedShipping);
      }
    }

    // Create order - base fields
    const orderData: any = {
      orderNumber,
      status: OrderStatus.PENDING,
      subtotal: createOrderDto.subtotal,
      shippingCost: createOrderDto.shippingCost || 0,
      tax: createOrderDto.tax || 0,
      total: createOrderDto.total,
      vendorId: createOrderDto.vendorId,
      customerEmail: createOrderDto.email,
      vendorSlug: createOrderDto.vendorSlug,
      paymentMethod: createOrderDto.paymentMethod as any,
      shippingName: createOrderDto.shippingName,
      shippingAddress: createOrderDto.shippingAddress,
      shippingNumber: createOrderDto.shippingNumber || '',
      shippingCity: createOrderDto.shippingCity,
      shippingCountry: createOrderDto.shippingCountry,
      shippingRegion: createOrderDto.shippingRegion,
      shippingCommune: createOrderDto.shippingCommune,
      shippingRegionId: createOrderDto.shippingRegionId,
      shippingCommuneId: createOrderDto.shippingCommuneId,
      shippingRut: createOrderDto.shippingRut,
      shippingPhone: createOrderDto.shippingPhone,
      shippingMethod: createOrderDto.shippingMethod,
      shippingMethodCode: createOrderDto.shippingMethodCode,
      estimatedDeliveryDays: createOrderDto.estimatedDeliveryDays,
      // Envia.com fields
      enviaCarrier: createOrderDto.enviaCarrier,
      enviaService: createOrderDto.enviaService,
      enviaServiceDescription: createOrderDto.enviaServiceDescription,
      enviaQuotedPrice: createOrderDto.enviaQuotedPrice,
      notes: createOrderDto.notes || '',
      checkoutSessionId: checkoutSessionId || null,
    };

    // Add commission fields only if they exist in the entity (backward compatible)
    // These fields are added via migration and may not exist yet
    try {
      orderData.orderSource = orderSource;
      orderData.isMarketplaceSale = isMarketplaceSale;
      orderData.commissionPercentage = commissionPercentage;
      orderData.vendorAmount = vendorAmount;
      orderData.commissionAmount = commissionAmount;
      orderData.commissionStatus = 'pending';
    } catch (e) {
      console.log('Commission fields not yet available in database');
    }

    if (savedOrderWithItems && shouldRefreshReusablePendingOrder) {
      savedOrderWithItems = await this.refreshReusablePendingOrder(
        savedOrderWithItems,
        orderData,
        createOrderDto,
      );
    }

    if (!savedOrderWithItems) {
      const order = this.ordersRepository.create(orderData as Partial<Order>);

      // Save order first
      const savedOrder = await this.ordersRepository.save(order);

      // Create order items with product info
      const orderItems = await Promise.all(
        createOrderDto.items.map(async (item) => {
          // Fetch product to get title, image and vendor
          const product = await this.productsRepository.findOne({
            where: { id: item.productId },
            relations: ['vendor'],
          });

          // Get vendorId: priority 1) from item, 2) from product.vendor, 3) from order
          const itemVendorId = item.vendorId || product?.vendor?.id || createOrderDto.vendorId;
          console.log(`📦 [OrderItem] Product ${item.productId} -> vendorId: ${itemVendorId}`);

          return this.orderItemsRepository.create({
            order: savedOrder,
            productId: item.productId,
            vendorId: itemVendorId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity,
            productTitle: product?.title || 'Producto desconocido',
            productImage: product?.images?.[0] || '',
          });
        })
      );

      await this.orderItemsRepository.save(orderItems);

      // Return order with items
      savedOrderWithItems = await this.ordersRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['items'],
      });

      if (!savedOrderWithItems) {
        throw new BadRequestException('No se pudo crear la orden');
      }
    }

    if (createOrderDto.discountCode) {
      await this.discountsService.reserve({ code: createOrderDto.discountCode, email: createOrderDto.email,
        vendorId: createOrderDto.vendorId, items: createOrderDto.items }, savedOrderWithItems!.id);
      savedOrderWithItems = await this.ordersRepository.findOneOrFail({ where: { id: savedOrderWithItems!.id }, relations: ['items'] });
    }

    // If payment method is Flow, create payment (unless deferred)
    if (createOrderDto.paymentMethod === 'flow' && !createOrderDto.deferPaymentCreation) {
      try {
        const flowPayment = await this.flowService.createPayment({
          orderId: savedOrderWithItems!.id,
          amount: savedOrderWithItems!.total,
          email: createOrderDto.email,
          vendorSlug: createOrderDto.vendorSlug,
          subject: `Pedido #${orderNumber}`,
        });

        // Update order with payment URL and token
        savedOrderWithItems!.paymentUrl = flowPayment.url;
        savedOrderWithItems!.paymentTransactionId = flowPayment.token;
        savedOrderWithItems!.paymentStatus = 'pending';
        await this.ordersRepository.save(savedOrderWithItems!);
        
        console.log('[OrdersService] Flow payment created successfully for order:', savedOrderWithItems!.id);
      } catch (error) {
        console.error('[OrdersService] Error creating Flow payment:', error);
        console.error('[OrdersService] Error details:', error.message);
        
        // Si el error es por falta de configuración de Flow, lanzar error para que el frontend lo muestre
        if (error.message.includes('no tiene configurado') || error.message.includes('Flow credentials not found')) {
          // Eliminar la orden creada si no se puede procesar el pago
          // Primero eliminar los items para evitar error de foreign key constraint
          if (savedOrderWithItems?.items && savedOrderWithItems.items.length > 0) {
            await this.orderItemsRepository.remove(savedOrderWithItems.items);
          }
          await this.ordersRepository.remove(savedOrderWithItems!);
          throw new BadRequestException({
            message: 'Configuración de pagos incompleta',
            details: 'Esta tienda no tiene configurado el sistema de pagos Flow. Por favor, contacta al administrador de la tienda para completar tu compra.',
            vendorContact: true,
          });
        }
        
        // Para otros errores, marcar orden como payment_error
        savedOrderWithItems!.paymentStatus = 'payment_error';
        await this.ordersRepository.save(savedOrderWithItems!);
        
        console.log('[OrdersService] Order created with payment_error status. User can contact vendor.');
      }
    }

    // If payment method is Payku, create marketplace transaction with splits (unless deferred)
    if (createOrderDto.paymentMethod === 'payku' && !createOrderDto.deferPaymentCreation) {
      try {
        // Get vendor info for payment email
        const vendor = await this.vendorsRepository.findOne({
          where: { id: createOrderDto.vendorId },
        });

        if (!vendor) {
          throw new Error('Vendor not found');
        }
        // Calculate marketplace commission over products only. Shipping stays with the marketplace.
        const commissionRate = Number(savedOrderWithItems!.commissionPercentage) || 10;
        const subtotalForCommission = Number(savedOrderWithItems!.subtotal) || Math.max(0, Number(savedOrderWithItems!.total) - (Number(savedOrderWithItems!.shippingCost) || 0));
        const marketplaceCommission = Math.round((subtotalForCommission * commissionRate) / 100);
        const sellerFundedShipping = Number(savedOrderWithItems!.shippingCost || 0) === 0
          && String(savedOrderWithItems!.shippingMethod || '').toLowerCase().includes('gratis')
          ? Number(savedOrderWithItems!.enviaQuotedPrice) || 0
          : 0;
        const vendorAmount = Math.max(0, subtotalForCommission - marketplaceCommission - sellerFundedShipping);

        const marketplaceEmail = process.env.MARKETPLACE_EMAIL || 'marketplace@example.com';
        const vendorEmail = vendor.paymentEmail || vendor.email;

        if (!vendorEmail) {
          throw new Error('Vendor does not have a payment email configured');
        }

        console.log('[OrdersService] Vendor Payku config:', {
          vendorId: vendor.id,
          vendorSlug: vendor.slug,
          paykuClientId: vendor.paykuClientId,
          paykuAffiliationToken: vendor.paykuAffiliationToken,
        });

        // 🏦 SISTEMA CENTRALIZADO DE PAGOS:
        // TODO el dinero va a la cuenta Payku del marketplace
        // El administrador del marketplace se encargará de las transferencias a vendors
        
        console.log('[OrdersService] 💰 Centralized payment: All amount goes to marketplace');
        
        const paykuTransactionConfig: any = {
          orderId: savedOrderWithItems!.id,
          totalAmount: savedOrderWithItems!.total,
          customerEmail: createOrderDto.email,
          subject: `Pedido #${orderNumber}`,
          vendorSlug: createOrderDto.vendorSlug || vendor.slug,
          vendorId: vendor.id,
          paykuPaymentMethod: createOrderDto.paykuMethod || '99',
          originHostname: createOrderDto.originHostname,
        };

        const paykuTransaction = await this.paykuService.createMarketplaceTransaction(paykuTransactionConfig);

        // Update order with Payku payment info
        savedOrderWithItems!.paymentUrl = paykuTransaction.url;
        savedOrderWithItems!.paymentTransactionId = paykuTransaction.transactionId;
        savedOrderWithItems!.paymentStatus = 'pending';
        savedOrderWithItems!.vendorEmail = vendorEmail;
        savedOrderWithItems!.marketplaceEmail = marketplaceEmail;
        savedOrderWithItems!.vendorAmount = vendorAmount;
        savedOrderWithItems!.marketplaceCommission = marketplaceCommission;
        savedOrderWithItems!.splitDetails = JSON.stringify({
          commissionRate,
          vendorAmount,
          marketplaceCommission,
          vendorEmail,
          marketplaceEmail,
          paymentType: 'centralized', // All money goes to marketplace
        });

        await this.ordersRepository.save(savedOrderWithItems!);
        
        console.log('[OrdersService] Payku transaction created successfully for order:', savedOrderWithItems!.id);
      } catch (error) {
        console.error('[OrdersService] Error creating Payku transaction:', error);
        console.error('[OrdersService] Error details:', error.message);
        
        // Si el error es por falta de configuración de Payku, lanzar error para que el frontend lo muestre
        if (error.message.includes('no tiene configurado el sistema de pagos')) {
          // Eliminar la orden creada si no se puede procesar el pago
          // Primero eliminar los items para evitar error de foreign key constraint
          if (savedOrderWithItems?.items && savedOrderWithItems.items.length > 0) {
            await this.orderItemsRepository.remove(savedOrderWithItems.items);
          }
          await this.ordersRepository.remove(savedOrderWithItems!);
          throw new BadRequestException({
            message: 'Configuración de pagos incompleta',
            details: 'Esta tienda no tiene configurado el sistema de pagos. Por favor, contacta al administrador de la tienda para completar tu compra.',
            vendorContact: true,
          });
        }
        
        // Para otros errores, marcar orden como payment_error
        savedOrderWithItems!.paymentStatus = 'payment_error';
        await this.ordersRepository.save(savedOrderWithItems!);
        
        console.log('[OrdersService] Order created with payment_error status. User can contact vendor.');
      }
    }

    // ✨ Crear o enlazar cuenta del cliente automáticamente
    let customerAccountResult: any = null;
    try {
      customerAccountResult = await this.createOrLinkCustomerAccount(savedOrderWithItems!, createOrderDto);
    } catch (error) {
      console.error('[OrdersService] Error creating/linking customer account:', error.message);
      // No lanzar error - permitir que la orden se cree incluso si falla la creación de cuenta
    }

    // ✨ Los emails se enviarán después de confirmar el pago (en webhook)
    // Guardar datos necesarios para enviar emails después
    savedOrderWithItems!['_customerAccountResult'] = customerAccountResult;
    savedOrderWithItems!['_createOrderDto'] = createOrderDto;

    return savedOrderWithItems!;
  }

  /**
   * Resolves SMTP config based on order source:
   * - Marketplace sales: always use marketplace SMTP
   * - Direct store / custom domain sales: use vendor SMTP if configured, fallback to marketplace SMTP
   * - fromName always uses the vendor/store name
   */
  private async resolveSmtpConfig(order: Order, vendor: Vendor) {
    const isMarketplaceSale = order.orderSource === 'marketplace';
    const vendorHasSmtp = vendor.smtpHost && vendor.smtpUser && vendor.smtpPassword;

    // For direct/custom domain sales with vendor SMTP configured, use vendor SMTP
    if (!isMarketplaceSale && vendorHasSmtp) {
      console.log(`[OrdersService] Using vendor SMTP for ${vendor.storeName} (orderSource: ${order.orderSource})`);
      return {
        host: vendor.smtpHost,
        port: vendor.smtpPort,
        secure: vendor.smtpSecure,
        user: vendor.smtpUser,
        password: vendor.smtpPassword,
        fromEmail: vendor.smtpFromEmail || vendor.smtpUser,
        fromName: vendor.storeName || vendor.smtpFromName,
      };
    }

    // For marketplace sales, or direct sales without vendor SMTP: use marketplace SMTP
    console.log(`[OrdersService] Using marketplace SMTP (orderSource: ${order.orderSource}, vendorHasSmtp: ${vendorHasSmtp})`);
    const smtpSettingsList = await this.smtpSettingsRepository.find({
      order: { updatedAt: 'DESC' },
    });
    const smtpSettings = smtpSettingsList.find(
      s => s.smtpHost && s.smtpUser && s.smtpPassword,
    );

    if (!smtpSettings) {
      return null;
    }

    return {
      host: smtpSettings.smtpHost,
      port: smtpSettings.smtpPort || 587,
      secure: smtpSettings.smtpSecure || false,
      user: smtpSettings.smtpUser,
      password: smtpSettings.smtpPassword,
      fromEmail: smtpSettings.smtpFromEmail || smtpSettings.smtpUser,
      fromName: vendor.storeName || smtpSettings.smtpFromName || 'Mundobeat',
    };
  }

  async sendOrderEmails(order: Order, customerAccountResult: any, vendor: Vendor, customerEmail: string) {
    console.log('[OrdersService] Sending order emails...');

    // Resolve SMTP config based on order source
    const smtpConfig = await this.resolveSmtpConfig(order, vendor);

    if (!smtpConfig) {
      console.error('[OrdersService] No SMTP configuration available (neither vendor nor marketplace), skipping emails');
      return;
    }

    console.log(`[OrdersService] Using SMTP: ${smtpConfig.fromName} <${smtpConfig.fromEmail}> via ${smtpConfig.host}`);
    // Prepare common email data
    const orderUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tiendas/${vendor.slug}/pedido/${order.id}`;
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    const currentYear = new Date().getFullYear().toString();

    // 1. Send welcome email if new customer
    if (customerAccountResult?.isNew && customerAccountResult?.tempPassword) {
      console.log('[OrdersService] Sending welcome email to new customer');
      
      try {
        await this.emailTemplatesService.sendEmail(
          'welcome_customer',
          {
            customerName: order.shippingName,
            customerEmail: customerEmail,
            tempPassword: customerAccountResult.tempPassword,
            orderNumber: order.orderNumber,
            loginUrl,
            vendorName: vendor.storeName,
            currentYear,
            marketplaceName: 'MundoBeat',
          },
          customerEmail,
          smtpConfig,
        );
        console.log('[OrdersService] Welcome email sent successfully');
      } catch (error) {
        console.error('[OrdersService] Failed to send welcome email:', error.message);
      }
    }

    // 2. Send order confirmation to customer
    console.log('[OrdersService] Sending order confirmation to customer');
    
    try {
      // Load order with items for email
      const orderWithItems = await this.ordersRepository.findOne({
        where: { id: order.id },
        relations: ['items', 'items.product', 'refund'],
      });

      const orderItems = orderWithItems?.items.map(item => 
        `${item.product?.title || 'Producto'} x${item.quantity} - $${item.price.toLocaleString('es-CL')}`
      ).join('\n') || '';

      const shippingAddress = `${order.shippingAddress}\n${order.shippingCity}, ${order.shippingCommune}\n${order.shippingRegion}, ${order.shippingCountry}\nTeléfono: ${order.shippingPhone}`;

      await this.emailTemplatesService.sendEmail(
        'order_confirmation_vendor',
        {
          customerName: order.shippingName,
          orderNumber: order.orderNumber,
          orderTotal: `$${order.total.toLocaleString('es-CL')}`,
          orderDate: new Date(order.createdAt).toLocaleDateString('es-CL', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          orderUrl,
          loginUrl,
          vendorName: vendor.storeName,
          storeName: vendor.storeName,
          orderItems,
          shippingAddress,
          currentYear,
          year: currentYear,
          marketplaceName: 'MundoBeat',
        },
        customerEmail,
        smtpConfig,
      );
      console.log('[OrdersService] Order confirmation sent to customer');
    } catch (error) {
      console.error('[OrdersService] Failed to send order confirmation:', error.message);
    }

    // 3. Send notification to vendor
    console.log('[OrdersService] Sending order notification to vendor');
    
    try {
      const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/orders`;
      const vendorEmail = vendor.paymentEmail || vendor.email;

      if (vendorEmail) {
        const vendorSettings = await this.vendorSettingsRepository.findOne({
          where: { vendorId: vendor.id },
        });
        const emailTheme = this.resolveVendorEmailTheme(vendorSettings);

        // Get order items again for vendor email
        const orderWithItems = await this.ordersRepository.findOne({
          where: { id: order.id },
          relations: ['items', 'items.product'],
        });

        const orderItems = orderWithItems?.items.map(item => 
          `${item.product?.title || 'Producto'} x${item.quantity} - $${item.price.toLocaleString('es-CL')}`
        ).join('\n') || '';

        const shippingAddress = `${order.shippingAddress}\n${order.shippingCity}, ${order.shippingCommune}\n${order.shippingRegion}, ${order.shippingCountry}\nTeléfono: ${order.shippingPhone}`;

        await this.emailTemplatesService.sendEmail(
          'vendor_new_order',
          {
            vendorName: vendor.storeName,
            orderNumber: order.orderNumber,
            orderTotal: `$${order.total.toLocaleString('es-CL')}`,
            customerName: order.shippingName,
            orderItems,
            shippingAddress,
            dashboardUrl,
            currentYear,
            year: currentYear,
            marketplaceName: 'MundoBeat',
            emailPrimaryColor: emailTheme.primary,
            emailSecondaryColor: emailTheme.secondary,
          },
          vendorEmail,
          smtpConfig,
        );
        console.log('[OrdersService] Vendor notification sent successfully');
      }
    } catch (error) {
      console.error('[OrdersService] Failed to send vendor notification:', error.message);
    }
  }

  private resolveVendorEmailTheme(settings: VendorSettings | null): { primary: string; secondary: string } {
    const themes: Record<string, { primary: string; secondary: string }> = {
      default: { primary: '#9333ea', secondary: '#2563eb' },
      forest: { primary: '#059669', secondary: '#0d9488' },
      sunset: { primary: '#ea580c', secondary: '#dc2626' },
      ocean: { primary: '#0284c7', secondary: '#0369a1' },
      royal: { primary: '#1e40af', secondary: '#1e3a8a' },
      rose: { primary: '#e11d48', secondary: '#be123c' },
      midnight: { primary: '#18181b', secondary: '#09090b' },
      mint: { primary: '#14b8a6', secondary: '#0d9488' },
      vinylWarm: { primary: '#84005f', secondary: '#5c0043' },
    };
    const selectedTheme = themes[settings?.colorTheme || 'default'] || themes.default;
    const customColors = settings?.customColors || {};
    const isHexColor = (value: unknown): value is string =>
      typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

    return {
      primary: isHexColor(customColors.primary) ? customColors.primary : selectedTheme.primary,
      secondary: isHexColor(customColors.secondary) ? customColors.secondary : selectedTheme.secondary,
    };
  }

  async findVendorByOrder(orderId: string): Promise<Vendor | null> {
    try {
      const order = await this.ordersRepository.findOne({
        where: { id: orderId },
      });

      if (!order || !order.vendorId) {
        return null;
      }

      return await this.vendorsRepository.findOne({
        where: { id: order.vendorId },
      });
    } catch (error) {
      console.error('[OrdersService] Error finding vendor by order:', error.message);
      return null;
    }
  }

  private async createOrLinkCustomerAccount(order: Order, createOrderDto: CreateOrderDto) {
    if (!createOrderDto.email) {
      console.log('[OrdersService] No email provided for customer account creation');
      return;
    }

    console.log('[OrdersService] Creating/linking guest customer for:', createOrderDto.email);

    try {
      // Usar el nuevo servicio de Customer (guest checkout)
      const customer = await this.customerAccessService.findOrCreateByEmail(
        createOrderDto.email,
        {
          name: createOrderDto.shippingName,
          phone: createOrderDto.shippingPhone,
          rut: createOrderDto.shippingRut,
        }
      );

      // Enlazar orden al cliente guest
      await this.customerAccessService.linkOrderToCustomer(order.id, customer.id);

      console.log('[OrdersService] Guest customer linked to order:', {
        customerId: customer.id,
        orderId: order.id,
        email: customer.email,
      });

      return { customer };
    } catch (error) {
      console.error('[OrdersService] Failed to create/link guest customer:', error.message);
      // No lanzar error - permitir que la orden se procese incluso si falla el linkeo
      return null;
    }
  }

  private getPendingReuseWindowHours(): number {
    const parsed = Number(process.env.PENDING_ORDER_REUSE_HOURS || '4');
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 4;
    }
    return parsed;
  }

  private getManualReminderCooldownHours(): number {
    const parsed = Number(process.env.MANUAL_PENDING_REMINDER_COOLDOWN_HOURS || '24');
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 24;
    }
    return parsed;
  }

  private buildReminderData(order: Order, vendor: Vendor) {
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resumeUrl = `${frontendBaseUrl}/tiendas/${vendor.slug}/checkout?resumeOrderId=${order.id}`;
    const itemsHtml = (order.items || [])
      .slice(0, 6)
      .map((item) => `<li>${item.productTitle || 'Producto'} x${item.quantity}</li>`)
      .join('');

    return {
      customerName: order.shippingName || 'cliente',
      storeName: vendor.storeName || 'nuestra tienda',
      marketplaceName: 'MundoBeat',
      orderNumber: order.orderNumber,
      orderTotal: `$${Number(order.total).toLocaleString('es-CL')}`,
      orderItems: itemsHtml || '<li>Productos de tu pedido</li>',
      resumeUrl,
    };
  }

  private async sendReminderEmail(order: Order, vendor: Vendor): Promise<void> {
    if (!order.customerEmail) {
      throw new BadRequestException('El pedido no tiene email del cliente para enviar recordatorio');
    }

    const smtpConfig = await this.resolveSmtpConfig(order, vendor);
    if (!smtpConfig) {
      throw new BadRequestException('No hay configuracion SMTP disponible para enviar recordatorios');
    }

    await this.emailTemplatesService.sendEmail(
      'abandoned_cart_reminder',
      this.buildReminderData(order, vendor),
      order.customerEmail,
      smtpConfig,
    );
  }

  async sendManualPendingReminder(orderId: string, actorUserId?: string): Promise<{ success: boolean; remindedAt: Date; cooldownHours: number; nextAvailableAt: Date }> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Solo puedes enviar recordatorios para pedidos pendientes');
    }
    if (order.orderSource === 'assisted_sale') {
      throw new BadRequestException('Las ventas asistidas no utilizan recordatorios de compra pendiente');
    }

    const vendor = await this.vendorsRepository.findOne({ where: { id: order.vendorId } });
    if (!vendor) {
      throw new BadRequestException('No se encontro la tienda asociada al pedido');
    }

    const cooldownHours = this.getManualReminderCooldownHours();
    const now = new Date();
    const nextAvailableAt = order.abandonedReminderSentAt
      ? new Date(order.abandonedReminderSentAt.getTime() + cooldownHours * 60 * 60 * 1000)
      : now;

    // Cooldown disabled temporarily: allow consecutive manual reminders.
    await this.sendReminderEmail(order, vendor);

    order.abandonedReminderSentAt = now;
    await this.ordersRepository.save(order);

    const manualNextAvailableAt = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000);

    await this.addHistory(order.id, {
      action: 'pending_order_reminder_manual_sent',
      description: 'Recordatorio de compra pendiente enviado manualmente',
      createdBy: actorUserId || undefined,
      newValues: {
        remindedAt: now,
        cooldownHours,
        nextAvailableAt: manualNextAvailableAt,
      },
    });

    return {
      success: true,
      remindedAt: now,
      cooldownHours,
      nextAvailableAt: manualNextAvailableAt,
    };
  }

  private async findRecentPendingReusableOrder(
    createOrderDto: CreateOrderDto,
    orderSource: string,
    reuseWindowHours: number,
  ): Promise<Order | null> {
    const customerEmail = (createOrderDto.email || '').trim().toLowerCase();
    if (!customerEmail) {
      return null;
    }

    const reuseSince = new Date(Date.now() - reuseWindowHours * 60 * 60 * 1000);

    return this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.vendorId = :vendorId', { vendorId: createOrderDto.vendorId })
      .andWhere('order.orderSource = :orderSource', { orderSource })
      .andWhere('order.status = :status', { status: OrderStatus.PENDING })
      .andWhere('LOWER(order.customerEmail) = :customerEmail', { customerEmail })
      .andWhere('order.createdAt >= :reuseSince', { reuseSince })
      // Discount tables can use a different default collation from existing orders.
      .andWhere('NOT EXISTS (SELECT 1 FROM discount_uses discount_use WHERE discount_use.orderId COLLATE utf8mb4_unicode_ci = order.id COLLATE utf8mb4_unicode_ci)')
      .orderBy('order.createdAt', 'DESC')
      .getOne();
  }

  private async createOrderItemsFromDto(
    order: Order,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderItem[]> {
    return Promise.all(
      createOrderDto.items.map(async (item) => {
        const product = await this.productsRepository.findOne({
          where: { id: item.productId },
          relations: ['vendor'],
        });

        const itemVendorId = item.vendorId || product?.vendor?.id || createOrderDto.vendorId;

        return this.orderItemsRepository.create({
          order,
          productId: item.productId,
          vendorId: itemVendorId,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
          productTitle: product?.title || 'Producto desconocido',
          productImage: product?.images?.[0] || '',
        });
      }),
    );
  }

  private async refreshReusablePendingOrder(
    reusableOrder: Order,
    orderData: any,
    createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    const previousSnapshot = {
      subtotal: Number(reusableOrder.subtotal) || 0,
      shippingCost: Number(reusableOrder.shippingCost) || 0,
      total: Number(reusableOrder.total) || 0,
      shippingMethod: reusableOrder.shippingMethod || null,
      itemCount: reusableOrder.items?.length || 0,
      checkoutSessionId: reusableOrder.checkoutSessionId || null,
    };

    Object.assign(reusableOrder, orderData);
    reusableOrder.status = OrderStatus.PENDING;
    reusableOrder.paymentStatus = 'pending';
    reusableOrder.paymentUrl = '';
    reusableOrder.paymentTransactionId = '';
    reusableOrder.confirmationEmailSent = false;
    reusableOrder.abandonedReminderSentAt = null;

    await this.ordersRepository.save(reusableOrder);

    await this.orderItemsRepository
      .createQueryBuilder()
      .delete()
      .from(OrderItem)
      .where('orderId = :orderId', { orderId: reusableOrder.id })
      .execute();

    const refreshedItems = await this.createOrderItemsFromDto(reusableOrder, createOrderDto);
    await this.orderItemsRepository.save(refreshedItems);

    await this.addHistory(reusableOrder.id, {
      action: 'pending_order_reused',
      description: 'Pedido pendiente reutilizado y actualizado dentro de la ventana de 4 horas',
      previousValues: previousSnapshot,
      newValues: {
        subtotal: Number(orderData.subtotal) || 0,
        shippingCost: Number(orderData.shippingCost) || 0,
        total: Number(orderData.total) || 0,
        shippingMethod: orderData.shippingMethod || null,
        itemCount: createOrderDto.items?.length || 0,
        checkoutSessionId: orderData.checkoutSessionId || null,
      },
    });

    const refreshedOrder = await this.ordersRepository.findOne({
      where: { id: reusableOrder.id },
      relations: ['items'],
    });

    if (!refreshedOrder) {
      throw new BadRequestException('No se pudo actualizar la orden pendiente reutilizada');
    }

    return refreshedOrder;
  }

  @Cron('0 */30 * * * *')
  async sendAbandonedCartReminders(): Promise<void> {
    const reminderWindowHours = this.getPendingReuseWindowHours();
    const cutoff = new Date(Date.now() - reminderWindowHours * 60 * 60 * 1000);

    const pendingOrders = await this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.status = :status', { status: OrderStatus.PENDING })
      .andWhere("(order.orderSource IS NULL OR order.orderSource != 'assisted_sale')")
      .andWhere('order.createdAt <= :cutoff', { cutoff })
      .andWhere('order.abandonedReminderSentAt IS NULL')
      .andWhere('order.customerEmail IS NOT NULL')
      .andWhere("(order.paymentStatus IS NULL OR order.paymentStatus IN ('pending', 'failed', 'payment_error'))")
      .orderBy('order.createdAt', 'ASC')
      .limit(50)
      .getMany();

    if (!pendingOrders.length) {
      return;
    }

    console.log(`[OrdersService] Processing ${pendingOrders.length} abandoned cart reminder(s)`);

    for (const order of pendingOrders) {
      try {
        const vendor = await this.vendorsRepository.findOne({ where: { id: order.vendorId } });
        if (!vendor || !order.customerEmail) {
          continue;
        }

        await this.sendReminderEmail(order, vendor);

        order.abandonedReminderSentAt = new Date();
        await this.ordersRepository.save(order);

        await this.addHistory(order.id, {
          action: 'abandoned_cart_reminder_sent',
          description: 'Recordatorio de carrito abandonado enviado al cliente',
          newValues: {
            remindedAt: order.abandonedReminderSentAt,
            reminderWindowHours,
          },
        });
      } catch (error) {
        console.error('[OrdersService] Failed to send abandoned reminder:', {
          orderId: order.id,
          error: error.message,
        });
      }
    }
  }

  async findAll(): Promise<Order[]> {
    try {
      return this.ordersRepository.find();
    } catch (error) {
      console.error('[OrdersService] findAll error:', error.message);
      return [];
    }
  }

  async findOne(id: string): Promise<Order> {
    try {
      // Detect if id is orderNumber (starts with ORD-) or UUID
      const isOrderNumber = id.startsWith('ORD-');
      
      const order = await this.ordersRepository.findOne({
        where: isOrderNumber ? { orderNumber: id } : { id },
        relations: ['items', 'items.product', 'items.product.categories'],
      });

      if (!order) {
        throw new NotFoundException(`Order with ${isOrderNumber ? 'number' : 'ID'} ${id} not found`);
      }

      (order as Order & { packageSummary: ReturnType<typeof calculatePackageSummary> }).packageSummary = calculatePackageSummary(order.items);
      return order;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('[OrdersService] findOne error:', error.message);
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
  }

  async findByOrderNumber(orderNumber: string): Promise<Order[]> {
    try {
      console.log(`[OrdersService] Finding all orders with orderNumber: ${orderNumber}`);
      
      const orders = await this.ordersRepository.find({
        where: { orderNumber },
        relations: ['items', 'items.product'],
        order: { createdAt: 'DESC' },
      });

      if (!orders || orders.length === 0) {
        throw new NotFoundException(`No orders found with number ${orderNumber}`);
      }

      console.log(`[OrdersService] Found ${orders.length} order(s) with orderNumber ${orderNumber}`);
      return orders;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('[OrdersService] findByOrderNumber error:', error.message);
      throw new NotFoundException(`Orders with number ${orderNumber} not found`);
    }
  }

  async findByVendor(vendorId: string, source?: string): Promise<Order[]> {
    console.log('[OrdersService] findByVendor called with vendorId:', vendorId, 'source:', source);
    console.log('[OrdersService] ordersRepository:', this.ordersRepository ? 'initialized' : 'null');
    
    try {
      console.log('[OrdersService] About to query orders...');
      
      // Find orders that either:
      // 1. Have this vendorId at order level (legacy or single-vendor orders)
      // 2. Have items with this vendorId (multi-vendor marketplace orders)
      const qb = this.ordersRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .where(
          '(order.vendorId = :vendorId OR items.vendorId = :vendorId)',
          { vendorId },
        )
        .orderBy('order.createdAt', 'DESC');

      if (source === 'pos') {
        // Mostrar sólo pedidos físicos (POS)
        qb.andWhere("order.orderSource = 'pos'");
      } else {
        // Vista por defecto: excluir POS
        qb.andWhere("(order.orderSource != 'pos' OR order.orderSource IS NULL)");
      }

      const orders = await qb.getMany();
      
      console.log('[OrdersService] Query successful, found', orders.length, 'orders');
      return orders;
    } catch (error) {
      console.error('[OrdersService] findByVendor caught error:', error);
      console.error('[OrdersService] Error message:', error.message);
      console.error('[OrdersService] Error stack:', error.stack);
      return [];
    }
  }

  async getUserWithVendor(userId: string) {
    return this.usersRepository.findOne({
      where: { id: userId },
      relations: ['vendor'],
    });
  }

  async createAssistedOrder(dto: CreateAssistedOrderDto, vendor: Vendor): Promise<Order> {
    if (!dto.items?.length) throw new BadRequestException('Agrega al menos un producto');

    const requestedIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .where('product.id IN (:...ids)', { ids: requestedIds })
      .getMany();
    const productById = new Map(products.map((product) => [product.id, product]));

    const items = dto.items.map((item) => {
      const product = productById.get(item.productId);
      const quantity = Math.max(0, Math.floor(Number(item.quantity)));
      if (!product || product.vendor?.id !== vendor.id) {
        throw new BadRequestException('Uno de los productos no pertenece a tu tienda');
      }
      if (!quantity || quantity > Number(product.stock || 0)) {
        throw new BadRequestException(`Stock insuficiente para ${product.title}`);
      }
      return { productId: product.id, vendorId: vendor.id, quantity, price: Number(product.price) };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await this.create({
      vendorId: vendor.id,
      vendorSlug: vendor.slug,
      items,
      shippingName: dto.customerName,
      email: dto.customerEmail,
      shippingPhone: dto.customerPhone,
      shippingRut: dto.customerRut,
      shippingAddress: dto.shippingAddress,
      shippingNumber: dto.shippingNumber,
      shippingCity: dto.shippingCommune,
      shippingCountry: 'CL',
      shippingRegionId: dto.shippingRegionId,
      shippingRegion: dto.shippingRegion,
      shippingCommuneId: dto.shippingCommuneId,
      shippingCommune: dto.shippingCommune,
      paymentMethod: 'transfer',
      paymentStatus: 'customer_transfer_pending',
      subtotal,
      shippingCost: 0,
      total: subtotal,
      notes: dto.notes,
      orderSource: 'assisted_sale',
      deferPaymentCreation: true,
    });

    const settings = await this.vendorSettingsRepository.findOne({ where: { vendorId: vendor.id } });
    const commissionType = settings?.assistedCommissionType ?? 'percentage';
    const commissionPercentage = commissionType === 'fixed' ? 0 : Number(settings?.assistedCommissionPercentage ?? 10);
    const commissionAmount = commissionType === 'fixed' ? Number(settings?.assistedCommissionFixedAmount ?? 0) : Math.round(subtotal * commissionPercentage / 100);
    order.splitDetails = JSON.stringify({ assistedCommissionType: commissionType });
    order.assistedSaleStatus = 'awaiting_customer_transfer';
    order.assistedSaleChannel = dto.channel;
    order.commissionPercentage = commissionPercentage;
    order.commissionAmount = commissionAmount;
    order.marketplaceCommission = commissionAmount;
    order.vendorAmount = Math.max(0, subtotal - commissionAmount);
    order.commissionStatus = 'pending';
    order.paymentStatus = 'customer_transfer_pending';
    await this.ordersRepository.save(order);
    return this.findOne(order.id);
  }

  async receiveAssistedTransfer(orderId: string, vendorId: string, dto: ConfirmAssistedTransferDto): Promise<Order> {
    const order = await this.findOneForVendor(orderId, vendorId);
    if (order.orderSource !== 'assisted_sale') throw new BadRequestException('Este pedido no es una venta asistida');
    if (![OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING].includes(order.status)) {
      throw new BadRequestException('No se puede confirmar la transferencia en el estado actual');
    }
    if (order.customerTransferConfirmedAt && order.status !== OrderStatus.PENDING) return order;
    const reference = dto.transferReference?.trim() || null;
    order.customerTransferReference = reference;
    order.customerTransferConfirmedAt = order.customerTransferConfirmedAt || new Date();
    if (order.assistedSaleStatus === 'awaiting_customer_transfer') order.assistedSaleStatus = 'awaiting_platform_payment';
    if (order.status === OrderStatus.PENDING) order.status = OrderStatus.PAID;
    await this.ordersRepository.save(order);
    await this.addHistory(order.id, {
      action: 'assisted_customer_transfer_received',
      description: 'Transferencia del comprador confirmada por la tienda. El pago de envío y comisión a MundoBeat se gestiona por separado.',
    });
    return order;
  }

  async startAssistedProcessing(orderId: string, vendorId: string): Promise<Order> {
    const order = await this.findOneForVendor(orderId, vendorId);
    if (order.orderSource !== 'assisted_sale' || !order.customerTransferConfirmedAt) {
      throw new BadRequestException('Primero confirma la transferencia del comprador');
    }
    if (order.status === OrderStatus.PROCESSING) return order;
    if (order.status !== OrderStatus.PAID) throw new BadRequestException('Solo puedes preparar una venta asistida pagada');
    return this.updateStatus(orderId, OrderStatus.PROCESSING);
  }

  async confirmAssistedTransfer(
    orderId: string,
    vendorId: string,
    dto: ConfirmAssistedTransferDto,
  ): Promise<{ order: Order; paymentUrl: string; chargeAmount: number }> {
    const order = await this.findOneForVendor(orderId, vendorId);
    if (order.orderSource !== 'assisted_sale') throw new BadRequestException('Este pedido no es una venta asistida');
    if (![OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING].includes(order.status)) throw new BadRequestException('El pedido no admite un cobro de plataforma en su estado actual');
    if (!order.enviaCarrier || !order.enviaService || !Number(order.enviaQuotedPrice)) {
      throw new BadRequestException('Selecciona una opción de envío antes de confirmar la transferencia');
    }
    if (order.paymentStatus === 'approved') throw new BadRequestException('El cobro de esta venta ya fue pagado');

    // Keep the existing checkout endpoint compatible, but record the buyer's payment independently.
    await this.receiveAssistedTransfer(orderId, vendorId, dto);
    if (order.status === OrderStatus.PENDING) order.status = OrderStatus.PAID;

    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Tienda no encontrada');

    const shippingCost = Math.round(Number(order.enviaQuotedPrice));
    const commissionAmount = Math.round(Number(order.commissionAmount || 0));
    const chargeAmount = shippingCost + commissionAmount;
    if (chargeAmount <= 0) throw new BadRequestException('El cobro de plataforma no es válido');

    const payment = await this.paykuService.createMarketplaceTransaction({
      orderId: order.id,
      totalAmount: chargeAmount,
      customerEmail: vendor.email || order.customerEmail,
      subject: `Envío y comisión venta asistida #${order.orderNumber}`,
      vendorSlug: vendor.slug,
      vendorId,
      originHostname: dto.originHostname,
      returnUrlOverride: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/orders/${order.id}?assistedPayment=1`,
    });

    order.customerTransferReference = order.customerTransferReference || dto.transferReference?.trim() || null;
    order.customerTransferConfirmedAt = order.customerTransferConfirmedAt || new Date();
    order.assistedSaleStatus = 'platform_payment_pending';
    order.shippingCost = shippingCost;
    order.total = Number(order.subtotal) + shippingCost;
    order.platformChargeAmount = chargeAmount;
    order.paymentTransactionId = payment.transactionId;
    order.paymentUrl = payment.url;
    order.paymentStatus = 'pending';
    order.splitDetails = JSON.stringify({
      assistedCommissionType: order.splitDetails ? JSON.parse(order.splitDetails).assistedCommissionType ?? 'percentage' : 'percentage',
      paymentType: 'assisted_platform_charge',
      customerTransferReceived: order.total,
      shippingCost,
      commissionRate: Number(order.commissionPercentage || 0),
      marketplaceCommission: commissionAmount,
      vendorAmount: Number(order.vendorAmount || 0),
      platformChargeAmount: chargeAmount,
    });
    await this.ordersRepository.save(order);
    await this.addHistory(order.id, {
      action: 'assisted_transfer_confirmed',
      description: `Transferencia del cliente confirmada. Cobro de plataforma: $${chargeAmount.toLocaleString('es-CL')}`,
    });
    return { order, paymentUrl: payment.url, chargeAmount };
  }

  async findVendorEstadoCuenta(
    vendorId: string,
    filters: { period?: string; fechaDesde?: string; fechaHasta?: string } = {},
  ) {
    const { period, fechaDesde, fechaHasta } = filters;

    // Calcular rango de fechas según período
    const now = new Date();
    let desde: Date | null = null;
    let hasta: Date | null = null;

    if (period === 'hoy') {
      desde = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      hasta = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (period === 'semana') {
      const day = now.getDay() || 7;
      desde = new Date(now);
      desde.setDate(now.getDate() - day + 1);
      desde.setHours(0, 0, 0, 0);
      hasta = new Date(desde);
      hasta.setDate(desde.getDate() + 6);
      hasta.setHours(23, 59, 59, 999);
    } else if (period === 'mes') {
      desde = new Date(now.getFullYear(), now.getMonth(), 1);
      hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (fechaDesde && fechaHasta) {
      const [desdeYear, desdeMonth, desdeDay] = fechaDesde.split('-').map(Number);
      const [hastaYear, hastaMonth, hastaDay] = fechaHasta.split('-').map(Number);
      desde = new Date(desdeYear, desdeMonth - 1, desdeDay, 0, 0, 0, 0);
      hasta = new Date(hastaYear, hastaMonth - 1, hastaDay, 0, 0, 0, 0);
      hasta.setHours(23, 59, 59, 999);
    }

    // Obtener órdenes del vendedor (excluir pendientes y excluir POS, que se gestionan aparte)
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.vendorId = :vendorId', { vendorId })
      .andWhere('order.status != :pending', { pending: 'pending' })
      .andWhere("(order.orderSource != 'pos' OR order.orderSource IS NULL)")
      .andWhere("(order.orderSource != 'mercadolibre' OR order.orderSource IS NULL)")
      .andWhere("(order.orderSource != 'woocommerce' OR order.orderSource IS NULL)")
      .orderBy('order.createdAt', 'DESC');

    if (desde) qb.andWhere('order.createdAt >= :desde', { desde });
    if (hasta) qb.andWhere('order.createdAt <= :hasta', { hasta });

    const orders = await qb.getMany();

    // Para cada orden, buscar la liquidación en payku_liquidaciones (dual: UUID o orderNumber)
    const orderIds = orders.map((o) => o.id);
    const orderNumbers = orders.map((o) => o.orderNumber);
    let liquidacionesMap: Map<string, Liquidacion> = new Map();

    if (orderIds.length > 0) {
      const liqRows = await this.liquidacionesRepository
        .createQueryBuilder('liq')
        .where('liq.orden IN (:...ids)', { ids: [...orderIds, ...orderNumbers] })
        .getMany();
      for (const liq of liqRows) {
        if (liq.orden) liquidacionesMap.set(liq.orden, liq);
      }
    }

    // Obtener datos de pagos a vendor registrados
    const vendorPaymentIds = [...new Set(orders.map((o) => o.vendorPaymentId).filter(Boolean))] as string[];
    const vendorPaymentsMap = new Map<string, VendorPayment>();
    if (vendorPaymentIds.length > 0) {
      const vpRows = await this.vendorPaymentsRepository.findByIds(vendorPaymentIds);
      for (const vp of vpRows) {
        vendorPaymentsMap.set(vp.id, vp);
      }
    }

    // Construir respuesta enriquecida
    const enrichedOrders = orders.map((order) => {
      const liq = liquidacionesMap.get(order.id) ?? liquidacionesMap.get(order.orderNumber);
      const vp = order.vendorPaymentId ? vendorPaymentsMap.get(order.vendorPaymentId) : null;
      const settlement = getVendorSettlement(order);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        ...settlement,
        assistedReimbursementStatus: order.assistedReimbursementStatus,
        assistedCommissionRefundAmount: Number(order.assistedCommissionRefundAmount) || 0,
        assistedShippingRefundAmount: Number(order.assistedShippingRefundAmount) || 0,
        coverImage: order.items?.find((item) => item.productImage)?.productImage ?? null,
        createdAt: order.createdAt,
        status: order.status,
        orderSource: order.orderSource,
        paymentStatus: order.paymentStatus,
        total: order.total,
        vendorAmount: order.vendorAmount,
        commissionAmount: order.commissionAmount,
        marketplaceCommission: order.marketplaceCommission,
        shippingCost: Number(order.shippingCost) || 0,
        customerEmail: order['customerEmail'] ?? null,
        vendorCustomerRefundStatus: order.vendorCustomerRefundStatus,
        vendorCustomerRefundAmount: order.vendorCustomerRefundAmount,
        vendorCustomerRefundReference: order.vendorCustomerRefundReference,
        vendorCustomerRefundProof: order.vendorCustomerRefundProof,
        vendorCustomerRefundedAt: order.vendorCustomerRefundedAt,
        vendorPaymentId: order.vendorPaymentId,
        // Liquidación
        liquidacionNumero: liq?.liquidacion ?? null,
        liquidacionFecha: liq?.fecha ?? null,
        fechaDepositoPayku: liq?.fechaDeposito ?? null,
        liquidacionId: liq?.identificador ?? null,
        // Pago a vendor
        pagado: vp ? settlement.marketplaceAmount : null,
        numeroTransferencia: vp?.numeroTransferencia ?? null,
        fechaTransferencia: vp?.fechaPago ?? order.vendorPaidAt ?? null,
      };
    });

    // Resumen
    const ventasTotales = enrichedOrders.reduce((acc, o) => acc + o.marketplaceAmount, 0);
    const pagosRecibidos = enrichedOrders
      .filter((o) => o.pagado != null)
      .reduce((acc, o) => acc + (Number(o.pagado) || 0), 0);
    const pagosPendientes = ventasTotales - pagosRecibidos;

    return {
      orders: enrichedOrders,
      resumen: {
        totalOrdenes: enrichedOrders.length,
        ventasTotales,
        pagosRecibidos,
        pagosPendientes,
        period: period || 'todos',
        desde: desde?.toISOString() ?? null,
        hasta: hasta?.toISOString() ?? null,
      },
    };
  }

  async getCustomerStats(email: string): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  }> {
    // TODO: Add email tracking to orders table
    // For now, return empty stats since shippingEmail column doesn't exist
    return {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
    };
  }

  async getCustomerHistory(email: string): Promise<any> {
    try {
      // TODO: Add email tracking to orders table
      // For now, return empty history since shippingEmail column doesn't exist
      return [];
      
      /* 
      const orders = await this.ordersRepository.find({
        where: { shippingEmail: email },
        order: { createdAt: 'DESC' },
      });

      const ordersWithHistory = await Promise.all(
        orders.map(async (order) => {
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            total: order.total,
            status: order.status,
            createdAt: order.createdAt,
            history: [],
          };
        }),
      );

      return ordersWithHistory;
      */
    } catch (error) {
      console.log('[OrdersService] Customer history failed:', error.message);
      return [];
    }
  }

  async findMarketplaceOrders(): Promise<Order[]> {
    // Admin del marketplace ve TODAS las órdenes de todas las tiendas
    const orders = await this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('order.refund', 'refund')
      .leftJoinAndSelect('order.shipments', 'shipments')
      .orderBy('order.createdAt', 'DESC')
      .getMany();
    return this.attachAdminReviewStatus(orders);
  }

  async findVendorStoresOrders(): Promise<Order[]> {
    const orders = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.vendorId IS NOT NULL')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('order.refund', 'refund')
      .leftJoinAndSelect('order.shipments', 'shipments')
      .orderBy('order.createdAt', 'DESC')
      .getMany();
    return this.attachAdminReviewStatus(orders);
  }

  private async attachAdminReviewStatus(orders: Order[]): Promise<Order[]> {
    if (!orders.length) return orders;
    const reviews = await this.vendorReviewsRepository.find({
      where: { orderId: In(orders.map((order) => order.id)) },
      select: ['orderId', 'status', 'rating', 'emailCount', 'lastEmailSentAt', 'submittedAt'],
    });
    const reviewByOrderId = new Map(reviews.map((review) => [review.orderId, review]));
    return orders.map((order) => Object.assign(order, {
      reviewStatus: reviewByOrderId.get(order.id) || null,
    }));
  }

  async findOneForVendor(orderId: string, vendorId: string): Promise<Order> {
    const order = await this.findOne(orderId);
    if (order.vendorId !== vendorId) {
      throw new UnauthorizedException('No tienes permisos para ver este pedido');
    }
    return order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.CANCELLED && status !== OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede reactivar un pedido cancelado desde el cambio de estado');
    }
    const previousStatus = order.status;
    order.status = status;
    const releasedExternalShipping = getExternalShippingReleaseAmount(order, previousStatus, status);

    if (releasedExternalShipping > 0) {
      order.vendorAmount = Math.max(0, Number(order.vendorAmount) || 0) + releasedExternalShipping;
      order.externalShippingPayoutStatus = 'eligible';
      order.externalShippingReleasedAt = new Date();
    }
    
    // ✨ When order changes to PROCESSING:
    // 1. Decrement product stock
    // 2. Send confirmation email (only once)
    if (status === OrderStatus.PROCESSING && previousStatus !== OrderStatus.PROCESSING) {
      console.log('[OrdersService] Order status changed to PROCESSING');
      
      // 1. Decrement stock for all order items
      if (order.items && order.items.length > 0) {
        console.log('[OrdersService] Decrementing stock for order items...');
        
        for (const item of order.items) {
          try {
            if (!item.productId) {
              console.warn('[OrdersService] Order item has no productId, skipping stock decrement');
              continue;
            }
            
            const product = await this.productsRepository.findOne({
              where: { id: item.productId },
            });
            
            if (product) {
              const previousStock = product.stock || 0;
              product.stock = Math.max(0, previousStock - item.quantity);
              await this.productsRepository.save(product);
              
              console.log(`[OrdersService] Product ${product.title}: stock ${previousStock} -> ${product.stock} (qty: ${item.quantity})`);
              
              // Record stock decrement in order history
              await this.recordHistory(
                id,
                OrderHistoryAction.STOCK_DECREMENTED,
                `Stock descontado: ${product.title} - Cantidad: ${item.quantity} (Stock anterior: ${previousStock}, Stock actual: ${product.stock})`,
                { productId: product.id, previousStock },
                { productId: product.id, newStock: product.stock },
              );

              // Sync stock to WooCommerce if product is linked
              if (product.woocommerceId) {
                this.woocommerceService.updateStock(product.id, product.stock).catch(err =>
                  console.error(`[OrdersService] WooCommerce stock sync failed for ${product.title}: ${err.message}`),
                );
              }
              this.mercadoLibreService.syncStockFromLocal(product.id).catch(err =>
                console.error(`[OrdersService] Mercado Libre stock sync failed for ${product.title}: ${err.message}`),
              );
            } else {
              console.warn(`[OrdersService] Product ${item.productId} not found for stock decrement`);
            }
          } catch (stockError) {
            console.error(`[OrdersService] Error decrementing stock for item ${item.id}:`, stockError.message);
            // Continue with other items
          }
        }
      }
      
      // 2. Send confirmation email (only once)
      if (!order.confirmationEmailSent) {
        console.log('[OrdersService] Sending confirmation email...');
        
        try {
          // Get vendor for email sending
          const vendor = await this.vendorsRepository.findOne({
            where: { id: order.vendorId },
          });

          if (vendor && order.customerEmail) {
            // Get customer account result from order metadata (if exists)
            const customerAccountResult = (order as any)._customerAccountResult;
            
            await this.sendOrderEmails(
              order,
              customerAccountResult,
              vendor,
              order.customerEmail,
            );
            
            // Mark email as sent
            order.confirmationEmailSent = true;
            console.log('[OrdersService] Confirmation email sent successfully');
          } else {
            console.warn('[OrdersService] Cannot send email - missing vendor or customer email');
          }
        } catch (emailError) {
          console.error('[OrdersService] Failed to send confirmation email:', emailError.message);
          // Continue anyway - don't fail status update
        }
      }
    }
    
    const saved = await this.ordersRepository.save(order);
    
    // Record status change in history
    await this.recordHistory(
      id,
      OrderHistoryAction.STATUS_CHANGED,
      `Estado cambió de ${previousStatus} a ${status}`,
      { status: previousStatus },
      { status: status },
    );

    if (releasedExternalShipping > 0) {
      await this.recordHistory(
        id,
        OrderHistoryAction.NOTE_ADDED,
        `Envío externo liberado para la liquidación de la tienda: $${releasedExternalShipping.toLocaleString('es-CL')}`,
        { externalShippingPayoutStatus: 'pending_delivery' },
        { externalShippingPayoutStatus: 'eligible', vendorAmount: saved.vendorAmount },
      );
    }
    
    return saved;
  }

  async completeVendorManagedShipping(id: string, vendorId: string): Promise<Order> {
    const order = await this.findOneForVendor(id, vendorId);
    if (!canCompleteVendorManagedShipping(order)) {
      throw new BadRequestException(
        'Sólo puedes completar un pedido enviado por la tienda cuando tenga courier y número de seguimiento registrados',
      );
    }
    return this.updateStatus(id, OrderStatus.DELIVERED);
  }

  async validateExternalShipping(
    id: string,
    vendorId: string,
    data: { reason: string; reasonDetail?: string; carrier: string; trackingNumber: string; trackingUrl?: string },
  ): Promise<Order> {
    const order = await this.findOneForVendor(id, vendorId);
    const allowedReasons = ['no_coverage', 'platform_error', 'buyer_agreement', 'other'];
    if (!allowedReasons.includes(String(data.reason || ''))) {
      throw new BadRequestException('Selecciona un motivo válido para usar otro medio de envío');
    }
    if (!String(data.carrier || '').trim()) throw new BadRequestException('Debes indicar el courier o medio de entrega');
    if (!String(data.trackingNumber || '').trim()) throw new BadRequestException('Debes indicar el número de seguimiento');
    if (String(data.carrier).trim().length > 120) throw new BadRequestException('El nombre del courier es demasiado largo');
    if (String(data.trackingNumber).trim().length > 150) throw new BadRequestException('El número de seguimiento es demasiado largo');
    if (['platform_error', 'other'].includes(data.reason) && !String(data.reasonDetail || '').trim()) {
      throw new BadRequestException('Debes describir el error o motivo');
    }
    if (String(data.reasonDetail || '').trim().length > 2000) throw new BadRequestException('El detalle no puede superar 2000 caracteres');
    if (data.trackingUrl?.trim()) {
      try {
        const url = new URL(data.trackingUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
      } catch {
        throw new BadRequestException('El enlace de seguimiento no es válido');
      }
    }
    if (['mercadolibre', 'falabella', 'paris', 'woocommerce', 'pos'].includes(String(order.orderSource || '').toLowerCase())) {
      throw new BadRequestException('El envío externo sólo está disponible para ventas realizadas en MundoBeat');
    }
    if (!['approved', 'paid'].includes(String(order.paymentStatus || '').toLowerCase())) {
      throw new BadRequestException('El pedido debe estar pagado antes de registrar un envío externo');
    }
    if (![OrderStatus.PROCESSING, OrderStatus.SHIPPED].includes(order.status)) {
      throw new BadRequestException('El pedido ya no permite cambiar la forma de despacho');
    }
    if (order.vendorPaymentId) throw new BadRequestException('El pedido ya fue incluido en una liquidación');
    if (order.enviaLabelUrl || order.enviaTrackingNumber || order.enviaShipmentId) {
      throw new BadRequestException('El pedido ya tiene una etiqueta de Envia.com y no puede cambiarse a envío externo');
    }
    return order;
  }

  async useExternalShipping(
    id: string,
    vendorId: string,
    data: { reason: string; reasonDetail?: string; carrier: string; trackingNumber: string; trackingUrl?: string },
    evidenceUrl?: string,
  ): Promise<Order> {
    const order = await this.validateExternalShipping(id, vendorId, data);
    const previousStatus = order.status;
    const previousTracking = order.trackingNumber;
    const previousShippingHandledBy = order.shippingHandledBy;
    const reasonLabels: Record<string, string> = {
      no_coverage: 'Envia.com no tiene cobertura',
      platform_error: 'Error en la plataforma',
      buyer_agreement: 'Acuerdo especial con el comprador',
      other: 'Otro motivo',
    };
    const payoutAmount = Math.max(0, Number(order.shippingCost) || 0);

    order.shippingHandledBy = 'vendor';
    order.externalShippingReason = data.reason;
    order.externalShippingReasonDetail = String(data.reasonDetail || '').trim() || null;
    order.externalShippingEvidenceUrl = evidenceUrl || order.externalShippingEvidenceUrl || null;
    order.externalShippingCarrier = String(data.carrier).trim();
    order.externalShippingTrackingUrl = String(data.trackingUrl || '').trim() || null;
    order.externalShippingSelectedAt = new Date();
    order.externalShippingPayoutAmount = payoutAmount;
    order.externalShippingPayoutStatus = 'pending_delivery';
    order.shippingMethod = `${order.externalShippingCarrier} - Gestionado por la tienda`;
    order.shippingMethodCode = 'vendor-external';
    order.trackingNumber = String(data.trackingNumber).trim();
    order.status = OrderStatus.SHIPPED;

    const saved = await this.ordersRepository.save(order);
    await this.recordHistory(
      id,
      OrderHistoryAction.STATUS_CHANGED,
      `Envío gestionado por la tienda mediante ${saved.externalShippingCarrier}. Motivo: ${reasonLabels[data.reason]}. El monto de envío se liberará al confirmar la entrega.`,
      { status: previousStatus, trackingNumber: previousTracking, shippingHandledBy: previousShippingHandledBy || null },
      {
        status: saved.status,
        trackingNumber: saved.trackingNumber,
        shippingHandledBy: saved.shippingHandledBy,
        externalShippingReason: saved.externalShippingReason,
        externalShippingPayoutAmount: payoutAmount,
      },
    );
    await this.sendExternalShippingEmail(saved).catch((error) =>
      console.error(`[OrdersService] External shipping email failed for ${saved.id}:`, error.message),
    );
    return saved;
  }

  private async sendExternalShippingEmail(order: Order): Promise<void> {
    const customerEmail = order.customerEmail || order.guestData?.email;
    if (!customerEmail) return;
    const vendor = order.vendorId ? await this.vendorsRepository.findOne({ where: { id: order.vendorId } }) : null;
    if (!vendor) return;
    const smtpConfig = await this.resolveSmtpConfig(order, vendor);
    if (!smtpConfig) return;
    const trackingLink = order.externalShippingTrackingUrl
      ? `<p><a href="${this.escapeHtml(order.externalShippingTrackingUrl)}">Rastrear envío</a></p>`
      : '';
    await this.emailService.sendEmail(
      smtpConfig,
      customerEmail,
      `Tu pedido ${order.orderNumber} fue enviado`,
      `<p>Hola ${this.escapeHtml(order.shippingName || 'cliente')},</p><p>La tienda despachó tu pedido <strong>${this.escapeHtml(order.orderNumber)}</strong>.</p><p><strong>Courier:</strong> ${this.escapeHtml(order.externalShippingCarrier || '')}<br><strong>Número de seguimiento:</strong> ${this.escapeHtml(order.trackingNumber || '')}</p>${trackingLink}`,
    );
  }

  async updateTrackingNumber(id: string, trackingNumber: string): Promise<Order> {
    const order = await this.findOne(id);
    const previousTracking = order.trackingNumber;
    order.trackingNumber = trackingNumber;
    const saved = await this.ordersRepository.save(order);
    
    // Record in history
    await this.recordHistory(
      id,
      OrderHistoryAction.STATUS_CHANGED,
      `Número de guía actualizado a ${trackingNumber}`,
      { trackingNumber: previousTracking },
      { trackingNumber: trackingNumber },
    );
    
    return saved;
  }

  async cancelOrder(id: string, reason: string, note?: string, actorId?: string, actorRole?: string): Promise<Order> {
    const queryRunner = this.ordersRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const restoredProducts: Product[] = [];
    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Este pedido ya está cancelado');
      const shipments = await queryRunner.manager.find(OrderShipment, { where: { orderId: id } });
      const hasLinkedShipment = shipments.some((shipment) => (
        shipment.enviaLabelUrl || shipment.enviaTrackingNumber || shipment.enviaShipmentId
      ));
      if (actorRole !== 'admin' && !canVendorCancelOrder(order, hasLinkedShipment)) {
        throw new BadRequestException(
          'Este pedido ya tiene un despacho registrado o salió de la etapa de preparación. Comunícate con el administrador del marketplace.',
        );
      }

      const isStockBreak = reason.trim().toLowerCase() === 'quiebre de stock';
      if (order.orderSource === 'woocommerce') {
        try {
          await this.woocommerceService.cancelWooCommerceOrder(order.id, reason.trim(), isStockBreak);
        } catch (wooError: any) {
          throw new BadRequestException(
            `WooCommerce no pudo cancelar el pedido: ${wooError.response?.data?.message || wooError.message}`,
          );
        }
      }

      const previousStatus = order.status;
      const stockHistory = await queryRunner.manager.find(OrderHistory, { where: { orderId: id, action: OrderHistoryAction.STOCK_DECREMENTED } });
      const stockWasDeducted = order.orderSource === 'pos' ||
        stockHistory.some((entry) => entry.description?.startsWith('Stock descontado:'));
      if (!isStockBreak && stockWasDeducted && !order.cancellationStockRestoredAt) {
        const items = await queryRunner.manager.find(OrderItem, { where: { order: { id } } });
        for (const item of items) {
          if (!item.productId || item.quantity <= 0) continue;
          await queryRunner.manager.increment(Product, { id: item.productId }, 'stock', item.quantity);
          const product = await queryRunner.manager.findOne(Product, { where: { id: item.productId } });
          if (product) restoredProducts.push(product);
        }
        order.cancellationStockRestoredAt = new Date();
      }

      order.status = OrderStatus.CANCELLED;
      order.cancellationReason = reason.trim();
      order.cancellationNote = note?.trim() || null;
      order.cancelledAt = new Date();
      order.cancelledById = actorId || null;
      if (order.orderSource === 'assisted_sale') {
        const platformChargePaid = order.paymentStatus === 'approved';
        const commissionRefund = platformChargePaid ? Number(order.commissionAmount || 0) : 0;
        const shippingCost = platformChargePaid ? Number(order.shippingCost || 0) : 0;
        const shipmentStatuses = [order.enviaShippingStatus, ...shipments.map((shipment) => shipment.enviaShippingStatus)]
          .filter(Boolean)
          .map((status) => String(status).toLowerCase());
        const shippingWasUsed = shipmentStatuses.some((status) =>
          ['picked_up', 'in_transit', 'delivered', 'completed'].includes(status),
        );
        const hasLabel = Boolean(
          order.enviaLabelUrl || order.enviaTrackingNumber || order.enviaShipmentId ||
          shipments.some((shipment) => shipment.enviaLabelUrl || shipment.enviaTrackingNumber || shipment.enviaShipmentId),
        );
        const shippingRefund = !hasLabel && !shippingWasUsed ? shippingCost : 0;

        order.cancellationReviewStatus = 'assisted_sale';
        order.commissionStatus = platformChargePaid ? 'refund_to_vendor' : 'cancelled';
        order.vendorCustomerRefundStatus = 'handled_directly';
        order.vendorCustomerRefundAmount = 0;
        order.assistedCommissionRefundAmount = commissionRefund;
        order.assistedShippingRefundAmount = shippingRefund;
        order.assistedReimbursementAmount = commissionRefund + shippingRefund;
        order.assistedShippingRefundStatus = !platformChargePaid
          ? 'not_paid'
          : shippingWasUsed
            ? 'not_refundable_used'
            : hasLabel
              ? 'pending_cancellation'
              : 'refundable_no_label';
        order.assistedReimbursementStatus = !platformChargePaid
          ? 'not_required'
          : hasLabel && !shippingWasUsed
            ? 'pending_shipping_cancellation'
            : 'pending_payment';
      } else {
        order.cancellationReviewStatus = actorRole === 'vendor' && reason.trim() !== 'Cliente solicitó cancelación'
          ? 'pending'
          : null;
        order.commissionStatus = 'refund_to_customer';
        order.vendorAmount = Number(order.total);
        order.commissionAmount = 0;
        order.marketplaceCommission = 0;
        order.vendorCustomerRefundStatus = order.paymentStatus === 'approved' ? 'pending' : 'not_required';
        order.vendorCustomerRefundAmount = order.paymentStatus === 'approved' ? Number(order.total) : 0;
      }
      await queryRunner.manager.save(order);
      await queryRunner.manager.save(OrderHistory, queryRunner.manager.create(OrderHistory, {
        orderId: id,
        action: OrderHistoryAction.STATUS_CHANGED,
        description: `Pedido cancelado. Motivo: ${reason}${note ? `. Detalle: ${note}` : ''}`,
        previousValues: JSON.stringify({ status: previousStatus }),
        newValues: JSON.stringify({ status: OrderStatus.CANCELLED, cancellationReason: reason, stockRestored: Boolean(order.cancellationStockRestoredAt) }),
        createdBy: actorId || undefined,
      }));
      await queryRunner.commitTransaction();
      for (const product of restoredProducts) {
        if (product.woocommerceId) {
          this.woocommerceService.updateStock(product.id, product.stock).catch((error) =>
            console.error(`[OrdersService] WooCommerce stock sync failed: ${error.message}`),
          );
        }
        this.mercadoLibreService.syncStockFromLocal(product.id).catch((error) =>
          console.error(`[OrdersService] Mercado Libre stock sync failed: ${error.message}`),
        );
      }
      await this.sendVendorManagedCancellationEmails(order).catch((emailError) =>
        console.error(`[OrdersService] Cancellation email failed for ${order.id}:`, emailError.message),
      );
      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async confirmAssistedShippingCancellation(orderId: string, actorId?: string): Promise<Order> {
    const order = await this.findOne(orderId);
    if (order.orderSource !== 'assisted_sale' || order.status !== OrderStatus.CANCELLED) {
      throw new BadRequestException('Esta acción solo corresponde a una venta asistida cancelada');
    }
    if (order.assistedReimbursementStatus !== 'pending_shipping_cancellation') {
      throw new BadRequestException('El envío de esta orden no está pendiente de confirmación de anulación');
    }

    const shippingRefund = Number(order.shippingCost || 0);
    const commissionRefund = Number(order.assistedCommissionRefundAmount || order.commissionAmount || 0);
    order.assistedShippingRefundStatus = 'confirmed';
    order.assistedShippingRefundAmount = shippingRefund;
    order.assistedReimbursementAmount = commissionRefund + shippingRefund;
    order.assistedShippingCancellationConfirmedAt = new Date();
    order.assistedReimbursementStatus = 'pending_payment';
    const saved = await this.ordersRepository.save(order);
    await this.recordHistory(
      order.id,
      OrderHistoryAction.NOTE_ADDED,
      'Administración confirmó la anulación de la etiqueta. El envío quedó habilitado para reintegro a la tienda.',
      undefined,
      { assistedShippingRefundStatus: 'confirmed', assistedReimbursementAmount: order.assistedReimbursementAmount },
    );
    return saved;
  }

  async registerVendorCustomerRefund(
    orderId: string,
    vendorId: string,
    data: { reference: string; note?: string; refundedAt?: string },
    proofUrl?: string,
  ): Promise<Order> {
    const order = await this.findOneForVendor(orderId, vendorId);
    if (order.status !== OrderStatus.CANCELLED || order.paymentStatus !== 'approved') {
      throw new BadRequestException('Solo puedes registrar la devolución de un pedido cancelado y pagado');
    }
    if (!data.reference?.trim()) throw new BadRequestException('Debes indicar el número o referencia de transferencia');
    if (!proofUrl && !order.vendorCustomerRefundProof) throw new BadRequestException('Debes adjuntar el comprobante de devolución');
    const refundedAt = data.refundedAt ? new Date(`${data.refundedAt}T12:00:00`) : new Date();
    if (Number.isNaN(refundedAt.getTime())) throw new BadRequestException('Fecha de devolución inválida');

    order.vendorCustomerRefundStatus = 'completed';
    order.vendorCustomerRefundAmount = Number(order.total);
    order.vendorCustomerRefundReference = data.reference.trim();
    order.vendorCustomerRefundNote = data.note?.trim() || null;
    order.vendorCustomerRefundProof = proofUrl || order.vendorCustomerRefundProof;
    order.vendorCustomerRefundedAt = refundedAt;
    const saved = await this.ordersRepository.save(order);
    await this.recordHistory(order.id, OrderHistoryAction.NOTE_ADDED,
      `Devolución al comprador registrada por la tienda. Referencia: ${data.reference.trim()}`,
      undefined, { status: 'completed', amount: Number(order.total), refundedAt });
    await this.sendVendorRefundCompletedEmails(saved).catch((error) =>
      console.error(`[OrdersService] Vendor refund confirmation email failed: ${error.message}`),
    );
    return saved;
  }

  async saveQrSalesReceipt(orderId: string, vendorId: string, url: string, file: Express.Multer.File) {
    await this.findOneForVendor(orderId, vendorId);
    const assets = await this.receiptDocuments.prepare(url, file);
    const updated = await this.updateSalesReceipt(orderId, vendorId, assets.receiptUrl, assets);
    return { ...updated, salesReceiptPdfSaved: assets.pdfSaved };
  }

  async resolveSalesReceipt(token: string) {
    if (!/^[a-f0-9]{32}$/.test(token)) throw new NotFoundException('Boleta no encontrada');
    const order = await this.ordersRepository.findOne({ where: { salesReceiptToken: token }, select: ['salesReceiptUrl'] });
    if (!order?.salesReceiptUrl) throw new NotFoundException('Boleta no encontrada');
    return { url: validateSalesReceiptUrl(order.salesReceiptUrl) };
  }

  async updateSalesReceipt(orderId: string, vendorId: string, receiptUrl: string, assets?: { qrImageUrl: string; attachments: EmailAttachment[] }): Promise<Order & { salesReceiptNotification: string }> {
    const order = await this.findOneForVendor(orderId, vendorId);
    receiptUrl = validateSalesReceiptUrl(receiptUrl);
    if (!assets && order.salesReceiptUrl === receiptUrl) return { ...order, salesReceiptNotification: 'unchanged' };
    const replaced = Boolean(order.salesReceiptUrl);
    order.salesReceiptUrl = receiptUrl;
    order.salesReceiptQrImageUrl = assets?.qrImageUrl || null;
    order.salesReceiptToken = order.salesReceiptToken || randomBytes(16).toString('hex');
    const shortUrl = receiptShortUrl(order.salesReceiptToken);
    const saved = await this.ordersRepository.save(order);

    await this.recordHistory(
      order.id,
      OrderHistoryAction.NOTE_ADDED,
      replaced ? 'La tienda actualizó la boleta del pedido.' : 'La tienda adjuntó la boleta del pedido.',
      undefined,
      { salesReceiptUrl: receiptUrl },
    );

    let notification = 'unavailable';
    try {
      const email = order.customerEmail || order.guestData?.email;
      const mail = email ? await this.getMarketplaceMailConfig() : null;
      if (email && mail) {
        const vendor = order.vendorId ? await this.vendorsRepository.findOne({ where: { id: order.vendorId }, select: ['storeName'] }) : null;
        await this.emailService.sendEmail(withStoreSender(mail.config, vendor?.storeName), email,
          `Boleta de tu pedido ${order.orderNumber}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6">
            <h2>Tu documento tributario está disponible</h2>
            <p>Hola ${this.escapeHtml(order.shippingName || 'cliente')},</p>
            <p>La tienda ${replaced ? 'actualizó' : 'adjuntó'} la boleta de tu pedido <strong>${this.escapeHtml(order.orderNumber)}</strong>.</p>
            ${assets ? '<p><img src="cid:boleta-qr" alt="QR de la boleta" width="220" style="max-width:100%;height:auto" /></p>' : ''}
            <p><a href="${this.escapeHtml(shortUrl)}" style="color:#0089c9;font-weight:bold">Ver boleta</a></p>
            <p style="font-size:13px;word-break:break-all">${this.escapeHtml(shortUrl)}</p>
          </div>`, assets?.attachments);
        notification = 'sent';
      }
    } catch {
      notification = 'failed';
      console.error('[OrdersService] No se pudo enviar el correo de boleta del pedido', order.id);
    }
    return { ...saved, salesReceiptNotification: notification };
  }

  async sendVendorCustomerRefundReminder(orderId: string): Promise<{ success: true; message: string }> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (
      order.status !== OrderStatus.CANCELLED
      || order.paymentStatus !== 'approved'
      || order.vendorCustomerRefundStatus === 'completed'
    ) {
      throw new BadRequestException('Este pedido no tiene una devolución pendiente al comprador');
    }

    const vendor = order.vendorId
      ? await this.vendorsRepository.findOne({ where: { id: order.vendorId } })
      : null;
    const vendorEmail = vendor?.email || order.vendorEmail;
    if (!vendorEmail) throw new BadRequestException('La tienda no tiene un correo disponible para la notificación');

    const mail = await this.getMarketplaceMailConfig();
    if (!mail) throw new BadRequestException('No hay una configuración SMTP disponible para enviar la notificación');

    const amount = Number(order.vendorCustomerRefundAmount || order.total).toLocaleString('es-CL');
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const orderUrl = `${baseUrl}/dashboard/orders/${order.id}`;
    await this.emailService.sendEmail(
      mail.config,
      vendorEmail,
      `Acción requerida: devolución pendiente del pedido ${order.orderNumber}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f2747;line-height:1.6">
        <h2 style="margin:0 0 16px;color:#0b1f3a">Devolución pendiente al comprador</h2>
        <p>Hola ${this.escapeHtml(vendor?.storeName || 'tienda')},</p>
        <p>La devolución de <strong>$${amount}</strong> correspondiente al pedido <strong>${this.escapeHtml(order.orderNumber)}</strong> aún no ha sido acreditada.</p>
        <p>Realiza el reembolso al comprador y registra en el pedido la referencia, fecha y comprobante de la transferencia. Si ya realizaste la devolución, solo debes adjuntar esos antecedentes.</p>
        <div style="margin:24px 0">
          <a href="${orderUrl}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:#0788c9;color:#fff;text-decoration:none;font-weight:700">Ir al pedido</a>
        </div>
        <p style="padding:14px 16px;border:1px solid #f5c2c7;border-radius:6px;background:#fff5f5;color:#9f1239"><strong>Importante:</strong> el pago asociado a esta orden permanecerá retenido y no será incluido en las próximas transferencias a tu tienda hasta que la devolución quede acreditada.</p>
        <p style="color:#64748b;font-size:13px">Administración MundoBeat</p>
      </div>`,
    );
    await this.recordHistory(
      order.id,
      OrderHistoryAction.NOTE_ADDED,
      'Administración envió a la tienda un recordatorio por la devolución pendiente al comprador.',
    );
    return { success: true, message: `Notificación enviada a ${vendorEmail}` };
  }

  private async sendVendorManagedCancellationEmails(order: Order): Promise<void> {
    const mail = await this.getMarketplaceMailConfig();
    if (!mail) return;
    const vendor = order.vendorId ? await this.vendorsRepository.findOne({ where: { id: order.vendorId } }) : null;
    const customerEmail = order.customerEmail || order.guestData?.email;
    const amount = Number(order.total).toLocaleString('es-CL');
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const tasks: Promise<any>[] = [];
    if (order.orderSource === 'assisted_sale') {
      const commission = Number(order.assistedCommissionRefundAmount || 0).toLocaleString('es-CL');
      const shipping = Number(order.assistedShippingRefundAmount || 0).toLocaleString('es-CL');
      const pendingLabel = order.assistedReimbursementStatus === 'pending_shipping_cancellation';
      if (customerEmail) tasks.push(this.emailService.sendEmail(withStoreSender(mail.config, vendor?.storeName), customerEmail,
        `Venta asistida cancelada ${order.orderNumber}`,
        `<p>Hola ${this.escapeHtml(order.shippingName || 'cliente')},</p><p>La venta asistida <strong>${this.escapeHtml(order.orderNumber)}</strong> fue cancelada.</p><p>La compra fue pagada directamente a la tienda, por lo que debes coordinar con ella la devolución correspondiente.</p>`));
      if (vendor?.email) tasks.push(this.emailService.sendEmail(mail.config, vendor.email,
        `Venta asistida cancelada ${order.orderNumber}`,
        `<p>La venta asistida <strong>${this.escapeHtml(order.orderNumber)}</strong> fue cancelada.</p><p>La devolución de los productos al comprador se gestiona directamente entre la tienda y el cliente; no debes cargar comprobante en MundoBeat y esta cancelación no genera puntos.</p><p>Reintegro de comisión: $${commission}. ${pendingLabel ? 'El reintegro del envío quedará pendiente hasta que administración confirme la anulación de la etiqueta.' : `Reintegro de envío habilitado: $${shipping}.`}</p>`));
      tasks.push(this.emailService.sendEmail(mail.config, mail.adminEmail,
        `Cancelación de venta asistida: ${order.orderNumber}`,
        `<p>Se canceló la venta asistida <strong>${this.escapeHtml(order.orderNumber)}</strong>.</p><p>Tienda: ${this.escapeHtml(vendor?.storeName || order.vendorId || 'Sin tienda')}</p><p>No requiere comprobante de devolución al comprador ni genera puntos.</p><p>Comisión a reintegrar: $${commission}.</p><p>${pendingLabel ? 'La orden tiene etiqueta: confirma su anulación o crédito antes de habilitar el reintegro del envío.' : `Envío habilitado para reintegro: $${shipping}.`}</p><p><a href="${baseUrl}/panel/orders">Revisar cancelaciones</a></p>`));
      await Promise.allSettled(tasks);
      return;
    }
    if (customerEmail) tasks.push(this.emailService.sendEmail(withStoreSender(mail.config, vendor?.storeName), customerEmail,
      `Pedido cancelado ${order.orderNumber}`,
      `<p>Hola ${this.escapeHtml(order.shippingName || 'cliente')},</p><p>El pedido <strong>${this.escapeHtml(order.orderNumber)}</strong> fue cancelado.</p><p>La tienda deberá devolverte el total pagado de <strong>$${amount}</strong> mediante transferencia. Te informaremos cuando la devolución sea registrada.</p><p><a href="${baseUrl}/mis-pedidos">Consultar mis pedidos</a></p>`));
    if (vendor?.email) tasks.push(this.emailService.sendEmail(mail.config, vendor.email,
      `Debes devolver el pago del pedido ${order.orderNumber}`,
      `<p>El pedido <strong>${this.escapeHtml(order.orderNumber)}</strong> fue cancelado.</p><p>Debes devolver al comprador el total de <strong>$${amount}</strong>. La liquidación se habilitará después de revisar la cancelación. Si es responsabilidad de la tienda, se descontará un 3% por gastos operacionales; si es justificada, se liquidará el 100%.</p><p>Una vez recibido el pago, registra la devolución con su comprobante en el pedido.</p><p><a href="${baseUrl}/dashboard/orders/${order.id}">Gestionar devolución</a></p>`));
    tasks.push(this.emailService.sendEmail(mail.config, mail.adminEmail,
      `Cancelación con devolución por tienda: ${order.orderNumber}`,
      `<p>El pedido <strong>${this.escapeHtml(order.orderNumber)}</strong> fue cancelado.</p><p>Tienda: ${this.escapeHtml(vendor?.storeName || order.vendorId || 'Sin tienda')}</p><p>Debes clasificar la cancelación antes de liquidarla. Si es responsabilidad de la tienda se descontará un 3%; si es justificada será obligatorio adjuntar un respaldo y se liquidará el 100%.</p><p>La tienda deberá devolver $${amount} al comprador.</p><p><a href="${baseUrl}/panel/orders/${order.id}">Revisar pedido</a></p>`));
    await Promise.allSettled(tasks);
  }

  private async sendVendorRefundCompletedEmails(order: Order): Promise<void> {
    const mail = await this.getMarketplaceMailConfig();
    if (!mail) return;
    const vendor = order.vendorId ? await this.vendorsRepository.findOne({ where: { id: order.vendorId } }) : null;
    const customerEmail = order.customerEmail || order.guestData?.email;
    const amount = Number(order.total).toLocaleString('es-CL');
    const tasks: Promise<any>[] = [];
    if (customerEmail) tasks.push(this.emailService.sendEmail(withStoreSender(mail.config, vendor?.storeName), customerEmail,
      `Devolución registrada ${order.orderNumber}`,
      `<p>La tienda informó la devolución de <strong>$${amount}</strong> por el pedido ${this.escapeHtml(order.orderNumber)}.</p><p>Referencia: ${this.escapeHtml(order.vendorCustomerRefundReference || '')}</p>`));
    tasks.push(this.emailService.sendEmail(mail.config, mail.adminEmail,
      `Devolución registrada por tienda: ${order.orderNumber}`,
      `<p>${this.escapeHtml(vendor?.storeName || 'La tienda')} registró la devolución de $${amount} al comprador.</p><p>Referencia: ${this.escapeHtml(order.vendorCustomerRefundReference || '')}</p>`));
    await Promise.allSettled(tasks);
  }

  async getRefunds(): Promise<OrderRefund[]> {
    return this.orderRefundsRepository.find({
      relations: ['order', 'order.items', 'order.items.product', 'order.items.product.vendor'],
      order: { createdAt: 'DESC' },
    });
  }

  async syncRefund(orderId: string): Promise<OrderRefund> {
    const refund = await this.orderRefundsRepository.findOne({ where: { orderId }, relations: ['order'] });
    if (!refund) throw new NotFoundException('Este pedido no tiene un reembolso registrado');
    if (!refund.paykuTransactionId) return refund;
    const response = await this.paykuService.getNullification(refund.paykuTransactionId);
    return this.applyPaykuRefundResponse(refund, response);
  }

  async retryRefund(orderId: string): Promise<OrderRefund> {
    let refund = await this.orderRefundsRepository.findOne({ where: { orderId }, relations: ['order'] });
    if (!refund) {
      throw new BadRequestException('Los reembolsos Payku están en pausa. La devolución debe gestionarla la tienda después de recibir la liquidación.');
    }
    if (refund.status === 'refunded') throw new BadRequestException('El reembolso ya fue completado');
    const order = refund.order || await this.findOne(orderId);
    if (order.status !== OrderStatus.CANCELLED || order.paymentStatus !== 'approved' || !order.paymentTransactionId) {
      throw new BadRequestException('El pedido no reúne las condiciones para un reembolso Payku');
    }
    try {
      const current = await this.paykuService.getNullification(order.paymentTransactionId);
      return this.applyPaykuRefundResponse(refund, current);
    } catch (lookupError: any) {
      const definitelyMissing = /404|no existe|not found|not valid/i.test(lookupError.message || '');
      if (!definitelyMissing) {
        throw new BadRequestException(`No se pudo comprobar si Payku ya recibió la solicitud. No se reenviará para evitar duplicados: ${lookupError.message}`);
      }
    }
    const response = await this.paykuService.createNullification(
      order.paymentTransactionId,
      Number(refund.amount),
      `Reembolso total pedido ${order.orderNumber}`,
    );
    refund.requestedAt = refund.requestedAt || new Date();
    return this.applyPaykuRefundResponse(refund, response);
  }

  @Cron('0 */30 * * * *')
  async syncPendingPaykuRefunds(): Promise<void> {
    const refunds = await this.orderRefundsRepository
      .createQueryBuilder('refund')
      .where('refund.status IN (:...statuses)', { statuses: ['pending_submission', 'submitted', 'processing', 'awaiting_funds', 'waiting_bank_details'] })
      .andWhere('refund.paykuTransactionId IS NOT NULL')
      .getMany();
    for (const refund of refunds) {
      try {
        if (refund.status === 'pending_submission') await this.retryRefund(refund.orderId);
        else await this.syncRefund(refund.orderId);
      } catch (error: any) {
        refund.lastCheckedAt = new Date();
        refund.errorMessage = error.message;
        await this.orderRefundsRepository.save(refund);
      }
    }
  }

  private async scheduleCancelledOrderRefund(orderId: string): Promise<void> {
    const order = await this.findOne(orderId);
    const existing = await this.orderRefundsRepository.findOne({ where: { orderId } });
    if (existing) return;

    const paid = order.paymentStatus === 'approved';
    const isPayku = Boolean(order.paymentTransactionId) && (order.paymentMethod === 'payku' || !order.paymentMethod);
    const refund = this.orderRefundsRepository.create({
      orderId: order.id,
      amount: Number(order.total),
      status: !paid ? 'not_required' : isPayku ? 'pending_submission' : 'manual_review',
      paykuTransactionId: order.paymentTransactionId || null,
    });
    await this.orderRefundsRepository.save(refund);

    if (paid && isPayku) {
      try {
        const response = await this.paykuService.createNullification(
          order.paymentTransactionId,
          Number(order.total),
          `Reembolso total pedido ${order.orderNumber}`,
        );
        refund.requestedAt = new Date();
        await this.applyPaykuRefundResponse(refund, response);
      } catch (error: any) {
        refund.status = 'failed';
        refund.errorMessage = error.message;
        refund.lastCheckedAt = new Date();
        await this.orderRefundsRepository.save(refund);
      }
    }

    await this.sendCancellationEmails(order, refund);
    await this.recordHistory(order.id, OrderHistoryAction.NOTE_ADDED,
      `Reembolso registrado: ${refund.status}${refund.paykuStatus ? ` (Payku: ${refund.paykuStatus})` : ''}`,
      undefined, { refundId: refund.id, amount: refund.amount, status: refund.status, paykuStatus: refund.paykuStatus });
  }

  private async applyPaykuRefundResponse(refund: OrderRefund, response: any): Promise<OrderRefund> {
    const data = Array.isArray(response?.nullify) ? response.nullify[0] : response?.nullify || response;
    const paykuStatus = data?.status_nullify || response?.status || 'pending';
    const previousStatus = refund.status;
    const wasCompleted = Boolean(refund.completedAt);
    refund.paykuStatus = paykuStatus;
    refund.paykuRefundId = data?.id || refund.paykuRefundId || refund.paykuTransactionId;
    refund.paykuResponse = JSON.stringify(response);
    refund.lastCheckedAt = new Date();
    refund.errorMessage = null;
    if (paykuStatus === 'reverse_completed') {
      refund.status = 'refunded';
      refund.completedAt = refund.completedAt || new Date();
    } else if (paykuStatus === 'awaiting_funds') {
      refund.status = 'awaiting_funds';
    } else if (paykuStatus === 'waiting_bank_details') {
      refund.status = 'waiting_bank_details';
    } else if (['reverse_deleted', 'request_deleted'].includes(paykuStatus)) {
      refund.status = 'failed';
    } else {
      refund.status = refund.requestedAt ? 'processing' : 'submitted';
    }
    const saved = await this.orderRefundsRepository.save(refund);
    if (previousStatus !== saved.status) {
      await this.recordHistory(saved.orderId, OrderHistoryAction.NOTE_ADDED,
        `Estado del reembolso actualizado: ${saved.status}${saved.paykuStatus ? ` (Payku: ${saved.paykuStatus})` : ''}`,
        { refundStatus: previousStatus }, { refundStatus: saved.status, paykuStatus: saved.paykuStatus });
    }
    if (!wasCompleted && saved.completedAt) await this.sendRefundCompletedEmail(saved);
    return saved;
  }

  private async getMarketplaceMailConfig() {
    const smtp = (await this.smtpSettingsRepository.find({ order: { updatedAt: 'DESC' } }))
      .find((item) => item.smtpHost && item.smtpUser && item.smtpPassword);
    if (!smtp) return null;
    return {
      config: {
        host: smtp.smtpHost,
        port: smtp.smtpPort || 587,
        secure: smtp.smtpSecure || false,
        user: smtp.smtpUser,
        password: smtp.smtpPassword,
        fromEmail: smtp.smtpFromEmail || smtp.smtpUser,
      fromName: smtp.smtpFromName || 'MundoBeat Marketplace',
      },
      adminEmail: process.env.MARKETPLACE_ADMIN_EMAIL || smtp.smtpFromEmail || smtp.smtpUser,
    };
  }

  private async sendCancellationEmails(order: Order, refund: OrderRefund): Promise<void> {
    if (refund.notificationsSentAt) return;
    const mail = await this.getMarketplaceMailConfig();
    if (!mail) return;
    const vendor = order.vendorId ? await this.vendorsRepository.findOne({ where: { id: order.vendorId } }) : null;
    const customerEmail = order.customerEmail || order.guestData?.email;
    const amount = Number(refund.amount).toLocaleString('es-CL');
    const refundMessage = refund.status === 'not_required'
      ? 'El pedido no tenía un pago aprobado, por lo que no requiere devolución.'
      : refund.status === 'failed'
        ? `No fue posible programar automáticamente la devolución en Payku. El administrador ya fue informado. Detalle: ${this.escapeHtml(refund.errorMessage || '')}`
        : 'La devolución total fue solicitada a Payku. Su avance quedará registrado en el pedido.';
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const tasks: Promise<any>[] = [];
    if (customerEmail) tasks.push(this.emailService.sendEmail(withStoreSender(mail.config, vendor?.storeName), customerEmail,
      `Cancelación y reembolso del pedido ${order.orderNumber}`,
      `<p>Hola ${this.escapeHtml(order.shippingName || 'cliente')},</p><p>El pedido <strong>${this.escapeHtml(order.orderNumber)}</strong> fue cancelado.</p><p><strong>Monto:</strong> $${amount}</p><p>${refundMessage}</p><p><a href="${baseUrl}/mis-pedidos">Consultar mis pedidos</a></p>`));
    if (vendor?.email) tasks.push(this.emailService.sendEmail(mail.config, vendor.email,
      `Pedido cancelado ${order.orderNumber}`,
      `<p>El pedido <strong>${this.escapeHtml(order.orderNumber)}</strong> fue cancelado.</p><p>No se incluirá en tus pagos ni se cobrará comisión. MundoBeat gestionará directamente con Payku la devolución de $${amount} al comprador.</p>`));
    tasks.push(this.emailService.sendEmail(mail.config, mail.adminEmail,
      `Reembolso ${refund.status === 'failed' ? 'requiere atención' : 'programado'}: ${order.orderNumber}`,
      `<p>Se registró la cancelación del pedido <strong>${this.escapeHtml(order.orderNumber)}</strong>.</p><p>Tienda: ${this.escapeHtml(vendor?.storeName || order.vendorId || 'Sin tienda')}</p><p>Monto: $${amount}</p><p>Estado interno: ${this.escapeHtml(refund.status)}</p>${refund.errorMessage ? `<p>Error: ${this.escapeHtml(refund.errorMessage)}</p>` : ''}<p><a href="${baseUrl}/panel/orders/${order.id}">Revisar pedido</a></p>`));
    await Promise.allSettled(tasks);
    refund.notificationsSentAt = new Date();
    await this.orderRefundsRepository.save(refund);
  }

  private async sendRefundCompletedEmail(refund: OrderRefund): Promise<void> {
    const mail = await this.getMarketplaceMailConfig();
    if (!mail) return;
    const order = refund.order || await this.findOne(refund.orderId);
    const vendor = order.vendorId ? await this.vendorsRepository.findOne({ where: { id: order.vendorId }, select: ['storeName'] }) : null;
    const customerEmail = order.customerEmail || order.guestData?.email;
    if (!customerEmail) return;
    await this.emailService.sendEmail(withStoreSender(mail.config, vendor?.storeName), customerEmail,
      `Reembolso completado ${order.orderNumber}`,
      `<p>Payku confirmó la devolución de <strong>$${Number(refund.amount).toLocaleString('es-CL')}</strong> correspondiente al pedido ${this.escapeHtml(order.orderNumber)}.</p><p>La acreditación final depende de los tiempos del medio de pago utilizado.</p>`);
  }

  private escapeHtml(value: string): string {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
  }

  async reviewCancellation(id: string, status: 'justified' | 'vendor_responsible', note: string, adminId: string, verificationUrl?: string): Promise<Order> {
    const order = await this.findOne(id);
    if (order.status !== OrderStatus.CANCELLED || order.cancellationReviewStatus !== 'pending') {
      throw new BadRequestException('Este pedido no tiene una cancelación pendiente de revisión');
    }
    if (status === 'justified' && !verificationUrl) {
      throw new BadRequestException('Debes adjuntar un respaldo para marcar la cancelación como justificada');
    }
    order.cancellationReviewStatus = status;
    order.cancellationReviewNote = note?.trim() || null;
    order.cancellationReviewedById = adminId;
    order.cancellationReviewedAt = new Date();
    order.cancellationVerificationUrl = verificationUrl || null;
    const operationalExpense = status === 'vendor_responsible'
      ? Math.round(Number(order.total) * 0.03)
      : 0;
    order.commissionPercentage = status === 'vendor_responsible' ? 3 : 0;
    order.commissionAmount = operationalExpense;
    order.marketplaceCommission = operationalExpense;
    order.vendorAmount = Math.max(0, Number(order.total) - operationalExpense);
    order.commissionStatus = status === 'vendor_responsible' ? 'operational_expense' : 'refund_to_customer';
    const saved = await this.ordersRepository.save(order);
    await this.recordHistory(id, OrderHistoryAction.NOTE_ADDED,
      `Cancelación revisada: ${status === 'justified' ? 'justificada' : 'responsabilidad de la tienda'}${note ? `. ${note}` : ''}`,
      undefined, { reviewStatus: status, reviewedById: adminId, operationalExpense, verificationUrl: verificationUrl || null });
    return saved;
  }

  async sendCancellationWarning(id: string, adminId: string): Promise<void> {
    const order = await this.findOne(id);
    if (order.cancellationReviewStatus !== 'vendor_responsible') {
      throw new BadRequestException('Primero marca la cancelación como responsabilidad de la tienda');
    }
    if (order.cancellationWarningSentAt) throw new BadRequestException('La advertencia ya fue enviada');
    const vendor = await this.vendorsRepository.findOne({ where: { id: order.vendorId } });
    if (!vendor?.email) throw new BadRequestException('La tienda no tiene correo de contacto');
    const smtpSettings = (await this.smtpSettingsRepository.find({ order: { updatedAt: 'DESC' } }))
      .find((settings) => settings.smtpHost && settings.smtpUser && settings.smtpPassword);
    if (!smtpSettings) throw new BadRequestException('No hay SMTP del marketplace configurado');
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
    await this.emailService.sendEmail({
      host: smtpSettings.smtpHost,
      port: smtpSettings.smtpPort || 587,
      secure: smtpSettings.smtpSecure || false,
      user: smtpSettings.smtpUser,
      password: smtpSettings.smtpPassword,
      fromEmail: smtpSettings.smtpFromEmail || smtpSettings.smtpUser,
      fromName: smtpSettings.smtpFromName || 'MundoBeat',
    }, vendor.email, `Advertencia por cancelación del pedido ${order.orderNumber}`,
    `<p>Hola ${escapeHtml(vendor.storeName || 'tienda')},</p><p>Revisamos la cancelación del pedido <strong>${escapeHtml(order.orderNumber)}</strong> y la clasificamos como responsabilidad de la tienda.</p><p><strong>Motivo:</strong> ${escapeHtml(order.cancellationReason || 'No indicado')}</p>${order.cancellationReviewNote ? `<p><strong>Observación:</strong> ${escapeHtml(order.cancellationReviewNote)}</p>` : ''}<p>Te pedimos revisar tu inventario y tus tiempos de despacho para evitar nuevas cancelaciones. Esta advertencia no genera puntos ni suspende automáticamente tu cuenta.</p><p>Administración MundoBeat</p>`);
    order.cancellationWarningSentAt = new Date();
    await this.ordersRepository.save(order);
    await this.recordHistory(id, OrderHistoryAction.NOTE_ADDED, 'Advertencia por cancelación enviada a la tienda', undefined, { sentById: adminId });
  }

  async update(id: string, updateData: Partial<Order>): Promise<Order> {
    const order = await this.findOne(id);
    const previousValues = { ...order };
    Object.assign(order, updateData);
    await this.ordersRepository.save(order);
    
    // Record changes in history
    const changedFields = Object.keys(updateData);
    if (changedFields.length > 0) {
      await this.recordHistory(
        id,
        OrderHistoryAction.STATUS_CHANGED,
        `Campos actualizados: ${changedFields.join(', ')}`,
        previousValues,
        updateData,
      );
    }
    
    return this.findOne(id);
  }

  async addOrderItem(orderId: string, productId: string, quantity: number, price: number): Promise<Order> {
    await this.discountsService.assertOrderItemsEditable(orderId);
    const order = await this.findOne(orderId);

    // Asegurar que quantity y price son números
    const numQuantity = Number(quantity) || 0;
    const numPrice = Number(price) || 0;

    // Fetch product to get title and image
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    // Crear nuevo item
    const newItem = this.orderItemsRepository.create({
      order,
      productId,
      quantity: numQuantity,
      price: numPrice,
      subtotal: numPrice * numQuantity,
      productTitle: product?.title || 'Producto desconocido',
      productImage: product?.images?.[0] || '',
    });

    const savedItem = await this.orderItemsRepository.save(newItem);

    // Actualizar stock del producto (reducir)
    if (product) {
      product.stock = Math.max(0, (product.stock || 0) - numQuantity);
      await this.productsRepository.save(product);
      if (product.woocommerceId) {
        this.woocommerceService.updateStock(product.id, product.stock).catch(err =>
          console.error(`[OrdersService] WooCommerce stock sync failed for ${product.title}: ${err.message}`),
        );
      }
      this.mercadoLibreService.syncStockFromLocal(product.id).catch(err =>
        console.error(`[OrdersService] Mercado Libre stock sync failed for ${product.title}: ${err.message}`),
      );
    }

    // Registrar en historial
    await this.addHistory(orderId, {
      action: OrderHistoryAction.ITEM_ADDED,
      description: `${product?.title || 'Producto'} agregado al pedido (cantidad: ${numQuantity})`,
      newValues: {
        productTitle: product?.title || 'Producto desconocido',
        quantity: numQuantity,
        price: numPrice,
        subtotal: numPrice * numQuantity,
      },
    });

    // Recalcular totales de la orden
    await this.recalculateOrderTotals(orderId);

    return this.findOne(orderId);
  }

  async removeOrderItem(orderId: string, itemId: string): Promise<Order> {
    await this.discountsService.assertOrderItemsEditable(orderId);
    const item = await this.orderItemsRepository.findOne({
      where: { id: itemId },
      relations: ['product'],
    });

    if (!item) {
      throw new NotFoundException('Order item not found');
    }

    // Guardar valores anteriores para historial
    const previousValues = {
      productTitle: item.productTitle || 'Producto desconocido',
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
    };

    // Restituir stock al producto
    if (item.productId) {
      try {
        const product = await this.productsRepository.findOne({
          where: { id: item.productId },
        });

        if (product) {
          const previousStock = product.stock || 0;
          product.stock = previousStock + item.quantity;
          await this.productsRepository.save(product);

          console.log(`[OrdersService] ✅ Stock restituido: ${item.productTitle} - Cantidad: ${item.quantity} (Stock anterior: ${previousStock}, Stock actual: ${product.stock})`);

          // Registrar en historial la restitución de stock
          await this.recordHistory(orderId, OrderHistoryAction.STOCK_DECREMENTED, 
            `Stock restituido: ${item.productTitle} - Cantidad: ${item.quantity} (Stock anterior: ${previousStock}, Stock actual: ${product.stock})`,
            { productId: item.productId, previousStock },
            { productId: item.productId, newStock: product.stock }
          );

          // Sync stock to WooCommerce if product is linked
          if (product.woocommerceId) {
            this.woocommerceService.updateStock(product.id, product.stock).catch(err =>
              console.error(`[OrdersService] WooCommerce stock sync failed for ${item.productTitle}: ${err.message}`),
            );
          }
          this.mercadoLibreService.syncStockFromLocal(product.id).catch(err =>
            console.error(`[OrdersService] Mercado Libre stock sync failed for ${item.productTitle}: ${err.message}`),
          );
        }
      } catch (error) {
        console.error('[OrdersService] Error al restituir stock:', error);
        // Continuar con la eliminación del item aunque falle la restitución de stock
      }
    }

    await this.orderItemsRepository.remove(item);

    // Registrar en historial
    await this.addHistory(orderId, {
      action: OrderHistoryAction.ITEM_REMOVED,
      description: `${item.productTitle || 'Producto'} eliminado del pedido (cantidad: ${item.quantity})`,
      previousValues,
    });

    // Recalcular totales de la orden
    await this.recalculateOrderTotals(orderId);

    return this.findOne(orderId);
  }

  async updateOrderItem(orderId: string, itemId: string, quantity: number): Promise<Order> {
    await this.discountsService.assertOrderItemsEditable(orderId);
    const item = await this.orderItemsRepository.findOne({
      where: { id: itemId },
      relations: ['product'],
    });

    if (!item) {
      throw new NotFoundException('Order item not found');
    }

    // Asegurar que quantity es un número
    const numQuantity = Number(quantity) || 0;
    const previousQuantity = item.quantity;
    const quantityDifference = numQuantity - previousQuantity;

    // Si la cantidad cambió, ajustar el stock
    if (quantityDifference !== 0 && item.productId) {
      try {
        const product = await this.productsRepository.findOne({
          where: { id: item.productId },
        });

        if (product) {
          const previousStock = product.stock || 0;
          // Si aumenta cantidad, descontar stock; si disminuye, restituir stock
          product.stock = Math.max(0, previousStock - quantityDifference);
          await this.productsRepository.save(product);

          const action = quantityDifference > 0 ? 'descontado' : 'restituido';
          console.log(`[OrdersService] ✅ Stock ${action}: ${item.productTitle} - Cantidad: ${Math.abs(quantityDifference)} (Stock anterior: ${previousStock}, Stock actual: ${product.stock})`);

          // Registrar en historial el ajuste de stock
          await this.recordHistory(orderId, OrderHistoryAction.STOCK_DECREMENTED, 
            `Stock ${action} por cambio de cantidad: ${item.productTitle} - Diferencia: ${quantityDifference > 0 ? '+' : ''}${quantityDifference} (Stock anterior: ${previousStock}, Stock actual: ${product.stock})`,
            { productId: item.productId, previousStock, previousQuantity },
            { productId: item.productId, newStock: product.stock, newQuantity: numQuantity }
          );

          // Sync stock to WooCommerce if product is linked
          if (product.woocommerceId) {
            this.woocommerceService.updateStock(product.id, product.stock).catch(err =>
              console.error(`[OrdersService] WooCommerce stock sync failed for ${item.productTitle}: ${err.message}`),
            );
          }
          this.mercadoLibreService.syncStockFromLocal(product.id).catch(err =>
            console.error(`[OrdersService] Mercado Libre stock sync failed for ${item.productTitle}: ${err.message}`),
          );
        }
      } catch (error) {
        console.error('[OrdersService] Error al ajustar stock:', error);
        // Continuar con la actualización del item aunque falle el ajuste de stock
      }
    }
    
    item.quantity = numQuantity;
    item.subtotal = Number(item.price) * numQuantity;
    await this.orderItemsRepository.save(item);

    // Recalcular totales de la orden
    await this.recalculateOrderTotals(orderId);

    return this.findOne(orderId);
  }

  private async recalculateOrderTotals(orderId: string): Promise<void> {
    const order = await this.findOne(orderId);
    const items = await this.orderItemsRepository.find({
      where: { order: { id: orderId } },
    });

    // Calcular nuevo subtotal - asegurar que son números
    const subtotal = items.reduce((sum, item) => {
      const itemSubtotal = Number(item.subtotal) || 0;
      return sum + itemSubtotal;
    }, 0);

    // Calcular tax (asumiendo 19% si existe tax anterior)
    const previousSubtotal = Number(order.subtotal) || 0;
    const previousTax = Number(order.tax) || 0;
    const taxRate = previousSubtotal > 0 ? (previousTax / previousSubtotal) : 0;
    const tax = subtotal * taxRate;

    // El total sería subtotal + shipping + tax
    const shippingCost = Number(order.shippingCost) || 0;
    const total = subtotal + shippingCost + tax;

    // Actualizar orden con valores numéricos validados
    order.subtotal = Math.round(subtotal * 100) / 100; // Redondear a 2 decimales
    order.tax = Math.round(tax * 100) / 100; // Redondear a 2 decimales
    order.total = Math.round(total * 100) / 100; // Redondear a 2 decimales

    await this.ordersRepository.save(order);
  }

  async addHistory(
    orderId: string,
    historyData: Partial<OrderHistory>,
  ): Promise<void> {
    try {
      console.log(`[addHistory] Starting for order ${orderId}`, historyData);
      
      const data: any = {
        orderId,
        ...historyData,
      };
      
      // Stringify JSON fields
      if (data.previousValues && typeof data.previousValues === 'object') {
        data.previousValues = JSON.stringify(data.previousValues);
      }
      if (data.newValues && typeof data.newValues === 'object') {
        data.newValues = JSON.stringify(data.newValues);
      }
      
      console.log(`[addHistory] Final data:`, JSON.stringify(data, null, 2));
      
      const result = await this.orderHistoryRepository.save(data);
      console.log(`[addHistory] Successfully saved with ID:`, result.id);
    } catch (error) {
      console.error('[addHistory] History logging failed:', error);
    }
  }

  private async recordHistory(
    orderId: string,
    action: OrderHistoryAction,
    description: string,
    previousValues?: any,
    newValues?: any,
  ) {
    try {
      console.log(`[recordHistory] Starting for order ${orderId}, action: ${action}`);
      
      const data: any = {
        orderId,
        action,
        description,
        previousValues: previousValues ? JSON.stringify(previousValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
      };
      
      console.log(`[recordHistory] Data to save:`, JSON.stringify(data, null, 2));
      
      const result = await this.orderHistoryRepository.save(data);
      console.log(`[recordHistory] Successfully saved history entry with ID:`, result.id);
    } catch (error) {
      console.error('[recordHistory] Error recording order history:', error);
    }
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${year}${month}${day}-${random}`;
  }

  private async generateUniqueOrderNumber(): Promise<string> {
    let orderNumber: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      orderNumber = this.generateOrderNumber();
      const existingOrder = await this.ordersRepository.findOne({
        where: { orderNumber },
      });
      
      if (!existingOrder) {
        return orderNumber;
      }
      
      attempts++;
    } while (attempts < maxAttempts);

    // Si después de 10 intentos no se encuentra un número único, usar timestamp
    const timestamp = Date.now();
    return `ORD-${timestamp}`;
  }

  async getOrderHistory(orderId: string): Promise<OrderHistory[]> {
    try {
      const history = await this.orderHistoryRepository.find({
        where: { orderId },
        order: { timestamp: 'DESC' },
      });
      console.log(`[getOrderHistory] Retrieved ${history.length} entries for order ${orderId}`);
      return history;
    } catch (error) {
      console.error(`[getOrderHistory] Error retrieving history for order ${orderId}:`, error);
      return [];
    }
  }

  async addVendorNote(orderId: string, vendorId: string, note: string, createdBy?: string): Promise<OrderHistory> {
    await this.findOneForVendor(orderId, vendorId);
    const normalizedNote = String(note || '').trim();
    if (!normalizedNote) throw new BadRequestException('Debes escribir una nota');
    if (normalizedNote.length > 1000) throw new BadRequestException('La nota no puede superar los 1000 caracteres');

    const entry = this.orderHistoryRepository.create({
      orderId,
      action: OrderHistoryAction.NOTE_ADDED,
      description: normalizedNote,
      newValues: JSON.stringify({ manualOrderNote: true }),
      createdBy,
    });
    return this.orderHistoryRepository.save(entry);
  }

  async createPosOrder(
    dto: CreatePosOrderDto,
    vendorId: string,
    vendorSlug: string,
    posContext: { shiftId: string; registerId: string; staffId: string },
  ): Promise<Order> {
    console.log('🛒 [OrdersService.createPosOrder] Starting POS order for vendor:', vendorId);

    const orderNumber = await this.generateUniqueOrderNumber();

    const orderData: Partial<Order> = {
      orderNumber,
      status: OrderStatus.DELIVERED, // Las ventas POS quedan completadas de inmediato
      subtotal: dto.subtotal,
      shippingCost: 0,
      tax: 0,
      total: dto.total,
      vendorId,
      vendorSlug,
      customerEmail: dto.customerEmail || '',
      paymentMethod: dto.paymentMethod as any,
      shippingName: dto.customerName || 'Venta presencial',
      shippingAddress: 'Punto de venta',
      shippingNumber: '',
      shippingCity: 'Local',
      shippingCountry: 'CL',
      shippingRut: '',
      shippingPhone: dto.customerPhone || '',
      notes: dto.notes || '',
      orderSource: 'pos' as any,
      isMarketplaceSale: false,
      commissionPercentage: 0,
      vendorAmount: dto.total,
      commissionAmount: 0,
      commissionStatus: 'pending',
      paymentStatus: 'approved',
      posShiftId: posContext.shiftId,
      posRegisterId: posContext.registerId,
      posStaffId: posContext.staffId,
    };

    const order = this.ordersRepository.create(orderData);
    const savedOrder = await this.ordersRepository.save(order);

    // Create order items and decrement stock immediately
    const orderItems: OrderItem[] = [];
    for (const item of dto.items) {
      const product = await this.productsRepository.findOne({
        where: { id: item.productId },
        relations: ['vendor'],
      });

      const orderItem = this.orderItemsRepository.create({
        order: savedOrder,
        productId: item.productId,
        vendorId: product?.vendor?.id || vendorId,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
        productTitle: product?.title || 'Producto',
        productImage: product?.images?.[0] || '',
      });
      orderItems.push(orderItem);

      // Decrement stock immediately for POS sales
      if (product) {
        const previousStock = product.stock || 0;
        product.stock = Math.max(0, previousStock - item.quantity);
        await this.productsRepository.save(product);
        console.log(`🛒 [POS] Stock: ${product.title} ${previousStock} -> ${product.stock}`);

        if (product.woocommerceId) {
          this.woocommerceService.updateStock(product.id, product.stock).catch(err =>
            console.error(`[POS] WooCommerce stock sync failed: ${err.message}`),
          );
        }
        this.mercadoLibreService.syncStockFromLocal(product.id).catch(err =>
          console.error(`[POS] Mercado Libre stock sync failed: ${err.message}`),
        );
      }
    }

    await this.orderItemsRepository.save(orderItems);

    const finalOrder = await this.ordersRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['items'],
    });

    console.log('🛒 [POS] Order created:', finalOrder!.orderNumber);
    return finalOrder!;
  }
}
