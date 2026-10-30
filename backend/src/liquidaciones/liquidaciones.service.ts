import { getVendorSettlement } from '../orders/vendor-settlement';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Liquidacion } from './liquidacion.entity';
import { VendorPayment } from './vendor-payment.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OrdersService } from '../orders/orders.service';

// Nombres de columna del Excel (fila 1) → clave interna
const HEADER_MAP: Record<string, string> = {
  'identificador/vaucher':                'IDENTIFICADOR',
  'identificador':                        'IDENTIFICADOR',
  'fecha':                                'FECHA',
  'concepto':                             'CONCEPTO',
  'orden':                                'ORDEN',
  'monto':                                'MONTO',
  'comisión':                            'COMISION',
  'comision':                             'COMISION',
  'monto final':                          'MONTO_FINAL',
  'email':                                'EMAIL',
  'liquidación':                         'LIQUIDACION',
  'liquidacion':                          'LIQUIDACION',
  '4 últimos dígitos de la tarjeta':     'ULTIMOS_DIGITOS',
  '4 ultimos digitos de la tarjeta':      'ULTIMOS_DIGITOS',
  'medio de pago':                        'MEDIO_DE_PAGO',
  'orden externa':                        'ORDEN_EXTERNA',
  'débito / crédito':                    'DEBITO_CREDITO',
  'debito / credito':                     'DEBITO_CREDITO',
};

const LIQUIDACIONES_HEADER_MAP: Record<string, string> = {
  'liquidacion':                          'LIQUIDACION',
  'monto':                                'MONTO',
  'estatus':                              'ESTATUS',
  'estado':                               'ESTATUS',
  'fecha deposito':                       'FECHA_DEPOSITO',
};

function normHeader(value: any): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  // Excel serial date number
  if (typeof value === 'number') {
    const MS_PER_DAY = 86400000;
    const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime();
    const d = new Date(EXCEL_EPOCH + value * MS_PER_DAY);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  const isoDateOnlyMatch = s.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (isoDateOnlyMatch) {
    const [, year, month, day, hh = '0', mm = '0', ss = '0'] = isoDateOnlyMatch;
    const d = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hh),
      Number(mm),
      Number(ss),
    );
    return isNaN(d.getTime()) ? null : d;
  }

  // Formato Payku: "d-m-yyyy hh:mm:s" o "d-m-yyyy" (día y mes sin cero)
  const paykuMatch = s.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?$/,
  );
  if (paykuMatch) {
    const [, day, month, year, hh = '0', mm = '0', ss = '0'] = paykuMatch;
    const d = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hh),
      Number(mm),
      Number(ss),
    );
    return isNaN(d.getTime()) ? null : d;
  }

  const slashDateMatch = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (slashDateMatch) {
    const [, day, month, year, hh = '0', mm = '0', ss = '0'] = slashDateMatch;
    const d = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hh),
      Number(mm),
      Number(ss),
    );
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO y otros formatos estándar como fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseNum(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function parseStr(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function buildColumnMap(headerRow: any[], map: Record<string, string>): Record<string, number> {
  const cols: Record<string, number> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const key = map[normHeader(headerRow[i])];
    if (key) cols[key] = i;
  }
  return cols;
}

function getSheetByName(workbook: XLSX.WorkBook, expectedName: string): XLSX.WorkSheet | null {
  const sheetName = workbook.SheetNames.find((name) => normHeader(name) === normHeader(expectedName));
  return sheetName ? workbook.Sheets[sheetName] : null;
}

function dateOnlyTime(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const EXTERNAL_ORDER_SOURCES = [
  'mercadolibre',
  'woocommerce',
  'falabella',
  'paris',
  'pos',
  'assisted_sale',
];

@Injectable()
export class LiquidacionesService {
  constructor(
    @InjectRepository(Liquidacion)
    private readonly repo: Repository<Liquidacion>,
    @InjectRepository(VendorPayment)
    private readonly vendorPaymentRepo: Repository<VendorPayment>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly ordersService: OrdersService,
  ) {}

  async notifyVendorPendingRefund(orderId: string) {
    return this.ordersService.sendVendorCustomerRefundReminder(orderId);
  }

  /**
   * Parsea el buffer del Excel e inserta/actualiza registros.
   * La fila 3 es encabezado, los datos empiezan en fila 4.
   * Clave de upsert: identificador (col D).
   */
  async importFromBuffer(buffer: Buffer): Promise<{
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    depositosAsociados: number;
    errors: string[];
  }> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = getSheetByName(workbook, 'Transacciones');
    const liquidacionesSheet = getSheetByName(workbook, 'Liquidaciones');

    if (!sheet) {
      throw new BadRequestException(
        `No se encontró la hoja "Transacciones". Hojas detectadas: ${workbook.SheetNames.join(', ')}`,
      );
    }

    if (!liquidacionesSheet) {
      throw new BadRequestException(
        `No se encontró la hoja "Liquidaciones". Hojas detectadas: ${workbook.SheetNames.join(', ')}`,
      );
    }

    const liquidacionRows: any[][] = XLSX.utils.sheet_to_json(liquidacionesSheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    if (liquidacionRows.length < 2) {
      throw new BadRequestException(
        'La hoja "Liquidaciones" debe tener encabezados en fila 1 y datos desde fila 2',
      );
    }

    const liquidacionCols = buildColumnMap(liquidacionRows[0], LIQUIDACIONES_HEADER_MAP);
    for (const required of ['LIQUIDACION', 'FECHA_DEPOSITO']) {
      if (liquidacionCols[required] === undefined) {
        throw new BadRequestException(
          `No se encontró la columna requerida "${required === 'LIQUIDACION' ? 'Liquidación' : 'Fecha Depósito'}" en la hoja "Liquidaciones". ` +
          `Encabezados detectados: ${liquidacionRows[0].filter(Boolean).join(', ')}`,
        );
      }
    }

    const depositosMap = new Map<string, { fechaDeposito: Date | null; estatus: string | null; monto: number | null }>();
    for (const row of liquidacionRows.slice(1)) {
      const numeroLiquidacion = parseStr(row[liquidacionCols['LIQUIDACION']]);
      if (!numeroLiquidacion) continue;
      depositosMap.set(numeroLiquidacion, {
        fechaDeposito: parseDate(row[liquidacionCols['FECHA_DEPOSITO']]),
        estatus: parseStr(row[liquidacionCols['ESTATUS']]),
        monto: parseNum(row[liquidacionCols['MONTO']]),
      });
    }

    // Convertir a array de arrays sin encabezado (header: 1)
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    // La fila 1 (index 0) contiene los encabezados
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo Excel debe tener al menos 2 filas: encabezados en fila 1 y datos desde fila 2',
      );
    }

    const headerRow: any[] = rows[0];
    const COL = buildColumnMap(headerRow, HEADER_MAP);

    if (COL['IDENTIFICADOR'] === undefined) {
      throw new BadRequestException(
        `No se encontró la columna "Identificador/vaucher" en los encabezados. ` +
        `Encabezados detectados: ${headerRow.filter(Boolean).join(', ')}`,
      );
    }

    // Datos desde la fila 2 (index 1)
    const dataRows = rows.slice(1);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let depositosAsociados = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

const identificador = parseStr(row[COL['IDENTIFICADOR']]);
        if (!identificador) {
          skipped++;
          continue;
        }

        try {
          // Buscar existente
          const existing = await this.repo.findOne({ where: { identificador } });

          const ordenId = parseStr(row[COL['ORDEN']]);
          let shippingCost: number | null = null;

          // Buscar la orden para obtener el shippingCost
          if (ordenId) {
            try {
              const order = await this.ordersRepo.findOne({ where: { id: ordenId } });
              if (order) {
                shippingCost = Number(order.shippingCost) || 0;
              }
            } catch (orderErr) {
              console.warn(`⚠️ [Liquidaciones] No se pudo obtener shippingCost de orden ${ordenId}:`, orderErr.message);
              shippingCost = null;
            }
          }

          const montoRaw = parseNum(row[COL['MONTO']]);
          const comisionRaw = parseNum(row[COL['COMISION']]);

          // Calcular comisión sobre venta sin envío
          // Si hay shippingCost, recalcular comisión proporcionalmente
          let comisionCalculada = comisionRaw;
          if (montoRaw != null && shippingCost != null && shippingCost > 0) {
            const montoSinEnvio = montoRaw - shippingCost;
            if (montoSinEnvio > 0 && comisionRaw != null) {
              // La comisión del Excel probablemente incluye envío, recalcular sin envío
              const tasaComision = comisionRaw / montoRaw;
              comisionCalculada = Math.round(montoSinEnvio * tasaComision);
            }
          }

          const liquidacion = parseStr(row[COL['LIQUIDACION']]);
          const depositoPayku = liquidacion ? depositosMap.get(liquidacion) : null;
          if (depositoPayku?.fechaDeposito) depositosAsociados++;

          const data: Partial<Liquidacion> = {
            identificador,
            fecha:           parseDate(row[COL['FECHA']]),
            concepto:        parseStr(row[COL['CONCEPTO']]),
            orden:           ordenId,
            monto:           montoRaw,
            comision:        comisionCalculada,
            montoFinal:      parseNum(row[COL['MONTO_FINAL']]),
            email:           parseStr(row[COL['EMAIL']]),
            liquidacion,
            fechaDeposito:   depositoPayku?.fechaDeposito ?? null,
            estatusLiquidacion: depositoPayku?.estatus ?? null,
            ultimosDigitos:  parseStr(row[COL['ULTIMOS_DIGITOS']]),
            medioDePago:     parseStr(row[COL['MEDIO_DE_PAGO']]),
            ordenExterna:    parseStr(row[COL['ORDEN_EXTERNA']]),
            debitoCredito:   parseStr(row[COL['DEBITO_CREDITO']]),
        };

        if (existing) {
          await this.repo.update({ identificador }, data);
          updated++;
        } else {
          await this.repo.save(this.repo.create({ ...data }));
          inserted++;
        }
      } catch (err) {
        errors.push(`Fila ${i + 2}: ${err.message}`);
      }
    }

    return {
      total: dataRows.filter(r => r && r.length > 0).length,
      inserted,
      updated,
      skipped,
      depositosAsociados,
      errors,
    };
  }

  async findAll(filters: {
    page?: number;
    limit?: number;
    estado?: string;
    search?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }) {
    const { page = 1, limit = 50, estado, search, fechaDesde, fechaHasta } = filters;

    const qb = this.repo.createQueryBuilder('liq');

    // Nota: "estado" ya no existe en el nuevo formato, pero mantenemos el parámetro por compatibilidad
    if (search) {
      qb.andWhere(
        '(liq.identificador LIKE :s OR liq.orden LIKE :s OR liq.ordenExterna LIKE :s OR liq.email LIKE :s OR liq.concepto LIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (fechaDesde) {
      qb.andWhere('liq.fecha >= :fechaDesde', { fechaDesde });
    }
    if (fechaHasta) {
      qb.andWhere('liq.fecha <= :fechaHasta', { fechaHasta });
    }

    qb.orderBy('liq.fecha', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Match the same order identifiers used by the account statement.
    const references = items.map(item => item.orden).filter(Boolean) as string[];
    const orders = references.length ? await this.ordersRepo.find({
      where: [{ id: In(references) }, { orderNumber: In(references) }],
    }) : [];
    const enrichedItems = items.map(item => {
      const order = orders.find(o => o.id === item.orden || o.orderNumber === item.orden);
      return {
        ...item,
        shippingCost: order ? Number(order.shippingCost) || 0 : null,
        productSaleAmount: order ? Math.max(0, Number(order.total) - Number(order.shippingCost || 0)) : null,
        orderSource: order?.orderSource ?? null,
        orderStatus: order?.status ?? null,
        ...(order ? getVendorSettlement(order) : {}),
      };
    });

    return {
      items: enrichedItems,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats() {
    const total = await this.repo.count();

    const montoTotal = await this.repo
      .createQueryBuilder('liq')
      .select('SUM(liq.monto)', 'total')
      .getRawOne();

    const montoPorLiquidacion = await this.repo
      .createQueryBuilder('liq')
      .select('liq.liquidacion', 'liquidacion')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('SUM(liq.monto)', 'monto')
      .addSelect('SUM(liq.comision)', 'comision')
      .addSelect('SUM(liq.montoFinal)', 'montoFinal')
      .groupBy('liq.liquidacion')
      .getRawMany();

    return {
      total,
      montoTotal: montoTotal?.total || 0,
      montoPorLiquidacion,
    };
  }

  async getResumenTiendas() {
    // Agrupar por email de cliente
    return this.repo
      .createQueryBuilder('liq')
      .select('liq.email', 'email')
      .addSelect('COUNT(*)', 'transacciones')
      .addSelect('SUM(liq.monto)', 'montoTotal')
      .addSelect('SUM(liq.comision)', 'comisionTotal')
      .addSelect('SUM(liq.montoFinal)', 'montoFinal')
      .where('liq.email IS NOT NULL')
      .groupBy('liq.email')
      .orderBy('montoTotal', 'DESC')
      .getRawMany();
  }

  // ─── Depósitos Tiendas ────────────────────────────────────────────────────

  /** Lista tiendas (vendorId + storeName) que tienen órdenes en processing */
  async getVendorsList() {
    const rows = await this.ordersRepo
      .createQueryBuilder('o')
      .select('o.vendorId', 'vendorId')
      .addSelect('MAX(o.vendorEmail)', 'vendorEmail')
      .addSelect('v.storeName', 'storeName')
      .leftJoin('vendors', 'v', 'v.id = o.vendorId')
      .where('o.status IN (:...statuses)', { statuses: ['processing', 'paid', 'shipped', 'delivered', 'cancelled'] })
      .andWhere('(o.paymentTransactionId IS NOT NULL OR o.paymentId IS NOT NULL)')
      .andWhere(`(
        (o.orderSource NOT IN (:...externalSources) OR o.orderSource IS NULL)
        OR (o.orderSource = 'assisted_sale' AND o.status = 'cancelled' AND o.assistedReimbursementStatus = 'pending_payment')
      )`, {
        externalSources: EXTERNAL_ORDER_SOURCES,
      })
      .groupBy('o.vendorId')
      .addGroupBy('v.storeName')
      .orderBy('v.storeName', 'ASC')
      .getRawMany();
    return rows;
  }

  /**
   * Órdenes en estado 'processing' CON pago Payku, SIN pago al vendor aún.
   * Enriquece con número de liquidación si existe.
   */
  async getDepositosPendientes(vendorId?: string) {
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .where('o.status IN (:...statuses)', { statuses: ['processing', 'paid', 'shipped', 'delivered', 'cancelled'] })
      .andWhere('(o.paymentTransactionId IS NOT NULL OR o.paymentId IS NOT NULL)')
      .andWhere(`(
        (o.orderSource NOT IN (:...externalSources) OR o.orderSource IS NULL)
        OR (o.orderSource = 'assisted_sale' AND o.status = 'cancelled' AND o.assistedReimbursementStatus = 'pending_payment')
      )`, {
        externalSources: EXTERNAL_ORDER_SOURCES,
      })
      .andWhere('o.vendorPaymentId IS NULL')
      .andWhere("(o.shippingHandledBy IS NULL OR o.shippingHandledBy != 'vendor' OR o.status = 'delivered')")
      .andWhere("(o.status != 'cancelled' OR o.cancellationReviewStatus IS NULL OR o.cancellationReviewStatus != 'pending')")
      .orderBy('o.createdAt', 'DESC');

    if (vendorId) qb.andWhere('o.vendorId = :vendorId', { vendorId });

    const orders = await qb.getMany();
    if (!orders.length) return [];

    // Búsqueda dual: single-vendor envía UUID a Payku, multi-vendor envía orderNumber
    const orderIds = orders.map((o) => o.id);
    const orderNumbers = orders.map((o) => o.orderNumber);
    const liquidaciones = await this.repo.find({
      where: { orden: In([...orderIds, ...orderNumbers]) },
    });
    const liqMap = new Map<string, Liquidacion>();
    for (const l of liquidaciones) {
      if (l.orden) liqMap.set(l.orden, l);
    }

    return orders.map((o) => {
      // Match por UUID (single-vendor) o por orderNumber (multi-vendor)
      const liq = liqMap.get(o.id) ?? liqMap.get(o.orderNumber);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        status: o.status,
        paymentStatus: o.paymentStatus,
        vendorCustomerRefundStatus: o.vendorCustomerRefundStatus,
        total: o.total,
        vendorAmount: o.vendorAmount,
        commissionAmount: o.commissionAmount,
        marketplaceCommission: o.marketplaceCommission,
        shippingCost: Number(o.shippingCost) || 0,
        orderSource: o.orderSource,
        depositType: o.orderSource === 'assisted_sale' ? 'assisted_reimbursement' : 'sale_settlement',
        depositAmount: o.orderSource === 'assisted_sale'
          ? Number(o.assistedReimbursementAmount) || 0
          : Number(o.vendorAmount) || 0,
        assistedReimbursementStatus: o.assistedReimbursementStatus,
        assistedShippingRefundStatus: o.assistedShippingRefundStatus,
        assistedCommissionRefundAmount: Number(o.assistedCommissionRefundAmount) || 0,
        assistedShippingRefundAmount: Number(o.assistedShippingRefundAmount) || 0,
        assistedReimbursementAmount: Number(o.assistedReimbursementAmount) || 0,
        vendorId: o.vendorId,
        vendorEmail: o.vendorEmail ?? null,
        customerEmail: o.customerEmail ?? null,
        liquidacionNumero: liq?.liquidacion ?? null,
        liquidacionFecha: liq?.fecha ?? null,
        fechaDepositoPayku: liq?.fechaDeposito ?? null,
        estatusLiquidacion: liq?.estatusLiquidacion ?? null,
      };
    });
  }

  /** Registra un pago a vendor y vincula las órdenes seleccionadas */
  async createVendorPayment(
    dto: {
      vendorId: string;
      vendorEmail?: string;
      vendorStoreName?: string;
      orderIds: string[];
      numeroTransferencia: string;
      comprobanteNota?: string;
      valorDepositado: number;
      fechaPago?: string;
    },
    filePath?: string,
  ) {
    // Calcular valor esperado: suma de vendorAmount de las órdenes
    const orders = await this.ordersRepo.find({
      where: { id: In(dto.orderIds), vendorId: dto.vendorId },
    });

    if (!orders.length) {
      throw new BadRequestException('No se encontraron órdenes válidas');
    }
    const requestedOrderIds = [...new Set(dto.orderIds)];
    if (orders.length !== requestedOrderIds.length) {
      throw new BadRequestException('Una o más órdenes no existen o no pertenecen a la tienda seleccionada');
    }
    const alreadyPaid = orders.find((order) => Boolean(order.vendorPaymentId));
    if (alreadyPaid) {
      throw new BadRequestException(`La orden ${alreadyPaid.orderNumber} ya fue incluida en un pago a tienda.`);
    }
    const externalShippingPending = orders.find((order) =>
      order.shippingHandledBy === 'vendor'
      && (order.status !== OrderStatus.DELIVERED || order.externalShippingPayoutStatus !== 'eligible'),
    );
    if (externalShippingPending) {
      throw new BadRequestException(
        `La orden ${externalShippingPending.orderNumber} usa envío gestionado por la tienda y sólo puede liquidarse después de confirmar la entrega.`,
      );
    }
    const isAssistedReimbursement = (order: Order) =>
      order.orderSource === 'assisted_sale'
      && order.status === 'cancelled'
      && order.assistedReimbursementStatus === 'pending_payment'
      && Number(order.assistedReimbursementAmount || 0) > 0;
    const externalOrder = orders.find((order) =>
      EXTERNAL_ORDER_SOURCES.includes(String(order.orderSource || '').toLowerCase())
      && !isAssistedReimbursement(order),
    );
    if (externalOrder) {
      throw new BadRequestException(
        `La orden ${externalOrder.orderNumber} pertenece a una integración externa y no puede incluirse en las liquidaciones de MundoBeat.`,
      );
    }
    const pendingReview = orders.find((order) => order.status === 'cancelled' && order.cancellationReviewStatus === 'pending');
    if (pendingReview) {
      throw new BadRequestException(`La cancelación de la orden ${pendingReview.orderNumber} debe revisarse antes de liquidarla.`);
    }
    const pendingCustomerRefund = orders.find((order) =>
      order.orderSource !== 'assisted_sale'
      &&
      order.status === 'cancelled'
      && order.paymentStatus === 'approved'
      && order.vendorCustomerRefundStatus !== 'completed',
    );
    if (pendingCustomerRefund) {
      throw new BadRequestException(
        `La orden ${pendingCustomerRefund.orderNumber} no puede pagarse a la tienda hasta que se registre la devolución al comprador con su comprobante.`,
      );
    }

    const fechaPago = dto.fechaPago ? parseDate(dto.fechaPago) : new Date();
    if (!fechaPago) {
      throw new BadRequestException('Fecha de pago a tienda inválida');
    }

    const orderIds = orders.map((o) => o.id);
    const orderNumbers = orders.map((o) => o.orderNumber);
    const liquidaciones = await this.repo.find({
      where: { orden: In([...orderIds, ...orderNumbers]) },
    });
    const liqMap = new Map<string, Liquidacion>();
    for (const l of liquidaciones) {
      if (l.orden) liqMap.set(l.orden, l);
    }

    for (const order of orders) {
      const liquidacion = liqMap.get(order.id) ?? liqMap.get(order.orderNumber);
      if (!liquidacion?.fechaDeposito) {
        throw new BadRequestException(
          `La orden ${order.orderNumber} no tiene Fecha Depósito de Payku registrada. Importa la hoja "Liquidaciones" antes de pagar a la tienda.`,
        );
      }
      if (dateOnlyTime(fechaPago) < dateOnlyTime(liquidacion.fechaDeposito)) {
        throw new BadRequestException(
          `La orden ${order.orderNumber} no puede pagarse a la tienda antes del depósito Payku (${liquidacion.fechaDeposito.toLocaleDateString('es-CL')}).`,
        );
      }
    }

    const valorEsperado = orders.reduce(
      (sum, o) => sum + (isAssistedReimbursement(o)
        ? Number(o.assistedReimbursementAmount) || 0
        : Number(o.vendorAmount) || 0),
      0,
    );

    // Crear registro del pago
    const payment = this.vendorPaymentRepo.create({
      id: uuidv4(),
      vendorId: dto.vendorId,
      vendorEmail: dto.vendorEmail ?? null,
      vendorStoreName: dto.vendorStoreName ?? null,
      numeroTransferencia: dto.numeroTransferencia,
      comprobante: filePath ?? null,
      comprobanteNota: dto.comprobanteNota ?? null,
      valorDepositado: dto.valorDepositado,
      valorEsperado,
      fechaPago,
      status: 'confirmed',
    });
    const saved = await this.vendorPaymentRepo.save(payment);

    // Vincular órdenes al pago
    await this.ordersRepo
      .createQueryBuilder()
      .update()
      .set({
        vendorPaymentId: saved.id,
        vendorPaidAt: fechaPago,
      })
      .where('id IN (:...ids)', { ids: dto.orderIds })
      .andWhere('vendorId = :vId', { vId: dto.vendorId })
      .execute();

    const assistedOrderIds = orders.filter(isAssistedReimbursement).map((order) => order.id);
    if (assistedOrderIds.length > 0) {
      await this.ordersRepo
        .createQueryBuilder()
        .update()
        .set({ assistedReimbursementStatus: 'paid' })
        .where('id IN (:...ids)', { ids: assistedOrderIds })
        .execute();
    }

    const externalShippingOrderIds = orders
      .filter((order) => order.shippingHandledBy === 'vendor')
      .map((order) => order.id);
    if (externalShippingOrderIds.length > 0) {
      await this.ordersRepo
        .createQueryBuilder()
        .update()
        .set({ externalShippingPayoutStatus: 'paid' })
        .where('id IN (:...ids)', { ids: externalShippingOrderIds })
        .execute();
    }

    return {
      payment: saved,
      ordenesPagadas: orders.length,
      valorEsperado,
      valorDepositado: dto.valorDepositado,
    };
  }

  /** Historial de pagos realizados a vendors */
  async getVendorPayments(vendorId?: string) {
    const qb = this.vendorPaymentRepo
      .createQueryBuilder('vp')
      .orderBy('vp.createdAt', 'DESC');

    if (vendorId) qb.where('vp.vendorId = :vendorId', { vendorId });

    const payments = await qb.getMany();

    // Para cada pago, incluir las órdenes asociadas
    const result = await Promise.all(
      payments.map(async (p) => {
        const orders = await this.ordersRepo.find({
          where: { vendorPaymentId: p.id },
          select: ['id', 'orderNumber', 'vendorAmount', 'orderSource', 'assistedReimbursementAmount', 'createdAt'],
        });
        return { ...p, orders };
      }),
    );

    return result;
  }
}
