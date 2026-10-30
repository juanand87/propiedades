import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Not, Repository } from 'typeorm';
import { MarketplaceSettings } from './marketplace-settings.entity';
import { MarketplacePaymentMethod } from './marketplace-payment-method.entity';
import { VendorPaymentMethod } from './vendor-payment-method.entity';
import { Vendor } from '../vendors/vendor.entity';
import { PaykuService } from '../payment/payku.service';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(MarketplaceSettings)
    private settingsRepository: Repository<MarketplaceSettings>,
    @InjectRepository(MarketplacePaymentMethod)
    private paymentMethodsRepository: Repository<MarketplacePaymentMethod>,
    @InjectRepository(VendorPaymentMethod)
    private vendorPaymentMethodsRepository: Repository<VendorPaymentMethod>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    private paykuService: PaykuService,
  ) {}

  // Settings
  async getAllSettings() {
    return this.settingsRepository.find({ where: { settingKey: Not(Like('mercadolibre_%')) } });
  }

  async getSetting(key: string) {
    if (key.startsWith('mercadolibre_')) return null;
    const setting = await this.settingsRepository.findOne({ where: { settingKey: key } });
    return setting ? setting.settingValue : null;
  }

  async updateSetting(key: string, value: string) {
    if (key.startsWith('mercadolibre_')) {
      throw new NotFoundException('Setting not found');
    }
    return this.updatePrivateSetting(key, value);
  }

  async getPrivateSetting(key: string) {
    const setting = await this.settingsRepository.findOne({ where: { settingKey: key } });
    return setting?.settingValue || null;
  }

  async updatePrivateSetting(key: string, value: string) {
    let setting = await this.settingsRepository.findOne({ where: { settingKey: key } });
    if (setting) {
      setting.settingValue = value;
    } else {
      setting = this.settingsRepository.create({ settingKey: key, settingValue: value });
    }
    return this.settingsRepository.save(setting);
  }

  // Payment Methods (Global)
  async getAllPaymentMethods() {
    return this.paymentMethodsRepository.find();
  }

  async getActivePaymentMethods() {
    return this.paymentMethodsRepository.find({
      where: { enabled: true }
    });
  }

  async getPaymentMethodByCode(code: string) {
    return this.paymentMethodsRepository.findOne({ where: { code } });
  }

  async updatePaymentMethod(id: string, data: Partial<MarketplacePaymentMethod>) {
    await this.paymentMethodsRepository.update(id, data);
    return this.paymentMethodsRepository.findOne({ where: { id } });
  }  // Vendor Payment Methods
  async getVendorPaymentMethods(vendorId: string) {
    const vendorIdNum = parseInt(vendorId, 10);
    return this.vendorPaymentMethodsRepository.find({
      where: { vendorId: vendorIdNum },
      relations: ['paymentMethod'],
    });
  }

  async enableVendorPaymentMethod(vendorId: string, paymentMethodId: number, customConfig?: any) {
    const vendorIdNum = parseInt(vendorId, 10);
    
    let vendorMethod = await this.vendorPaymentMethodsRepository.findOne({
      where: { 
        vendorId: vendorIdNum,
        marketplacePaymentMethodId: paymentMethodId 
      },
    });

    if (vendorMethod) {
      vendorMethod.isEnabled = true;
      if (customConfig) {
        vendorMethod.customConfig = customConfig;
      }
    } else {
      vendorMethod = this.vendorPaymentMethodsRepository.create({
        vendorId: vendorIdNum,
        marketplacePaymentMethodId: paymentMethodId,
        isEnabled: true,
        customConfig,
      });
    }

    return this.vendorPaymentMethodsRepository.save(vendorMethod);
  }

  async disableVendorPaymentMethod(vendorId: string, paymentMethodId: number) {
    const vendorIdNum = parseInt(vendorId, 10);
    
    const vendorMethod = await this.vendorPaymentMethodsRepository.findOne({
      where: { 
        vendorId: vendorIdNum,
        marketplacePaymentMethodId: paymentMethodId 
      },
    });

    if (vendorMethod) {
      vendorMethod.isEnabled = false;
      return this.vendorPaymentMethodsRepository.save(vendorMethod);
    }

    return null;
  }

  // Vendor Management
  async getAllVendors() {
    const vendors = await this.vendorsRepository.find({
      select: [
        'id',
        'storeName',
        'slug',
        'email',
        'paymentEmail',
        'paykuClientId',
        'paykuAffiliationToken',
        'isActive',
        'aiImageGenerationEnabled',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });
    
    // Excluir el vendor "Marketplace" que es un placeholder
    return vendors.filter(v => v.id !== '00000000-0000-0000-0000-000000000001');
  }

  async updateVendorPaykuCredentials(
    vendorId: string,
    data: { paykuClientId?: string; paykuAffiliationToken?: string },
  ) {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    if (data.paykuClientId !== undefined) {
      vendor.paykuClientId = data.paykuClientId;
    }

    if (data.paykuAffiliationToken !== undefined) {
      vendor.paykuAffiliationToken = data.paykuAffiliationToken;
    }

    return this.vendorsRepository.save(vendor);
  }

  async setupVendorPayku(
    vendorId: string,
    data: {
      vendorName: string;
      vendorEmail: string;
      vendorRut: string;
      vendorPhone: string;
      accountBankRut: string;
      accountBankSbif: string;
      accountBankType: string;
      accountBankNum: string;
      commissionPercentage?: number;
    },
  ) {
    console.log('[MarketplaceService] Setting up Payku for vendor:', vendorId);

    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    try {
      // Paso 1: Crear cliente en Payku
      const client = await this.paykuService.createMarketplaceClient({
        name: data.vendorName,
        email: data.vendorEmail,
        rut: data.vendorRut,
        phone: data.vendorPhone,
        accountBankRut: data.accountBankRut,
        accountBankSbif: data.accountBankSbif,
        accountBankType: data.accountBankType,
        accountBankNum: data.accountBankNum,
      });

      console.log('[MarketplaceService] Payku client created:', client.id);

      // Paso 2: Crear afiliación con comisión
      const affiliation = await this.paykuService.createMarketplaceAffiliation({
        clientId: client.id,
        commissionPercentage: data.commissionPercentage || 10,
      });

      console.log('[MarketplaceService] Payku affiliation created:', affiliation.token);

      // Paso 3: Guardar credenciales en el vendor
      vendor.paykuClientId = client.id;
      vendor.paykuAffiliationToken = affiliation.token;

      await this.vendorsRepository.save(vendor);

      return {
        success: true,
        message: 'Vendor Payku setup completed successfully',
        data: {
          clientId: client.id,
          affiliationToken: affiliation.token,
          commissionPercentage: data.commissionPercentage || 10,
        },
      };
    } catch (error) {
      console.error('[MarketplaceService] Error setting up Payku:', error);
      throw error;
    }
  }
}
