import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplacePaymentMethod } from '../marketplace/marketplace-payment-method.entity';
import { Vendor } from '../vendors/vendor.entity';
import * as crypto from 'crypto';

@Injectable()
export class PaykuService {
  constructor(
    @InjectRepository(MarketplacePaymentMethod)
    private paymentMethodsRepository: Repository<MarketplacePaymentMethod>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
  ) {}

  // Crear cliente en Payku Marketplace
  async createMarketplaceClient(data: {
    name: string;
    email: string;
    rut: string;
    phone: string;
    accountBankRut: string;
    accountBankSbif: string;
    accountBankType: string;
    accountBankNum: string;
  }) {
    console.log('[PaykuService] Creating Payku marketplace client:', data.name);
    
    const paykuConfig = await this.getPaykuConfig();
    if (!paykuConfig || !paykuConfig.enabled) {
      throw new Error('Payku payment method is not enabled');
    }

    const config = typeof paykuConfig.config === 'string' 
      ? JSON.parse(paykuConfig.config) 
      : paykuConfig.config;

    const publicToken = config.publicToken;
    const apiUrl = config.apiUrl || 'https://app.payku.cl/api';

    console.log('[PaykuService] API URL:', apiUrl);
    console.log('[PaykuService] Public Token (first 10 chars):', publicToken?.substring(0, 10));

    try {
      const response = await fetch(`${apiUrl}/maclient`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          rut: data.rut,
          phone: data.phone,
          accountbankrut: data.accountBankRut,
          accountbanksbif: data.accountBankSbif,
          accountbanktype: data.accountBankType,
          accountbanknum: data.accountBankNum,
        }),
      });

      const result = await response.json();
      console.log('[PaykuService] Client response:', JSON.stringify(result));
      
      if (result.status === 'failed' || result.type === 'Unprocessable Entity') {
        throw new Error(result.message_error || 'Failed to create Payku client');
      }
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create Payku client');
      }

      return result;
    } catch (error) {
      console.error('[PaykuService] Error creating Payku client:', error);
      throw error;
    }
  }

  // Crear afiliación en Payku Marketplace
  async createMarketplaceAffiliation(data: {
    clientId: string;
    commissionPercentage: number;
  }) {
    console.log('[PaykuService] Creating Payku marketplace affiliation for client:', data.clientId);
    
    const paykuConfig = await this.getPaykuConfig();
    if (!paykuConfig || !paykuConfig.enabled) {
      throw new Error('Payku payment method is not enabled');
    }

    const config = typeof paykuConfig.config === 'string' 
      ? JSON.parse(paykuConfig.config) 
      : paykuConfig.config;

    const publicToken = config.publicToken;
    const apiUrl = config.apiUrl || 'https://app.payku.cl/api';

    try {
      const response = await fetch(`${apiUrl}/maaffiliation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.clientId,
          percentage: data.commissionPercentage,
          affiliation: data.clientId,
        }),
      });

      const result = await response.json();
      console.log('[PaykuService] Affiliation response:', JSON.stringify(result));
      
      if (result.type === 'Unprocessable Entity') {
        throw new Error(result.message_error || 'Failed to create Payku affiliation');
      }
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create Payku affiliation');
      }

      return result;
    } catch (error) {
      console.error('[PaykuService] Error creating Payku affiliation:', error);
      throw error;
    }
  }

  async createMarketplaceTransaction(orderData: {
    orderId: string;
    totalAmount: number;
    customerEmail: string;
    subject: string;
    vendorSlug: string;
    vendorId?: string;
    paykuPaymentMethod?: string;
    originHostname?: string;
    returnUrlOverride?: string;
  }) {
    console.log('[PaykuService] Creating marketplace transaction for order:', orderData.orderId);
    
    // Get Payku config from marketplace payment methods
    const paykuConfig = await this.getPaykuConfig();

    if (!paykuConfig || !paykuConfig.enabled) {
      console.error('[PaykuService] Payku payment method is not enabled or not found');
      throw new Error('Payku payment method is not enabled');
    }

    console.log('[PaykuService] Payku config loaded. Environment:', paykuConfig.config.environment);

    // Parse config if it's a string
    const config = typeof paykuConfig.config === 'string' 
      ? JSON.parse(paykuConfig.config) 
      : paykuConfig.config;

    const publicToken = config.publicToken;
    const privateToken = config.privateToken;
    const apiUrl = config.apiUrl || 'https://app.payku.cl/api';
    
    // 🔔 WEBHOOK URL: Always use the public backend URL for webhook notifications
    // Payku needs to call this URL from the internet, so localhost won't work
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    let notifyUrl = `${backendUrl}/api/payment/payku/webhook`;
    
    // Return URL - will be overridden by originHostname if provided
    let returnUrl = config.returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`;
    
    console.log('[PaykuService] 🔔 Webhook URL:', notifyUrl);
    
    if (orderData.vendorId) {
      try {
        const vendor = await this.paymentMethodsRepository.manager
          .getRepository('Vendor')
          .findOne({ where: { id: orderData.vendorId } });
        
        if (vendor) {
          // Note: We no longer use vendor.paykuNotifyUrl because webhook must be consistent
          // Only use vendor's returnUrl if originHostname is NOT provided
          // originHostname has priority as it's the actual domain user is on
          if (vendor.paykuReturnUrl && !orderData.originHostname) {
            returnUrl = vendor.paykuReturnUrl.replace('{orderId}', orderData.orderId);
            console.log('[PaykuService] Using vendor custom returnUrl:', returnUrl);
          }
        }
      } catch (vendorError) {
        console.error('[PaykuService] Error fetching vendor URLs, using defaults:', vendorError);
      }
    }
    
    // 🌐 CUSTOM DOMAIN SUPPORT: If originHostname is provided, use it to build returnUrl
    // This ensures Payku redirects back to the same domain where payment was initiated
    // This takes PRIORITY over vendor.paykuReturnUrl as it's the actual runtime domain
    if (orderData.originHostname) {
      const envFrontendUrl = process.env.FRONTEND_URL;
      const isLocalhost = orderData.originHostname.includes('localhost');
      const isMainDomain = orderData.originHostname === 'www.mundobeat.cl' || 
                           orderData.originHostname === 'mundobeat.cl';
      
      // Detectar si es un subdomain de mundobeat.cl (ej: cdmania.mundobeat.cl)
      // Un subdomain tendrá ".mundobeat.cl" en el hostname pero NO será "mundobeat.cl" o "www.mundobeat.cl"
      const isSubdomain = orderData.originHostname.includes('.mundobeat.cl') && !isMainDomain;
      
      console.log('[PaykuService] 🔍 FRONTEND_URL env:', envFrontendUrl);
      console.log('[PaykuService] 🔍 originHostname:', orderData.originHostname);
      console.log('[PaykuService] 🔍 isMainDomain:', isMainDomain, '| isLocalhost:', isLocalhost, '| isSubdomain:', isSubdomain);
      
      // 🎯 If subdomain access: Check if vendor has verified custom domain
      // If yes, redirect to custom domain instead of subdomain
      let vendorCustomDomain: string | null = null;
      if (isSubdomain && orderData.vendorId) {
        try {
          const vendor = await this.vendorsRepository
            .createQueryBuilder('vendor')
            .select(['vendor.id', 'vendor.customDomain', 'vendor.customDomainVerified'])
            .where('vendor.id = :vendorId', { vendorId: orderData.vendorId })
            .getOne();
          
          if (vendor?.customDomain && vendor.customDomainVerified) {
            vendorCustomDomain = vendor.customDomain;
            console.log('[PaykuService] ✅ Vendor has verified custom domain:', vendorCustomDomain);
          }
        } catch (err) {
          console.error('[PaykuService] Error fetching vendor custom domain:', err);
        }
      }

      // Decision tree:
      // 1. If subdomain but vendor has verified custom domain → use custom domain
      // 2. If subdomain without custom domain → use FRONTEND_URL with /tiendas/{slug} path
      // 3. If custom domain access (not main, not localhost, not subdomain) → use that domain
      // 4. If main domain → use FRONTEND_URL from env
      // 5. If localhost → use localhost
      
      if (isSubdomain && vendorCustomDomain) {
        // Subdomain access but vendor has custom domain - redirect to custom domain
        returnUrl = `https://${vendorCustomDomain}/payment/success?order=${orderData.orderId}`;
        console.log('[PaykuService] 🎯 Redirecting subdomain to CUSTOM DOMAIN:', returnUrl);
      } else if (isSubdomain) {
        // Subdomain without custom domain - use main domain with proper path
        const vendorSlug = orderData.originHostname.split('.mundobeat.cl')[0];
        if (envFrontendUrl && !envFrontendUrl.includes('localhost')) {
          returnUrl = `${envFrontendUrl}/tiendas/${vendorSlug}/pedido/${orderData.orderId}`;
          console.log('[PaykuService] ✅ Using SUBDOMAIN with proper path:', returnUrl);
        } else {
          // Fallback to subdomain itself
          returnUrl = `https://${orderData.originHostname}/payment/success?order=${orderData.orderId}`;
          console.log('[PaykuService] ⚠️ Subdomain fallback:', returnUrl);
        }
      } else if (!isLocalhost && !isMainDomain) {
        // Custom domain (e.g., cdmania.cl) - use it directly
        returnUrl = `https://${orderData.originHostname}/payment/success?order=${orderData.orderId}`;
        console.log('[PaykuService] ✅ Using CUSTOM DOMAIN:', returnUrl);
      } else if (isMainDomain && envFrontendUrl && !envFrontendUrl.includes('localhost')) {
        // Main domain in production - use env variable
        returnUrl = `${envFrontendUrl}/payment/success?order=${orderData.orderId}`;
        console.log('[PaykuService] ✅ Using FRONTEND_URL from env:', returnUrl);
      } else {
        // Localhost or fallback
        const protocol = isLocalhost ? 'http' : 'https';
        const baseUrl = `${protocol}://${orderData.originHostname}`;
        returnUrl = `${baseUrl}/payment/success?order=${orderData.orderId}`;
        console.log('[PaykuService] ⚠️ Using originHostname fallback:', returnUrl);
      }
    }
    
    if (orderData.returnUrlOverride) {
      returnUrl = orderData.returnUrlOverride;
    }

    console.log('[PaykuService] Final URLs - notify:', notifyUrl, '| return:', returnUrl);

    if (!publicToken || !privateToken) {
      console.error('[PaykuService] Payku is not properly configured');
      throw new Error('Payku is not properly configured. Please add public and private tokens.');
    }

    // Build transaction data with marketplace
    // Payment method code: '99' = Shows all available payment methods in Payku
    const paymentMethod = orderData.paykuPaymentMethod || '99';
    
    const transactionData: any = {
      email: orderData.customerEmail,
      order: orderData.orderId,
      subject: orderData.subject,
      amount: Math.round(orderData.totalAmount), // Payku requires integer
      payment: paymentMethod,
      urlreturn: returnUrl, // Payku always redirects here regardless of payment status
      urlnotify: notifyUrl, // Webhook receives the actual payment status
    };

    // 🏦 Centralized payment model
    // All payment goes to marketplace account
    // Admin will handle distribution to vendors via liquidaciones system
    console.log('[PaykuService] 💰 Centralized payment: All amount ($' + orderData.totalAmount + ') goes to marketplace');
    console.log('[PaykuService] ℹ️ Vendor will receive their amount after admin approves liquidación');

    console.log('[PaykuService] Transaction data:', JSON.stringify(transactionData, null, 2));

    // Create authorization header
    const authString = `Bearer ${publicToken}`;

    // Call Payku API
    try {
      const response = await fetch(`${apiUrl}/transaction`, {
        method: 'POST',
        headers: {
          'Authorization': authString,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      const data = await response.json();
      console.log('[PaykuService] Payku API response:', data);

      if (response.ok && data.url && data.id) {
        console.log('[PaykuService] Transaction created successfully. ID:', data.id);
        return {
          url: data.url,
          transactionId: data.id,
          status: data.status,
        };
      }

      console.error('[PaykuService] Payku API error response:', data);
      throw new Error(data.message || 'Error creating Payku transaction');
    } catch (error) {
      console.error('[PaykuService] Payku transaction creation error:', error);
      throw error;
    }
  }

  async getTransactionStatus(transactionId: string) {
    const paykuConfig = await this.getPaykuConfig();

    if (!paykuConfig) {
      throw new Error('Payku payment method not found');
    }

    // Parse config if it's a string
    const config = typeof paykuConfig.config === 'string' 
      ? JSON.parse(paykuConfig.config) 
      : paykuConfig.config;

    const publicToken = config.publicToken;
    const apiUrl = config.apiUrl || 'https://app.payku.cl/api';

    if (!publicToken) {
      throw new Error('Payku is not properly configured');
    }

    try {
      const response = await fetch(`${apiUrl}/transaction/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('[PaykuService] Transaction status:', JSON.stringify(data, null, 2));
      
      // Normalizar el estado de Payku a nuestros estados internos
      let normalizedStatus = 'pending';
      
      if (data.status === 'success' || data.status === 'paid') {
        normalizedStatus = 'success';
      } else if (data.status === 'rejected' || data.status === 'failed' || data.status === 'cancelled') {
        normalizedStatus = 'failed';
      } else if (data.status === 'expired') {
        normalizedStatus = 'expired';
      }
      
      return {
        ...data,
        status: normalizedStatus,
        originalStatus: data.status,
      };
    } catch (error) {
      console.error('[PaykuService] Error getting transaction status:', error);
      throw error;
    }
  }

  async getTransactionMarketplaceDetails(transactionId: string) {
    const transaction = await this.getTransactionStatus(transactionId);
    
    // Extraer información relevante de marketplace
    return {
      transactionId: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      gateway_response: transaction.gateway_response,
      marketplace: {
        hasMarketplace: !!transaction.marketplace,
        affiliationToken: transaction.marketplace || 'No tiene token de afiliación',
        distribution: transaction.marketplace 
          ? 'El pago se dividirá automáticamente según la comisión configurada'
          : 'Este pago NO se dividió con marketplace (no tiene token de afiliación)',
      },
      created_at: transaction.created_at,
      fullResponse: transaction,
    };
  }

  async createNullification(transactionId: string, amount: number, subject: string) {
    const { publicToken, privateToken, apiUrl } = await this.getApiCredentials();
    const payload = {
      id: transactionId,
      amount: Math.round(amount),
      subject: subject.substring(0, 200),
    };
    const sign = this.createApiSignature('/api/nullification', payload, privateToken);
    const response = await fetch(`${apiUrl}/nullification`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicToken}`,
        Sign: sign,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'failed') {
      throw new Error(data.message_error || data.message || `Payku rechazó la anulación (${response.status})`);
    }
    return data;
  }

  async getNullification(transactionId: string) {
    const { publicToken, apiUrl } = await this.getApiCredentials();
    const response = await fetch(`${apiUrl}/nullification/${encodeURIComponent(transactionId)}`, {
      headers: {
        Authorization: `Bearer ${publicToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'failed') {
      throw new Error(data.message_error || data.message || `No se pudo consultar la anulación (${response.status})`);
    }
    return data;
  }

  private async getApiCredentials() {
    const paykuConfig = await this.getPaykuConfig();
    if (!paykuConfig?.enabled) throw new Error('Payku no está habilitado');
    const config = typeof paykuConfig.config === 'string' ? JSON.parse(paykuConfig.config) : paykuConfig.config;
    if (!config?.publicToken || !config?.privateToken) throw new Error('Payku no tiene tokens configurados');
    return {
      publicToken: config.publicToken as string,
      privateToken: config.privateToken as string,
      apiUrl: (config.apiUrl || 'https://app.payku.cl/api').replace(/\/$/, ''),
    };
  }

  private createApiSignature(requestPath: string, data: Record<string, unknown>, privateToken: string) {
    const params = new URLSearchParams();
    Object.keys(data).sort().forEach((key) => {
      const value = data[key];
      if (value !== null && value !== undefined && typeof value !== 'object') params.append(key, String(value));
    });
    const source = `${encodeURIComponent(requestPath)}&${params.toString()}`;
    return crypto.createHmac('sha256', privateToken).update(source).digest('hex');
  }

  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    const paykuConfig = await this.getPaykuConfig();

    if (!paykuConfig) {
      return false;
    }

    const config = typeof paykuConfig.config === 'string' 
      ? JSON.parse(paykuConfig.config) 
      : paykuConfig.config;

    const privateToken = config.privateToken;

    if (!privateToken) {
      return false;
    }

    const hash = crypto
      .createHmac('sha256', privateToken)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  async getAvailablePaymentMethods() {
    console.log('[PaykuService] Getting available payment methods');
    
    const paykuConfig = await this.getPaykuConfig();

    if (!paykuConfig || !paykuConfig.enabled) {
      console.error('[PaykuService] Payku payment method is not enabled');
      throw new Error('Payku payment method is not enabled');
    }

    const config = typeof paykuConfig.config === 'string' 
      ? JSON.parse(paykuConfig.config) 
      : paykuConfig.config;

    const publicToken = config.publicToken;
    const apiUrl = config.apiUrl || 'https://app.payku.cl/api';

    if (!publicToken) {
      throw new Error('Payku is not properly configured');
    }

    try {
      // Call Payku API to get available payment methods
      const response = await fetch(`${apiUrl}/payments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[PaykuService] Failed to fetch payment methods:', response.status);
        // Return default methods if API call fails
        return this.getDefaultPaymentMethods();
      }

      const data = await response.json();
      console.log('[PaykuService] Payment methods from Payku:', data);

      // Map Payku response to our format
      if (data && Array.isArray(data.payments)) {
        return data.payments.map((method: any) => ({
          code: method.id || method.code,
          name: method.name,
          description: method.description || '',
          enabled: method.enabled !== false,
        }));
      }

      // Return default methods if response format is unexpected
      return this.getDefaultPaymentMethods();
    } catch (error) {
      console.error('[PaykuService] Error fetching payment methods:', error);
      // Return default methods on error
      return this.getDefaultPaymentMethods();
    }
  }

  private getDefaultPaymentMethods() {
    // Payment methods enabled in Payku account
    return [
      { code: '1', name: 'Webpay', description: 'Tarjetas de crédito y débito', enabled: true },
      { code: '4', name: 'Khipu', description: 'Transferencia instantánea', enabled: true },
      { code: '5', name: 'Mach', description: 'Pago con Mach', enabled: true },
      { code: '6', name: 'Etpay', description: 'Pago con Etpay', enabled: true },
      { code: '8', name: 'Pago', description: 'Banco Ripley (Pago)', enabled: true },
      { code: '9', name: 'Hites', description: 'Tarjeta Hites', enabled: true },
      { code: '10', name: 'Fintoc', description: 'Transferencia Fintoc', enabled: true },
    ];
  }

  private async getPaykuConfig() {
    const config = await this.paymentMethodsRepository.findOne({
      where: { code: 'payku' },
    });
    
    if (config) {
      const parsedConfig = typeof config.config === 'string' 
        ? JSON.parse(config.config) 
        : config.config;
      console.log('[PaykuService] Config loaded - Environment:', parsedConfig.environment);
      console.log('[PaykuService] Config loaded - API URL:', parsedConfig.apiUrl);
    }
    
    return config;
  }
}
