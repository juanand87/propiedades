import { Controller, Get, Post, Query, Body, Param, Headers, Req, Inject, forwardRef } from '@nestjs/common';
import { FlowService } from './flow.service';
import { PaykuService } from './payku.service';
import { OrdersService } from '../orders/orders.service';
import { Order, OrderStatus } from '../orders/order.entity';
import { ProductsService } from '../products/products.service';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import type { Request } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(
    private flowService: FlowService,
    private paykuService: PaykuService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
    private productsService: ProductsService,
    @Inject(forwardRef(() => WoocommerceService))
    private woocommerceService: WoocommerceService,
  ) {}

  @Post('flow/confirm')
  async confirmFlowPayment(@Body('token') token: string) {
    try {
      const paymentStatus = await this.flowService.getPaymentStatus(token);
      
      // Find order by token
      const orders = await this.ordersService.findAll();
      const order = orders.find(o => o.paymentTransactionId === token);
      
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      // Update order based on payment status
      // Flow status codes: 1=pending, 2=approved, 3=rejected, 4=cancelled
      if (paymentStatus.status === 2) {
        order.paymentStatus = 'approved';
      } else if (paymentStatus.status === 3) {
        order.paymentStatus = 'rejected';
      } else if (paymentStatus.status === 4) {
        order.paymentStatus = 'cancelled';
      } else {
        order.paymentStatus = 'pending';
      }

      // Save payment status first
      await this.ordersService.update(order.id, order as any);
      
      // Update status separately to trigger email sending
      if (paymentStatus.status === 2) {
        await this.ordersService.updateStatus(order.id, OrderStatus.PROCESSING);
      } else if (paymentStatus.status === 3) {
        await this.ordersService.updateStatus(order.id, OrderStatus.PENDING);
      } else if (paymentStatus.status === 4) {
        await this.ordersService.updateStatus(order.id, OrderStatus.CANCELLED);
      }

      // Reload order with relations (product and vendor) so frontend can redirect to vendor store
      const enrichedOrder = await this.ordersService.findOne(order.id);

      return { success: true, order: enrichedOrder };
    } catch (error) {
      console.error('Flow confirmation error:', error);
      return { success: false, message: error.message };
    }
  }

  @Get('flow/status/:orderId')
  async getFlowPaymentStatus(@Param('orderId') orderId: string) {
    try {
      const order = await this.ordersService.findOne(orderId);
      
      if (!order || !order.paymentTransactionId) {
        return { success: false, message: 'Order or payment not found' };
      }

      const status = await this.flowService.getPaymentStatus(order.paymentTransactionId);
      return { success: true, status, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('payku/check-status/:orderId')
  async checkPaykuStatus(@Param('orderId') orderId: string) {
    try {
      console.log('[PaymentController] Checking Payku status for order:', orderId);
      
      const order = await this.ordersService.findOne(orderId);
      
      if (!order || !order.paymentTransactionId) {
        return { success: false, message: 'Order or payment not found' };
      }

      // Get transaction status from Payku
      const paykuStatus = await this.paykuService.getTransactionStatus(order.paymentTransactionId);
      console.log('[PaymentController] Payku status response:', paykuStatus);

      // Update order based on Payku status
      if (paykuStatus.status === 'success') {
        order.paymentStatus = 'approved';
        
        await this.ordersService.addHistory(order.id, {
          action: 'payment_approved',
          description: '✅ Pago verificado y aprobado'
        });
        
        // Save payment status and use updateStatus() to trigger email + stock reduction
        await this.ordersService.update(order.id, order as any);
        await this.ordersService.updateStatus(order.id, OrderStatus.PROCESSING);
      } else if (paykuStatus.status === 'failed' || paykuStatus.status === 'rejected' || paykuStatus.status === 'cancelled') {
        order.paymentStatus = 'failed';
        
        await this.ordersService.update(order.id, order as any);
        await this.ordersService.updateStatus(order.id, OrderStatus.PENDING);
        
        await this.ordersService.addHistory(order.id, {
          action: 'payment_rejected',
          description: '❌ Pago cancelado o rechazado'
        });
      } else if (paykuStatus.status === 'expired') {
        order.paymentStatus = 'failed';
        
        await this.ordersService.update(order.id, order as any);
        await this.ordersService.updateStatus(order.id, OrderStatus.PENDING);
        
        await this.ordersService.addHistory(order.id, {
          action: 'payment_expired',
          description: '⏱️ Tiempo de pago expirado'
        });
      }
      
      // Reload order with relations (already saved by updateStatus)
      const enrichedOrder = await this.ordersService.findOne(order.id);

      return { success: true, status: paykuStatus, order: enrichedOrder };
    } catch (error) {
      console.error('[PaymentController] Error checking Payku status:', error);
      return { success: false, message: error.message };
    }
  }

  @Post('payku/retry-payment/:orderId')
  async retryPaykuPayment(@Param('orderId') orderId: string, @Body() body: { originHostname?: string }) {
    try {
      console.log('[PaymentController] Retrying Payku payment for order:', orderId);
      console.log('[PaymentController] 🌐 Origin hostname from retry:', body.originHostname);
      
      const order = await this.ordersService.findOne(orderId);
      
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      // ✅ VALIDACIÓN: No permitir reintento si ya está pagado
      if (order.paymentStatus === 'approved') {
        console.log('[PaymentController] Order already paid, blocking retry');
        return { 
          success: false, 
          message: 'Este pedido ya ha sido pagado exitosamente',
          alreadyPaid: true 
        };
      }

      // ✅ VALIDACIÓN: Si tiene transactionId, verificar estado en Payku primero
      if (order.paymentTransactionId) {
        console.log('[PaymentController] Checking Payku status before retry...');
        try {
          const paykuStatus = await this.paykuService.getTransactionStatus(order.paymentTransactionId);
          
          if (paykuStatus.status === 'success') {
            // El pago YA fue exitoso, usar updateStatus() para trigger email + stock
            order.paymentStatus = 'approved';
            await this.ordersService.update(order.id, order as any);
            await this.ordersService.updateStatus(order.id, OrderStatus.PROCESSING);
            
            console.log('[PaymentController] Payment already completed in Payku');
            return { 
              success: false, 
              message: 'Tu pago ya fue procesado exitosamente. Recarga la página para ver la confirmación.',
              alreadyPaid: true 
            };
          }
        } catch (error) {
          console.warn('[PaymentController] Could not verify Payku status, proceeding with retry:', error.message);
        }
      }

      // Load customer info
      const customerEmail = order.customer?.email || order.vendorEmail || 'no-email@example.com';

      // Reset payment status to pending for new attempt
      order.paymentStatus = 'pending';
      order.paymentTransactionId = '';
      order.paymentUrl = '';
      
      await this.ordersService.update(order.id, order as any);

      // Create new Payku payment (centralized - all to marketplace)
      const paykuResponse = await this.paykuService.createMarketplaceTransaction({
        orderId: order.id,
        customerEmail: customerEmail,
        totalAmount: order.total,
        subject: `Pedido #${order.orderNumber}`,
        vendorId: order.vendorId,
        vendorSlug: order.vendorSlug,
        originHostname: body.originHostname, // 🌐 Pass originHostname for custom domain support
      });

      // Update order with new payment info
      order.paymentUrl = paykuResponse.url;
      order.paymentTransactionId = paykuResponse.transactionId;
      
      await this.ordersService.update(order.id, order as any);
      
      await this.ordersService.addHistory(order.id, {
        action: 'payment_retry',
        description: '🔄 Reintento de pago iniciado'
      });

      console.log('[PaymentController] Payment retry successful. New URL:', paykuResponse.url);

      // Reload order with relations
      const enrichedOrder = await this.ordersService.findOne(order.id);

      return { 
        success: true, 
        paymentUrl: paykuResponse.url,
        transactionId: paykuResponse.transactionId,
        order: enrichedOrder 
      };
    } catch (error) {
      console.error('[PaymentController] Error retrying Payku payment:', error);
      return { success: false, message: error.message };
    }
  }

  @Post('payku/webhook')
  async paykuWebhook(
    @Headers('x-payku-signature') signature: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    try {
      console.log('[PaymentController] Payku webhook received');
      console.log('[PaymentController] Headers:', req.headers);
      console.log('[PaymentController] Body:', body);

      // Step 1: Validate origin IP (Payku's IP)
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || 
                       req.headers['do-connecting-ip']?.toString() ||
                       req.connection.remoteAddress;
      
      console.log('[PaymentController] Request from IP:', clientIp);
      
      // Payku uses IP 35.188.95.14 for webhooks
      const paykuIps = ['35.188.95.14', '35.188.95.0/24']; // Allow subnet
      const isFromPayku = clientIp === '35.188.95.14' || clientIp?.startsWith('35.188.95.');
      
      if (!isFromPayku) {
        console.warn('[PaymentController] ⚠️ Webhook from unknown IP:', clientIp);
        // Continue anyway but log it
      }

      // Extract transaction data
      const { transaction_id, payment_key, status, order: webhookOrderId, verification_key } = body;
      
      console.log('[PaymentController] Webhook data:', {
        transaction_id,
        payment_key,
        status,
        order: webhookOrderId,
        verification_key: verification_key ? 'present' : 'missing'
      });

      // Step 2: Verify transaction with Payku API
      if (!payment_key) {
        console.error('[PaymentController] ❌ Missing payment_key in webhook');
        return { success: false, message: 'Missing payment_key' };
      }

      console.log('[PaymentController] 🔍 Verifying transaction with Payku API...');
      let paykuStatus;
      try {
        paykuStatus = await this.paykuService.getTransactionStatus(payment_key);
        console.log('[PaymentController] ✅ Payku API response:', paykuStatus);
      } catch (error) {
        console.error('[PaymentController] ❌ Failed to verify with Payku API:', error.message);
        return { success: false, message: 'Failed to verify transaction with Payku' };
      }

      // Step 3: Verify status matches
      const apiStatus = paykuStatus.status;
      if (apiStatus !== status) {
        console.error('[PaymentController] ⚠️ Status mismatch! Webhook:', status, 'API:', apiStatus);
        // Use API status as source of truth
        console.log('[PaymentController] Using API status as source of truth:', apiStatus);
      }

      const finalStatus = apiStatus; // API is source of truth
      const order_id = webhookOrderId || paykuStatus.order;

      console.log('[PaymentController] Processing transaction:', payment_key);
      console.log('[PaymentController] Order ID from webhook:', order_id);
      console.log('[PaymentController] Final status:', finalStatus);

      // Find all orders with this orderNumber or transaction ID
      // For grouped marketplace orders, multiple orders share the same orderNumber
      const allOrders = await this.ordersService.findAll();
      let ordersToUpdate: Order[] = allOrders.filter(o => 
        o.orderNumber === order_id || // Direct match by orderNumber
        o.paymentTransactionId === payment_key || // Or by payment key
        o.paymentTransactionId === transaction_id || // Or by transaction ID
        o.id === order_id // Legacy: or by UUID
      );

      // Load items relation for each order (needed for stock reduction)
      for (let i = 0; i < ordersToUpdate.length; i++) {
        ordersToUpdate[i] = await this.ordersService.findOne(ordersToUpdate[i].id);
      }

      if (ordersToUpdate.length === 0) {
        console.error('[PaymentController] No orders found for webhook');
        return { success: false, message: 'Orders not found' };
      }

      const isMultiOrder = ordersToUpdate.length > 1;
      console.log(`[PaymentController] Found ${ordersToUpdate.length} order(s) to update${isMultiOrder ? ' (grouped marketplace order)' : ''}`);
      console.log('[PaymentController] Orders:', ordersToUpdate.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        vendorId: o.vendorId,
        total: o.total,
      })));

      // Update all orders with the same payment status
      for (const order of ordersToUpdate) {
        console.log('[PaymentController] Updating order:', order.id);
        
        if (finalStatus === 'success') {
          order.paymentStatus = 'approved';
          if (order.orderSource === 'assisted_sale') {
            order.assistedSaleStatus = 'platform_payment_paid';
            order.commissionStatus = 'paid';
          }
          // Status will be updated later using updateStatus() to trigger email

          // Parse order details
          const splitDetails = JSON.parse(order.splitDetails || '{}');
          const commissionRate = splitDetails.commissionRate || 10;
          const vendorAmount = splitDetails.vendorAmount || 0;
          
          let historyDescription = order.orderSource === 'assisted_sale'
            ? `PAGO DE ENVÍO Y COMISIÓN CONFIRMADO\n`
            : `✅ PAGO CONFIRMADO\n`;
          historyDescription += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          historyDescription += `💰 Total pagado: $${Number(order.platformChargeAmount || order.total).toLocaleString('es-CL')}\n`;
          historyDescription += `💵 A pagar al vendedor: $${vendorAmount.toLocaleString('es-CL')}\n`;
          historyDescription += `📊 Comisión marketplace: ${commissionRate}%\n\n`;
          historyDescription += `📝 El marketplace recibió el pago\n`;
          historyDescription += `⏳ Administrador procesará la liquidación y transferencia al vendedor`;
          
          if (isMultiOrder) {
            const grandTotal = ordersToUpdate.reduce((sum, o) => sum + o.total, 0);
            const paymentReference = order.checkoutSessionId || order.orderNumber;
            historyDescription = `✅ PAGO AGRUPADO CONFIRMADO\n`;
            historyDescription += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            historyDescription += `🛍️ Múltiples tiendas (${ordersToUpdate.length})\n`;
            historyDescription += `💰 Total del grupo: $${grandTotal.toLocaleString('es-CL')}\n`;
            historyDescription += `💵 Esta orden: $${order.total.toLocaleString('es-CL')}\n`;
            historyDescription += `💳 Referencia: ${paymentReference}\n\n`;
            historyDescription += `✓ El marketplace recibió el pago completo\n`;
            historyDescription += `⏳ El administrador procesará liquidaciones y transferencias`;
          }

          await this.ordersService.addHistory(order.id, {
            action: 'payment_approved',
            description: historyDescription,
            changedFields: JSON.stringify({
              paymentStatus: order.paymentStatus,
              status: order.status,
              paymentType: 'centralized',
              isMultiOrder,
            }),
          });

          // Stock reduction and email sending are handled by updateStatus()
          
        } else if (finalStatus === 'failed' || finalStatus === 'rejected') {
          order.paymentStatus = 'rejected';
          if (order.orderSource !== 'assisted_sale') order.status = OrderStatus.PENDING;
          
          await this.ordersService.addHistory(order.id, {
            action: 'payment_rejected',
            description: '❌ Pago rechazado por Payku',
          });
        } else if (finalStatus === 'cancelled') {
          order.paymentStatus = 'cancelled';
          if (order.orderSource !== 'assisted_sale') order.status = OrderStatus.CANCELLED;
          
          await this.ordersService.addHistory(order.id, {
            action: 'payment_cancelled',
            description: '🚫 Pago cancelado',
          });
        } else {
          order.paymentStatus = 'pending';
        }

        // Save payment status first
        await this.ordersService.update(order.id, order as any);
        
        // Update status separately to trigger email sending (if status = PROCESSING)
        if (finalStatus === 'success' && order.orderSource !== 'assisted_sale') {
          await this.ordersService.updateStatus(order.id, OrderStatus.PROCESSING);
        }
      }

      console.log('[PaymentController] All orders updated from Payku webhook');
      return { success: true };
    } catch (error) {
      console.error('[PaymentController] Payku webhook error:', error);
      return { success: false, message: error.message };
    }
  }

  @Get('payku/status/:orderId')
  async getPaykuPaymentStatus(@Param('orderId') orderId: string) {
    try {
      // Try to find by UUID first, then by orderNumber
      let order: Order | null = null;
      
      // Check if it's a UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      
      if (isUUID) {
        order = await this.ordersService.findOne(orderId);
      } else {
        // It's an orderNumber like ORD-20260216-9935
        const allOrders = await this.ordersService.findAll();
        order = allOrders.find(o => o.orderNumber === orderId) || null;
      }

      if (!order || !order.paymentTransactionId) {
        return { success: false, message: 'Order or payment not found' };
      }

      const status = await this.paykuService.getTransactionStatus(
        order.paymentTransactionId,
      );
      return { success: true, status, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('payku/methods')
  async getPaykuPaymentMethods() {
    try {
      const methods = await this.paykuService.getAvailablePaymentMethods();
      return { success: true, methods };
    } catch (error) {
      console.error('[PaymentController] Error getting Payku payment methods:', error);
      return { success: false, message: error.message, methods: [] };
    }
  }

  @Get('payku/transaction/:transactionId/marketplace')
  async getPaykuMarketplaceDetails(@Param('transactionId') transactionId: string) {
    try {
      const details = await this.paykuService.getTransactionMarketplaceDetails(transactionId);
      return { success: true, ...details };
    } catch (error) {
      console.error('[PaymentController] Error getting marketplace details:', error);
      return { success: false, message: error.message };
    }
  }

  // DESARROLLO: Endpoint para simular webhook de Payku (solo para pruebas)
  @Post('payku/simulate-webhook/:orderId')
  async simulatePaykuWebhook(
    @Param('orderId') orderId: string,
    @Body() body: { status?: string },
  ) {
    try {
      const status = body.status || 'success';
      console.log('[PaymentController] Simulating Payku webhook for order:', orderId, 'with status:', status);

      const order = await this.ordersService.findOne(orderId);

      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      // Actualizar estado según el parámetro
      if (status === 'success') {
        order.paymentStatus = 'approved';
        order.status = 'processing' as any;

        // Add history entry with marketplace split details
        const splitDetails = JSON.parse(order.splitDetails || '{}');
        const commissionRate = splitDetails.commissionRate || 10;
        const vendorAmount = splitDetails.vendorAmount || 0;
        const marketplaceCommission = splitDetails.marketplaceCommission || 0;
        const vendorToken = splitDetails.paykuAffiliationToken || null;
        
        let historyDescription = `✅ Pago aprobado - Total: $${order.total.toLocaleString('es-CL')}\n\n`;
        
        // If vendor has affiliation token, assume split was applied
        if (vendorToken) {
          historyDescription += `🔄 DIVISIÓN AUTOMÁTICA DE PAGO (Payku Marketplace)\n`;
          historyDescription += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          historyDescription += `💰 Venta total: $${order.total.toLocaleString('es-CL')}\n`;
          historyDescription += `📊 Comisión marketplace: ${commissionRate}% ($${marketplaceCommission.toLocaleString('es-CL')})\n`;
          historyDescription += `💵 Depósito al vendedor: $${vendorAmount.toLocaleString('es-CL')}\n\n`;
          historyDescription += `🎯 Token de afiliación: ${vendorToken}\n`;
          historyDescription += `✓ El pago se dividió automáticamente según la configuración de Payku Marketplace\n`;
          historyDescription += `✓ El vendedor recibirá $${vendorAmount.toLocaleString('es-CL')} en su cuenta\n`;
          historyDescription += `✓ El marketplace recibirá $${marketplaceCommission.toLocaleString('es-CL')} como comisión\n\n`;
          historyDescription += `ℹ️ Verifica el correo de confirmación de Payku para confirmar la distribución`;
        } else {
          historyDescription += `⚠️ DIVISIÓN MANUAL DE PAGO\n`;
          historyDescription += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          historyDescription += `💰 Venta total: $${order.total.toLocaleString('es-CL')}\n`;
          historyDescription += `📊 Comisión marketplace: ${commissionRate}% ($${marketplaceCommission.toLocaleString('es-CL')})\n`;
          historyDescription += `💵 A depositar al vendedor: $${vendorAmount.toLocaleString('es-CL')}\n\n`;
          historyDescription += `⚠️ Este pago NO se dividió automáticamente en Payku\n`;
          historyDescription += `⚠️ El vendedor no tiene configurado token de afiliación\n`;
          historyDescription += `⚠️ Se debe realizar transferencia manual al vendedor`;
        }

        await this.ordersService.addHistory(order.id, {
          action: 'payment_approved',
          description: historyDescription,
          changedFields: JSON.stringify({
            paymentStatus: order.paymentStatus,
            status: order.status,
            vendorToken,
          }),
        });
        
      } else if (status === 'failed' || status === 'rejected') {
        order.paymentStatus = 'failed';
        order.status = OrderStatus.PENDING;
        
        await this.ordersService.addHistory(order.id, {
          action: 'payment_rejected',
          description: '❌ Pago rechazado o cancelado por el cliente',
        });
      } else if (status === 'cancelled') {
        order.paymentStatus = 'cancelled';
        order.status = OrderStatus.CANCELLED;
        
        await this.ordersService.addHistory(order.id, {
          action: 'payment_cancelled',
          description: '🚫 Pago cancelado',
        });
      }

      await this.ordersService.update(order.id, order as any);

      console.log('[PaymentController] Order updated via simulated webhook');
      console.log('[PaymentController] New status:', order.paymentStatus);

      return { 
        success: true, 
        message: 'Webhook simulado exitosamente',
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          status: order.status,
        }
      };
    } catch (error) {
      console.error('[PaymentController] Simulate webhook error:', error);
      return { success: false, message: error.message };
    }
  }

  @Post('payku/create-multi-order-payment')
  async createMultiOrderPaykuPayment(@Body() body: { orderIds: string[], paymentMethod: string, originHostname?: string }) {
    try {
      console.log('[PaymentController] Creating multi-order Payku payment:', body.orderIds);

      const { orderIds, paymentMethod, originHostname } = body;

      if (!orderIds || orderIds.length === 0) {
        return { success: false, message: 'No order IDs provided' };
      }

      // Load all orders
      const orders = await Promise.all(
        orderIds.map(id => this.ordersService.findOne(id))
      );

      // Validate all orders exist
      if (orders.some(o => !o)) {
        return { success: false, message: 'One or more orders not found' };
      }

      const checkoutSessionIds = [...new Set(orders.map(o => o.checkoutSessionId).filter(Boolean))];
      const hasCheckoutSessionId = checkoutSessionIds.length === 1;
      const sharedCheckoutSessionId = hasCheckoutSessionId ? checkoutSessionIds[0] : null;

      if (hasCheckoutSessionId) {
        console.log('[PaymentController] 📋 Shared checkout session for Payku:', sharedCheckoutSessionId);
      } else {
        // Backward compatibility for older orders that do not yet have checkoutSessionId
        const orderNumbers = [...new Set(orders.map(o => o.orderNumber))];
        if (orderNumbers.length !== 1) {
          console.error('[PaymentController] Orders do not share the same checkout session or orderNumber:', {
            checkoutSessionIds,
            orderNumbers,
          });
          return { success: false, message: 'Orders must share the same checkout session for multi-vendor payment' };
        }
      }

      const existingPaymentUrl = orders[0].paymentUrl;
      const existingTransactionId = orders[0].paymentTransactionId;
      const allShareSamePayment = orders.every(order =>
        order.paymentUrl === existingPaymentUrl &&
        order.paymentTransactionId === existingTransactionId &&
        order.paymentUrl &&
        order.paymentTransactionId,
      );

      if (allShareSamePayment) {
        console.log('[PaymentController] ♻️ Reusing existing multi-order payment transaction:', existingTransactionId);
        return {
          success: true,
          paymentUrl: existingPaymentUrl,
          transactionId: existingTransactionId,
          totalAmount: orders.reduce((sum, order) => sum + Number(order.total), 0),
          orderIds,
          reused: true,
        };
      }

      // Calculate total amount from ALL orders
      const totalAmount = orders.reduce((sum, order) => sum + Number(order.total), 0);
      console.log('[PaymentController] 💰 Total amount for multi-order payment (sum of all orders):', totalAmount);
      console.log('[PaymentController] 📦 Orders breakdown:', orders.map(o => ({ id: o.id, orderNumber: o.orderNumber, total: o.total })));

      // Use first order data for customer info
      const firstOrder = orders[0];
      const customerEmail = firstOrder.customer?.email || firstOrder.customerEmail;

      const paymentReference = sharedCheckoutSessionId || firstOrder.orderNumber;
      console.log('[PaymentController] 📋 Payment reference for Payku:', paymentReference);
      console.log('[PaymentController] 🌐 Origin hostname from request body:', originHostname);

      // ⚠️ IMPORTANTE: Para pagos multi-vendedor, NO usar el sistema de división de Payku
      // porque solo soporta 1 vendedor por transacción. En su lugar, crear una transacción
      // simple donde el marketplace recibe TODO el pago y después distribuye manualmente.
      
      // Create Payku transaction WITHOUT marketplace split (simple transaction)
      const paykuResponse = await this.paykuService.createMarketplaceTransaction({
        orderId: paymentReference,
        customerEmail,
        originHostname, // 🌐 Pass originHostname for correct domain redirect
        totalAmount, // Total completo de TODAS las órdenes
        subject: `Pedido ${paymentReference} (${orders.length} tienda${orders.length > 1 ? 's' : ''})`,
        vendorId: 'MARKETPLACE', // No es un vendedor específico
        vendorSlug: 'marketplace',
      });

      // Update all orders with payment info
      for (const order of orders) {
        order.paymentUrl = paykuResponse.url;
        order.paymentTransactionId = paykuResponse.transactionId;
        order.paymentStatus = 'pending';
        
        await this.ordersService.update(order.id, order as any);
        
        // Add history entry with clear explanation
        const historyDescription = `💳 PAGO AGRUPADO INICIADO\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🛍️ Orden agrupada con ${orders.length} tienda${orders.length > 1 ? 's' : ''}\n` +
          `📋 Referencia de pago: ${paymentReference}\n` +
          `�💰 Total del grupo: $${totalAmount.toLocaleString('es-CL')}\n` +
          `💵 Total esta orden: $${order.total.toLocaleString('es-CL')}\n\n` +
          `⚠️ Este es un pago multi-vendedor\n` +
          `⚠️ El marketplace recibirá el pago completo\n` +
          `⚠️ La distribución a cada vendedor se hará manualmente\n\n` +
          `🔗 ID de transacción: ${paykuResponse.transactionId}`;
        
        await this.ordersService.addHistory(order.id, {
          action: 'payment_initiated',
          description: historyDescription,
        });
      }

      console.log('[PaymentController] ✅ Multi-order payment created successfully');
      console.log('[PaymentController] 💳 Transaction ID:', paykuResponse.transactionId);
      console.log('[PaymentController] 💰 Total amount:', totalAmount);
      console.log('[PaymentController] 🔗 Payment URL:', paykuResponse.url);

      return {
        success: true,
        paymentUrl: paykuResponse.url,
        transactionId: paykuResponse.transactionId,
        totalAmount,
        orderIds,
      };
    } catch (error) {
      console.error('[PaymentController] Error creating multi-order payment:', error);
      return { success: false, message: error.message };
    }
  }
}
