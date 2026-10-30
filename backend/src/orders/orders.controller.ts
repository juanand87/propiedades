import { Controller, Get, Header, Post, Body, Param, Patch, Delete, UseGuards, UseInterceptors, UploadedFile, Request, UnauthorizedException, BadRequestException, Query, Headers } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrdersService } from './orders.service';
import { StorageService } from '../storage/storage.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { ConfirmAssistedTransferDto, CreateAssistedOrderDto } from './dto/create-assisted-order.dto';
import { OrderStatus } from './order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PosService } from '../pos/pos.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly storageService: StorageService,
    private readonly posService: PosService,
  ) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    console.log('📥 [OrdersController.create] Received order request');
    console.log('📥 [OrdersController.create] vendorId:', createOrderDto.vendorId);
    console.log('📥 [OrdersController.create] items:', createOrderDto.items?.length);
    return this.ordersService.create(createOrderDto);
  }

  @Post('pos')
  async createPos(
    @Body() dto: CreatePosOrderDto,
    @Headers('x-pos-token') posToken?: string,
    @Headers('x-pos-shift-id') posShiftId?: string,
  ) {
    const session = await this.posService.sessionFromToken(posToken);
    const shift = await this.posService.requireOpenShift(session, posShiftId);
    const store = await this.posService.getStore(session.vendorId);
    return this.ordersService.createPosOrder(dto, session.vendorId, store.slug, {
      shiftId: shift.id,
      registerId: shift.registerId,
      staffId: shift.staffId,
    });
  }

  @Post('assisted')
  @UseGuards(JwtAuthGuard)
  async createAssisted(@Body() dto: CreateAssistedOrderDto, @Request() req: any) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    return this.ordersService.createAssistedOrder(dto, user.vendor);
  }

  @Post('assisted/:orderId/confirm-transfer')
  @UseGuards(JwtAuthGuard)
  async confirmAssistedTransfer(
    @Param('orderId') orderId: string,
    @Body() dto: ConfirmAssistedTransferDto,
    @Request() req: any,
  ) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    return this.ordersService.confirmAssistedTransfer(orderId, user.vendor.id, dto);
  }

  @Post('assisted/:orderId/transfer-received')
  @UseGuards(JwtAuthGuard)
  async receiveAssistedTransfer(@Param('orderId') orderId: string, @Body() dto: ConfirmAssistedTransferDto, @Request() req: any) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    return this.ordersService.receiveAssistedTransfer(orderId, user.vendor.id, dto);
  }

  @Post('assisted/:orderId/start-processing')
  @UseGuards(JwtAuthGuard)
  async startAssistedProcessing(@Param('orderId') orderId: string, @Request() req: any) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    return this.ordersService.startAssistedProcessing(orderId, user.vendor.id);
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('marketplace')
  @UseGuards(JwtAuthGuard)
  findMarketplaceOrders(@Request() req: any) {
    console.log('🔍 DEBUG findMarketplaceOrders - User:', req.user);
    console.log('🔍 DEBUG findMarketplaceOrders - Role:', req.user?.role);
    if (req.user.role !== 'admin') {
      throw new UnauthorizedException('Solo administradores pueden ver órdenes del marketplace');
    }
    return this.ordersService.findMarketplaceOrders();
  }

  @Get('stores')
  @UseGuards(JwtAuthGuard)
  findVendorStoresOrders(@Request() req: any) {
    if (req.user.role !== 'admin') {
      throw new UnauthorizedException('Solo administradores pueden ver órdenes de tiendas');
    }
    return this.ordersService.findVendorStoresOrders();
  }

  @Get('refunds')
  @UseGuards(JwtAuthGuard)
  getRefunds(@Request() req: any) {
    if (req.user.role !== 'admin') throw new UnauthorizedException('Solo administradores pueden revisar reembolsos');
    return this.ordersService.getRefunds();
  }

  @Post(':id/refund/sync')
  @UseGuards(JwtAuthGuard)
  syncRefund(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'admin') throw new UnauthorizedException('Solo administradores pueden sincronizar reembolsos');
    return this.ordersService.syncRefund(id);
  }

  @Post(':id/refund/retry')
  @UseGuards(JwtAuthGuard)
  retryRefund(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'admin') throw new UnauthorizedException('Solo administradores pueden reintentar reembolsos');
    return this.ordersService.retryRefund(id);
  }

  @Get('vendor/mine')
  @UseGuards(JwtAuthGuard)
  async findMyOrders(@Request() req: any, @Query('source') source?: string) {
    // Get user with vendor relation
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user || !user.vendor) {
      throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    }
    return this.ordersService.findByVendor(user.vendor.id, source);
  }

  @Get('vendor/estado-cuenta')
  @UseGuards(JwtAuthGuard)
  async getEstadoCuenta(
    @Request() req: any,
    @Query('period') period: string,
    @Query('fechaDesde') fechaDesde: string,
    @Query('fechaHasta') fechaHasta: string,
  ) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user || !user.vendor) {
      throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    }
    return this.ordersService.findVendorEstadoCuenta(user.vendor.id, {
      period,
      fechaDesde,
      fechaHasta,
    });
  }

  @Get('vendor/mine/:orderId')
  @Header('Cache-Control', 'private, no-store, no-cache, must-revalidate')
  @UseGuards(JwtAuthGuard)
  async findMyOrder(@Param('orderId') orderId: string, @Request() req: any) {
    // Get user with vendor relation
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user || !user.vendor) {
      throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    }
    return this.ordersService.findOneForVendor(orderId, user.vendor.id);
  }

  @Get('customer/:email/stats')
  async getCustomerStats(@Param('email') email: string) {
    return this.ordersService.getCustomerStats(email);
  }

  @Get('customer/:email/history')
  async getCustomerHistory(@Param('email') email: string) {
    return this.ordersService.getCustomerHistory(email);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  async getOrderHistory(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para ver este pedido');
    }
    return this.ordersService.getOrderHistory(id);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard)
  async addOrderNote(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    return this.ordersService.addVendorNote(id, user.vendor.id, body.note || '', req.user.sub);
  }

  // Endpoints para editar items - ANTES de los genéricos :id
  @Post(':id/items')
  @UseGuards(JwtAuthGuard)
  async addOrderItem(
    @Param('id') id: string,
    @Body() data: { productId: string; quantity: number; price: number },
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (order.status !== 'pending') {
      throw new UnauthorizedException('Solo puedes modificar órdenes en estado pendiente');
    }
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para modificar este pedido');
    }
    return this.ordersService.addOrderItem(id, data.productId, data.quantity, data.price);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  async removeOrderItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (order.status !== 'pending') {
      throw new UnauthorizedException('Solo puedes modificar órdenes en estado pendiente');
    }
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para modificar este pedido');
    }
    return this.ordersService.removeOrderItem(id, itemId);
  }

  @Patch(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  async updateOrderItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() data: { quantity: number },
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (order.status !== 'pending') {
      throw new UnauthorizedException('Solo puedes modificar órdenes en estado pendiente');
    }
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para modificar este pedido');
    }
    return this.ordersService.updateOrderItem(id, itemId, data.quantity);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para modificar este pedido');
    }
    // Vendors can only change status freely for POS orders; online orders remain cancel-only.
    const isPosOrder = order.orderSource === 'pos';
    if (req.user.role !== 'admin' && !isPosOrder && status !== OrderStatus.CANCELLED) {
      throw new UnauthorizedException('Solo puedes cancelar pedidos');
    }
    if (status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Para cancelar utiliza la acción Cancelar pedido e indica el motivo');
    }
    return this.ordersService.updateStatus(id, status);
  }

  @Patch(':id/external-shipping/delivered')
  @UseGuards(JwtAuthGuard)
  async completeVendorManagedShipping(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para modificar este pedido');
    }
    return this.ordersService.completeVendorManagedShipping(id, order.vendorId);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelOrder(
    @Param('id') id: string,
    @Body() body: { reason: string; note?: string },
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para cancelar este pedido');
    }
    if (!body.reason) {
      throw new UnauthorizedException('Debes indicar el motivo de cancelación');
    }
    if (req.user.role !== 'admin') {
      const allowedReasons = ['Quiebre de stock', 'Cliente solicitó cancelación', 'Error en publicación', 'No puedo despachar', 'Otro'];
      if (!allowedReasons.includes(body.reason)) throw new BadRequestException('Motivo de cancelación inválido');
      if (body.reason === 'Otro' && !body.note?.trim()) throw new BadRequestException('Debes describir el motivo de cancelación');
    }
    return this.ordersService.cancelOrder(id, body.reason, body.note, req.user.sub, req.user.role);
  }

  @Patch(':id/cancellation-review')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('verificador', {
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async reviewCancellation(
    @Param('id') id: string,
    @Body() body: { status: 'justified' | 'vendor_responsible'; note?: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    if (req.user.role !== 'admin') throw new UnauthorizedException('Solo administradores pueden revisar cancelaciones');
    if (!['justified', 'vendor_responsible'].includes(body.status)) throw new BadRequestException('Estado de revisión inválido');
    const verificationUrl = file
      ? (await this.storageService.uploadFile(file, 'comprobantes/cancelaciones')).url
      : undefined;
    return this.ordersService.reviewCancellation(id, body.status, body.note || '', req.user.sub, verificationUrl);
  }

  @Post(':id/assisted-reimbursement/confirm-shipping-cancellation')
  @UseGuards(JwtAuthGuard)
  async confirmAssistedShippingCancellation(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'admin') throw new UnauthorizedException('Solo administradores pueden confirmar la anulación del envío');
    return this.ordersService.confirmAssistedShippingCancellation(id, req.user.sub);
  }

  @Post(':id/customer-refund')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('comprobante', {
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async registerCustomerRefund(
    @Param('id') id: string,
    @Body() body: { reference: string; note?: string; refundedAt?: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    const proofUrl = file
      ? (await this.storageService.uploadFile(file, 'comprobantes/devoluciones')).url
      : undefined;
    return this.ordersService.registerVendorCustomerRefund(id, user.vendor.id, body, proofUrl);
  }

  @Post(':id/sales-receipt')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('boleta', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return callback(new BadRequestException('La boleta debe ser una imagen JPG, PNG, WEBP o un archivo PDF'), false);
      }
      callback(null, true);
    },
  }))
  async uploadSalesReceipt(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    if (!file) throw new BadRequestException('Debes adjuntar una boleta');

    await this.ordersService.findOneForVendor(id, user.vendor.id);
    const uploaded = (await this.storageService.uploadFile(file, 'comprobantes/boletas')).url;
    const backendUrl = (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/api\/?$/, '').replace(/\/$/, '');
    const receiptUrl = uploaded.startsWith('/uploads/') ? `${backendUrl}${uploaded}` : uploaded;
    return this.ordersService.updateSalesReceipt(id, user.vendor.id, receiptUrl);
  }

  @Get('receipts/:token')
  async resolveSalesReceipt(@Param('token') token: string) {
    return this.ordersService.resolveSalesReceipt(token);
  }

  @Post(':id/sales-receipt/qr')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('qr', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => callback(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)),
  }))
  async uploadQrSalesReceipt(@Param('id') id: string, @Body('url') url: string, @UploadedFile() file: Express.Multer.File | undefined, @Request() req: any) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    if (!file) throw new BadRequestException('Adjunta una imagen QR en formato PNG, JPG o WEBP');
    return this.ordersService.saveQrSalesReceipt(id, user.vendor.id, url, file);
  }

  @Patch(':id/sales-receipt')
  @UseGuards(JwtAuthGuard)
  async linkSalesReceipt(@Param('id') id: string, @Body('url') url: string, @Request() req: any) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    return this.ordersService.updateSalesReceipt(id, user.vendor.id, url);
  }

  @Post(':id/external-shipping')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('captura', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return callback(new BadRequestException('La captura debe ser una imagen JPG, PNG o WEBP'), false);
      }
      callback(null, true);
    },
  }))
  async useExternalShipping(
    @Param('id') id: string,
    @Body() body: { reason: string; reasonDetail?: string; carrier: string; trackingNumber: string; trackingUrl?: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    const user = await this.ordersService.getUserWithVendor(req.user.sub);
    if (!user?.vendor) throw new UnauthorizedException('Tu cuenta no está asociada a una tienda');
    await this.ordersService.validateExternalShipping(id, user.vendor.id, body);
    const evidenceUrl = file
      ? (await this.storageService.uploadFile(file, 'comprobantes/envios-externos')).url
      : undefined;
    return this.ordersService.useExternalShipping(id, user.vendor.id, body, evidenceUrl);
  }

  @Post(':id/cancellation-warning')
  @UseGuards(JwtAuthGuard)
  async sendCancellationWarning(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'admin') throw new UnauthorizedException('Solo administradores pueden enviar advertencias');
    await this.ordersService.sendCancellationWarning(id, req.user.sub);
    return { success: true };
  }

  @Patch(':id/tracking')
  @UseGuards(JwtAuthGuard)
  async updateTracking(
    @Param('id') id: string,
    @Body('trackingNumber') trackingNumber: string,
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para modificar este pedido');
    }
    return this.ordersService.updateTrackingNumber(id, trackingNumber);
  }

  @Post(':id/send-pending-reminder')
  @UseGuards(JwtAuthGuard)
  async sendPendingReminder(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const order = await this.ordersService.findOne(id);
    if (req.user.role !== 'admin' && order.vendorId !== req.user.vendorId) {
      throw new UnauthorizedException('No tienes permisos para enviar recordatorios de este pedido');
    }
    return this.ordersService.sendManualPendingReminder(id, req.user.sub);
  }

  @Get('by-number/:orderNumber')
  findByOrderNumber(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.findByOrderNumber(orderNumber);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Request() req: any) {
    if (req.user.role !== 'admin') {
      throw new UnauthorizedException('Solo administradores pueden ver cualquier pedido');
    }
    return this.ordersService.findOne(id);
  }

  @Get('vendor/:vendorId')
  @UseGuards(JwtAuthGuard)
  findByVendor(@Param('vendorId') vendorId: string, @Request() req: any) {
    console.log('[OrdersController] findByVendor called with vendorId:', vendorId);
    console.log('[OrdersController] req.user:', req.user);
    
    if (req.user.role !== 'admin' && req.user.vendorId !== vendorId) {
      throw new UnauthorizedException('No tienes permisos para acceder a esta tienda');
    }
    
    console.log('[OrdersController] About to call ordersService.findByVendor');
    return this.ordersService.findByVendor(vendorId);
  }
}
