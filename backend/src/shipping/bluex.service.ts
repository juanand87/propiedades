import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface BluexConfig {
  apiKey: string;
  integrationToken?: string;
  baseUrl: string;
  accountName: string;
  sandboxMode?: boolean;
}

interface PricingRequest {
  from: {
    commune: string;
    region: string;
  };
  to: {
    commune: string;
    region: string;
  };
  serviceType: string;
  bultos: Array<{
    weight: number; // kg
    length: number; // cm
    width: number;  // cm
    height: number; // cm
  }>;
  declaredValue: number;
  familiaProducto: 'PAQU' | 'PUDO';
}

interface PricingResponse {
  price: number;
  estimatedDays: number;
  serviceType: string;
  additionalInfo?: any;
}

interface TrackingResponse {
  trackingNumber: string;
  status: string;
  history: Array<{
    date: string;
    status: string;
    description: string;
    location: string;
  }>;
}

@Injectable()
export class BluexService {
  private client: AxiosInstance;
  private config: BluexConfig;

  constructor() {
    // Default config - será sobrescrito por la configuración del vendor
    // URL común basada en el patrón de BlueExpress
    this.config = {
      apiKey: '',
      baseUrl: 'https://apigw.bluex.cl',
      accountName: '',
      sandboxMode: false,
    };
  }

  /**
   * Inicializar el servicio con la configuración del vendor
   */
  initialize(config: BluexConfig) {
    this.config = { ...this.config, ...config };
    
    // Probar con diferentes combinaciones de headers según la versión de BlueExpress
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    // Método 1: Solo apikey
    if (this.config.apiKey) {
      headers['apikey'] = this.config.apiKey;
    }
    
    // Método 2: Si tiene token, agregarlo como BX-TOKEN
    if (this.config.integrationToken) {
      headers['BX-TOKEN'] = this.config.integrationToken;
    }
    
    // Método 3: También probar con Authorization Bearer
    if (this.config.apiKey && !this.config.integrationToken) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers,
    });

    // Logging interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log('🔵 BlueX API Request:', {
          method: config.method,
          url: config.url,
          data: config.data,
        });
        return config;
      },
      (error) => {
        console.error('❌ BlueX Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log('✅ BlueX API Response:', {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        console.error('❌ BlueX Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Obtener cotización de envío
   */
  async getPricing(request: PricingRequest): Promise<PricingResponse> {
    try {
      const response = await this.client.post('/api/ecommerce/pricing/v1', {
        from: request.from,
        to: request.to,
        serviceType: request.serviceType,
        domain: this.config.accountName,
        datosProducto: {
          producto: 'P',
          familiaProducto: request.familiaProducto,
          bultos: request.bultos,
          claveValor: request.declaredValue,
        },
      });

      return {
        price: response.data.price || 0,
        estimatedDays: response.data.estimatedDays || 3,
        serviceType: response.data.serviceType || request.serviceType,
        additionalInfo: response.data,
      };
    } catch (error) {
      console.error('Error getting BlueX pricing:', error);
      throw new HttpException(
        {
          message: 'Error al obtener cotización de BlueX',
          error: error.response?.data || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Crear orden de envío
   */
  async createShipment(shipmentData: any): Promise<any> {
    try {
      const response = await this.client.post('/api/ecommerce/shipment/v1', {
        ...shipmentData,
        domain: this.config.accountName,
      });

      return response.data;
    } catch (error) {
      console.error('Error creating BlueX shipment:', error);
      throw new HttpException(
        {
          message: 'Error al crear envío en BlueX',
          error: error.response?.data || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Obtener tracking de un envío
   */
  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    try {
      const response = await this.client.get(
        `/api/ecommerce/tracking/v1/${trackingNumber}`,
      );

      return {
        trackingNumber: response.data.trackingNumber || trackingNumber,
        status: response.data.status || 'UNKNOWN',
        history: response.data.history || [],
      };
    } catch (error) {
      console.error('Error getting BlueX tracking:', error);
      throw new HttpException(
        {
          message: 'Error al obtener tracking de BlueX',
          error: error.response?.data || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Generar etiqueta de envío
   */
  async generateLabel(shipmentId: string): Promise<Buffer> {
    try {
      const response = await this.client.get(
        `/api/ecommerce/label/v1/${shipmentId}`,
        {
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error generating BlueX label:', error);
      throw new HttpException(
        {
          message: 'Error al generar etiqueta de BlueX',
          error: error.response?.data || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Validar configuración de API
   */
  async validateConfig(): Promise<boolean> {
    try {
      console.log('🔍 Validating BlueExpress config:', {
        baseUrl: this.config.baseUrl,
        apikey: this.config.apiKey?.substring(0, 10) + '...',
        'BX-TOKEN': this.config.integrationToken ? this.config.integrationToken.substring(0, 10) + '...' : 'not provided',
        hasAuthBearer: !!this.client.defaults.headers['Authorization'],
      });
      
      // Intentar hacer una cotización de prueba para validar credenciales
      const response = await this.client.post('/api/ecommerce/pricing/v1', {
        from: {
          country: 'CL',
          district: 'SAN',
        },
        to: {
          country: 'CL',
          state: '13', // Región Metropolitana
          district: 'SAN',
        },
        serviceType: 'EX',
        domain: this.config.accountName || 'test.com',
        datosProducto: {
          producto: 'P',
          familiaProducto: 'PAQU',
          bultos: [{
            peso: 1,
            largo: 10,
            ancho: 10,
            alto: 10,
            pesoFisico: 1,
            cantidad: 1,
          }],
        },
      });
      
      // Si llegamos aquí, la API key es válida
      console.log('✅ BlueX API key válida:', response.status);
      return true;
    } catch (error) {
      console.error('❌ BlueX validation error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      
      // Si el error es 401 o 403, la API key es inválida
      if (error.response?.status === 401 || error.response?.status === 403) {
        return false;
      }
      
      // Si hay respuesta del servidor (incluso con error), significa que la autenticación funcionó
      if (error.response?.status >= 400 && error.response?.status < 500) {
        console.log('✅ BlueX API key válida (error de validación de datos esperado)');
        return true;
      }
      
      // Errores de red o timeout
      return false;
    }
  }
}
