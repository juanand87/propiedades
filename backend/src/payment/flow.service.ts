import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplacePaymentMethod } from '../marketplace/marketplace-payment-method.entity';
import * as crypto from 'crypto';

@Injectable()
export class FlowService {
  constructor(
    @InjectRepository(MarketplacePaymentMethod)
    private paymentMethodsRepository: Repository<MarketplacePaymentMethod>,
  ) {}

  async createPayment(orderData: {
    orderId: string;
    amount: number;
    email: string;
    subject: string;
    vendorSlug?: string;
  }) {
    console.log('[FlowService] Creating payment for order:', orderData.orderId);
    
    // Get Flow config from marketplace payment methods
    const flowConfig = await this.getFlowConfig();

    if (!flowConfig || !flowConfig.enabled) {
      console.error('[FlowService] Flow payment method is not enabled or not found');
      throw new Error('Flow payment method is not enabled');
    }

    console.log('[FlowService] Flow config loaded. Environment:', flowConfig.config.environment);
    console.log('[FlowService] Config object:', JSON.stringify(flowConfig.config));

    // Parse config if it's a string
    const config = typeof flowConfig.config === 'string' 
      ? JSON.parse(flowConfig.config) 
      : flowConfig.config;

    const apiKey = config.apiKey;
    const secretKey = config.secretKey;
    const apiUrl = config.apiUrl;

    console.log('[FlowService] Parsed apiKey:', apiKey);
    console.log('[FlowService] Parsed secretKey:', secretKey ? '***' : 'null');
    console.log('[FlowService] Parsed apiUrl:', apiUrl);

    if (!apiKey || !secretKey) {
      console.error('[FlowService] Flow credentials not configured. ApiKey:', !!apiKey, 'SecretKey:', !!secretKey);
      throw new Error('Flow is not properly configured. Please configure API Key and Secret Key in marketplace settings.');
    }    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Build return URL with vendor context
    const returnUrl = new URL(`${frontendUrl}/payment/success`);
    returnUrl.searchParams.set('orderId', orderData.orderId);
    if (orderData.vendorSlug) {
      returnUrl.searchParams.set('vendorSlug', orderData.vendorSlug);
    }

    // Prepare payment data
    const params = {
      apiKey: apiKey,
      commerceOrder: orderData.orderId,
      subject: orderData.subject,
      currency: 'CLP',
      amount: Math.round(orderData.amount),
      email: orderData.email,
      urlConfirmation: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/payment/flow/confirm`,
      urlReturn: returnUrl.toString(),
    };

    // Sign request
    const signature = this.signParams(params, secretKey);
    const signedParams = { ...params, s: signature };

    console.log('[FlowService] Calling Flow API:', apiUrl);
    console.log('[FlowService] Request params:', JSON.stringify(params, null, 2));
    console.log('[FlowService] Signature:', signature);

    // Call Flow API
    try {
      const requestBody = new URLSearchParams(signedParams as any).toString();
      console.log('[FlowService] Request body:', requestBody);
      
      const response = await fetch(`${apiUrl}/payment/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody,
      });

      const data = await response.json();
      console.log('[FlowService] Flow API response:', data);

      if (data.url && data.token) {
        console.log('[FlowService] Payment created successfully. Token:', data.token);
        return {
          url: data.url + '?token=' + data.token,
          token: data.token,
        };
      }

      console.error('[FlowService] Flow API error response:', data);
      throw new Error(data.message || 'Error creating Flow payment');
    } catch (error) {
      console.error('[FlowService] Flow payment creation error:', error);
      throw error;
    }
  }

  async getPaymentStatus(token: string) {
    const flowConfig = await this.getFlowConfig();

    if (!flowConfig) {
      throw new Error('Flow payment method not found');
    }

    // Parse config if it's a string
    const config = typeof flowConfig.config === 'string' 
      ? JSON.parse(flowConfig.config) 
      : flowConfig.config;

    const apiKey = config.apiKey;
    const secretKey = config.secretKey;
    const apiUrl = config.apiUrl;

    if (!apiKey || !secretKey || !apiUrl) {
      throw new Error('Flow is not properly configured');
    }    const params = {
      apiKey,
      token,
    };

    const signature = this.signParams(params, secretKey);
    const signedParams = { ...params, s: signature };

    try {
      const response = await fetch(`${apiUrl}/payment/getStatus?${new URLSearchParams(signedParams as any).toString()}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Flow status check error:', error);
      throw error;
    }
  }

  private signParams(params: any, secretKey: string): string {
    const keys = Object.keys(params).sort();
    const string = keys.map(key => `${key}${params[key]}`).join('');
    return crypto.createHmac('sha256', secretKey).update(string).digest('hex');
  }

  private async getFlowConfig() {
    const flowMethod = await this.paymentMethodsRepository.findOne({
      where: { code: 'flow' }
    });
    
    return flowMethod;
  }
}
