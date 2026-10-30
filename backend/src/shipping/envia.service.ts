// ==============================================
// ENVIA.COM - SERVICIO PRINCIPAL
// ==============================================

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { MarketplaceSettings } from '../marketplace/marketplace-settings.entity';
import { Vendor } from '../vendors/vendor.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { OrderShipment } from '../orders/order-shipment.entity';
import { WoocommerceService } from '../woocommerce/woocommerce.service';
import {
  EnviaAddress,
  EnviaPackage,
  EnviaQuoteRequest,
  EnviaQuoteResponse,
  EnviaQuoteOption,
  EnviaGenerateLabelRequest,
  EnviaGenerateLabelResponse,
  EnviaTrackingResponse,
  EnviaMarketplaceConfig,
  EnviaVendorConfig,
  CHILE_CARRIERS,
} from './envia.interface';
import {
  extractEnviaTrackingWebhook,
  shouldApplyEnviaShippingStatus,
  verifyEnviaWebhookSignature,
} from './envia-webhook.util';

@Injectable()
export class EnviaService {
  private readonly logger = new Logger(EnviaService.name);
  private axiosInstance: AxiosInstance | null = null;
  private config: EnviaMarketplaceConfig | null = null;
  private fallbackSyncRunning = false;

  constructor(
    @InjectRepository(MarketplaceSettings)
    private marketplaceSettingsRepo: Repository<MarketplaceSettings>,
    @InjectRepository(Vendor)
    private vendorRepo: Repository<Vendor>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(OrderShipment)
    private shipmentRepo: Repository<OrderShipment>,
    private readonly moduleRef: ModuleRef,
  ) {}

  private async syncWooCommerceShipping(orderId: string): Promise<void> {
    try {
      const service = this.moduleRef.get(WoocommerceService, { strict: false });
      await service.syncShippingToWooCommerce(orderId);
    } catch (error: any) {
      this.logger.warn(`[ENVIA] No se pudo sincronizar el envío con WooCommerce: ${error.message}`);
    }
  }

  // ========== CONFIGURACIÓN ==========

  /**
   * Obtener configuración global de Envia.com del marketplace
   */
  async getMarketplaceConfig(): Promise<EnviaMarketplaceConfig> {
    const settings = await this.marketplaceSettingsRepo.find({
      where: [
        { settingKey: 'envia_api_token' },
        { settingKey: 'envia_sandbox_token' },
        { settingKey: 'envia_environment' },
        { settingKey: 'envia_enabled' },
        { settingKey: 'envia_webhook_url' },
        { settingKey: 'envia_webhook_secret' },
        { settingKey: 'envia_api_url' },
        { settingKey: 'envia_api_test_url' },
        { settingKey: 'envia_carrier_logos' },
      ],
    });

    const getValue = (key: string, defaultValue: string = ''): string => {
      const setting = settings.find(s => s.settingKey === key);
      return setting?.settingValue || defaultValue;
    };

    let carrierLogos: Record<string, string> = {};
    const carrierLogosRaw = getValue('envia_carrier_logos', '{}');
    try {
      const parsed = JSON.parse(carrierLogosRaw || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        carrierLogos = parsed;
      }
    } catch {
      carrierLogos = {};
    }

    return {
      apiToken: getValue('envia_api_token') || null,
      sandboxToken: getValue('envia_sandbox_token') || null,
      environment: getValue('envia_environment', 'sandbox') as 'sandbox' | 'production',
      enabled: getValue('envia_enabled', 'false') === 'true',
      webhookUrl: getValue('envia_webhook_url') || null,
      webhookSecret: getValue('envia_webhook_secret') || null,
      apiUrl: getValue('envia_api_url', 'https://api.envia.com/'),
      apiTestUrl: getValue('envia_api_test_url', 'https://api-test.envia.com/'),
      carrierLogos,
    };
  }

  /**
   * Actualizar configuración global de Envia.com
   */
  async updateMarketplaceConfig(config: Partial<EnviaMarketplaceConfig>): Promise<void> {
    this.logger.log(`[ENVIA] updateMarketplaceConfig called with: ${JSON.stringify(config)}`);
    
    const keyMap: Record<string, string> = {
      apiToken: 'envia_api_token',
      sandboxToken: 'envia_sandbox_token',
      environment: 'envia_environment',
      enabled: 'envia_enabled',
      webhookUrl: 'envia_webhook_url',
      webhookSecret: 'envia_webhook_secret',
      carrierLogos: 'envia_carrier_logos',
    };

    for (const [key, dbKey] of Object.entries(keyMap)) {
      if (key in config) {
        let value: any = config[key as keyof EnviaMarketplaceConfig];
        if (typeof value === 'boolean') {
          value = value ? 'true' : 'false';
        }
        if (key === 'carrierLogos' && value && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        
        this.logger.log(`[ENVIA] Updating ${dbKey} = ${key === 'apiToken' || key === 'sandboxToken' ? '***hidden***' : value}`);
        
        // Buscar el setting existente
        const existing = await this.marketplaceSettingsRepo.findOne({
          where: { settingKey: dbKey },
        });
        
        if (existing) {
          // Actualizar
          this.logger.log(`[ENVIA] Found existing setting ${dbKey}, updating...`);
          existing.settingValue = value as string;
          await this.marketplaceSettingsRepo.save(existing);
          this.logger.log(`[ENVIA] Updated ${dbKey} successfully`);
        } else {
          // Crear nuevo
          this.logger.log(`[ENVIA] Setting ${dbKey} not found, creating new...`);
          const newSetting = this.marketplaceSettingsRepo.create({
            settingKey: dbKey,
            settingValue: value as string,
            description: `Envia.com - ${key}`,
          });
          await this.marketplaceSettingsRepo.save(newSetting);
          this.logger.log(`[ENVIA] Created ${dbKey} successfully`);
        }
      }
    }

    // Resetear instancia para que use nueva config
    this.axiosInstance = null;
    this.config = null;
    this.logger.log(`[ENVIA] Config update complete`);
  }

  /**
   * Obtener configuración de Envia.com de un vendor
   */
  async getVendorConfig(vendorId: string): Promise<EnviaVendorConfig> {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    
    if (!vendor) {
      throw new Error('Vendor no encontrado');
    }

    this.logger.log(`[ENVIA] getVendorConfig for vendor ${vendorId}:`, {
      enviaEnabled: vendor.enviaEnabled,
      enviaOriginName: vendor.enviaOriginName,
      enviaOriginCity: vendor.enviaOriginCity,
      enviaOriginState: vendor.enviaOriginState,
      enviaOriginPostalCode: vendor.enviaOriginPostalCode,
    });

    // Mapear código de región chileno (I, II, XIV, etc.) a código ISO 3166-2 que usa Envia.com
    const regionStateMap: Record<string, string> = {
      'XV': 'AP',    // Arica y Parinacota
      'I': 'TA',     // Tarapacá
      'II': 'AN',    // Antofagasta
      'III': 'AT',   // Atacama
      'IV': 'CO',    // Coquimbo
      'V': 'VS',     // Valparaíso
      'VI': 'LI',    // Libertador General Bernardo O'Higgins
      'VII': 'ML',   // Maule
      'VIII': 'BI',  // Biobío
      'IX': 'AR',    // Araucanía
      'X': 'LL',     // Los Lagos
      'XI': 'AI',    // Aysén
      'XII': 'MA',   // Magallanes
      'XIII': 'RM',  // Metropolitana
      'XIV': 'LR',   // Los Ríos
      'XVI': 'NB',   // Ñuble
    };

    const originStateCode = vendor.enviaOriginState 
      ? (regionStateMap[vendor.enviaOriginState] || vendor.enviaOriginState)
      : 'RM';

    return {
      enabled: vendor.enviaEnabled || false,
      origin: vendor.enviaOriginName ? {
        name: vendor.enviaOriginName,
        phone: vendor.enviaOriginPhone || '',
        street: vendor.enviaOriginStreet || '',
        number: vendor.enviaOriginNumber || 'S/N',
        city: vendor.enviaOriginCity || '',
        state: originStateCode, // Usar código ISO convertido
        country: vendor.enviaOriginCountry || 'CL',
        postalCode: vendor.enviaOriginPostalCode || '',
        // regionId y communeId son solo para uso interno, NO enviar a API de Envia/carriers
        regionId: vendor.enviaOriginRegionId || undefined,
        communeId: vendor.enviaOriginCommuneId || undefined,
        // Campos opcionales adicionales
        company: vendor.storeName || undefined,
        email: vendor.email || undefined,
        phone_code: 'CL',
        district: vendor.enviaOriginCity || undefined, // Usando city como district/comuna
      } : null,
      enabledCarriers: vendor.enviaEnabledCarriers || [],
      carrierSettings: vendor.enviaCarrierSettings || {},
      defaultPackageType: (vendor.enviaDefaultPackageType as 'box' | 'envelope') || 'box',
      defaultWeightUnit: (vendor.enviaDefaultWeightUnit as 'KG' | 'LB') || 'KG',
      defaultLengthUnit: (vendor.enviaDefaultLengthUnit as 'CM' | 'IN') || 'CM',
    };
  }

  /**
   * Actualizar configuración de Envia.com de un vendor
   */
  async updateVendorConfig(vendorId: string, config: Partial<EnviaVendorConfig>): Promise<void> {
    this.logger.log(`[ENVIA] updateVendorConfig called for vendor ${vendorId}`);
    this.logger.log(`[ENVIA] config received: ${JSON.stringify(config)}`);
    
    const updateData: Partial<Vendor> = {};

    // Envia.com siempre habilitado (es el único método de envío)
    updateData.enviaEnabled = true;
    this.logger.log(`[ENVIA] enviaEnabled always set to true`);

    if (config.origin) {
      updateData.enviaOriginName = config.origin.name;
      updateData.enviaOriginPhone = config.origin.phone;
      updateData.enviaOriginStreet = config.origin.street;
      updateData.enviaOriginCity = config.origin.city;
      updateData.enviaOriginState = config.origin.state;
      updateData.enviaOriginCountry = config.origin.country;
      updateData.enviaOriginPostalCode = config.origin.postalCode;
      updateData.enviaOriginRegionId = config.origin.regionId || undefined;
      updateData.enviaOriginCommuneId = config.origin.communeId || undefined;
      this.logger.log(`[ENVIA] Setting origin: ${config.origin.name}, ${config.origin.city}, ${config.origin.state}, regionId=${config.origin.regionId}, communeId=${config.origin.communeId}`);
    }

    if ('enabledCarriers' in config) {
      updateData.enviaEnabledCarriers = config.enabledCarriers;
      this.logger.log(`[ENVIA] Setting enabledCarriers: ${JSON.stringify(config.enabledCarriers)}`);
    }

    if ('carrierSettings' in config) {
      updateData.enviaCarrierSettings = config.carrierSettings;
    }

    if ('defaultPackageType' in config) {
      updateData.enviaDefaultPackageType = config.defaultPackageType;
    }

    if ('defaultWeightUnit' in config) {
      updateData.enviaDefaultWeightUnit = config.defaultWeightUnit;
    }

    if ('defaultLengthUnit' in config) {
      updateData.enviaDefaultLengthUnit = config.defaultLengthUnit;
    }

    this.logger.log(`[ENVIA] Final updateData: ${JSON.stringify(updateData)}`);
    
    const result = await this.vendorRepo.update(vendorId, updateData);
    this.logger.log(`[ENVIA] Update result: affected=${result.affected}`);
    
    // Verificar que se guardó correctamente
    const updatedVendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    this.logger.log(`[ENVIA] Verification - Vendor after update:`, {
      enviaEnabled: updatedVendor?.enviaEnabled,
      enviaOriginName: updatedVendor?.enviaOriginName,
      enviaOriginCity: updatedVendor?.enviaOriginCity,
      enviaOriginState: updatedVendor?.enviaOriginState,
      enviaOriginPostalCode: updatedVendor?.enviaOriginPostalCode,
      enviaEnabledCarriers: updatedVendor?.enviaEnabledCarriers,
    });
  }

  // ========== API CLIENT ==========

  /**
   * Inicializar cliente HTTP de Envia.com
   */
  private async getClient(): Promise<AxiosInstance> {
    if (this.axiosInstance) {
      return this.axiosInstance;
    }

    this.config = await this.getMarketplaceConfig();
    
    const token = this.config.environment === 'production' 
      ? this.config.apiToken 
      : this.config.sandboxToken;

    if (!token) {
      throw new Error(`Token de Envia.com no configurado para ambiente ${this.config.environment}`);
    }

    const baseURL = this.config.environment === 'production'
      ? this.config.apiUrl
      : this.config.apiTestUrl;

    this.logger.log(`[ENVIA] getClient → env=${this.config.environment}, baseURL=${baseURL}, tokenSet=${!!token}`);

    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 segundos para dar tiempo a Envia.com
      // Deshabilitar cualquier comportamiento de retry
      maxRedirects: 0, // No seguir redirects automáticamente
      validateStatus: (status) => status >= 200 && status < 500, // No reintentar en errores 4xx
    });

    // Interceptor para prevenir cualquier retry
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        // NO reintentar - solo lanzar el error
        this.logger.error(`[ENVIA] HTTP Error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    return this.axiosInstance;
  }

  /**
   * Probar conexión con Envia.com
   * Prueba el token contra el API real de cotizaciones (mismo endpoint que se usa en producción)
   */
  async testConnection(): Promise<{ success: boolean; message: string; environment: string; carriers?: any[] }> {
    try {
      const config = await this.getMarketplaceConfig();
      
      const token = config.environment === 'production' 
        ? config.apiToken 
        : config.sandboxToken;

      if (!token) {
        return {
          success: false,
          message: `Token de ${config.environment} no configurado`,
          environment: config.environment,
        };
      }

      // Probar contra el mismo baseURL que se usa para cotizaciones
      const baseURL = config.environment === 'production'
        ? config.apiUrl
        : config.apiTestUrl;

      this.logger.log(`[ENVIA] testConnection → ${baseURL}carrier/ (env=${config.environment})`);

      try {
        const carriersResponse = await axios.get(`${baseURL}carrier/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
          validateStatus: (status) => status < 500,
        });

        this.logger.log(`[ENVIA] testConnection status: ${carriersResponse.status}`);
        this.logger.log(`[ENVIA] testConnection data: ${JSON.stringify(carriersResponse.data).substring(0, 500)}`);

        if (carriersResponse.status === 401 || carriersResponse.status === 403) {
          return {
            success: false,
            message: `Token inválido o sin permisos para ${config.environment}. Verifica que el token corresponda al ambiente ${config.environment} en app.envia.com.`,
            environment: config.environment,
          };
        }

        if (carriersResponse.data) {
          const carriers = carriersResponse.data.data || carriersResponse.data;
          const carrierList = Array.isArray(carriers) ? carriers : [];

          return {
            success: true,
            message: `Conexión exitosa en ${config.environment}. ${carrierList.length} carrier(s) disponibles.`,
            environment: config.environment,
            carriers: carrierList,
          };
        }

        return {
          success: true,
          message: `Token válido para ${config.environment}.`,
          environment: config.environment,
        };

      } catch (err: any) {
        this.logger.warn(`[ENVIA] testConnection HTTP error: ${err.message}`);

        if (err.response?.status === 401 || err.response?.status === 403) {
          return {
            success: false,
            message: `Token inválido para ${config.environment}.`,
            environment: config.environment,
          };
        }

        return {
          success: false,
          message: `Error de conexión: ${err.message}`,
          environment: config.environment,
        };
      }
    } catch (error: any) {
      this.logger.error('[ENVIA] Error testing connection:', error.message);
      
      return {
        success: false,
        message: `Error: ${error.message}`,
        environment: this.config?.environment || 'unknown',
      };
    }
  }

  // ========== GEOCODIFICACIÓN ==========

  /**
   * Obtener estados/regiones de un país
   */
  async getStates(countryCode: string = 'CL'): Promise<any[]> {
    try {
      const config = await this.getMarketplaceConfig();
      const token = config.environment === 'production' 
        ? config.apiToken 
        : config.sandboxToken;

      if (!token) {
        throw new Error('Token no configurado');
      }

      const response = await axios.get(`https://queries.envia.com/state?country_code=${countryCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      this.logger.log(`[ENVIA] States for ${countryCode}: ${response.data?.data?.length || 0} found`);
      return response.data?.data || [];
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error fetching states: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener provincias/comunas de un país
   */
  async getProvinces(countryCode: string = 'CL', stateCode?: string): Promise<any[]> {
    try {
      const config = await this.getMarketplaceConfig();
      const token = config.environment === 'production' 
        ? config.apiToken 
        : config.sandboxToken;

      if (!token) {
        throw new Error('Token no configurado');
      }

      let url = `https://queries.envia.com/provinces?country_code=${countryCode}`;
      if (stateCode) {
        url += `&state_code=${stateCode}`;
      }

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      this.logger.log(`[ENVIA] Provinces for ${countryCode}${stateCode ? '/' + stateCode : ''}: ${response.data?.data?.length || 0} found`);
      return response.data?.data || [];
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error fetching provinces: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validar código postal y obtener información de ubicación
   */
  async validatePostalCode(countryCode: string, postalCode: string): Promise<any> {
    try {
      const config = await this.getMarketplaceConfig();
      const token = config.environment === 'production' 
        ? config.apiToken 
        : config.sandboxToken;

      if (!token) {
        throw new Error('Token no configurado');
      }

      const response = await axios.get(`https://geocodes.envia.com/zipcode/${countryCode}/${postalCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      this.logger.log(`[ENVIA] Postal code ${postalCode} validation: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error validating postal code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Buscar ciudad por nombre
   */
  async locateCity(countryCode: string, cityName: string): Promise<any> {
    try {
      const config = await this.getMarketplaceConfig();
      const token = config.environment === 'production' 
        ? config.apiToken 
        : config.sandboxToken;

      if (!token) {
        throw new Error('Token no configurado');
      }

      // Codificar el nombre de la ciudad para URL
      const encodedCity = encodeURIComponent(cityName);

      const response = await axios.get(`https://geocodes.envia.com/locate/${countryCode}/${encodedCity}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      this.logger.log(`[ENVIA] Locate city ${cityName}: ${JSON.stringify(response.data).substring(0, 500)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error locating city: ${error.message}`);
      throw error;
    }
  }

  // ========== COTIZACIÓN ==========

  /**
   * Obtener cotización de envío para un vendor
   */
  async getQuote(
    vendorId: string,
    destination: EnviaAddress,
    packages: EnviaPackage[],
    carriers?: string[],
  ): Promise<EnviaQuoteOption[]> {
    const vendorConfig = await this.getVendorConfig(vendorId);

    if (!vendorConfig.enabled) {
      throw new Error('Envia.com no está habilitado para este vendor');
    }

    if (!vendorConfig.origin) {
      throw new Error('Dirección de origen no configurada para este vendor');
    }

    const enabledCarriers = carriers || vendorConfig.enabledCarriers;
    if (!enabledCarriers.length) {
      throw new Error('No hay carriers habilitados para este vendor');
    }

    const client = await this.getClient();
    const allOptions: EnviaQuoteOption[] = [];

    // Cotizar con cada carrier habilitado
    for (const carrier of enabledCarriers) {
      try {
        const quoteRequest: EnviaQuoteRequest = {
          origin: vendorConfig.origin,
          destination,
          packages,
          shipment: { type: 1, carrier },
        };

        this.logger.log(`[ENVIA] 🔵 Cotizando con ${carrier}...`);
        this.logger.log(`[ENVIA] 📤 REQUEST ${carrier}: ${JSON.stringify(quoteRequest, null, 2)}`);
        
        const response = await client.post<EnviaQuoteResponse>('ship/rate/', quoteRequest);

        this.logger.log(`[ENVIA] 📥 RESPONSE ${carrier} - Status: ${response.status}`);
        this.logger.log(`[ENVIA] 📥 RESPONSE ${carrier} - Data: ${JSON.stringify(response.data, null, 2)}`);

        if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
          // Aplicar markup si está configurado
          const carrierSettings = vendorConfig.carrierSettings[carrier];
          const markup = carrierSettings?.markup || 0;

          const options = response.data.data.map(opt => ({
            ...opt,
            totalPrice: markup > 0 
              ? (parseFloat(opt.totalPrice) * (1 + markup / 100)).toFixed(2)
              : opt.totalPrice,
          }));

          allOptions.push(...options);
          this.logger.log(`[ENVIA] ✅ ${carrier}: ${options.length} opciones recibidas - Precios: ${options.map(o => o.totalPrice).join(', ')}`);
        } else {
          this.logger.warn(`[ENVIA] ⚠️ ${carrier}: Sin datos en respuesta`);
          this.logger.warn(`[ENVIA] ⚠️ ${carrier}: response.data = ${JSON.stringify(response.data)}`);
        }
      } catch (error: any) {
        this.logger.error(`[ENVIA] ❌ ${carrier} FALLÓ: ${error.message}`);
        if (error.response) {
          this.logger.error(`[ENVIA] ${carrier} - Status: ${error.response.status}`);
          this.logger.error(`[ENVIA] ${carrier} - Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        if (error.request) {
          this.logger.error(`[ENVIA] ${carrier} - No response received. Request was made but no response.`);
        }
        this.logger.error(`[ENVIA] ${carrier} - Full error stack:`, error.stack);
        // Continuar con otros carriers
      }
    }

    // Ordenar por precio
    allOptions.sort((a, b) => parseFloat(a.totalPrice) - parseFloat(b.totalPrice));

    return allOptions;
  }

  /**
   * Calcular paquete consolidado desde items de orden
   * (Opción B: calcular volumen total como un solo paquete)
   */
  calculateConsolidatedPackage(
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      weight?: number;
      length?: number;
      width?: number;
      height?: number;
    }>,
    vendorConfig: EnviaVendorConfig,
  ): EnviaPackage {
    let totalWeight = 0;
    let totalVolume = 0;
    let totalValue = 0;
    const contents: string[] = [];

    for (const item of items) {
      const qty = item.quantity || 1;
      
      // Peso: usar peso del producto o estimar 0.5kg por item
      const itemWeight = (item.weight || 0.5) * qty;
      totalWeight += itemWeight;

      // Volumen: usar dimensiones del producto o estimar 20x20x10
      const length = item.length || 20;
      const width = item.width || 20;
      const height = item.height || 10;
      const itemVolume = length * width * height * qty;
      totalVolume += itemVolume;

      // Valor declarado
      totalValue += item.price * qty;

      // Contenido
      contents.push(`${qty}x ${item.name}`);
    }

    // Calcular dimensiones aproximadas del paquete consolidado
    // Asumiendo que el volumen se distribuye en forma cúbica
    const cubeRoot = Math.cbrt(totalVolume);
    const estimatedLength = Math.ceil(cubeRoot * 1.2); // 20% extra por empaque
    const estimatedWidth = Math.ceil(cubeRoot);
    const estimatedHeight = Math.ceil(cubeRoot * 0.8);

    return {
      type: vendorConfig.defaultPackageType || 'box',
      content: contents.join(', ').substring(0, 200), // Limitar longitud
      amount: 1,
      declaredValue: Math.round(totalValue),
      weight: Math.max(0.5, Math.round(totalWeight * 10) / 10), // Mínimo 0.5kg
      weightUnit: vendorConfig.defaultWeightUnit || 'KG',
      lengthUnit: vendorConfig.defaultLengthUnit || 'CM',
      dimensions: {
        length: Math.max(10, estimatedLength),
        width: Math.max(10, estimatedWidth),
        height: Math.max(5, estimatedHeight),
      },
    };
  }

  // ========== GENERACIÓN DE ETIQUETA ==========

  /**
   * Generar etiqueta de envío
   */
  async generateLabel(
    vendorId: string,
    destination: EnviaAddress,
    packages: EnviaPackage[],
    carrier: string,
    service: string,
    orderId?: string, // Para generar clave de idempotencia
    orderReference?: string, // Número de orden para mostrar en la etiqueta
  ): Promise<{
    shipmentId: string;
    trackingNumber: string;
    labelUrl: string;
    trackingUrl: string;
    totalPrice: number;
    currency: string;
  }> {
    const vendorConfig = await this.getVendorConfig(vendorId);

    if (!vendorConfig.enabled) {
      throw new Error('Envia.com no está habilitado para este vendor');
    }

    if (!vendorConfig.origin) {
      throw new Error('Dirección de origen no configurada para este vendor');
    }

    // Verificar que el carrier esté habilitado
    if (!vendorConfig.enabledCarriers.some((enabledCarrier) =>
      enabledCarrier.toLowerCase() === carrier.toLowerCase(),
    )) {
      throw new Error(`Carrier ${carrier} no está habilitado para este vendor`);
    }

    const client = await this.getClient();
    
    // Generar clave de idempotencia única para esta orden+vendor
    // Esto previene que Envia.com procese la misma request múltiples veces
    // IMPORTANTE: NO usar Date.now() para que sea determinístico por orden
    const idempotencyKey = orderId 
      ? `${orderId}-${vendorId}-${carrier}-${service}`
      : `${vendorId}-${carrier}-${service}-${Math.random().toString(36).substring(7)}`;

    const labelRequest: EnviaGenerateLabelRequest = {
      origin: vendorConfig.origin,
      destination,
      packages,
      shipment: {
        type: 1,
        carrier,
        service,
      },
      settings: {
        currency: 'CLP',
        printFormat: 'PDF',
        printSize: 'STOCK_4X6',
        comments: `idempotency:${idempotencyKey}`, // Incluir clave en comments como backup
      },
      // Número de orden/referencia para mostrar en la etiqueta
      orderReference: orderReference || orderId,
    };

    this.logger.log(`[ENVIA] Generando etiqueta con ${carrier}/${service}...`);
    this.logger.log(`[ENVIA] 🔑 Idempotency Key: ${idempotencyKey}`);
    this.logger.log(`[ENVIA] 📤 REQUEST generate: ${JSON.stringify(labelRequest, null, 2)}`);
    
    try {
      // Enviar header de idempotencia (si Envia.com lo soporta)
      const response = await client.post<EnviaGenerateLabelResponse>('ship/generate/', labelRequest, {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
          'Idempotency-Key': idempotencyKey,
        },
      });

      this.logger.log(`[ENVIA] 📥 RESPONSE generate - Status: ${response.status}`);
      this.logger.log(`[ENVIA] 📥 RESPONSE generate - Data: ${JSON.stringify(response.data, null, 2)}`);

      // Envia.com puede responder HTTP 200 y comunicar el rechazo dentro de `error`.
      // Traducimos esos rechazos antes de validar la presencia de la etiqueta.
      const responsePayload = response.data as EnviaGenerateLabelResponse & {
        error?: { code?: number | string; description?: string; message?: string };
      };
      if (responsePayload?.error) {
        const enviaError = responsePayload.error;
        const code = enviaError.code ? ` (código ${enviaError.code})` : '';
        const rawMessage = String(enviaError.message || enviaError.description || 'Error desconocido');
        const normalizedMessage = rawMessage.toLowerCase();
        const message = normalizedMessage.includes('not enough money')
          ? 'Saldo insuficiente en Envia.com'
          : `Envia.com rechazó la etiqueta: ${rawMessage}`;

        throw new Error(`${message}${code}`);
      }

      if (!response.data?.data?.[0]) {
        this.logger.error(`[ENVIA] ❌ No data in response. Full response: ${JSON.stringify(response.data)}`);
        throw new Error('No se recibió etiqueta de Envia.com');
      }

      const label = response.data.data[0];

      this.logger.log(`[ENVIA] Etiqueta generada: ${label.trackingNumber}`);

      return {
        shipmentId: String(label.shipmentId),
        trackingNumber: label.trackingNumber,
        labelUrl: label.label,
        trackingUrl: label.trackUrl,
        totalPrice: label.totalPrice,
        currency: label.currency,
      };
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error generando etiqueta: ${error.message}`);
      throw new Error(error.response?.data?.message || error.message || 'Error al generar etiqueta');
    }
  }

  // ========== TRACKING ==========

  /**
   * Obtener tracking de un envío
   */
  async getTracking(trackingNumber: string): Promise<{
    status: string | number | { id?: number; name?: string; status?: string };
    carrier: string;
    events: Array<{ timestamp: string; location: string; description: string }>;
  }> {
    const client = await this.getClient();

    try {
      const response = await client.post<EnviaTrackingResponse>('ship/generaltrack/', {
        trackingNumbers: [trackingNumber],
      });

      if (!response.data?.data?.[0]) {
        throw new Error('Tracking no encontrado');
      }

      const tracking = response.data.data[0];

      this.logger.log(
        `[ENVIA] Tracking ${trackingNumber}: estado original=${JSON.stringify(tracking.status)}, carrier=${tracking.carrier}, eventos=${tracking.events?.length || 0}`,
      );

      return {
        status: tracking.status,
        carrier: tracking.carrier,
        events: tracking.events || [],
      };
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error obteniendo tracking: ${error.message}`);
      throw new Error(error.response?.data?.message || error.message || 'Error al obtener tracking');
    }
  }

  /**
   * Procesar webhook de tracking de Envia.com
   */
  async processTrackingWebhook(payload: any): Promise<void> {
    this.logger.log(`[ENVIA] Webhook recibido: ${JSON.stringify(payload)}`);

    try {
      const { trackingNumber, status } = extractEnviaTrackingWebhook(payload);

      if (!trackingNumber) {
        this.logger.warn('[ENVIA] Webhook sin tracking number');
        return;
      }
      if (status === undefined || status === null || status === '') {
        this.logger.warn(`[ENVIA] Webhook sin estado para tracking ${trackingNumber}`);
        return;
      }

      // Buscar orden por tracking number
      const order = await this.orderRepo.findOne({
        where: { enviaTrackingNumber: trackingNumber },
      });

      if (!order) {
        this.logger.warn(`[ENVIA] No se encontró orden con tracking ${trackingNumber}`);
        return;
      }

      this.logger.log(`[ENVIA] Actualizando orden ${order.orderNumber} con estado de envío: ${status}`);

      // Mapear estado de Envia.com a nuestro sistema
      const shippingStatus = this.mapEnviaStatus(status);
      const orderStatus = this.getOrderStatusFromShipping(shippingStatus);
      const now = new Date();

      if (!shouldApplyEnviaShippingStatus(order.enviaShippingStatus, shippingStatus)) {
        await this.orderRepo.update(order.id, { enviaLastTrackingUpdate: now });
        await this.shipmentRepo.update(
          { orderId: order.id },
          { enviaLastTrackingUpdate: now },
        );
        this.logger.log(
          `[ENVIA] Webhook sin cambio aplicable para ${order.orderNumber}: ${order.enviaShippingStatus} → ${shippingStatus}`,
        );
        return;
      }

      // Actualizar orden
      await this.orderRepo.update(order.id, {
        enviaShippingStatus: shippingStatus,
        enviaLastTrackingUpdate: now,
        status: orderStatus as any,
      });

      // Actualizar shipment si existe
      await this.shipmentRepo.update(
        { orderId: order.id },
        {
          enviaShippingStatus: shippingStatus,
          enviaLastTrackingUpdate: now,
          status: this.getShipmentStatusFromShipping(shippingStatus),
        },
      );

      await this.syncWooCommerceShipping(order.id);

      this.logger.log(
        `[ENVIA] ✅ Orden ${order.orderNumber} actualizada: envío=${shippingStatus}, pedido=${orderStatus}`,
      );
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error procesando webhook: ${error.message}`);
      throw error;
    }
  }

  async verifyTrackingWebhookSignature(
    rawBody: Buffer,
    event: string,
    timestamp: string,
    signature: string,
  ): Promise<boolean> {
    const config = await this.getMarketplaceConfig();
    if (!config.webhookSecret) {
      this.logger.error('[ENVIA] Webhook v2 recibido sin secreto configurado');
      return false;
    }

    return verifyEnviaWebhookSignature(
      rawBody,
      config.webhookSecret,
      event,
      timestamp,
      signature,
    );
  }

  /**
   * Mapear estado de Envia.com a nuestro sistema
   */
  private mapEnviaStatus(
    enviaStatus: string | number | { id?: number; name?: string; status?: string } | null | undefined,
  ): string {
    const statusIdMap: Record<number, string> = {
      1: 'generated',       // Created
      2: 'in_transit',      // Shipped
      3: 'delivered',
      4: 'failed',          // Canceled
      5: 'in_transit',      // Information
      6: 'unknown',         // N/A
      7: 'pending',
      8: 'picked_up',
      9: 'in_transit',      // Out for delivery
      10: 'failed',         // Lost
      11: 'failed',         // Returned
      12: 'in_transit',     // Pickup at office
      13: 'failed',         // Delivered at origin
      14: 'failed',         // Damaged
      15: 'in_transit',     // Redirected
      16: 'picked_up',      // Out for pickup
      17: 'in_transit',     // Delivery attempts
      18: 'in_transit',
      19: 'in_transit',
      20: 'failed',         // Return problem
      21: 'failed',         // Address error
      22: 'failed',         // Undeliverable
      23: 'in_transit',     // Delayed
      24: 'failed',         // Rejected
      25: 'pending',        // Pickup attempt
      26: 'in_transit',     // Partially shipped
      27: 'in_transit',     // Partially delivered
      28: 'in_transit',     // Delivery attempt
    };

    if (typeof enviaStatus === 'number') {
      const mapped = statusIdMap[enviaStatus];
      if (!mapped) this.logger.warn(`[ENVIA] Código de tracking desconocido: ${enviaStatus}`);
      return mapped || 'unknown';
    }

    if (enviaStatus && typeof enviaStatus === 'object') {
      if (enviaStatus.id != null && statusIdMap[Number(enviaStatus.id)]) {
        return statusIdMap[Number(enviaStatus.id)];
      }
      enviaStatus = enviaStatus.name || enviaStatus.status || '';
    }

    const statusMap: Record<string, string> = {
      // Estados de Envia.com -> Nuestros estados
      pending: 'pending',
      created: 'generated',
      generated: 'generated',
      'label created': 'generated',
      shipped: 'in_transit',
      'partially shipped': 'in_transit',
      'in transit': 'in_transit',
      'picked up': 'picked_up',
      pickup: 'picked_up',
      collected: 'picked_up',
      'collected by carrier': 'picked_up',
      retirado: 'picked_up',
      recolectado: 'picked_up',
      transit: 'in_transit',
      intransit: 'in_transit',
      'en transito': 'in_transit',
      transito: 'in_transit',
      outfordelivery: 'in_transit',
      'out for delivery': 'in_transit',
      'pickup at office': 'in_transit',
      redirected: 'in_transit',
      delayed: 'in_transit',
      information: 'in_transit',
      'delivery attempt': 'in_transit',
      'partially delivered': 'in_transit',
      reparto: 'in_transit',
      'en reparto': 'in_transit',
      delivered: 'delivered',
      completed: 'delivered',
      entregado: 'delivered',
      delivery: 'delivered',
      cancelled: 'failed',
      canceled: 'failed',
      cancelado: 'failed',
      failed: 'failed',
      error: 'failed',
      lost: 'failed',
      returned: 'failed',
      damaged: 'failed',
      rejected: 'failed',
      undeliverable: 'failed',
      'address error': 'failed',
      'return problem': 'failed',
      'delivered at origin': 'failed',
      'n a': 'unknown',
    };

    const normalized = String(enviaStatus || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const numericStatus = Number(normalized);
    if (normalized && Number.isInteger(numericStatus) && statusIdMap[numericStatus]) {
      return statusIdMap[numericStatus];
    }

    const mapped = statusMap[normalized];
    if (!mapped) {
      this.logger.warn(
        `[ENVIA] Estado de tracking desconocido: original=${JSON.stringify(enviaStatus)}, normalizado="${normalized}"`,
      );
    }
    return mapped || 'unknown';
  }

  /**
   * Determinar estado del pedido según estado del envío
   * Regla: picked_up o in_transit -> shipped
   *        delivered -> delivered
   */
  private getOrderStatusFromShipping(shippingStatus: string): string {
    switch (shippingStatus) {
      case 'picked_up':
      case 'in_transit':
        return 'shipped'; // Pedido enviado
      case 'delivered':
        return 'delivered'; // Pedido completado
      default:
        return 'processing'; // Procesando
    }
  }

  /**
   * Determinar estado del shipment según estado del envío
   */
  private getShipmentStatusFromShipping(shippingStatus: string): string {
    switch (shippingStatus) {
      case 'generated':
        return 'label_generated';
      case 'picked_up':
        return 'picked_up';
      case 'in_transit':
        return 'in_transit';
      case 'delivered':
        return 'delivered';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  // ========== HELPERS ==========

  /**
   * Fallback de tracking por cron.
   * Se ejecuta cada 15 minutos para cubrir casos donde el webhook de Envia no llega.
   */
  @Cron('0 */15 * * * *')
  async syncTrackingFallback(): Promise<void> {
    if (this.fallbackSyncRunning) {
      this.logger.warn('[ENVIA] Fallback tracking sync already running, skipping this cycle');
      return;
    }

    this.fallbackSyncRunning = true;

    try {
      const candidates = await this.orderRepo
        .createQueryBuilder('o')
        .where('o.enviaTrackingNumber IS NOT NULL')
        .andWhere("TRIM(o.enviaTrackingNumber) != ''")
        .andWhere('o.status IN (:...statuses)', {
          statuses: [OrderStatus.PROCESSING, OrderStatus.SHIPPED],
        })
        .andWhere('(o.enviaShippingStatus IS NULL OR o.enviaShippingStatus != :delivered)', {
          delivered: 'delivered',
        })
        .andWhere('(o.enviaLastTrackingUpdate IS NULL OR o.enviaLastTrackingUpdate <= :staleBefore)', {
          staleBefore: new Date(Date.now() - 15 * 60 * 1000),
        })
        .orderBy('o.enviaLastTrackingUpdate', 'ASC')
        .limit(50)
        .getMany();

      if (!candidates.length) {
        this.logger.log('[ENVIA] Fallback tracking sync: no candidate orders found');
        return;
      }

      let updated = 0;
      let failed = 0;

      for (const order of candidates) {
        const now = new Date();
        try {
          const tracking = await this.getTracking(order.enviaTrackingNumber);
          const shippingStatus = this.mapEnviaStatus(tracking.status);
          const orderStatus = this.getOrderStatusFromShipping(shippingStatus);

          const shouldUpdate =
            order.enviaShippingStatus !== shippingStatus ||
            order.status !== (orderStatus as OrderStatus);

          await this.orderRepo.update(order.id, shouldUpdate ? {
            enviaShippingStatus: shippingStatus,
            enviaLastTrackingUpdate: now,
            status: orderStatus as any,
          } : {
            enviaLastTrackingUpdate: now,
          });

          await this.shipmentRepo.update(
            { orderId: order.id },
            shouldUpdate ? {
              enviaShippingStatus: shippingStatus,
              enviaLastTrackingUpdate: now,
              status: this.getShipmentStatusFromShipping(shippingStatus),
            } : {
              enviaLastTrackingUpdate: now,
            },
          );

          if (!shouldUpdate) continue;

          await this.syncWooCommerceShipping(order.id);

          updated++;
        } catch (error: any) {
          failed++;
          await this.orderRepo.update(order.id, { enviaLastTrackingUpdate: now });
          this.logger.warn(
            `[ENVIA] Fallback sync failed for order ${order.orderNumber} (${order.enviaTrackingNumber}): ${error.message}`,
          );
        }
      }

      this.logger.log(
        `[ENVIA] Fallback tracking sync completed. candidates=${candidates.length}, updated=${updated}, failed=${failed}`,
      );
    } catch (error: any) {
      this.logger.error(`[ENVIA] Fallback tracking sync crashed: ${error.message}`);
    } finally {
      this.fallbackSyncRunning = false;
    }
  }

  /**
   * Obtener lista de carriers disponibles (estática)
   */
  async getAvailableCarriers() {
    const config = await this.getMarketplaceConfig();
    const carrierLogos = config.carrierLogos || {};

    return CHILE_CARRIERS.map((carrier) => ({
      ...carrier,
      logo: carrierLogos[carrier.code] || carrier.logo,
    }));
  }

  /**
   * Obtener carriers desde la API de Envia.com para Chile
   */
  async getCarriersFromApi(): Promise<any[]> {
    try {
      const config = await this.getMarketplaceConfig();
      const token = config.environment === 'production' 
        ? config.apiToken 
        : config.sandboxToken;

      if (!token) {
        throw new Error('Token no configurado');
      }

      // Obtener carriers para Chile
      const response = await axios.get('https://queries.envia.com/carrier?country_code=CL', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      this.logger.log(`[ENVIA] Carriers from API for CL: ${JSON.stringify(response.data)}`);
      return response.data?.data || [];
    } catch (error: any) {
      this.logger.error(`[ENVIA] Error fetching carriers from API: ${error.message}`);
      // Fallback a lista estática
      return CHILE_CARRIERS;
    }
  }

  /**
   * Sincronizar tracking de una orden específica (consulta manual desde dashboard/panel)
   * Retorna información sobre si el estado cambió
   */
  async syncOrderTracking(orderId: string): Promise<{
    success: boolean;
    message: string;
    statusChanged: boolean;
    previousStatus?: string;
    newStatus?: string;
    enviaShippingStatus?: string;
    lastTrackingUpdate?: Date;
  }> {
    try {
      // Buscar la orden
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) {
        return {
          success: false,
          message: 'Orden no encontrada',
          statusChanged: false,
        };
      }

      // Validar que tenga tracking number
      if (!order.enviaTrackingNumber || !order.enviaTrackingNumber.trim()) {
        return {
          success: false,
          message: 'Esta orden no tiene número de seguimiento de Envia.com',
          statusChanged: false,
        };
      }

      // Consultar Envia.com
      const tracking = await this.getTracking(order.enviaTrackingNumber);
      const newShippingStatus = this.mapEnviaStatus(tracking.status);
      const newOrderStatus = this.getOrderStatusFromShipping(newShippingStatus);

      // Verificar si cambió el estado
      const statusChanged =
        order.enviaShippingStatus !== newShippingStatus ||
        order.status !== (newOrderStatus as OrderStatus);

      const previousStatus = order.status;
      const previousEnviaStatus = order.enviaShippingStatus;
      const now = new Date();

      if (statusChanged) {
        // Actualizar orden
        await this.orderRepo.update(order.id, {
          enviaShippingStatus: newShippingStatus,
          enviaLastTrackingUpdate: now,
          status: newOrderStatus as any,
        });

        // Actualizar shipment
        await this.shipmentRepo.update(
          { orderId: order.id },
          {
            enviaShippingStatus: newShippingStatus,
            enviaLastTrackingUpdate: now,
            status: this.getShipmentStatusFromShipping(newShippingStatus),
          },
        );

        this.logger.log(
          `[ENVIA] Manual sync for order ${order.orderNumber}: ${previousEnviaStatus} → ${newShippingStatus}`,
        );
      } else {
        await this.orderRepo.update(order.id, {
          enviaLastTrackingUpdate: now,
        });

        await this.shipmentRepo.update(
          { orderId: order.id },
          {
            enviaLastTrackingUpdate: now,
          },
        );

        this.logger.log(
          `[ENVIA] Manual sync for order ${order.orderNumber}: no status change (${newShippingStatus})`,
        );
      }

      await this.syncWooCommerceShipping(order.id);

      return {
        success: true,
        message: statusChanged
          ? `Estado actualizado a: ${newShippingStatus}`
          : `Sin cambios. Estado actual: ${newShippingStatus}`,
        statusChanged,
        previousStatus,
        newStatus: newOrderStatus,
        enviaShippingStatus: newShippingStatus,
        lastTrackingUpdate: now,
      };
    } catch (error: any) {
      this.logger.error(
        `[ENVIA] Manual sync failed for order ${orderId}: ${error.message}`,
      );
      return {
        success: false,
        message: `Error al sincronizar: ${error.message}`,
        statusChanged: false,
      };
    }
  }

  /**
   * Validar dirección (básico)
   */
  validateAddress(address: EnviaAddress): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!address.name?.trim()) errors.push('Nombre es requerido');
    if (!address.phone?.trim()) errors.push('Teléfono es requerido');
    if (!address.street?.trim()) errors.push('Calle es requerida');
    if (!address.city?.trim()) errors.push('Ciudad es requerida');
    if (!address.state?.trim()) errors.push('Región es requerida');
    if (!address.country?.trim()) errors.push('País es requerido');
    if (!address.postalCode?.trim()) errors.push('Código postal es requerido');

    // Validar formato teléfono chileno
    if (address.phone && !address.phone.match(/^\+?56\d{9}$/)) {
      errors.push('Teléfono debe tener formato +56XXXXXXXXX');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
