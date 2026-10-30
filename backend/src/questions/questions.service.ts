import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { withStoreSender } from '../email/store-sender';
import { SmtpSettingsService } from '../marketplace/smtp-settings.service';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { ProductQuestion } from './product-question.entity';
import { ProductQuestionMessage } from './product-question-message.entity';
import { VendorQuestionPenalty } from './vendor-penalty.entity';
import { MercadoLibreService } from '../mercadolibre/mercadolibre.service';

type RequestUser = { userId: string; role: string; vendorId?: string; email?: string };

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(ProductQuestion) private readonly questions: Repository<ProductQuestion>,
    @InjectRepository(ProductQuestionMessage) private readonly messages: Repository<ProductQuestionMessage>,
    @InjectRepository(VendorQuestionPenalty) private readonly penalties: Repository<VendorQuestionPenalty>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly smtpSettings: SmtpSettingsService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => MercadoLibreService)) private readonly mercadoLibreService: MercadoLibreService,
  ) {}

  async getProductQuestions(productId: string) {
    const rows = await this.questions.find({
      where: { productId, source: 'mundobeat' },
      relations: ['customer', 'messages', 'messages.author'],
      order: { createdAt: 'DESC', messages: { createdAt: 'ASC' } },
    });
    return rows.filter((question) => question.reviewStatus !== 'annulled').map((question) => this.serializePublic(question));
  }

  async createQuestion(user: RequestUser, productId: string, rawMessage: string) {
    const content = this.validateMessage(rawMessage);
    const product = await this.products.findOne({ where: { id: productId }, relations: ['vendor', 'vendor.user'] });
    if (!product || !product.vendor) throw new NotFoundException('Producto o vendedor no encontrado');

    const question = await this.questions.save(this.questions.create({
      productId,
      vendorId: product.vendor.id,
      customerId: user.userId,
      status: 'pending',
    }));
    await this.messages.save(this.messages.create({
      questionId: question.id,
      authorId: user.userId,
      authorType: 'customer',
      content,
    }));

    const customer = await this.users.findOne({ where: { id: user.userId } });
    await this.sendNotification(
      product.vendor.user?.email || product.vendor.email,
      `Nueva pregunta sobre ${product.title}`,
      `<p>Hola ${this.escapeHtml(product.vendor.storeName)},</p><p>Recibiste una nueva pregunta pública sobre <strong>${this.escapeHtml(product.title)}</strong>.</p><blockquote>${this.escapeHtml(content)}</blockquote><p>Respóndela desde el panel de tu tienda.</p>`,
      '/dashboard/preguntas',
      product.vendor.storeName,
    );
    return { ...(await this.getQuestion(question.id)), customerName: customer ? this.displayName(customer) : 'Comprador' };
  }

  async reply(user: RequestUser, questionId: string, rawMessage: string) {
    const content = this.validateMessage(rawMessage);
    const question = await this.questions.findOne({
      where: { id: questionId },
      relations: ['product', 'vendor', 'vendor.user', 'customer'],
    });
    if (!question) throw new NotFoundException('Pregunta no encontrada');
    if (question.reviewStatus === 'annulled') throw new BadRequestException('Esta conversación fue anulada y no admite nuevas respuestas');

    const isVendor = user.role === 'vendor';
    if (isVendor && question.vendorId !== user.vendorId) throw new ForbiddenException('Esta pregunta pertenece a otra tienda');
    if (!isVendor && question.customerId !== user.userId) throw new ForbiddenException('No puedes responder esta pregunta');
    if (question.source === 'mercadolibre') {
      if (!isVendor || !question.externalQuestionId) throw new ForbiddenException('Esta pregunta sólo puede responderla la tienda');
      await this.mercadoLibreService.answerQuestion(question.vendorId, question.externalQuestionId, content);
      question.externalStatus = 'ANSWERED';
    }

    const authorType = isVendor ? 'vendor' : 'customer';
    const message = await this.messages.save(this.messages.create({
      questionId,
      authorId: user.userId,
      authorType,
      content,
    }));
    question.status = isVendor ? 'answered' : 'pending';
    question.reviewStatus = isVendor ? 'pending_review' : 'awaiting_response';
    question.reviewedAt = null;
    question.reviewedById = null;
    await this.questions.save(question);

    const recipient = isVendor ? question.customer?.email : (question.vendor.user?.email || question.vendor.email);
    const destination = isVendor ? '/mis-preguntas' : '/dashboard/preguntas';
    await this.sendNotification(
      recipient,
      `${isVendor ? 'Respondieron' : 'Nueva respuesta'}: ${question.product.title}`,
      `<p>Hay una nueva respuesta pública sobre <strong>${this.escapeHtml(question.product.title)}</strong>.</p><blockquote>${this.escapeHtml(content)}</blockquote>`,
      destination,
      question.vendor.storeName,
    );
    return message;
  }

  getCustomerQuestions(customerId: string) {
    return this.questions.find({
      where: { customerId },
      relations: ['product', 'vendor', 'messages', 'messages.author'],
      order: { updatedAt: 'DESC', messages: { createdAt: 'ASC' } },
    });
  }

  async getVendorQuestions(vendorId: string, status?: string) {
    if (!vendorId) throw new ForbiddenException('Usuario sin tienda asociada');
    const qb = this.baseQuery().where('question.vendorId = :vendorId', { vendorId });
    qb.andWhere('question.reviewStatus != :annulledStatus', { annulledStatus: 'annulled' });
    if (status === 'pending' || status === 'answered') qb.andWhere('question.status = :status', { status });
    return qb.orderBy('question.updatedAt', 'DESC').addOrderBy('message.createdAt', 'ASC').getMany();
  }

  async getAllQuestions(search?: string, status?: string) {
    const qb = this.baseQuery().andWhere('question.status = :answeredStatus', { answeredStatus: 'answered' });
    const reviewStatuses = ['pending_review', 'reviewed', 'penalized', 'annulled'];
    if (status && reviewStatuses.includes(status)) {
      qb.andWhere('question.reviewStatus = :reviewStatus', { reviewStatus: status });
    } else if (status !== 'all') {
      qb.andWhere('question.reviewStatus = :reviewStatus', { reviewStatus: 'pending_review' });
    }
    if (search?.trim()) {
      qb.andWhere(new Brackets((where) => where
        .where('product.title LIKE :search', { search: `%${search.trim()}%` })
        .orWhere('vendor.storeName LIKE :search', { search: `%${search.trim()}%` })
        .orWhere('message.content LIKE :search', { search: `%${search.trim()}%` })));
    }
    const rows = await qb.orderBy('question.updatedAt', 'DESC').addOrderBy('message.createdAt', 'ASC').getMany();
    const vendorIds = [...new Set(rows.map((row) => row.vendorId))];
    const counts = vendorIds.length ? await this.penalties.createQueryBuilder('penalty')
      .select('penalty.vendorId', 'vendorId').addSelect('COUNT(*)', 'count')
      .where('penalty.vendorId IN (:...vendorIds)', { vendorIds }).groupBy('penalty.vendorId').getRawMany() : [];
    const countMap = new Map(counts.map((row) => [row.vendorId, Number(row.count)]));
    return rows.map((row) => ({ ...row, vendorPenaltyPoints: countMap.get(row.vendorId) || 0 }));
  }

  async moderateMessage(adminId: string, messageId: string, action: 'review' | 'penalize' | 'annul', reason?: string, annulQuestion = false) {
    const message = await this.messages.findOne({ where: { id: messageId }, relations: ['question', 'question.vendor', 'question.vendor.user'] });
    if (!message) throw new NotFoundException('Mensaje no encontrado');
    if (!['review', 'penalize', 'annul'].includes(action)) throw new BadRequestException('Acción de moderación inválida');
    if (message.authorType !== 'vendor') throw new BadRequestException('La fiscalización se aplica a la respuesta del vendedor');

    if (action === 'review') {
      message.question.reviewStatus = 'reviewed';
      message.question.reviewedById = adminId;
      message.question.reviewedAt = new Date();
      await this.questions.save(message.question);
      return { success: true, reviewStatus: 'reviewed' };
    }

    if (action === 'annul') {
      message.question.reviewStatus = 'annulled';
      message.question.reviewedById = adminId;
      message.question.reviewedAt = new Date();
      await this.questions.save(message.question);
      return { success: true, reviewStatus: 'annulled' };
    }

    if (action === 'penalize') {
      const allowedReasons = [
        'Compartió datos de contacto',
        'Intentó concretar la venta fuera de MundoBeat',
        'Respuesta inapropiada o contraria a las normas',
      ];
      const selectedReason = reason?.trim() || '';
      if (!allowedReasons.includes(selectedReason)) throw new BadRequestException('Selecciona un motivo de penalización válido');

      message.isHidden = true;
      message.hiddenById = adminId;
      message.hiddenAt = new Date();
      message.moderationReason = selectedReason;
      await this.messages.save(message);

      message.question.reviewStatus = annulQuestion ? 'annulled' : 'penalized';
      message.question.reviewedById = adminId;
      message.question.reviewedAt = new Date();
      await this.questions.save(message.question);

      const existing = await this.penalties.findOne({ where: { messageId } });
      if (!existing) {
        await this.penalties.save(this.penalties.create({
          vendorId: message.question.vendorId,
          messageId,
          administratorId: adminId,
          reason: selectedReason,
        }));
      }
      const points = await this.penalties.count({ where: { vendorId: message.question.vendorId } });
      if (!existing) {
        const remaining = Math.max(0, 3 - points);
        await this.sendNotification(
          message.question.vendor.user?.email || message.question.vendor.email,
          `Advertencia por incumplimiento (${points} de 3 penalizaciones)`,
          `<h2>Tu respuesta recibió una penalización</h2><p>La administración de MundoBeat revisó una respuesta publicada por tu tienda y determinó que incumple las normas de comunicación del marketplace.</p><p><strong>Motivo seleccionado:</strong> ${this.escapeHtml(selectedReason)}</p><p><strong>Respuesta observada:</strong></p><blockquote style="border-left:4px solid #dc2626;padding:10px 14px;background:#fef2f2">${this.escapeHtml(message.content)}</blockquote><p>La respuesta dejó de mostrarse públicamente, pero se conserva en el historial de fiscalización.</p>${annulQuestion ? '<p><strong>Además, la conversación completa fue anulada</strong> y ya no admite nuevas respuestas.</p>' : ''}<p>Tu tienda acumula actualmente <strong>${points} de 3 penalizaciones</strong>${remaining > 0 ? ` y le quedan ${remaining} antes de alcanzar el límite de revisión` : ''}.</p><p style="color:#b91c1c"><strong>Importante:</strong> al llegar a la tercera penalización, la administración puede inhabilitar la cuenta de la tienda. La suspensión no es automática y será evaluada manualmente.</p><p>Para evitar nuevas penalizaciones, no compartas teléfonos, correos, enlaces, redes sociales ni intentes concretar operaciones fuera de MundoBeat.</p>`,
          '/dashboard/preguntas',
        );
      }
      return { success: true, message, reviewStatus: message.question.reviewStatus, penaltyPoints: points, requiresAccountReview: points >= 3 };
    }
  }

  private baseQuery() {
    return this.questions.createQueryBuilder('question')
      .leftJoinAndSelect('question.product', 'product')
      .leftJoinAndSelect('question.vendor', 'vendor')
      .leftJoinAndSelect('question.customer', 'customer')
      .leftJoinAndSelect('question.messages', 'message')
      .leftJoinAndSelect('message.author', 'author');
  }

  private async getQuestion(id: string) {
    return this.questions.findOne({ where: { id }, relations: ['product', 'vendor', 'customer', 'messages', 'messages.author'] });
  }

  private serializePublic(question: ProductQuestion) {
    return {
      id: question.id,
      status: question.status,
      createdAt: question.createdAt,
      customerName: this.displayName(question.customer),
      messages: (question.messages || []).filter((message) => !message.isHidden).map((message) => ({
        id: message.id,
        authorType: message.authorType,
        authorName: message.authorType === 'vendor' ? 'Vendedor' : this.displayName(message.author),
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  }

  private validateMessage(rawMessage: string) {
    const content = String(rawMessage || '').replace(/\s+/g, ' ').trim();
    if (content.length < 5 || content.length > 1000) throw new BadRequestException('El mensaje debe tener entre 5 y 1000 caracteres');
    const normalized = content.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const email = /\b[a-z0-9._%+-]+\s*(?:@|\(arroba\)|\[arroba\]| arroba )\s*[a-z0-9.-]+\s*(?:\.| punto )\s*[a-z]{2,}\b/i;
    const url = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\s*(?:\.| punto )(?:cl|com|net|org|io)\b)/i;
    const social = /\b(?:whats?app|wsp|instagram|facebook|telegram|tiktok|correo|e-?mail|gmail|hotmail|outlook|contactame|escribeme|llamame)\b/i;
    const phone = /(?:\d[\s,.;:_+()\/-]*){8,}/;
    const numberWords = /\b(?:cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)(?:[\s,.;:_+()\/-]+(?:cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)){7,}\b/i;
    if (email.test(normalized) || url.test(normalized) || social.test(normalized) || phone.test(normalized) || numberWords.test(normalized)) {
      throw new BadRequestException('No está permitido compartir teléfonos, correos, sitios web ni datos de contacto');
    }
    return content;
  }

  private async sendNotification(to: string | undefined, subject: string, body: string, path: string, storeName?: string) {
    if (!to) return;
    try {
      const smtp = await this.smtpSettings.getSmtpConfig();
      if (!smtp) return;
      const baseUrl = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/$/, '');
      await this.emailService.sendEmail(withStoreSender(smtp, storeName), to, subject, `${body}<p><a href="${baseUrl}${path}" style="display:inline-block;padding:10px 16px;background:#087fb8;color:#fff;text-decoration:none;border-radius:4px">Ver en MundoBeat</a></p>`);
    } catch (error) {
      console.error('[Questions] No se pudo enviar notificación:', error.message);
    }
  }

  private displayName(user?: User | null) {
    if (!user) return 'Comprador';
    const firstName = (user.firstName || '').trim();
    const lastInitial = (user.lastName || '').trim().charAt(0);
    return `${firstName || 'Comprador'}${lastInitial ? ` ${lastInitial}.` : ''}`;
  }

  private escapeHtml(value: string) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
  }
}
