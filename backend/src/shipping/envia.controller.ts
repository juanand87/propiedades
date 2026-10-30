// ==============================================
// ENVIA.COM - CONTROLADOR API
// ==============================================

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  HttpCode,
  Headers,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IsOptional, IsString, IsBoolean, IsArray, IsObject, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnviaService } from './envia.service';
import { EnviaAddress, EnviaPackage, getRegionCode } from './envia.interface';
import { Order } from '../orders/order.entity';
import { OrderShipment } from '../orders/order-shipment.entity';
import { Commune } from './commune.entity';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import { calculatePackageSummary } from './package-calculator';

// DTOs para requests
class UpdateMarketplaceConfigDto {
  @IsOptional()
  @IsString()
  apiToken?: string;

  @IsOptional()
  @IsString()
  sandboxToken?: string;

  @IsOptional()
  @IsString()
  environment?: 'sandbox' | 'production';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsObject()
  carrierLogos?: Record<string, string>;
}

class EnviaAddressDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsInt()
  regionId?: number;

  @IsOptional()
  @IsInt()
  communeId?: number;
}

class UpdateVendorConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnviaAddressDto)
  origin?: EnviaAddressDto;

  @IsOptional()
  @IsArray()
  enabledCarriers?: string[];

  @IsOptional()
  @IsObject()
  carrierSettings?: Record<string, { enabled: boolean; priority: number; markup: number; customLabel?: string }>;

  @IsOptional()
  @IsString()
  defaultPackageType?: 'box' | 'envelope';

  @IsOptional()
  @IsString()
  defaultWeightUnit?: 'KG' | 'LB';

  @IsOptional()
  @IsString()
  defaultLengthUnit?: 'CM' | 'IN';
}

class QuoteRequestDto {
  vendorId: string;
  destination: EnviaAddress;
  packages: EnviaPackage[];
  carriers?: string[];
}

class GenerateLabelDto {
  orderId: string;
  vendorId: string;
  carrier?: string; // Opcional: si se quiere cambiar el carrier
  service?: string;
}

class QuoteFromCartDto {
  vendorId: string;
  destination: EnviaAddress;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
  }>;
}

class SelectOrderQuoteDto {
  @IsString()
  carrier: string;

  @IsString()
  service: string;
}

@Controller('shipping/envia')
export class EnviaController {
  private readonly logger = new Logger(EnviaController.name);
  
  // Identificador único de instancia para detectar múltiples réplicas
  private readonly INSTANCE_ID = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Contador de requests para esta instancia
  private requestCounter = 0;
  
  // Historial de requests recientes (para detectar duplicados)
  private recentRequests: Map<string, { timestamp: number; count: number }> = new Map();
  
  // Mutex para prevenir generación paralela de la misma orden (con timestamp para auto-limpieza)
  // Expira después de 5 minutos para evitar bloqueos permanentes
  private generatingOrders = new Map<string, number>(); // orderId -> timestamp
  private readonly MUTEX_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

  constructor(
    private readonly enviaService: EnviaService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderShipment)
    private readonly shipmentRepo: Repository<OrderShipment>,
    @InjectRepository(Commune)
    private readonly communeRepo: Repository<Commune>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => WoocommerceService))
    private readonly woocommerceService: WoocommerceService,
  ) {}

  private assertOrderAccess(order: Order, user: any): void {
    if (user?.role !== 'admin' && order.vendorId !== user?.vendorId) {
      throw new HttpException('No tienes acceso a este pedido', HttpStatus.FORBIDDEN);
    }
  }

  private async buildOrderQuoteContext(orderId: string, user: any) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.product.categories'],
    });
    if (!order) throw new HttpException('Pedido no encontrado', HttpStatus.NOT_FOUND);
    this.assertOrderAccess(order, user);
    if (order.enviaTrackingNumber || order.trackingNumber) {
      throw new HttpException('El pedido ya tiene una etiqueta generada', HttpStatus.BAD_REQUEST);
    }
    if (!order.vendorId) throw new HttpException('El pedido no tiene una tienda asociada', HttpStatus.BAD_REQUEST);

    const vendorConfig = await this.enviaService.getVendorConfig(order.vendorId);
    let cityName = order.shippingCommune || order.shippingCity;
    let postalCode = String(
      order.externalOrderData?.shipping?.postcode
      || order.externalOrderData?.billing?.postcode
      || '',
    ).trim();
    let regionCode = getRegionCode(order.shippingRegion || order.shippingCity);

    const communeQuery = this.communeRepo
      .createQueryBuilder('commune')
      .leftJoinAndSelect('commune.region', 'region');
    if (order.shippingCommuneId) {
      communeQuery.where('commune.id = :communeId', { communeId: order.shippingCommuneId });
    } else if (postalCode) {
      communeQuery.where('commune.enviaPostalCode = :postalCode', { postalCode });
    } else {
      communeQuery.where('LOWER(commune.name) = LOWER(:city)', { city: cityName });
    }
    const commune = await communeQuery.getOne();
    if (commune) {
      cityName = commune.name;
      postalCode = commune.enviaPostalCode || postalCode;
      regionCode = getRegionCode(commune.region?.name || order.shippingRegion || order.shippingCity);
    }

    const destination: EnviaAddress = {
      name: order.shippingName,
      phone: order.shippingPhone,
      street: order.shippingAddress,
      number: order.shippingNumber || 'S/N',
      city: cityName,
      state: regionCode,
      country: 'CL',
      postalCode,
      phone_code: 'CL',
      email: order.customerEmail || undefined,
      district: order.shippingCommune || undefined,
      reference: order.notes || undefined,
    };

    const quoteItems = (order.items || []).map((item) => {
      const product = item.product;
      const category = product?.categories?.[0];
      return {
        name: item.productTitle,
        quantity: item.quantity,
        price: Number(item.price) || 0,
        weight: Number(product?.weight || category?.weight) || 0.5,
        length: Number(product?.depth || category?.depth) || 30,
        width: Number(product?.width || category?.width) || 20,
        height: Number(product?.height || category?.height) || 10,
      };
    });
    if (!quoteItems.length) throw new HttpException('El pedido no tiene productos para cotizar', HttpStatus.BAD_REQUEST);

    const consolidatedPackage = this.enviaService.calculateConsolidatedPackage(quoteItems, vendorConfig);
    consolidatedPackage.declaredValue = Math.min(50000, Number(order.subtotal) || consolidatedPackage.declaredValue);

    return { order, destination, packages: [consolidatedPackage] };
  }

  // ========== CONFIGURACIÓN GLOBAL (ADMIN) ==========

  @UseGuards(JwtAuthGuard)
  @Get('config')
  async getMarketplaceConfig() {
    try {
      const config = await this.enviaService.getMarketplaceConfig();
      // No devolver tokens completos por seguridad
      return {
        ...config,
        apiToken: config.apiToken ? '***' + config.apiToken.slice(-4) : null,
        sandboxToken: config.sandboxToken ? '***' + config.sandboxToken.slice(-4) : null,
        webhookSecret: config.webhookSecret ? '********' : null,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('config')
  async updateMarketplaceConfig(@Body() dto: UpdateMarketplaceConfigDto) {
    try {
      console.log('[ENVIA CONTROLLER] Received dto:', JSON.stringify(dto));
      console.log('[ENVIA CONTROLLER] dto keys:', Object.keys(dto));
      await this.enviaService.updateMarketplaceConfig(dto);
      return { success: true, message: 'Configuración actualizada' };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('test-connection')
  async testConnection() {
    try {
      const result = await this.enviaService.testConnection();
      return result;
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('carriers')
  async getAvailableCarriers() {
    return this.enviaService.getAvailableCarriers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('carriers-api')
  async getCarriersFromApi() {
    try {
      const carriers = await this.enviaService.getCarriersFromApi();
      return { success: true, data: carriers };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ========== GEOCODIFICACIÓN ==========

  @UseGuards(JwtAuthGuard)
  @Get('states/:countryCode')
  async getStates(@Param('countryCode') countryCode: string) {
    try {
      const states = await this.enviaService.getStates(countryCode);
      return { success: true, data: states };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('provinces/:countryCode')
  async getProvinces(@Param('countryCode') countryCode: string) {
    try {
      const provinces = await this.enviaService.getProvinces(countryCode);
      return { success: true, data: provinces };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('provinces/:countryCode/:stateCode')
  async getProvincesByState(
    @Param('countryCode') countryCode: string,
    @Param('stateCode') stateCode: string,
  ) {
    try {
      const provinces = await this.enviaService.getProvinces(countryCode, stateCode);
      return { success: true, data: provinces };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('validate-postal/:countryCode/:postalCode')
  async validatePostalCode(
    @Param('countryCode') countryCode: string,
    @Param('postalCode') postalCode: string,
  ) {
    try {
      const result = await this.enviaService.validatePostalCode(countryCode, postalCode);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('locate-city/:countryCode/:cityName')
  async locateCity(
    @Param('countryCode') countryCode: string,
    @Param('cityName') cityName: string,
  ) {
    try {
      const result = await this.enviaService.locateCity(countryCode, cityName);
      return { success: true, data: result };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ========== CONFIGURACIÓN VENDOR ==========

  @UseGuards(JwtAuthGuard)
  @Get('vendor/:vendorId')
  async getVendorConfig(@Param('vendorId') vendorId: string) {
    try {
      return await this.enviaService.getVendorConfig(vendorId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('vendor/:vendorId')
  async updateVendorConfig(
    @Param('vendorId') vendorId: string,
    @Body() dto: UpdateVendorConfigDto,
  ) {
    try {
      console.log('[ENVIA CONTROLLER] Updating vendor config for:', vendorId);
      console.log('[ENVIA CONTROLLER] Received dto:', JSON.stringify(dto));
      console.log('[ENVIA CONTROLLER] dto keys:', Object.keys(dto));
      
      // Map DTO to service format
      const configUpdate: any = {};
      
      if ('enabled' in dto) {
        configUpdate.enabled = dto.enabled;
      }
      
      if (dto.origin) {
        configUpdate.origin = {
          name: dto.origin.name || '',
          phone: dto.origin.phone || '',
          street: dto.origin.street || '',
          city: dto.origin.city || '',
          state: dto.origin.state || '',
          country: dto.origin.country || 'CL',
          postalCode: dto.origin.postalCode || '',
          regionId: dto.origin.regionId,
          communeId: dto.origin.communeId,
        };
      }
      
      if ('enabledCarriers' in dto) {
        configUpdate.enabledCarriers = dto.enabledCarriers;
      }
      
      if ('carrierSettings' in dto) {
        configUpdate.carrierSettings = dto.carrierSettings;
      }
      
      if ('defaultPackageType' in dto) {
        configUpdate.defaultPackageType = dto.defaultPackageType;
      }
      
      if ('defaultWeightUnit' in dto) {
        configUpdate.defaultWeightUnit = dto.defaultWeightUnit;
      }
      
      if ('defaultLengthUnit' in dto) {
        configUpdate.defaultLengthUnit = dto.defaultLengthUnit;
      }
      
      await this.enviaService.updateVendorConfig(vendorId, configUpdate);
      return { success: true, message: 'Configuración de vendor actualizada' };
    } catch (error: any) {
      console.error('[ENVIA CONTROLLER] Error updating vendor config:', error.message);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('vendor/:vendorId/validate-address')
  async validateVendorAddress(@Param('vendorId') vendorId: string) {
    try {
      const config = await this.enviaService.getVendorConfig(vendorId);
      
      if (!config.origin) {
        return { valid: false, errors: ['Dirección de origen no configurada'] };
      }

      return this.enviaService.validateAddress(config.origin);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('vendor/:vendorId/test-quote')
  async testVendorQuote(
    @Param('vendorId') vendorId: string,
    @Body() body: { destination?: EnviaAddress },
  ) {
    try {
      // Destino de prueba por defecto
      const testDestination: EnviaAddress = body.destination || {
        name: 'Cliente Test',
        phone: '+56912345678',
        street: 'Av. Providencia',
        number: '123',
        city: 'Santiago',
        state: 'RM',
        country: 'CL',
        postalCode: '7500000',
      };

      const testPackage: EnviaPackage = {
        type: 'box',
        content: 'Producto de prueba',
        amount: 1,
        declaredValue: 25000,
        weight: 1,
        weightUnit: 'KG',
        lengthUnit: 'CM',
        dimensions: { length: 25, width: 25, height: 15 },
      };

      const quotes = await this.enviaService.getQuote(
        vendorId,
        testDestination,
        [testPackage],
      );

      return {
        success: true,
        options: quotes,
        message: `${quotes.length} opciones de envío encontradas`,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // ========== COTIZACIÓN (CHECKOUT) ==========

  @Post('quote')
  async getQuote(@Body() dto: QuoteRequestDto) {
    try {
      const options = await this.enviaService.getQuote(
        dto.vendorId,
        dto.destination,
        dto.packages,
        dto.carriers,
      );

      return {
        success: true,
        options,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('quote-from-cart')
  async getQuoteFromCart(@Body() dto: QuoteFromCartDto) {
    try {
      const vendorConfig = await this.enviaService.getVendorConfig(dto.vendorId);
      
      // Calcular paquete consolidado
      const consolidatedPackage = this.enviaService.calculateConsolidatedPackage(
        dto.items,
        vendorConfig,
      );

      const options = await this.enviaService.getQuote(
        dto.vendorId,
        dto.destination,
        [consolidatedPackage],
      );

      return {
        success: true,
        options,
        package: consolidatedPackage,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:orderId/quotes')
  async getOrderQuotes(@Param('orderId') orderId: string, @Req() req: any) {
    try {
      const context = await this.buildOrderQuoteContext(orderId, req.user);
      const options = await this.enviaService.getQuote(
        context.order.vendorId,
        context.destination,
        context.packages,
      );
      return { success: true, options };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('orders/:orderId/shipping-option')
  async selectOrderShippingOption(
    @Param('orderId') orderId: string,
    @Body() dto: SelectOrderQuoteDto,
    @Req() req: any,
  ) {
    try {
      const context = await this.buildOrderQuoteContext(orderId, req.user);
      const options = await this.enviaService.getQuote(
        context.order.vendorId,
        context.destination,
        context.packages,
      );
      const selected = options.find((option) =>
        String(option.carrier) === dto.carrier && String(option.service) === dto.service,
      );
      if (!selected) {
        throw new HttpException('La opción seleccionada ya no está disponible', HttpStatus.BAD_REQUEST);
      }

      const quotedPrice = Math.round(Number(selected.totalPrice) || 0);
      const serviceDescription = selected.serviceDescription || selected.service;
      await this.orderRepo.update(context.order.id, {
        shippingMethod: `${selected.carrier} - ${serviceDescription}`,
        shippingMethodCode: `envia-${selected.carrier}-${selected.service}`,
        enviaCarrier: selected.carrier,
        enviaService: selected.service,
        enviaServiceDescription: serviceDescription,
        enviaQuotedPrice: quotedPrice,
        enviaShippingStatus: 'pending',
      });

      return {
        success: true,
        selected: { ...selected, totalPrice: quotedPrice },
        message: 'Empresa de transporte actualizada. La etiqueta aún no ha sido generada.',
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // ========== GENERACIÓN DE ETIQUETA ==========

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateLabel(@Body() dto: GenerateLabelDto) {
    try {
      // TODO: Obtener orden y validar que pertenece al vendor
      // TODO: Obtener datos de destino de la orden
      // TODO: Calcular paquete desde items de la orden
      // Por ahora devolvemos error indicando que falta implementar

      throw new Error('Endpoint en desarrollo - usar generate-from-order');
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // ========== ENDPOINT DE PRUEBA - SIMULAR GENERACIÓN ==========
  // Este endpoint simula la generación de etiquetas SIN llamar a Envia.com
  // para diagnosticar cuántas veces llega la solicitud al backend
  
  private testRequestCount = 0;
  private testRequestLog: Array<{ id: string; time: string; orderId: string }> = [];

  @UseGuards(JwtAuthGuard)
  @Post('test-generate/:orderId')
  async testGenerateLabel(
    @Param('orderId') orderId: string,
  ) {
    this.testRequestCount++;
    const requestId = Math.random().toString(36).substring(7);
    const timestamp = new Date().toISOString();
    
    // LOG MUY VISIBLE
    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log(`║ 🧪 TEST REQUEST #${this.testRequestCount} - ${requestId}`);
    console.log(`║ 📦 Orden: ${orderId}`);
    console.log(`║ 🕐 Time: ${timestamp}`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    this.testRequestLog.push({ id: requestId, time: timestamp, orderId });
    
    // Simular delay de 2 segundos (como si Envia.com respondiera)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      message: `TEST REQUEST #${this.testRequestCount} recibida`,
      requestId,
      timestamp,
      totalRequests: this.testRequestCount,
      allRequests: this.testRequestLog.slice(-20), // Últimas 20 requests
    };
  }

  @Get('test-stats')
  async getTestStats() {
    return {
      totalRequests: this.testRequestCount,
      lastRequests: this.testRequestLog.slice(-50),
    };
  }

  @Post('test-reset')
  async resetTestStats() {
    this.testRequestCount = 0;
    this.testRequestLog = [];
    return { success: true, message: 'Estadísticas reseteadas' };
  }

  // ==========================================
  // DIAGNÓSTICO DE INSTANCIAS Y DUPLICADOS
  // ==========================================
  
  @Get('diagnostics')
  async getDiagnostics() {
    const recentRequestsData: any[] = [];
    for (const [orderId, data] of this.recentRequests.entries()) {
      recentRequestsData.push({
        orderId,
        count: data.count,
        timestamp: new Date(data.timestamp).toISOString(),
        ageSeconds: Math.round((Date.now() - data.timestamp) / 1000),
      });
    }
    
    return {
      instanceId: this.INSTANCE_ID,
      totalRequestsThisInstance: this.requestCounter,
      currentlyGenerating: Array.from(this.generatingOrders),
      recentRequests: recentRequestsData,
      serverTime: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  // Endpoint para eliminar registro fallido y permitir reintento
  @UseGuards(JwtAuthGuard)
  @Post('retry/:orderId')
  async retryGeneration(@Param('orderId') orderId: string) {
    this.logger.log(`[ENVIA] [${this.INSTANCE_ID}] 🔄 Solicitud de reintento para orden: ${orderId}`);
    
    // Buscar y eliminar registros fallidos o en processing
    const existingShipments = await this.shipmentRepo.find({
      where: { orderId },
    });
    
    let deleted = 0;
    for (const shipment of existingShipments) {
      if (shipment.status === 'failed' || shipment.status === 'processing') {
        await this.shipmentRepo.delete(shipment.id);
        deleted++;
        this.logger.log(`[ENVIA] [${this.INSTANCE_ID}] 🗑️ Registro eliminado: ${shipment.id} (status: ${shipment.status})`);
      }
    }
    
    // Limpiar mutex si existe
    this.generatingOrders.delete(orderId);
    
    return {
      success: true,
      message: `Se eliminaron ${deleted} registros. Ahora puedes generar la etiqueta.`,
      deletedCount: deleted,
      instanceId: this.INSTANCE_ID,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate-from-order/:orderId')
  async generateLabelFromOrder(
    @Param('orderId') orderId: string,
    @Body() body: { carrier?: string; service?: string },
    @Req() req: any,
  ) {
    // ==========================================
    // DIAGNÓSTICO AVANZADO - Identificadores únicos
    // ==========================================
    this.requestCounter++;
    const requestNum = this.requestCounter;
    const requestUUID = `${this.INSTANCE_ID}-${requestNum}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Detectar requests duplicadas recientes (últimos 30 segundos)
    const recentKey = orderId;
    const now = Date.now();
    const recent = this.recentRequests.get(recentKey);
    
    if (recent && (now - recent.timestamp) < 30000) {
      recent.count++;
      this.recentRequests.set(recentKey, recent);
      console.log(`\n⚠️⚠️⚠️ POSIBLE DUPLICADO #${recent.count} para orden ${orderId} en ${(now - recent.timestamp) / 1000}s ⚠️⚠️⚠️\n`);
    } else {
      this.recentRequests.set(recentKey, { timestamp: now, count: 1 });
    }
    
    // Limpiar requests antiguas (más de 5 minutos)
    for (const [key, value] of this.recentRequests.entries()) {
      if (now - value.timestamp > 300000) {
        this.recentRequests.delete(key);
      }
    }
    
    // LOG MUY VISIBLE - DEBUG CON INSTANCE ID
    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════╗');
    console.log(`║ 🚨 NUEVA REQUEST ENVIA.COM`);
    console.log(`║ 🖥️  INSTANCE: ${this.INSTANCE_ID} | REQUEST #${requestNum}`);
    console.log(`║ 🔑 UUID: ${requestUUID}`);
    console.log(`║ 📦 Orden: ${orderId}`);
    console.log(`║ 🕐 Time: ${timestamp}`);
    console.log(`║ 📊 Requests recientes para esta orden: ${this.recentRequests.get(recentKey)?.count || 1}`);
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    this.logger.log(`[ENVIA] [${this.INSTANCE_ID}] [REQ#${requestNum}] ===== NUEVA REQUEST ${requestUUID} ===== Orden: ${orderId}`);
    
    // ==========================================
    // PROTECCIÓN TRIPLE CONTRA DUPLICADOS
    // ==========================================
    
    // 1️⃣ MUTEX EN MEMORIA CON TIMEOUT - Primera línea de defensa (rápida)
    const mutexTimestamp = this.generatingOrders.get(orderId);
    
    if (mutexTimestamp) {
      const elapsed = now - mutexTimestamp;
      if (elapsed < this.MUTEX_TIMEOUT_MS) {
        // Aún dentro del tiempo de bloqueo
        const remainingSeconds = Math.ceil((this.MUTEX_TIMEOUT_MS - elapsed) / 1000);
        this.logger.warn(`[ENVIA] [${this.INSTANCE_ID}] ⚠️ MUTEX MEMORIA: Request ${requestUUID} bloqueada, ya hay generación en progreso (${Math.floor(elapsed/1000)}s transcurridos, ${remainingSeconds}s restantes)`);
        return {
          success: false,
          error: `Ya hay una generación de etiqueta en progreso para esta orden. Por favor espera ${remainingSeconds} segundos.`,
          blocked: 'memory_mutex',
          instanceId: this.INSTANCE_ID,
          requestUUID,
          elapsedSeconds: Math.floor(elapsed / 1000),
          remainingSeconds,
        };
      } else {
        // El mutex expiró, limpiarlo y continuar
        this.logger.warn(`[ENVIA] [${this.INSTANCE_ID}] ⚠️ MUTEX EXPIRADO: Limpiando mutex de orden ${orderId} (${Math.floor(elapsed/1000)}s desde el último intento)`);
        this.generatingOrders.delete(orderId);
      }
    }
    
    // 2️⃣ VERIFICACIÓN PRE-LOCK EN BD
    const preCheck = await this.orderRepo.findOne({
      where: { id: orderId },
      select: ['id', 'enviaTrackingNumber', 'enviaShipmentId', 'shippingHandledBy'],
    });

    if (preCheck?.shippingHandledBy === 'vendor') {
      throw new HttpException(
        'Este pedido será enviado por la tienda y ya no permite generar una etiqueta de Envia.com',
        HttpStatus.CONFLICT,
      );
    }
    
    if (preCheck?.enviaTrackingNumber) {
      this.logger.warn(`[ENVIA] ⚠️ PRE-CHECK: Orden ${orderId} ya tiene tracking: ${preCheck.enviaTrackingNumber}`);
      return {
        success: false,
        error: `Ya existe una etiqueta generada. Tracking: ${preCheck.enviaTrackingNumber}`,
        trackingNumber: preCheck.enviaTrackingNumber,
        blocked: 'pre_check',
      };
    }

    const accessOrder = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!accessOrder) throw new HttpException('Pedido no encontrado', HttpStatus.NOT_FOUND);
    this.assertOrderAccess(accessOrder, req.user);
    if (accessOrder.orderSource === 'assisted_sale' && accessOrder.paymentStatus !== 'approved') {
      throw new HttpException('Debes pagar el envío y la comisión antes de generar la etiqueta', HttpStatus.BAD_REQUEST);
    }
    
    // Agregar al mutex de memoria con timestamp
    this.generatingOrders.set(orderId, now);
    this.logger.log(`[ENVIA] 🔒 MUTEX MEMORIA: Orden ${orderId} agregada (expira en 5 min)`);
    
    // 3️⃣ TRANSACCIÓN CON LOCK FOR UPDATE - Garantía a nivel de BD
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      this.logger.log(`[ENVIA] [${this.INSTANCE_ID}] [${requestUUID}] Iniciando transacción con LOCK para orden: ${orderId}`);
      
      // 🔒 LOCK FOR UPDATE - Bloquea la fila de la orden mientras se procesa
      const order = await queryRunner.manager
        .createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write') // FOR UPDATE
        .where('order.id = :orderId', { orderId })
        .getOne();

      if (!order) {
        throw new Error('Orden no encontrada');
      }

      if (order.shippingHandledBy === 'vendor') {
        throw new HttpException(
          'Este pedido será enviado por la tienda y ya no permite generar una etiqueta de Envia.com',
          HttpStatus.CONFLICT,
        );
      }
      
      // 4️⃣ VERIFICACIÓN POST-LOCK - Después de obtener el lock
      if (order.enviaTrackingNumber) {
        this.logger.warn(`[ENVIA] ⚠️ POST-LOCK: Orden ${orderId} ya tiene tracking: ${order.enviaTrackingNumber}`);
        await queryRunner.commitTransaction();
        return {
          success: false,
          error: `Ya existe una etiqueta generada. Tracking: ${order.enviaTrackingNumber}`,
          trackingNumber: order.enviaTrackingNumber,
          blocked: 'post_lock_check',
        };
      }
      
      // Verificar shipment existente
      const existingShipment = await queryRunner.manager.findOne(OrderShipment, {
        where: { orderId },
      });

      if (existingShipment) {
        if (existingShipment.enviaTrackingNumber) {
          this.logger.warn(`[ENVIA] ⚠️ Ya existe etiqueta para orden ${orderId}: ${existingShipment.enviaTrackingNumber}`);
          await queryRunner.commitTransaction();
          return {
            success: false,
            error: `Ya existe una etiqueta generada. Tracking: ${existingShipment.enviaTrackingNumber}`,
            trackingNumber: existingShipment.enviaTrackingNumber,
            labelUrl: existingShipment.enviaLabelUrl,
          };
        }
        
        if (existingShipment.status === 'processing') {
          this.logger.warn(`[ENVIA] ⚠️ Ya se está generando etiqueta para orden ${orderId}`);
          await queryRunner.commitTransaction();
          return {
            success: false,
            error: 'Ya se está generando una etiqueta para esta orden. Por favor espera.',
          };
        }
        
        if (existingShipment.status === 'failed') {
          this.logger.warn(`[ENVIA] ⚠️ Intento previo falló para orden ${orderId}`);
          await queryRunner.commitTransaction();
          return {
            success: false,
            error: 'Hubo un error previo. Usa el botón de reintento para limpiar el estado.',
          };
        }
      }

      if (!order.vendorId) {
        throw new Error('Orden sin vendorId');
      }

      // 🔒 Marcar la orden como "en proceso de etiqueta" DENTRO de la transacción
      await queryRunner.manager.update(Order, order.id, {
        enviaShippingStatus: 'processing',
      });
      
      // Crear placeholder shipment DENTRO de la transacción
      const placeholderShipment = queryRunner.manager.create(OrderShipment, {
        orderId: orderId,
        vendorId: order.vendorId,
        status: 'processing',
        enviaShippingStatus: 'processing',
      });
      await queryRunner.manager.save(placeholderShipment);
      this.logger.log(`[ENVIA] Placeholder shipment creado: ${placeholderShipment.id}`);
      
      // COMMIT de la transacción de lock - ahora tenemos el placeholder creado
      await queryRunner.commitTransaction();
      this.logger.log(`[ENVIA] 🔒 Lock liberado, placeholder creado, procediendo a llamar Envia.com`);

      // =========================================
      // LLAMADA A ENVIA.COM (FUERA DE TRANSACCIÓN)
      // =========================================
      
      // Obtener orden completa con relaciones
      const fullOrder = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['items', 'items.product', 'items.product.categories'],
      });

      if (!fullOrder) {
        throw new Error('Orden no encontrada después del lock');
      }

      this.logger.log(`[ENVIA] Orden encontrada: ${fullOrder.orderNumber}, Vendor: ${fullOrder.vendorId}`);

      // Obtener configuración del vendor
      const vendorConfig = await this.enviaService.getVendorConfig(fullOrder.vendorId);
      
      if (!vendorConfig.enabled) {
        throw new Error('Envia.com no está habilitado para este vendor');
      }

      if (!vendorConfig.origin) {
        throw new Error('Dirección de origen no configurada para el vendor');
      }

      // Obtener código de comuna y región
      let cityName = fullOrder.shippingCommune || fullOrder.shippingCity;
      let postalCode = '';
      let regionCode = 'RM';
      
      if (fullOrder.shippingCommuneId) {
        const commune = await this.communeRepo.findOne({
          where: { id: fullOrder.shippingCommuneId },
          relations: ['region'],
        });
        
        if (commune) {
          cityName = commune.name;
          postalCode = commune.enviaPostalCode || '';
          if (commune.region?.name) {
            regionCode = getRegionCode(commune.region.name);
          }
        }
      } else {
        const externalPostcode = String(
          fullOrder.externalOrderData?.shipping?.postcode
          || fullOrder.externalOrderData?.billing?.postcode
          || '',
        ).trim();
        const communeQuery = this.communeRepo
          .createQueryBuilder('commune')
          .leftJoinAndSelect('commune.region', 'region');
        if (externalPostcode) {
          communeQuery.where('commune.enviaPostalCode = :postcode', { postcode: externalPostcode });
        } else {
          communeQuery.where('LOWER(commune.name) = LOWER(:city)', { city: cityName });
        }
        const commune = await communeQuery.getOne();
        if (commune) {
          cityName = commune.name;
          postalCode = commune.enviaPostalCode || externalPostcode;
          regionCode = getRegionCode(commune.region?.name || fullOrder.shippingRegion || fullOrder.shippingCity);
        } else {
          postalCode = externalPostcode;
          regionCode = getRegionCode(fullOrder.shippingRegion || fullOrder.shippingCity);
        }
      }

      // Construir dirección de destino
      const destination: EnviaAddress = {
        name: fullOrder.shippingName,
        phone: fullOrder.shippingPhone,
        street: fullOrder.shippingAddress,
        number: fullOrder.shippingNumber || 'S/N',
        city: cityName,
        state: regionCode,
        country: 'CL',
        postalCode: postalCode,
        phone_code: 'CL',
        email: fullOrder.customerEmail || undefined,
        district: fullOrder.shippingCommune || undefined,
        reference: fullOrder.notes || undefined,
      };

      this.logger.log(`[ENVIA] 📍 Destination: ${JSON.stringify(destination)}`);

      const packageSummary = calculatePackageSummary(fullOrder.items);

      const orderSubtotal = Number(fullOrder.subtotal) || 0;
      const declaredValue = Math.min(50000, orderSubtotal);
      if (orderSubtotal > declaredValue) {
        this.logger.warn(
          `[ENVIA] Orden ${orderId}: valor declarado limitado de $${orderSubtotal} a $${declaredValue} mientras no se adjunten documentos tributarios`,
        );
      }

      const packages: EnviaPackage[] = [{
        name: 'Paquete 1',
        content: fullOrder.items.map(item => `${item.quantity}x ${item.productTitle}`).join(', '),
        amount: 1, // Cantidad de bultos/paquetes
        declaredValue,
        type: vendorConfig.defaultPackageType,
        weight: packageSummary.weight,
        weightUnit: vendorConfig.defaultWeightUnit,
        lengthUnit: vendorConfig.defaultLengthUnit,
        dimensions: {
          height: packageSummary.height,
          width: packageSummary.width,
          length: packageSummary.length,
        },
      }];

      // Determinar carrier y service
      let carrier = body.carrier || fullOrder.enviaCarrier;
      let service = body.service || fullOrder.enviaService;
      
      if (!carrier && fullOrder.shippingMethodCode) {
        const parts = fullOrder.shippingMethodCode.split('-');
        if (parts.length >= 2 && parts[0] === 'envia') {
          carrier = parts[1];
          if (parts.length >= 3 && !service) {
            service = parts[2];
          }
        }
      }

      if (!carrier) {
        throw new Error('No se pudo determinar el carrier');
      }

      // Las órdenes antiguas con envío gratis podían guardar $0 como cotización.
      // Recuperamos el costo real del mismo carrier/servicio antes de comprar la etiqueta.
      if (Number(fullOrder.enviaQuotedPrice) <= 0) {
        this.logger.warn(`[ENVIA] Orden ${orderId} sin precio interno; recotizando ${carrier}/${service}`);
        const quoteOptions = await this.enviaService.getQuote(
          fullOrder.vendorId,
          destination,
          packages,
          [carrier],
        );
        const selectedQuote = quoteOptions.find((option: any) =>
          !service || String(option.service) === String(service),
        );
        if (!selectedQuote) {
          throw new Error(`Envia.com no devolvió una cotización para ${carrier}/${service || 'servicio seleccionado'}`);
        }
        fullOrder.enviaQuotedPrice = Math.round(Number(selectedQuote.totalPrice) || 0);
        await this.orderRepo.update(fullOrder.id, {
          enviaQuotedPrice: fullOrder.enviaQuotedPrice,
        });
      }

      this.logger.log(`[ENVIA] 🚚 Llamando a Envia.com con carrier: ${carrier}, service: ${service}`);
      this.logger.log(`[ENVIA] 🚚 Esta es la ÚNICA llamada HTTP para orden ${orderId}`);

      // ====== LLAMADA A ENVIA.COM ======
      // Usar orderNumber como referencia para la etiqueta
      const orderReference = fullOrder.orderNumber || `ORD-${orderId}`;
      
      const label = await this.enviaService.generateLabel(
        fullOrder.vendorId,
        destination,
        packages,
        carrier,
        service,
        orderId,
        orderReference, // Número de orden para la etiqueta
      );

      this.logger.log(`[ENVIA] ✅ Etiqueta generada: ${label.trackingNumber}`);

      // Actualizar shipment con datos de etiqueta
      await this.shipmentRepo.update(placeholderShipment.id, {
        vendorId: fullOrder.vendorId,
        shippingMethod: fullOrder.shippingMethod,
        shippingMethodCode: fullOrder.shippingMethodCode,
        shippingCost: fullOrder.shippingCost,
        enviaQuotedPrice: fullOrder.enviaQuotedPrice,
        enviaCarrier: carrier,
        enviaService: service,
        enviaShipmentId: label.shipmentId,
        enviaTrackingNumber: label.trackingNumber,
        enviaLabelUrl: label.labelUrl,
        enviaTrackingUrl: label.trackingUrl,
        enviaFinalPrice: label.totalPrice,
        enviaShippingStatus: 'generated',
        enviaLabelGeneratedAt: new Date(),
        status: 'label_generated',
      });

      // En envío gratis el cliente paga $0, pero la tienda asume el precio real de la etiqueta.
      const finalShippingPrice = Math.round(Number(label.totalPrice) || Number(fullOrder.enviaQuotedPrice) || 0);
      const sellerFundedShipping = Number(fullOrder.shippingCost) === 0
        && String(fullOrder.shippingMethod || '').toLowerCase().includes('gratis')
        ? finalShippingPrice
        : 0;
      const updatedVendorAmount = Math.max(
        0,
        Number(fullOrder.subtotal || 0) - Number(fullOrder.commissionAmount || 0) - sellerFundedShipping,
      );

      // Actualizar orden
      await this.orderRepo.update(fullOrder.id, {
        enviaCarrier: carrier,
        enviaService: service,
        enviaQuotedPrice: finalShippingPrice,
        enviaShipmentId: label.shipmentId,
        enviaTrackingNumber: label.trackingNumber,
        enviaLabelUrl: label.labelUrl,
        enviaTrackingUrl: label.trackingUrl,
        enviaShippingStatus: 'generated',
        enviaLabelGeneratedAt: new Date(),
        trackingNumber: label.trackingNumber,
        status: 'processing' as any,
        vendorAmount: updatedVendorAmount,
      });

      try {
        await this.woocommerceService.syncShippingToWooCommerce(fullOrder.id);
      } catch (syncError: any) {
        this.logger.warn(
          `[ENVIA] La etiqueta se generó, pero no pudo actualizarse WooCommerce: ${syncError.message}`,
        );
      }

      // Liberar mutex de memoria
      this.generatingOrders.delete(orderId);
      this.logger.log(`[ENVIA] 🔓 MUTEX MEMORIA: Orden ${orderId} liberada`);

      return {
        success: true,
        shipmentId: label.shipmentId,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        trackingUrl: label.trackingUrl,
        carrier,
        service,
      };
    } catch (error: any) {
      // Rollback si la transacción aún está activa
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      
      // Liberar mutex de memoria
      this.generatingOrders.delete(orderId);
      this.logger.log(`[ENVIA] 🔓 MUTEX MEMORIA: Orden ${orderId} liberada (error)`);
      
      this.logger.error(`[ENVIA] ❌ Error generando etiqueta: ${error.message}`);
      this.logger.error(error.stack);
      
      // Marcar placeholder como fallido
      try {
        const failedShipment = await this.shipmentRepo.findOne({
          where: { orderId: orderId, status: 'processing' },
        });
        if (failedShipment) {
          await this.shipmentRepo.update(failedShipment.id, {
            status: 'failed',
            enviaShippingStatus: 'failed',
          });
          this.logger.log(`[ENVIA] Placeholder marcado como fallido: ${failedShipment.id}`);
        }
      } catch (cleanupError) {
        this.logger.error(`[ENVIA] Error actualizando placeholder: ${cleanupError.message}`);
      }
      
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    } finally {
      // Siempre liberar el queryRunner
      await queryRunner.release();
    }
  }

  // ========== TRACKING ==========

  @Get('track/:trackingNumber')
  async getTracking(@Param('trackingNumber') trackingNumber: string) {
    try {
      const tracking = await this.enviaService.getTracking(trackingNumber);
      return {
        success: true,
        ...tracking,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync-order/:orderId')
  async syncOrderTracking(@Param('orderId') orderId: string) {
    try {
      const result = await this.enviaService.syncOrderTracking(orderId);
      return result;
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error syncing order ${orderId}: ${error.message}`);
      return {
        success: false,
        message: `Error al sincronizar: ${error.message}`,
        statusChanged: false,
      };
    }
  }

  // ========== WEBHOOK ==========

  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  checkWebhookConnection() {
    return { received: true, ready: true };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Req() req: any,
    @Headers('x-webhook-signature') webhookSignature?: string,
    @Headers('x-envia-signature') legacySignature?: string,
    @Headers('x-webhook-event') event?: string,
    @Headers('x-webhook-timestamp') timestamp?: string,
  ) {
    const signature = webhookSignature || legacySignature;
    const hasSignedHeaders = Boolean(signature || event || timestamp);

    if (hasSignedHeaders) {
      const validSignature = Boolean(
        signature
        && event
        && timestamp
        && req.rawBody
        && await this.enviaService.verifyTrackingWebhookSignature(
          req.rawBody,
          event,
          timestamp,
          signature,
        ),
      );
      if (!validSignature) {
        this.logger.warn('[ENVIA] Webhook rechazado por firma inválida o incompleta');
        throw new HttpException('Firma de webhook inválida', HttpStatus.UNAUTHORIZED);
      }
    }

    if (!hasSignedHeaders) {
      this.logger.log('[ENVIA] Prueba de webhook recibida sin firma; conexión confirmada sin procesar datos');
      return { received: true, test: true };
    }

    // Envia requiere respuesta inmediata; el cron de respaldo cubre errores posteriores.
    void this.enviaService.processTrackingWebhook(payload).catch((error: any) => {
      this.logger.error(`[ENVIA] Error procesando webhook en segundo plano: ${error.message}`);
    });

    return { received: true };
  }
}
