import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomUUID } from 'crypto';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { withStoreSender } from '../email/store-sender';
import { SmtpSettings } from '../marketplace/smtp-settings.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { SubmitVendorReviewDto } from './dto/submit-vendor-review.dto';
import {
  canEditReview,
  REVIEW_EDIT_DAYS,
  REVIEW_MAX_EMAILS,
  REVIEW_REMINDER_DAYS,
  REVIEWABLE_ORDER_SOURCES,
} from './review-rules';
import { VendorReview } from './vendor-review.entity';
import { DiscountsService } from '../discounts/discounts.service';

@Injectable()
export class ReviewsService {
  private processing = false;
  private readonly reviewRequestsStartAt = this.resolveReviewRequestsStartAt();

  constructor(
    @InjectRepository(VendorReview)
    private readonly reviewsRepository: Repository<VendorReview>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Vendor)
    private readonly vendorsRepository: Repository<Vendor>,
    @InjectRepository(VendorSettings)
    private readonly vendorSettingsRepository: Repository<VendorSettings>,
    @InjectRepository(SmtpSettings)
    private readonly smtpSettingsRepository: Repository<SmtpSettings>,
    private readonly emailService: EmailService,
    private readonly discounts: DiscountsService,
  ) {}

  @Cron('30 */15 * * * *')
  async processReviewRequests(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.createRequestsForDeliveredOrders();
      await this.sendDueEmails();
    } catch (error) {
      console.error('[Reviews] Scheduled review processing failed:', error?.message || error);
    } finally {
      this.processing = false;
    }
  }

  async createRequestsForDeliveredOrders(): Promise<number> {
    const orders = await this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('order.orderSource IN (:...sources)', { sources: [...REVIEWABLE_ORDER_SOURCES] })
      .andWhere('order.updatedAt >= :reviewRequestsStartAt', { reviewRequestsStartAt: this.reviewRequestsStartAt })
      .andWhere('order.vendorId IS NOT NULL')
      .andWhere('(order.customerEmail IS NOT NULL OR JSON_UNQUOTE(JSON_EXTRACT(order.guestData, \'$.email\')) IS NOT NULL)')
      .andWhere(`(
        order.enviaShippingStatus = 'delivered'
        OR EXISTS (
          SELECT 1 FROM order_shipments shipment
          WHERE shipment.order_id = order.id
            AND (shipment.status = 'delivered' OR shipment.envia_shipping_status = 'delivered')
        )
      )`)
      .andWhere(`NOT EXISTS (
        SELECT 1 FROM vendor_reviews review
        WHERE review.order_id = order.id AND review.vendor_id = order.vendorId
      )`)
      .orderBy('order.updatedAt', 'ASC')
      .take(100)
      .getMany();

    let created = 0;
    for (const order of orders) {
      const email = String(order.customerEmail || order.guestData?.email || '').trim().toLowerCase();
      if (!email || !order.vendorId) continue;
      try {
        const reviewId = randomUUID();
        const token = this.buildToken(reviewId);
        await this.reviewsRepository.save(this.reviewsRepository.create({
          id: reviewId,
          orderId: order.id,
          vendorId: order.vendorId,
          orderNumber: order.orderNumber,
          customerEmail: email,
          customerName: order.shippingName || order.guestData?.name || null,
          tokenHash: this.hashToken(token),
          status: 'pending',
          emailCount: 0,
          nextEmailAt: new Date(),
        }));
        created += 1;
      } catch (error) {
        if (error?.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
    return created;
  }

  async sendDueEmails(): Promise<number> {
    const now = new Date();
    const due = await this.reviewsRepository.find({
      where: {
        status: 'pending',
        nextEmailAt: LessThanOrEqual(now),
      },
      order: { nextEmailAt: 'ASC' },
      take: 50,
    });

    let sent = 0;
    for (const review of due) {
      if (review.emailCount >= REVIEW_MAX_EMAILS || review.rating) continue;

      const claimUntil = new Date(now.getTime() + 60 * 60 * 1000);
      const claim = await this.reviewsRepository.update(
        {
          id: review.id,
          status: 'pending',
          emailCount: review.emailCount,
          nextEmailAt: LessThanOrEqual(now),
        },
        { nextEmailAt: claimUntil, lastEmailAttemptAt: now },
      );
      if (!claim.affected) continue;

      try {
        await this.sendReviewEmail(review, this.buildToken(review.id));

        const emailCount = review.emailCount + 1;
        const nextEmailAt = emailCount < REVIEW_MAX_EMAILS
          ? new Date(now.getTime() + REVIEW_REMINDER_DAYS * 24 * 60 * 60 * 1000)
          : null;
        await this.reviewsRepository.update(review.id, {
          emailCount,
          firstEmailSentAt: review.firstEmailSentAt || now,
          lastEmailSentAt: now,
          lastEmailError: null,
          nextEmailAt,
        });
        sent += 1;
      } catch (error) {
        await this.reviewsRepository.update(review.id, {
          lastEmailError: String(error?.message || error).slice(0, 2000),
          nextEmailAt: claimUntil,
        });
      }
    }
    return sent;
  }

  async getPublicReview(token: string) {
    const review = await this.findByToken(token);
    const [vendor, settings, order] = await Promise.all([
      this.vendorsRepository.findOne({ where: { id: review.vendorId } }),
      this.vendorSettingsRepository.findOne({ where: { vendorId: review.vendorId } }),
      this.ordersRepository.findOne({ where: { id: review.orderId }, relations: ['items'] }),
    ]);
    if (!vendor || !order) throw new NotFoundException('La evaluación ya no está disponible');

    return {
      orderNumber: review.orderNumber,
      storeName: vendor.storeName,
      storeSlug: vendor.slug,
      storeLogo: vendor.logo || settings?.headerConfig?.logo || null,
      products: (order.items || []).map((item) => ({
        title: item.productTitle || 'Producto',
        image: item.productImage || null,
        quantity: item.quantity,
      })),
      rating: review.rating,
      comment: review.comment || '',
      submittedAt: review.submittedAt,
      editableUntil: review.editableUntil,
      canEdit: !review.rating || canEditReview(review.editableUntil),
    };
  }

  async submit(token: string, data: SubmitVendorReviewDto) {
    const review = await this.findByToken(token);
    if (review.rating && !canEditReview(review.editableUntil)) {
      throw new BadRequestException('El plazo de 7 días para modificar esta calificación terminó');
    }

    const now = new Date();
    const isFirstSubmission = !review.submittedAt;
    review.rating = data.rating;
    review.comment = data.comment?.trim() || null;
    review.status = 'submitted';
    review.submittedAt = review.submittedAt || now;
    review.editableUntil = review.editableUntil || new Date(now.getTime() + REVIEW_EDIT_DAYS * 24 * 60 * 60 * 1000);
    review.nextEmailAt = null;
    review.lastEmailError = null;
    await this.reviewsRepository.save(review);
    await this.recalculateVendorRating(review.vendorId);
    const recovery = await this.discounts.recoveryForReview(review.id);
    if (recovery?.acceptedAt) {
      recovery.reviewUpdatedAt = now;
      await this.discounts.saveRecovery(recovery);
    }

    return {
      success: true,
      message: isFirstSubmission ? 'Gracias por calificar tu compra' : 'Tu calificación fue actualizada',
      rating: review.rating,
      comment: review.comment || '',
      editableUntil: review.editableUntil,
      canEdit: true,
    };
  }

  async getVendorSummary(vendorId: string) {
    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Tienda no encontrada');
    const rows = await this.reviewsRepository
      .createQueryBuilder('review')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('review.vendorId = :vendorId', { vendorId })
      .andWhere('review.status = :status', { status: 'submitted' })
      .andWhere('review.rating IS NOT NULL')
      .groupBy('review.rating')
      .getRawMany<{ rating: string; count: string }>();
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach((row) => { distribution[Number(row.rating)] = Number(row.count); });
    return {
      average: Number(vendor.rating || 0),
      count: Number((vendor as any).ratingCount || 0),
      distribution,
    };
  }

  async getMine(userId: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!vendor) throw new NotFoundException('Tienda no encontrada');
    const [summary, reviews] = await Promise.all([
      this.getVendorSummary(vendor.id),
      this.reviewsRepository.find({
        where: { vendorId: vendor.id, status: 'submitted' },
        order: { submittedAt: 'DESC' },
        take: 200,
      }),
    ]);
    const recoveries = await this.discounts.recoveriesForReviews(reviews.map((review) => review.id));
    return {
      ...summary,
      reviews: reviews.map((review) => ({
        id: review.id,
        orderNumber: review.orderNumber,
        customerName: this.abbreviateName(review.customerName),
        rating: review.rating,
        comment: review.comment || '',
        submittedAt: review.submittedAt,
        updatedAt: review.updatedAt,
        recovery: this.recoveryStatus(recoveries.find((code) => code.reviewId === review.id)),
      })),
    };
  }

  async getMineOrderReview(userId: string, orderId: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!vendor) throw new NotFoundException('Tienda no encontrada');
    const order = await this.getOrderForReview(orderId);
    if (order.vendorId !== vendor.id) throw new NotFoundException('Pedido no encontrado');
    const review = await this.reviewsRepository.findOne({
      where: { orderId: order.id, vendorId: vendor.id },
    });
    const status = this.buildOrderReviewStatus(order, review);
    return {
      state: status.state,
      eligible: status.eligible,
      rating: status.rating,
      comment: status.state === 'submitted' ? status.comment : '',
      submittedAt: status.state === 'submitted' ? status.submittedAt : null,
      emailCount: status.emailCount,
      message: status.message,
    };
  }

  async getAdminReviews() {
    const reviews = await this.reviewsRepository.find({
      where: { status: 'submitted' },
      order: { submittedAt: 'DESC' },
      take: 500,
    });
    const vendorIds = [...new Set(reviews.map((review) => review.vendorId))];
    const vendors = vendorIds.length
      ? await this.vendorsRepository.find({ where: { id: In(vendorIds) } })
      : [];
    const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.storeName]));
    return reviews.map((review) => ({
      id: review.id,
      vendorId: review.vendorId,
      storeName: vendorNames.get(review.vendorId) || 'Tienda',
      orderNumber: review.orderNumber,
      customerName: this.abbreviateName(review.customerName),
      rating: review.rating,
      comment: review.comment || '',
      submittedAt: review.submittedAt,
      updatedAt: review.updatedAt,
    }));
  }

  async getAdminOrderReview(orderId: string) {
    const order = await this.getOrderForReview(orderId);
    const review = order.vendorId
      ? await this.reviewsRepository.findOne({ where: { orderId, vendorId: order.vendorId } })
      : null;
    return this.buildOrderReviewStatus(order, review);
  }

  async resendAdminOrderReview(orderId: string) {
    const order = await this.getOrderForReview(orderId);
    const eligibility = this.getOrderReviewEligibility(order);
    if (!eligibility.eligible) throw new BadRequestException(eligibility.message);

    let review = await this.reviewsRepository.findOne({
      where: { orderId: order.id, vendorId: order.vendorId },
    });
    if (review?.status === 'submitted' || review?.rating) {
      throw new BadRequestException('Esta venta ya fue calificada');
    }
    if (review && review.emailCount >= REVIEW_MAX_EMAILS) {
      throw new BadRequestException('Ya se enviaron los dos correos permitidos');
    }

    if (!review) {
      const email = String(order.customerEmail || order.guestData?.email || '').trim().toLowerCase();
      const reviewId = randomUUID();
      const token = this.buildToken(reviewId);
      try {
        review = await this.reviewsRepository.save(this.reviewsRepository.create({
          id: reviewId,
          orderId: order.id,
          vendorId: order.vendorId,
          orderNumber: order.orderNumber,
          customerEmail: email,
          customerName: order.shippingName || order.guestData?.name || null,
          tokenHash: this.hashToken(token),
          status: 'pending',
          emailCount: 0,
          nextEmailAt: null,
        }));
      } catch (error) {
        if (error?.code !== 'ER_DUP_ENTRY') throw error;
        review = await this.reviewsRepository.findOne({
          where: { orderId: order.id, vendorId: order.vendorId },
        });
      }
    }
    if (!review) throw new BadRequestException('No se pudo preparar la solicitud de calificación');

    const now = new Date();
    const claimUntil = new Date(now.getTime() + 60 * 60 * 1000);
    const claim = await this.reviewsRepository.update(
      { id: review.id, status: 'pending', emailCount: review.emailCount },
      { nextEmailAt: claimUntil, lastEmailAttemptAt: now },
    );
    if (!claim.affected) throw new BadRequestException('La solicitud ya está siendo enviada');

    try {
      await this.sendReviewEmail(review, this.buildToken(review.id));
      const emailCount = review.emailCount + 1;
      await this.reviewsRepository.update(review.id, {
        emailCount,
        firstEmailSentAt: review.firstEmailSentAt || now,
        lastEmailSentAt: now,
        lastEmailError: null,
        nextEmailAt: emailCount < REVIEW_MAX_EMAILS
          ? new Date(now.getTime() + REVIEW_REMINDER_DAYS * 24 * 60 * 60 * 1000)
          : null,
      });
    } catch (error) {
      await this.reviewsRepository.update(review.id, {
        lastEmailError: String(error?.message || error).slice(0, 2000),
        nextEmailAt: claimUntil,
      });
      throw new BadRequestException('No se pudo enviar el correo de calificación');
    }

    const refreshed = await this.reviewsRepository.findOne({ where: { id: review.id } });
    return this.buildOrderReviewStatus(order, refreshed);
  }

  private recoveryStatus(code?: { percentage: number; emailSentAt: Date | null; acceptedAt: Date | null; reviewUpdatedAt: Date | null; expiresAt: Date }) {
    return code ? { percentage: code.percentage, sentAt: code.emailSentAt, acceptedAt: code.acceptedAt,
      updatedAt: code.reviewUpdatedAt, expiresAt: code.expiresAt } : null;
  }

  async offerRecovery(userId: string, reviewId: string, data: any) {
    const vendor = await this.vendorsRepository.findOne({ where: { user: { id: userId } } });
    if (!vendor) throw new NotFoundException('Tienda no encontrada');
    const review = await this.reviewsRepository.findOneBy({ id: reviewId, vendorId: vendor.id, status: 'submitted' });
    if (!review || !review.rating || review.rating > 3) throw new BadRequestException('La compensación está disponible para calificaciones de 1 a 3 estrellas');
    const resolution = String(data.resolution || '').trim();
    if (resolution.length < 10 || resolution.length > 1000) throw new BadRequestException('Describe la atención o solución ofrecida (10 a 1000 caracteres)');
    if (![10, 20, 30, 40].includes(Number(data.percentage))) throw new BadRequestException('Selecciona 10, 20, 30 o 40%');
    let code = await this.discounts.recoveryForReview(review.id);
    if (code?.emailSentAt) throw new BadRequestException('Ya se envió una compensación para esta calificación');
    const smtp = await this.getMarketplaceSmtp();
    if (!smtp) throw new BadRequestException('No hay correo de salida configurado');
    if (!code) code = await this.discounts.create({ name: `Compensación ${review.orderNumber}`, percentage: data.percentage,
      vendorId: vendor.id, customerEmail: review.customerEmail, maxUses: 1,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), reviewId: review.id,
      resolution, originalRating: review.rating, originalComment: review.comment,
      minPurchase: data.minPurchase || 0, maxDiscount: data.maxDiscount || null });
    const token = this.discounts.recoveryToken(code.id);
    const url = `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/compensacion/${token}`;
    code.percentage = Number(data.percentage);
    code.resolution = resolution;
    await this.discounts.claimRecoveryEmail(code.id, code.percentage, resolution);
    try {
    await this.emailService.sendEmail(withStoreSender(smtp, vendor.storeName), review.customerEmail, `${vendor.storeName}: un beneficio por tu experiencia`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.7;color:#172033"><h2>MundoBeat</h2>
      <p>Hola ${this.escapeHtml(review.customerName || 'cliente')},</p><p>${this.escapeHtml(vendor.storeName)} lamenta el inconveniente en tu pedido ${this.escapeHtml(review.orderNumber)} y te ofrece un ${code.percentage}% de descuento para una próxima compra en su tienda.</p>
      <p>${this.escapeHtml(code.resolution || '')}</p><p>El beneficio es personal, de un solo uso y vence el ${code.expiresAt.toLocaleDateString('es-CL')}. No incluye el envío.${code.minPurchase ? ` Compra mínima: $${code.minPurchase.toLocaleString('es-CL')}.` : ''}${code.maxDiscount ? ` Descuento máximo: $${code.maxDiscount.toLocaleString('es-CL')}.` : ''}</p>
      <p>Activarlo no cambia tu calificación. Si consideras que la atención recibida merece una nueva evaluación, puedes actualizar voluntariamente tus estrellas y comentario.</p>
      <p><a href="${url}" style="display:inline-block;background:#0788c9;padding:12px 20px;color:white;text-decoration:none">Ver beneficio</a></p></div>`);
    } catch (error) {
      await this.discounts.releaseRecoveryEmail(code.id);
      throw new BadRequestException('No se pudo enviar la compensación. Puedes intentarlo nuevamente.');
    }
    return { success: true, message: 'Compensación enviada al comprador' };
  }

  async getRecovery(token: string) {
    const code = await this.discounts.recoveryByToken(token);
    const vendor = await this.vendorsRepository.findOneBy({ id: code.vendorId! });
    return { storeName: vendor?.storeName || 'Tienda', storeSlug: vendor?.slug, percentage: code.percentage,
      minPurchase: code.minPurchase, maxDiscount: code.maxDiscount, expiresAt: code.expiresAt,
      resolution: code.resolution, acceptedAt: code.acceptedAt,
      available: code.status === 'active' && code.expiresAt > new Date(),
      code: code.acceptedAt ? code.code : null,
      reviewUrl: code.acceptedAt ? `/calificar/${this.buildToken(code.reviewId!)}` : null };
  }

  async acceptRecovery(token: string, acceptedTerms: boolean) {
    if (acceptedTerms !== true) throw new BadRequestException('Debes aceptar las condiciones del beneficio');
    const code = await this.discounts.recoveryByToken(token);
    if (code.status !== 'active' || code.expiresAt <= new Date()) throw new BadRequestException('El beneficio venció o ya no está disponible');
    await this.discounts.acceptRecoveryCode(code.id);
    return this.getRecovery(token);
  }

  private async getOrderForReview(orderId: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['shipments'],
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  private getOrderReviewEligibility(order: Order): { eligible: boolean; message: string } {
    if (!REVIEWABLE_ORDER_SOURCES.includes(order.orderSource as any)) {
      return { eligible: false, message: 'Sólo las ventas de MundoBeat y las ventas asistidas pueden calificarse' };
    }
    if (order.status !== OrderStatus.DELIVERED) {
      return { eligible: false, message: 'La venta debe estar completada antes de solicitar la calificación' };
    }
    const shippingDelivered = order.enviaShippingStatus === 'delivered'
      || (order.shipments || []).some((shipment) => shipment.status === 'delivered' || shipment.enviaShippingStatus === 'delivered');
    if (!shippingDelivered) {
      return { eligible: false, message: 'El envío debe figurar como entregado antes de solicitar la calificación' };
    }
    if (!String(order.customerEmail || order.guestData?.email || '').trim()) {
      return { eligible: false, message: 'El pedido no tiene un correo de comprador válido' };
    }
    if (!order.vendorId) return { eligible: false, message: 'El pedido no está asociado a una tienda' };
    return { eligible: true, message: 'La venta está lista para solicitar una calificación' };
  }

  private buildOrderReviewStatus(order: Order, review: VendorReview | null) {
    const eligibility = this.getOrderReviewEligibility(order);
    if (review?.status === 'submitted' && review.rating) {
      return {
        state: 'submitted',
        eligible: true,
        rating: review.rating,
        comment: review.comment || '',
        emailCount: review.emailCount,
        submittedAt: review.submittedAt,
        editableUntil: review.editableUntil,
        message: 'El comprador calificó esta venta',
        canSend: false,
      };
    }
    const emailCount = review?.emailCount || 0;
    return {
      state: review ? 'pending' : eligibility.eligible ? 'ready' : 'not_eligible',
      eligible: eligibility.eligible,
      rating: null,
      comment: '',
      emailCount,
      lastEmailSentAt: review?.lastEmailSentAt || null,
      nextEmailAt: review?.nextEmailAt || null,
      lastEmailError: review?.lastEmailError || null,
      message: eligibility.eligible
        ? emailCount
          ? `Esperando respuesta del comprador. ${emailCount} de ${REVIEW_MAX_EMAILS} correos enviados.`
          : 'La venta está lista para solicitar una calificación'
        : eligibility.message,
      canSend: eligibility.eligible && emailCount < REVIEW_MAX_EMAILS,
    };
  }

  private async findByToken(token: string): Promise<VendorReview> {
    const [reviewId] = String(token || '').split('.');
    if (!/^[0-9a-f-]{36}$/i.test(reviewId || '') || token !== this.buildToken(reviewId)) {
      throw new NotFoundException('Enlace de calificación inválido');
    }
    const review = await this.reviewsRepository.findOne({ where: { id: reviewId, tokenHash: this.hashToken(token) } });
    if (!review) throw new NotFoundException('Enlace de calificación inválido o vencido');
    return review;
  }

  private async recalculateVendorRating(vendorId: string): Promise<void> {
    const result = await this.reviewsRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.vendorId = :vendorId', { vendorId })
      .andWhere('review.status = :status', { status: 'submitted' })
      .andWhere('review.rating IS NOT NULL')
      .getRawOne<{ average: string | null; count: string }>();
    await this.vendorsRepository.update(vendorId, {
      rating: Number(Number(result?.average || 0).toFixed(2)),
      ratingCount: Number(result?.count || 0),
    } as any);
  }

  private async sendReviewEmail(review: VendorReview, token: string): Promise<void> {
    const [vendor, smtp] = await Promise.all([
      this.vendorsRepository.findOne({ where: { id: review.vendorId } }),
      this.getMarketplaceSmtp(),
    ]);
    if (!vendor) throw new Error('Vendor not found');
    if (!smtp) throw new Error('No marketplace SMTP configuration found');
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const reviewUrl = `${baseUrl}/calificar/${token}`;
    const isReminder = review.emailCount > 0;
    const subject = isReminder
      ? `¿Cómo fue tu compra en ${vendor.storeName}?`
      : `Califica tu compra en ${vendor.storeName}`;
    const safeName = this.escapeHtml(review.customerName || 'cliente');
    const safeStore = this.escapeHtml(vendor.storeName);
    const safeOrder = this.escapeHtml(review.orderNumber);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#172033;line-height:1.6">
        <div style="background:#0b203d;color:#fff;padding:24px 28px">
          <div style="font-size:22px;font-weight:700">MundoBeat</div>
        </div>
        <div style="padding:28px;border:1px solid #dce4ee;border-top:0">
          <p>Hola ${safeName},</p>
          <h1 style="font-size:24px;line-height:1.3;margin:12px 0;color:#0b203d">${isReminder ? 'Tu opinión todavía nos importa' : '¿Cómo estuvo tu experiencia?'}</h1>
          <p>El pedido <strong>${safeOrder}</strong> de <strong>${safeStore}</strong> figura como entregado. Calificar toma menos de un minuto.</p>
          <div style="font-size:30px;letter-spacing:4px;color:#f5a400;text-align:center;margin:24px 0">★★★★★</div>
          <p style="text-align:center;margin:26px 0">
            <a href="${reviewUrl}" style="display:inline-block;background:#0788c9;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px">Calificar esta tienda</a>
          </p>
          <p style="font-size:13px;color:#667085">La calificación pública muestra sólo las estrellas y el total de evaluaciones verificadas. Tu comentario será privado para la tienda y la administración.</p>
        </div>
      </div>`;
    await this.emailService.sendEmail(withStoreSender(smtp, vendor.storeName), review.customerEmail, subject, html);
  }

  private async getMarketplaceSmtp() {
    const settings = await this.smtpSettingsRepository.find({ order: { updatedAt: 'DESC' } });
    const smtp = settings.find((item) => item.smtpHost && item.smtpUser && item.smtpPassword);
    if (!smtp) return null;
    return {
      host: smtp.smtpHost,
      port: smtp.smtpPort || 587,
      secure: smtp.smtpSecure || false,
      user: smtp.smtpUser,
      password: smtp.smtpPassword,
      fromEmail: smtp.smtpFromEmail || smtp.smtpUser,
      fromName: smtp.smtpFromName || 'MundoBeat',
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private resolveReviewRequestsStartAt(): Date {
    const configured = process.env.REVIEW_REQUESTS_START_AT;
    if (configured) {
      const parsed = new Date(configured);
      if (!Number.isNaN(parsed.getTime())) return parsed;
      console.warn('[Reviews] REVIEW_REQUESTS_START_AT is invalid; using startup grace period');
    }
    // Prevent an initial deployment from emailing the entire historical order base.
    return new Date(Date.now() - 60 * 60 * 1000);
  }

  private buildToken(reviewId: string): string {
    const secret = process.env.REVIEW_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('REVIEW_TOKEN_SECRET or JWT_SECRET must be configured');
    const signature = createHmac('sha256', secret).update(reviewId).digest('hex');
    return `${reviewId}.${signature}`;
  }

  private abbreviateName(name: string | null): string {
    const parts = String(name || 'Cliente').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
  }

  private escapeHtml(value: string): string {
    const entities: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    };
    return String(value).replace(/[&<>'"]/g, (character) => entities[character]);
  }
}
