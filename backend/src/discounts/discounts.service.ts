import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'crypto';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { Order } from '../orders/order.entity';
import { DiscountCode, DiscountUse } from './discount.entity';
import { calculateDiscount, matchesDiscount } from './discount-rules';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(DiscountCode)
    private readonly codes: Repository<DiscountCode>,
    @InjectRepository(DiscountUse)
    private readonly uses: Repository<DiscountUse>,
    private readonly db: DataSource,
  ) {}

  async list() {
    const codes = await this.codes.find({
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const counts = await this.uses
      .createQueryBuilder('u')
      .select('u.discountId', 'id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.discountId')
      .getRawMany();
    return codes.map((code) => ({
      ...code,
      uses: Number(counts.find((row) => row.id === code.id)?.count || 0),
    }));
  }

  async create(data: any): Promise<DiscountCode> {
    const percentage = Number(data.percentage);
    if (![10, 20, 30, 40].includes(percentage))
      throw new BadRequestException('Selecciona 10, 20, 30 o 40%');
    const name = String(data.name || '').trim();
    const code = String(data.code || `MB-${randomBytes(6).toString('hex')}`)
      .trim()
      .toUpperCase();
    if (!name || name.length > 150 || !/^[A-Z0-9-]{4,60}$/.test(code))
      throw new BadRequestException('Nombre o código inválido');
    const startsAt = data.startsAt ? new Date(data.startsAt) : new Date();
    const expiresAt = new Date(data.expiresAt);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt <= startsAt ||
      expiresAt <= new Date()
    )
      throw new BadRequestException('Revisa las fechas del descuento');
    const minPurchase = Number(data.minPurchase || 0);
    const maxDiscount = data.maxDiscount ? Number(data.maxDiscount) : null;
    const maxUses = Number(data.maxUses || 100);
    if (
      !Number.isSafeInteger(minPurchase) ||
      minPurchase < 0 ||
      (maxDiscount !== null &&
        (!Number.isSafeInteger(maxDiscount) || maxDiscount < 1)) ||
      !Number.isSafeInteger(maxUses) ||
      maxUses < 1
    )
      throw new BadRequestException('Límites de descuento inválidos');
    const ids = (value: unknown, numeric = false): string[] => {
      if (value == null) return [];
      if (
        !Array.isArray(value) ||
        value.length > 100 ||
        value.some((id) =>
          numeric
            ? !/^[0-9]+$/.test(String(id))
            : typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id),
        )
      )
        throw new BadRequestException(
          'Selección de productos, categorías o géneros inválida',
        );
      return [...new Set(value.map(String))];
    };
    if (data.vendorId && !/^[0-9a-f-]{36}$/i.test(String(data.vendorId)))
      throw new BadRequestException('Tienda inválida');
    try {
      return await this.codes.save(
        this.codes.create({
          code,
          name,
          percentage,
          vendorId: data.vendorId || null,
          categoryIds: ids(data.categoryIds),
          genreIds: ids(data.genreIds, true),
          productIds: ids(data.productIds),
          minPurchase,
          maxDiscount,
          maxUses,
          startsAt,
          expiresAt,
          status: data.status === 'draft' ? 'draft' : 'active',
          customerEmail: data.customerEmail
            ? String(data.customerEmail).trim().toLowerCase()
            : null,
          reviewId: data.reviewId || null,
          resolution: data.resolution || null,
          originalRating: data.originalRating ?? null,
          originalComment: data.originalComment ?? null,
        }),
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY')
        throw new BadRequestException(
          'Ya existe ese código o una compensación para esta calificación',
        );
      throw error;
    }
  }

  async setStatus(id: string, status: string) {
    if (!['active', 'draft', 'disabled'].includes(status))
      throw new BadRequestException('Estado inválido');
    const code = await this.codes.findOneBy({ id });
    if (!code) throw new NotFoundException('Descuento no encontrado');
    code.status = status;
    return this.codes.save(code);
  }

  async quote(
    data: any,
    manager: EntityManager = this.db.manager,
    lockedCode?: DiscountCode,
  ) {
    const code =
      lockedCode ||
      (await manager.findOneBy(DiscountCode, {
        code: String(data.code || '')
          .trim()
          .toUpperCase(),
      }));
    if (
      !code ||
      code.status !== 'active' ||
      new Date() < code.startsAt ||
      new Date() >= code.expiresAt
    )
      throw new BadRequestException('El código no está disponible o venció');
    const email = String(data.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@'))
      throw new BadRequestException(
        'Ingresa tu correo antes de aplicar el código',
      );
    if (code.customerEmail && code.customerEmail !== email)
      throw new BadRequestException(
        'Este código está asociado a otro comprador',
      );
    if (code.reviewId && !code.acceptedAt)
      throw new BadRequestException(
        'Activa primero el beneficio desde el correo recibido',
      );
    if (code.vendorId && code.vendorId !== data.vendorId)
      throw new BadRequestException('Este código pertenece a otra tienda');
    if (
      !Array.isArray(data.items) ||
      !data.items.length ||
      data.items.length > 100 ||
      data.items.some(
        (item: any) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 999,
      )
    )
      throw new BadRequestException('Carrito inválido');
    if (
      new Set(data.items.map((item: any) => item.productId)).size !==
      data.items.length
    )
      throw new BadRequestException('El carrito contiene productos duplicados');
    const products = await manager.find(Product, {
      where: { id: In(data.items.map((item: any) => item.productId)) },
      relations: ['vendor', 'categories', 'genres'],
    });
    let subtotal = 0;
    let eligible = 0;
    for (const item of data.items) {
      const product = products.find((p) => p.id === item.productId);
      if (
        !product ||
        product.vendor?.id !== data.vendorId ||
        product.status !== 'active' ||
        product.stock < item.quantity
      )
        throw new BadRequestException(
          'El carrito contiene productos no disponibles',
        );
      const price = Number(
        product.isOnSale && product.salePrice != null
          ? product.salePrice
          : product.price,
      );
      const amount = price * item.quantity;
      subtotal += amount;
      if (matchesDiscount(product, code)) eligible += amount;
    }
    if (subtotal < code.minPurchase)
      throw new BadRequestException(
        `Compra mínima: $${code.minPurchase.toLocaleString('es-CL')}`,
      );
    const discountAmount = calculateDiscount(
      eligible,
      code.percentage,
      code.maxDiscount,
    );
    if (!discountAmount)
      throw new BadRequestException(
        'El código no aplica a los productos seleccionados',
      );
    const existing = await manager.findOneBy(DiscountUse, {
      discountId: code.id,
      customerEmail: email,
    });
    if (existing && existing.orderId !== data.orderId)
      throw new BadRequestException('Ya utilizaste este código en un pedido');
    const uses = await manager.countBy(DiscountUse, { discountId: code.id });
    if (!existing && uses >= code.maxUses)
      throw new BadRequestException('El código agotó sus usos');
    return {
      code: code.code,
      discountId: code.id,
      percentage: code.percentage,
      subtotal,
      discountAmount,
      discountedSubtotal: subtotal - discountAmount,
      prices: products.map((p) => ({
        productId: p.id,
        price: Number(
          p.isOnSale && p.salePrice != null ? p.salePrice : p.price,
        ),
      })),
    };
  }

  async reserve(data: any, orderId: string) {
    return this.db.transaction(async (manager) => {
      const code = await manager.findOne(DiscountCode, {
        where: { code: String(data.code).trim().toUpperCase() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!code) throw new BadRequestException('Código inválido');
      const quote = await this.quote({ ...data, orderId }, manager, code);
      const existing = await manager.findOneBy(DiscountUse, { orderId });
      if (existing && existing.discountId !== code.id)
        throw new BadRequestException('El pedido ya tiene otro descuento');
      if (!existing)
        await manager.save(
          DiscountUse,
          manager.create(DiscountUse, {
            discountId: code.id,
            orderId,
            customerEmail: String(data.email).trim().toLowerCase(),
            amount: quote.discountAmount,
          }),
        );
      const order = await manager.findOneByOrFail(Order, { id: orderId });
      order.subtotal = quote.discountedSubtotal;
      order.total =
        quote.discountedSubtotal +
        Number(order.shippingCost || 0) +
        Number(order.tax || 0);
      order.commissionAmount = Math.round(
        (quote.discountedSubtotal * Number(order.commissionPercentage || 0)) /
          100,
      );
      const shippingFunded =
        Number(order.shippingCost) === 0 &&
        String(order.shippingMethod).toLowerCase().includes('gratis')
          ? Number(order.enviaQuotedPrice || 0)
          : 0;
      order.vendorAmount = Math.max(
        0,
        quote.discountedSubtotal - order.commissionAmount - shippingFunded,
      );
      await manager.save(Order, order);
      return quote;
    });
  }

  async assertOrderItemsEditable(orderId: string) {
    if (await this.uses.existsBy({ orderId }))
      throw new BadRequestException(
        'Este pedido tiene un descuento reservado. Conserva sus productos o crea un nuevo pedido.',
      );
  }

  async recoveryForReview(reviewId: string) {
    return this.codes.findOneBy({ reviewId });
  }
  async recoveriesForReviews(reviewIds: string[]): Promise<DiscountCode[]> {
    return reviewIds.length
      ? this.codes.findBy({ reviewId: In(reviewIds) })
      : [];
  }
  async saveRecovery(code: DiscountCode) {
    return this.codes.save(code);
  }
  async claimRecoveryEmail(id: string, percentage: number, resolution: string) {
    const result = await this.codes.update(
      { id, emailSentAt: IsNull() },
      { emailSentAt: new Date(), percentage, resolution },
    );
    if (!result.affected)
      throw new BadRequestException(
        'La compensación ya fue enviada o está siendo enviada',
      );
  }
  async releaseRecoveryEmail(id: string) {
    await this.codes.update(id, { emailSentAt: null });
  }
  async acceptRecoveryCode(id: string) {
    await this.db.transaction(async (manager) => {
      const code = await manager.findOneOrFail(DiscountCode, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (code.status !== 'active' || code.expiresAt <= new Date())
        throw new BadRequestException(
          'El beneficio venció o ya no está disponible',
        );
      if (!code.acceptedAt) {
        code.acceptedAt = new Date();
        await manager.save(code);
        await manager.query(
          'UPDATE vendor_reviews SET editable_until = ? WHERE id = ?',
          [new Date(Date.now() + 7 * 86400000), code.reviewId],
        );
      }
    });
  }
  recoveryToken(id: string) {
    const secret = process.env.REVIEW_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('Falta configurar la firma de enlaces');
    return `${id}.${createHmac('sha256', secret).update(`recovery:${id}`).digest('hex')}`;
  }
  async recoveryByToken(token: string) {
    const id = String(token || '').split('.')[0];
    if (!/^[0-9a-f-]{36}$/i.test(id) || token !== this.recoveryToken(id))
      throw new NotFoundException('Enlace no disponible');
    const code = await this.codes.findOneBy({ id });
    if (!code?.reviewId) throw new NotFoundException('Beneficio no disponible');
    return code;
  }
}
