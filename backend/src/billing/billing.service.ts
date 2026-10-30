import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { EmailService } from '../email/email.service';
import { SmtpSettingsService } from '../marketplace/smtp-settings.service';
import {
  BillingSnapshot,
  InvoiceOrderSnapshot,
  VendorInvoice,
  VendorInvoiceStatus,
} from './vendor-invoice.entity';

const EXTERNAL_SOURCES = ['mercadolibre', 'woocommerce', 'falabella', 'paris', 'pos', 'assisted_sale'];

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(VendorInvoice)
    private readonly invoiceRepository: Repository<VendorInvoice>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Vendor)
    private readonly vendorRepository: Repository<Vendor>,
    private readonly emailService: EmailService,
    private readonly smtpSettingsService: SmtpSettingsService,
  ) {}

  private resolvePeriod(period?: string) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() - 1);
    const value = period || `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}`;
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) throw new BadRequestException('El período debe tener formato YYYY-MM');

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) throw new BadRequestException('Período inválido');

    const start = new Date(Date.UTC(year, month - 1, 1));
    const next = new Date(Date.UTC(year, month, 1));
    const end = new Date(next.getTime() - 86400000);
    return {
      value,
      year,
      month,
      start,
      next,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  private async loadVendor(vendorId: string) {
    const vendor = await this.vendorRepository
      .createQueryBuilder('vendor')
      .leftJoinAndSelect('vendor.user', 'user')
      .addSelect([
        'vendor.taxpayerType',
        'vendor.billingRut',
        'vendor.billingLegalName',
        'vendor.billingBusinessActivity',
        'vendor.billingAddress',
        'vendor.billingRegion',
        'vendor.billingCommune',
        'vendor.billingEmail',
      ])
      .where('vendor.id = :vendorId', { vendorId })
      .getOne();
    if (!vendor) throw new NotFoundException('Tienda no encontrada');
    return vendor;
  }

  private billingSnapshot(vendor: Vendor): BillingSnapshot {
    return {
      taxpayerType: vendor.taxpayerType,
      rut: vendor.billingRut,
      legalName: vendor.billingLegalName,
      businessActivity: vendor.billingBusinessActivity,
      address: vendor.billingAddress,
      region: vendor.billingRegion,
      commune: vendor.billingCommune,
      email: vendor.billingEmail,
    };
  }

  private profileComplete(snapshot: BillingSnapshot) {
    return Object.values(snapshot).every((value) => Boolean(String(value || '').trim()));
  }

  private escapeHtml(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatClp(value: number) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private async sendIssuedInvoiceEmail(invoice: VendorInvoice, vendor: Vendor) {
    const recipient = vendor.user?.email || vendor.billingEmail || vendor.email;
    if (!recipient) {
      return { sent: false, reason: 'La tienda no tiene un correo de administrador configurado.' };
    }

    const smtpConfig = await this.smtpSettingsService.getSmtpConfig();
    if (!smtpConfig) {
      return { sent: false, reason: 'El SMTP del marketplace no está configurado.' };
    }

    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/estado-cuenta`;
    const subject = `Factura de comisión ${invoice.invoiceNumber} - MundoBeat`;
    const html = `
      <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#10213d">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce5ef;border-radius:8px;overflow:hidden">
          <div style="background:#071a35;padding:22px 28px;color:#ffffff">
            <div style="font-size:21px;font-weight:700">MundoBeat</div>
            <div style="margin-top:4px;color:#b9c9dc;font-size:13px">Facturación de comisiones del marketplace</div>
          </div>
          <div style="padding:28px">
            <p style="margin:0 0 18px">Hola, administrador de <strong>${this.escapeHtml(vendor.storeName)}</strong>:</p>
            <p style="margin:0 0 22px;line-height:1.55">Se emitió el documento mensual correspondiente a las comisiones de ventas de tu tienda.</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:22px">
              <tr><td style="padding:9px 0;color:#607089;border-bottom:1px solid #e6edf5">Documento</td><td style="padding:9px 0;text-align:right;font-weight:700;border-bottom:1px solid #e6edf5">${this.escapeHtml(invoice.invoiceNumber)}</td></tr>
              <tr><td style="padding:9px 0;color:#607089;border-bottom:1px solid #e6edf5">Período</td><td style="padding:9px 0;text-align:right;border-bottom:1px solid #e6edf5">${this.escapeHtml(invoice.periodStart)} al ${this.escapeHtml(invoice.periodEnd)}</td></tr>
              <tr><td style="padding:9px 0;color:#607089;border-bottom:1px solid #e6edf5">Ventas incluidas</td><td style="padding:9px 0;text-align:right;border-bottom:1px solid #e6edf5">${invoice.orderCount}</td></tr>
              <tr><td style="padding:12px 0;font-weight:700">Comisión total</td><td style="padding:12px 0;text-align:right;font-size:19px;font-weight:700;color:#087fb8">${this.formatClp(invoice.totalAmount)}</td></tr>
            </table>
            <div style="padding:14px 16px;background:#eef8fc;border-left:4px solid #08a7d5;border-radius:4px;font-size:13px;line-height:1.5">
              Este monto ya fue descontado y compensado en las liquidaciones del período. No debes realizar un pago adicional.
            </div>
            <div style="margin-top:26px;text-align:center">
              <a href="${this.escapeHtml(dashboardUrl)}" style="display:inline-block;padding:11px 20px;background:#087fb8;color:#ffffff;text-decoration:none;border-radius:5px;font-weight:700">Ver factura en MundoBeat</a>
            </div>
          </div>
        </div>
      </div>`;

    try {
      await this.emailService.sendEmail(smtpConfig, recipient, subject, html);
      return { sent: true, recipient };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No fue posible enviar el correo.';
      console.error(`[BillingService] Invoice ${invoice.id} was issued, but email notification failed:`, reason);
      return { sent: false, recipient, reason };
    }
  }

  private async getPeriodOrders(period: ReturnType<BillingService['resolvePeriod']>) {
    return this.orderRepository
      .createQueryBuilder('order')
      .select([
        'order.id',
        'order.orderNumber',
        'order.vendorId',
        'order.createdAt',
        'order.commissionAmount',
        'order.marketplaceCommission',
      ])
      .where('order.createdAt >= :start AND order.createdAt < :next', { start: period.start, next: period.next })
      .andWhere("order.paymentStatus = 'approved'")
      .andWhere('(order.orderSource IS NULL OR order.orderSource NOT IN (:...externalSources))', {
        externalSources: EXTERNAL_SOURCES,
      })
      .andWhere('COALESCE(order.commissionAmount, order.marketplaceCommission, 0) > 0')
      .orderBy('order.createdAt', 'ASC')
      .getMany();
  }

  private mapOrder(order: Order): InvoiceOrderSnapshot {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      commission: Number(order.commissionAmount ?? order.marketplaceCommission) || 0,
    };
  }

  async getAdminPreview(periodValue?: string) {
    const period = this.resolvePeriod(periodValue);
    const orders = await this.getPeriodOrders(period);
    const vendorIds = [...new Set(orders.map((order) => order.vendorId).filter(Boolean))] as string[];
    const invoices = await this.invoiceRepository.find({
      where: { periodStart: period.startDate, periodEnd: period.endDate },
      order: { createdAt: 'DESC' },
    });
    invoices.forEach((invoice) => {
      if (!vendorIds.includes(invoice.vendorId)) vendorIds.push(invoice.vendorId);
    });

    const rows = await Promise.all(vendorIds.map(async (vendorId) => {
      const vendor = await this.loadVendor(vendorId);
      const vendorOrders = orders.filter((order) => order.vendorId === vendorId).map((order) => this.mapOrder(order));
      const activeInvoice = invoices.find((invoice) => invoice.vendorId === vendorId && invoice.status !== VendorInvoiceStatus.VOIDED) || null;
      const snapshot = this.billingSnapshot(vendor);
      return {
        vendorId,
        storeName: vendor.storeName,
        billingEmail: vendor.billingEmail,
        billingProfileComplete: this.profileComplete(snapshot),
        missingBillingFields: Object.entries(snapshot).filter(([, value]) => !String(value || '').trim()).map(([key]) => key),
        orderCount: vendorOrders.length,
        commissionTotal: vendorOrders.reduce((sum, order) => sum + order.commission, 0),
        orders: vendorOrders,
        invoice: activeInvoice,
      };
    }));

    return { period: period.value, periodStart: period.startDate, periodEnd: period.endDate, rows };
  }

  async createDraft(vendorId: string, periodValue: string, createdById?: string) {
    if (!vendorId) throw new BadRequestException('La tienda es obligatoria');
    const period = this.resolvePeriod(periodValue);
    const duplicate = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.vendorId = :vendorId', { vendorId })
      .andWhere('invoice.periodStart = :periodStart', { periodStart: period.startDate })
      .andWhere('invoice.periodEnd = :periodEnd', { periodEnd: period.endDate })
      .andWhere('invoice.status != :voided', { voided: VendorInvoiceStatus.VOIDED })
      .getOne();
    if (duplicate) {
      throw new BadRequestException('La tienda ya tiene una factura para este período');
    }

    const vendor = await this.loadVendor(vendorId);
    const details = (await this.getPeriodOrders(period))
      .filter((order) => order.vendorId === vendorId)
      .map((order) => this.mapOrder(order));
    const total = details.reduce((sum, order) => sum + order.commission, 0);
    if (!details.length || total <= 0) throw new BadRequestException('No hay comisiones facturables en este período');

    return this.invoiceRepository.save(this.invoiceRepository.create({
      vendorId,
      periodStart: period.startDate,
      periodEnd: period.endDate,
      status: VendorInvoiceStatus.DRAFT,
      orderCount: details.length,
      commissionTotal: total,
      taxAmount: 0,
      totalAmount: total,
      paymentMethod: 'compensated',
      billingSnapshot: this.billingSnapshot(vendor),
      orderDetails: details,
      createdById: createdById || null,
    }));
  }

  async issue(id: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (invoice.status !== VendorInvoiceStatus.DRAFT) throw new BadRequestException('Solo se pueden emitir facturas en borrador');

    const vendor = await this.loadVendor(invoice.vendorId);
    const snapshot = this.billingSnapshot(vendor);
    if (!this.profileComplete(snapshot)) {
      throw new BadRequestException('La tienda debe completar todos sus datos de facturación antes de emitir');
    }

    const issueDate = new Date();
    const prefix = `MB-${issueDate.getFullYear()}${String(issueDate.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.invoiceNumber LIKE :prefix', { prefix: `${prefix}-%` })
      .getCount();

    invoice.invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
    invoice.status = VendorInvoiceStatus.ISSUED;
    invoice.billingSnapshot = snapshot;
    invoice.issuedAt = issueDate;
    const savedInvoice = await this.invoiceRepository.save(invoice);
    const emailNotification = await this.sendIssuedInvoiceEmail(savedInvoice, vendor);
    return { ...savedInvoice, emailNotification };
  }

  async void(id: string, reason?: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (invoice.status === VendorInvoiceStatus.VOIDED) throw new BadRequestException('La factura ya está anulada');
    if (invoice.status === VendorInvoiceStatus.ISSUED && !String(reason || '').trim()) {
      throw new BadRequestException('Debes indicar el motivo de anulación');
    }
    invoice.status = VendorInvoiceStatus.VOIDED;
    invoice.voidReason = String(reason || 'Borrador descartado').trim();
    invoice.voidedAt = new Date();
    return this.invoiceRepository.save(invoice);
  }

  async getVendorInvoices(vendorId?: string) {
    if (!vendorId) throw new BadRequestException('El usuario no tiene una tienda asociada');
    return this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.vendorId = :vendorId', { vendorId })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [VendorInvoiceStatus.ISSUED, VendorInvoiceStatus.VOIDED],
      })
      .orderBy('invoice.periodStart', 'DESC')
      .addOrderBy('invoice.createdAt', 'DESC')
      .getMany();
  }
}
