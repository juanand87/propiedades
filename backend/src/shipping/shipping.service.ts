import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Region } from './region.entity';
import { Commune } from './commune.entity';
import { ShippingMethod } from './shipping-method.entity';
import { VendorShippingMethod } from './vendor-shipping-method.entity';
import { ShippingMethodCommune } from './shipping-method-commune.entity';
import { BluexService } from './bluex.service';
import { EnviaService } from './envia.service';
import { Vendor } from '../vendors/vendor.entity';
import { Product } from '../products/product.entity';
import { calculatePackageSummary } from './package-calculator';

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(Region)
    private regionRepository: Repository<Region>,
    @InjectRepository(Commune)
    private communeRepository: Repository<Commune>,
    @InjectRepository(ShippingMethod)
    private shippingMethodRepository: Repository<ShippingMethod>,
    @InjectRepository(VendorShippingMethod)
    private vendorShippingMethodRepository: Repository<VendorShippingMethod>,
    @InjectRepository(ShippingMethodCommune)
    private shippingMethodCommuneRepository: Repository<ShippingMethodCommune>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private bluexService: BluexService,
    private enviaService: EnviaService,
  ) {}

  // ========== REGIONES Y COMUNAS ==========

  async getAllRegions() {
    return this.regionRepository.find({
      order: { displayOrder: 'ASC' },
    });
  }

  async getCommunesByRegion(regionId: number) {
    return this.communeRepository.find({
      where: { regionId },
      order: { name: 'ASC' },
    });
  }

  async getAllCommunes() {
    return this.communeRepository.find({
      relations: ['region'],
      order: { name: 'ASC' },
    });
  }

  // ========== MÉTODOS DE ENVÍO ==========

  async getAllShippingMethods() {
    return this.shippingMethodRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getShippingMethodByCode(code: string) {
    return this.shippingMethodRepository.findOne({
      where: { code },
    });
  }

  // ========== CONFIGURACIÓN DE VENDOR ==========

  async getVendorShippingMethods(vendorId: string) {
    return this.vendorShippingMethodRepository.find({
      where: { vendorId },
      relations: ['shippingMethod'],
    });
  }

  async enableShippingMethodForVendor(
    vendorId: string,
    shippingMethodId: number,
    config: any,
  ) {
    let vendorShippingMethod = await this.vendorShippingMethodRepository.findOne({
      where: { vendorId, shippingMethodId },
    });

    if (vendorShippingMethod) {
      vendorShippingMethod.isEnabled = true;
      vendorShippingMethod.config = config;
    } else {
      vendorShippingMethod = this.vendorShippingMethodRepository.create({
        vendorId,
        shippingMethodId,
        isEnabled: true,
        config,
      });
    }

    return this.vendorShippingMethodRepository.save(vendorShippingMethod);
  }

  async disableShippingMethodForVendor(
    vendorId: string,
    shippingMethodId: number,
  ) {
    const vendorShippingMethod = await this.vendorShippingMethodRepository.findOne({
      where: { vendorId, shippingMethodId },
    });

    if (vendorShippingMethod) {
      vendorShippingMethod.isEnabled = false;
      return this.vendorShippingMethodRepository.save(vendorShippingMethod);
    }

    return null;
  }

  async updateVendorShippingMethodConfig(
    vendorId: string,
    shippingMethodId: number,
    config: any,
  ) {
    const vendorShippingMethod = await this.vendorShippingMethodRepository.findOne({
      where: { vendorId, shippingMethodId },
    });

    if (vendorShippingMethod) {
      vendorShippingMethod.config = config;
      return this.vendorShippingMethodRepository.save(vendorShippingMethod);
    }

    return null;
  }

  // ========== CONFIGURACIÓN DE COMUNAS ==========

  async getCommuneConfigForVendorMethod(vendorShippingMethodId: number) {
    return this.shippingMethodCommuneRepository.find({
      where: { vendorShippingMethodId },
      relations: ['commune', 'commune.region'],
      order: {
        commune: { name: 'ASC' },
      },
    });
  }

  async setCommuneConfig(
    vendorShippingMethodId: number,
    communeId: number,
    config: {
      isAvailable: boolean;
      baseCost: number;
      estimatedDays: number;
      additionalConfig?: any;
    },
  ) {
    let communeConfig = await this.shippingMethodCommuneRepository.findOne({
      where: { vendorShippingMethodId, communeId },
    });

    if (communeConfig) {
      Object.assign(communeConfig, config);
    } else {
      communeConfig = this.shippingMethodCommuneRepository.create({
        vendorShippingMethodId,
        communeId,
        ...config,
      });
    }

    return this.shippingMethodCommuneRepository.save(communeConfig);
  }

  async bulkSetCommuneConfig(
    vendorShippingMethodId: number,
    communes: Array<{
      communeId: number;
      isAvailable: boolean;
      baseCost: number;
      estimatedDays: number;
      additionalConfig?: any;
    }>,
  ) {
    console.log(`Processing ${communes.length} communes for vendorShippingMethodId ${vendorShippingMethodId}`);
    console.log('First commune data:', communes[0]);
    const results: ShippingMethodCommune[] = [];

    for (const communeData of communes) {
      try {
        const { communeId, ...config } = communeData;
        const result = await this.setCommuneConfig(
          vendorShippingMethodId,
          communeId,
          config,
        );
        results.push(result);
      } catch (error) {
        console.error(`Error setting commune ${communeData.communeId}:`, error);
        throw error;
      }
    }

    console.log(`Successfully processed ${results.length} communes`);
    return results;
  }  // ========== COTIZACIÓN Y CÁLCULO ==========

  async calculateShippingWithProducts(
    vendorId: string,
    communeId: number,
    products: Array<{ productId: string; quantity: number }>,
    declaredValue: number,
  ) {
    // Obtener todos los productos con sus categorías
    const productIds = products.map(p => p.productId);
    const loadedProducts = await this.productRepository.find({
      where: productIds.map(id => ({ id })),
      relations: ['categories'],
    });

    const packageSummary = calculatePackageSummary(products.map((cartItem) => ({
      quantity: cartItem.quantity,
      product: loadedProducts.find((product) => product.id === cartItem.productId),
    })));

    // Llamar al método original con las dimensiones calculadas
    return this.calculateShipping(
      vendorId,
      communeId,
      packageSummary.weight,
      { length: packageSummary.length, width: packageSummary.width, height: packageSummary.height },
      declaredValue,
    );
  }

  async calculateWooCommerceShipping(
    vendorId: string,
    city: string,
    postcode: string | undefined,
    products: Array<{ productId: string; quantity: number }>,
    declaredValue: number,
  ) {
    const normalizedCity = String(city || '').trim().toLowerCase();
    const normalizedPostcode = String(postcode || '').trim();
    const communes = await this.communeRepository.find({ relations: ['region'] });
    const commune = communes.find((item) => normalizedPostcode && item.enviaPostalCode === normalizedPostcode)
      || communes.find((item) => item.name.toLowerCase() === normalizedCity)
      || communes.find((item) => normalizedCity && (item.name.toLowerCase().includes(normalizedCity) || normalizedCity.includes(item.name.toLowerCase())));
    if (!commune) return [];
    return this.calculateShippingWithProducts(vendorId, commune.id, products, declaredValue);
  }

  async calculateShipping(
    vendorId: string,
    communeId: number,
    weight: number,
    dimensions: { length: number; width: number; height: number },
    declaredValue: number,
  ) {
    // Cargar vendor una sola vez al inicio con sus settings
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['settings'],
    });

    console.log('[SHIPPING] Loaded vendor:', {
      id: vendor?.id,
      storeName: vendor?.storeName,
      enviaEnabled: vendor?.enviaEnabled,
      enviaOriginCity: vendor?.enviaOriginCity,
      enviaEnabledCarriers: vendor?.enviaEnabledCarriers,
      allFields: Object.keys(vendor || {}),
    });

    // Obtener métodos de envío activos del vendor
    const vendorMethods = await this.vendorShippingMethodRepository.find({
      where: { vendorId, isEnabled: true },
      relations: ['shippingMethod'],
    });

    let availableOptions: Array<{
      methodId: number;
      method: string;
      methodCode: string;
      price: number;
      estimatedDays: number;
      isRealTimeQuote: boolean;
    }> = [];

    for (const vendorMethod of vendorMethods) {
      // Buscar configuración de la comuna
      let communeConfig = await this.shippingMethodCommuneRepository.findOne({
        where: {
          vendorShippingMethodId: vendorMethod.id,
          communeId,
          isAvailable: true,
        },
        relations: ['commune', 'commune.region'],
      });

      // Para BlueX viejo, si no hay configuración de comuna pero tiene integrationId o apiKey,
      // intentar obtener la comuna directamente de la base de datos para cotización en tiempo real
      if (!communeConfig && vendorMethod.shippingMethod.code === 'bluex' && 
          (vendorMethod.config?.integrationId || vendorMethod.config?.apiKey)) {
        const commune = await this.communeRepository.findOne({
          where: { id: communeId },
          relations: ['region'],
        });

        if (commune) {
          // Crear un objeto temporal para simular communeConfig
          communeConfig = {
            commune,
            baseCost: 0,
            estimatedDays: 3,
            isAvailable: true,
          } as any;
        }
      }

      if (communeConfig) {
        // Obtener cotización según el método de envío
        
        if (vendorMethod.shippingMethod.code === 'bluex' && 
            (vendorMethod.config?.integrationId || vendorMethod.config?.apiKey)) {
          // Código viejo de BlueX (mantener por compatibilidad)
          try {
            this.bluexService.initialize({
              apiKey: vendorMethod.config.integrationId || vendorMethod.config.apiKey,
              baseUrl: vendorMethod.config.baseUrl || 'https://apigw.bluex.cl',
              accountName: vendorMethod.config.accountName || '',
              sandboxMode: vendorMethod.config.sandboxMode === true,
            });

            const pricing = await this.bluexService.getPricing({
              from: {
                commune: vendorMethod.config.originCommune || 'Santiago',
                region: vendorMethod.config.originRegion || 'Región Metropolitana',
              },
              to: {
                commune: communeConfig.commune.name,
                region: communeConfig.commune.region.name,
              },
              serviceType: vendorMethod.config.serviceType || 'NORMAL',
              bultos: [{
                weight,
                ...dimensions,
              }],
              declaredValue,
              familiaProducto: vendorMethod.config.familiaProducto || 'PAQU',
            });

            availableOptions.push({
              methodId: vendorMethod.shippingMethodId,
              method: vendorMethod.shippingMethod.name,
              methodCode: vendorMethod.shippingMethod.code,
              price: pricing.price,
              estimatedDays: pricing.estimatedDays,
              isRealTimeQuote: true,
            });
          } catch (error) {
            console.error('Error getting BlueX real-time quote:', error);
            // Fallback a precio base configurado solo si existe y es mayor a 0
            if (communeConfig.baseCost && communeConfig.baseCost > 0) {
              availableOptions.push({
                methodId: vendorMethod.shippingMethodId,
                method: vendorMethod.shippingMethod.name,
                methodCode: vendorMethod.shippingMethod.code,
                price: communeConfig.baseCost,
                estimatedDays: communeConfig.estimatedDays,
                isRealTimeQuote: false,
              });
            }
          }
        } else {
          // Usar precio base configurado (incluye métodos gratuitos con baseCost = 0)
          availableOptions.push({
            methodId: vendorMethod.shippingMethodId,
            method: vendorMethod.shippingMethod.name,
            methodCode: vendorMethod.shippingMethod.code,
            price: communeConfig.baseCost,
            estimatedDays: communeConfig.estimatedDays,
            isRealTimeQuote: false,
          });
        }
      }
    }

    // ========== CONSULTAR ENVIA.COM SI ESTÁ CONFIGURADO ==========
    try {
      // El vendor ya fue cargado al inicio del método
      console.log('[ENVIA] Checking vendor config:', {
        enviaEnabled: vendor?.enviaEnabled,
        hasOriginCity: !!vendor?.enviaOriginCity,
        hasEnabledCarriers: !!vendor?.enviaEnabledCarriers,
      });

      if (vendor?.enviaEnabled && vendor?.enviaOriginCity && vendor?.enviaEnabledCarriers?.length > 0) {
        // El vendor tiene Envia.com configurado y carriers habilitados
        const commune = await this.communeRepository.findOne({
          where: { id: communeId },
          relations: ['region'],
        });

        if (commune) {
          try {
            console.log('[ENVIA] Requesting quotation...');

            // Usar código postal de Envia.com guardado en la comuna
            let postalCode = commune.enviaPostalCode || '';
            let cityName = commune.name;
            
            // Mapear códigos de región a códigos de estado cortos (ISO 3166-2:CL)
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
            
            let stateCode = regionStateMap[commune.region.code] || 'RM';

            // Si no tiene código postal guardado, intentar buscar en API de Geocodes
            if (!postalCode) {
              try {
                console.log(`[ENVIA] No postal code for ${commune.name}, trying Geocodes API...`);
                const cityInfo = await this.enviaService.locateCity('CL', commune.name);
                if (cityInfo?.data && cityInfo.data.length > 0) {
                  const firstResult = cityInfo.data[0];
                  postalCode = firstResult.zip_code || firstResult.postal_code || '';
                  if (firstResult.state_code) {
                    stateCode = firstResult.state_code;
                  }
                  console.log(`[ENVIA] Located city ${commune.name}: postalCode=${postalCode}, stateCode=${stateCode}`);
                }
              } catch (geoError) {
                console.warn('[ENVIA] Could not locate city via API:', geoError);
              }
            } else {
              console.log(`[ENVIA] Using saved postal code for ${commune.name}: ${postalCode}`);
            }

            // Preparar dirección destino como EnviaAddress
            // IMPORTANTE: NO incluir regionId ni communeId aquí, son IDs internos de nuestra BD
            // que los carriers (Chilexpress, etc.) no reconocen
            const destinationAddress = {
              name: 'Cliente',
              phone: '',
              street: 'Dirección por confirmar',
              number: 'S/N',
              city: cityName,
              state: stateCode,
              country: 'CL',
              postalCode: postalCode,
            };

            // Preparar packages como EnviaPackage[]
            const packages = [{
              type: 'box' as const,
              content: 'Productos',
              amount: 1,
              declaredValue: declaredValue,
              weight: weight,
              weightUnit: 'KG' as const,
              lengthUnit: 'CM' as const,
              dimensions: {
                length: dimensions.length,
                width: dimensions.width,
                height: dimensions.height,
              },
            }];

            console.log('[ENVIA] 📦 PACKAGE DATA:', JSON.stringify({
              weight: `${weight} KG`,
              dimensions: `${dimensions.length}x${dimensions.width}x${dimensions.height} CM`,
              declaredValue: `$${declaredValue}`,
              destination: `${commune.name}, ${destinationAddress.postalCode}`
            }, null, 2));

            // Obtener cotizaciones de Envia.com
            const enviaQuotations = await this.enviaService.getQuote(vendorId, destinationAddress, packages);
            const carrierCatalog = await this.enviaService.getAvailableCarriers();
            const carrierLogoMap = new Map(
              carrierCatalog.map((carrier) => [String(carrier.code).toLowerCase(), carrier.logo]),
            );

            console.log('[ENVIA] Received quotations:', enviaQuotations.length);

            // Agregar cada cotización de Envia.com a las opciones disponibles
            for (const quotation of enviaQuotations) {
              // Calcular días estimados desde deliveryDate o deliveryEstimate
              let estimatedDays = 3;
              if (quotation.deliveryDate?.dateDifference) {
                estimatedDays = quotation.deliveryDate.dateDifference;
              } else if (quotation.deliveryEstimate) {
                // Intentar extraer número de "3-5 días" o similar
                const match = quotation.deliveryEstimate.match(/(\d+)/);
                if (match) {
                  estimatedDays = parseInt(match[1], 10);
                }
              }

              availableOptions.push({
                methodId: 0, // Envia.com no tiene methodId en shipping_methods
                id: `envia-${quotation.carrier.toLowerCase()}-${quotation.service}`,
                method: `${quotation.carrier} - ${quotation.serviceDescription}`,
                methodCode: `envia-${quotation.carrier.toLowerCase()}-${quotation.service}`,
                price: Math.round(parseFloat(quotation.totalPrice)),
                estimatedDays,
                isRealTimeQuote: true,
                // Guardamos datos extras para usar al crear la orden
                enviaCarrier: quotation.carrier.toLowerCase(),
                enviaService: quotation.service,
                enviaServiceDescription: quotation.serviceDescription,
                carrierLogo: carrierLogoMap.get(quotation.carrier.toLowerCase()) || null,
              } as any);
            }
          } catch (enviaError) {
            console.error('[ENVIA] Error getting quotations:', enviaError);
            console.error('[ENVIA] Error details:', enviaError.message);
            // No hacer nada, continuar con otros métodos
          }
        }
      } else {
        console.log('[ENVIA] Vendor not configured for Envia.com or no carriers enabled');
      }
    } catch (error) {
      console.error('[ENVIA] Error checking vendor Envia.com config:', error);
      // No hacer nada, continuar con otros métodos
    }

    // ========== ENVÍO GRATIS Y DESCUENTOS ==========
    // Verificar si el vendor tiene envío gratis o descuentos configurados
    if (vendor?.settings) {
      try {
        const shippingSettings = (vendor.settings as any)?.shippingSettings;
        
        // Envío Gratis (100% descuento)
        if (shippingSettings?.freeShippingEnabled && shippingSettings?.freeShippingThreshold) {
          const threshold = Number(shippingSettings.freeShippingThreshold);

          if (declaredValue >= threshold) {
            console.log(`[FREE SHIPPING] Applied! Cart value: ${declaredValue} >= Threshold: ${threshold}`);

            if (availableOptions.length > 0) {
              const cheapestOption = availableOptions.reduce((min: any, option: any) =>
                Number(option.price) < Number(min.price) ? option : min,
              availableOptions[0] as any);
              const quotedPrice = Number(
                cheapestOption.originalPrice ?? cheapestOption.enviaQuotedPrice ?? cheapestOption.price ?? 0,
              );

              availableOptions = [{
                ...cheapestOption,
                method: 'Envío Gratis',
                displayMethod: 'Envío Gratis',
                originalPrice: quotedPrice,
                enviaQuotedPrice: quotedPrice,
                price: 0,
                isFreeShipping: true,
              }];
            } else {
              availableOptions.unshift({
                methodId: 999,
                method: 'Envío Gratis',
                methodCode: 'free_shipping',
                price: 0,
                estimatedDays: 5,
                isRealTimeQuote: false,
              });
            }
          } else {
            console.log(`[FREE SHIPPING] Not applied. Cart value: ${declaredValue} < Threshold: ${threshold}`);
          }
        }

        // Descuento 50% en Envío
        if (shippingSettings?.halfPriceShippingEnabled && shippingSettings?.halfPriceShippingThreshold) {
          const halfPriceThreshold = Number(shippingSettings.halfPriceShippingThreshold);
          
          // Si el valor declarado supera el umbral de 50% descuento, aplicar descuento a todas las opciones
          if (declaredValue >= halfPriceThreshold) {
            console.log(`[HALF PRICE SHIPPING] Applied! Cart value: $${declaredValue} >= Threshold: $${halfPriceThreshold}`);
            
            // Aplicar 50% descuento a todas las opciones de envío (excepto envío gratis)
            availableOptions = availableOptions.map(option => {
              if (option.methodCode !== 'free_shipping' && option.price > 0) {
                return {
                  ...option,
                  originalPrice: option.price, // Guardar precio original
                  price: Math.round(option.price * 0.5), // 50% descuento
                  hasDiscount: true,
                  discountPercentage: 50,
                };
              }
              return option;
            });
          } else {
            console.log(`[HALF PRICE SHIPPING] Not applied. Cart value: $${declaredValue} < Threshold: $${halfPriceThreshold}`);
          }
        }
      } catch (error) {
        console.error('[SHIPPING DISCOUNTS] Error checking shipping discounts config:', error);
      }
    }

    return availableOptions;
  }

  /**
   * Probar conexión con un proveedor de envío
   */
  async testConnection(methodCode: string, config: any): Promise<{ success: boolean; message: string }> {
    try {
      if (methodCode === 'bluex') {
        // BlueExpress usa integrationId como apiKey
        const integrationId = config.integrationId || config.apiKey;
        
        // Validar que tenga un ID de integración
        if (!integrationId || integrationId.trim().length === 0) {
          return {
            success: false,
            message: 'Por favor ingresa el ID de integración de BlueExpress.',
          };
        }

        // Validar con el API real de BlueExpress
        try {
          this.bluexService.initialize({
            apiKey: integrationId,
            integrationToken: config.integrationToken,
            baseUrl: config.baseUrl || 'https://apigw.bluex.cl',
            accountName: config.accountName || '',
            sandboxMode: config.sandboxMode || false,
          });

          const isValid = await this.bluexService.validateConfig();
          
          if (isValid) {
            return {
              success: true,
              message: 'Conexión exitosa con BlueExpress. ID de integración válido.',
            };
          } else {
            return {
              success: false,
              message: 'ID de integración inválido. Verifica que el ID sea correcto.',
            };
          }
        } catch (error) {
          console.error('Error validating BlueExpress config:', error);
          return {
            success: false,
            message: `Error al conectar con BlueExpress: ${error.message || 'Error desconocido'}`,
          };
        }
      }

      return {
        success: false,
        message: 'Método de envío no soportado',
      };
    } catch (error) {
      console.error('[TEST CONNECTION] Error:', error);
      return {
        success: false,
        message: error.message || 'Error al probar la conexión',
      };
    }
  }
}
