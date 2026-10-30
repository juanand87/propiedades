import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { PosCashMovement } from './pos-cash-movement.entity';
import { PosRegister } from './pos-register.entity';
import { PosShift } from './pos-shift.entity';
import { PosStaff, PosStaffRole } from './pos-staff.entity';

export interface PosSession {
  vendorId: string;
  staffId: string;
  role: PosStaffRole;
}

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(PosRegister) private readonly registers: Repository<PosRegister>,
    @InjectRepository(PosStaff) private readonly staff: Repository<PosStaff>,
    @InjectRepository(PosShift) private readonly shifts: Repository<PosShift>,
    @InjectRepository(PosCashMovement) private readonly movements: Repository<PosCashMovement>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
    private readonly jwt: JwtService,
  ) {}

  listRegisters(vendorId: string) {
    return this.registers.find({ where: { vendorId }, order: { name: 'ASC' } });
  }

  async createRegister(vendorId: string, body: { name: string; code?: string }) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Debes indicar el nombre de la caja');
    const code = (body.code?.trim() || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!code) throw new BadRequestException('El código de la caja no es válido');
    if (await this.registers.findOne({ where: { vendorId, code } })) throw new BadRequestException('Ya existe una caja con ese código');
    return this.registers.save(this.registers.create({ vendorId, name, code, isActive: true }));
  }

  async updateRegister(vendorId: string, id: string, body: { name?: string; isActive?: boolean }) {
    const item = await this.registers.findOne({ where: { id, vendorId } });
    if (!item) throw new NotFoundException('Caja no encontrada');
    if (body.name?.trim()) item.name = body.name.trim();
    if (typeof body.isActive === 'boolean') item.isActive = body.isActive;
    return this.registers.save(item);
  }

  listStaff(vendorId: string) {
    return this.staff.find({ where: { vendorId }, order: { name: 'ASC' } });
  }

  async createStaff(vendorId: string, body: { name: string; username: string; pin: string; role?: PosStaffRole }) {
    const name = body.name?.trim();
    const username = body.username?.trim().toLowerCase();
    if (!name || !username || !body.pin || body.pin.length < 4) throw new BadRequestException('Completa nombre, usuario y una clave de al menos 4 caracteres');
    if (await this.staff.findOne({ where: { vendorId, username } })) throw new BadRequestException('Ese usuario ya existe');
    const pinHash = await bcrypt.hash(body.pin, 10);
    return this.staff.save(this.staff.create({ vendorId, name, username, pinHash, role: body.role || 'cashier', isActive: true }));
  }

  async updateStaff(vendorId: string, id: string, body: { name?: string; username?: string; pin?: string; role?: PosStaffRole; isActive?: boolean }) {
    const item = await this.staff.createQueryBuilder('staff').addSelect('staff.pinHash').where('staff.id = :id AND staff.vendorId = :vendorId', { id, vendorId }).getOne();
    if (!item) throw new NotFoundException('Cajero no encontrado');
    if (body.name?.trim()) item.name = body.name.trim();
    if (body.username?.trim()) item.username = body.username.trim().toLowerCase();
    if (body.pin) {
      if (body.pin.length < 4) throw new BadRequestException('La clave debe tener al menos 4 caracteres');
      item.pinHash = await bcrypt.hash(body.pin, 10);
    }
    if (body.role) item.role = body.role;
    if (typeof body.isActive === 'boolean') item.isActive = body.isActive;
    return this.staff.save(item);
  }

  async login(vendorId: string, username: string, pin: string) {
    const member = await this.staff.createQueryBuilder('staff').addSelect('staff.pinHash')
      .where('staff.vendorId = :vendorId AND LOWER(staff.username) = :username', { vendorId, username: username?.trim().toLowerCase() }).getOne();
    if (!member || !member.isActive || !(await bcrypt.compare(pin || '', member.pinHash))) throw new UnauthorizedException('Usuario o clave incorrectos');
    const token = await this.jwt.signAsync({ purpose: 'pos', vendorId, staffId: member.id, role: member.role }, { expiresIn: '12h' });
    return { token, staff: { id: member.id, name: member.name, username: member.username, role: member.role } };
  }

  async loginPublic(store: string, username: string, pin: string) {
    const key = (store || '').trim().toLowerCase().replace(/^www\./, '');
    const slug = key.endsWith('.mundobeat.cl') ? key.replace('.mundobeat.cl', '') : key;
    const vendor = await this.vendors.createQueryBuilder('vendor')
      .leftJoinAndSelect('vendor.settings', 'settings')
      .where('LOWER(vendor.slug) = :slug OR LOWER(vendor.customDomain) = :domain', { slug, domain: key })
      .andWhere('vendor.isActive = :active', { active: true })
      .getOne();
    if (!vendor) throw new NotFoundException('No encontramos la tienda asociada a esta dirección');
    const result = await this.login(vendor.id, username, pin);
    return { ...result, store: { id: vendor.id, name: vendor.storeName, slug: vendor.slug, logo: vendor.settings?.headerConfig?.logo || vendor.logo } };
  }

  async session(token: string | undefined, vendorId: string): Promise<PosSession> {
    if (!token) throw new UnauthorizedException('Debes iniciar sesión en la caja');
    try {
      const payload = await this.jwt.verifyAsync(token);
      if (payload.purpose !== 'pos' || payload.vendorId !== vendorId) throw new Error();
      const member = await this.staff.findOne({ where: { id: payload.staffId, vendorId, isActive: true } });
      if (!member) throw new Error();
      return { vendorId, staffId: member.id, role: member.role };
    } catch {
      throw new UnauthorizedException('La sesión de caja expiró. Inicia sesión nuevamente');
    }
  }

  async sessionFromToken(token: string | undefined): Promise<PosSession> {
    if (!token) throw new UnauthorizedException('Debes iniciar sesión en la caja');
    try {
      const payload = await this.jwt.verifyAsync(token);
      if (payload.purpose !== 'pos' || !payload.vendorId) throw new Error();
      const member = await this.staff.findOne({ where: { id: payload.staffId, vendorId: payload.vendorId, isActive: true } });
      if (!member) throw new Error();
      return { vendorId: payload.vendorId, staffId: member.id, role: member.role };
    } catch {
      throw new UnauthorizedException('La sesión de caja expiró. Inicia sesión nuevamente');
    }
  }

  async getStore(vendorId: string) {
    const vendor = await this.vendors.findOne({ where: { id: vendorId, isActive: true }, relations: ['settings'] });
    if (!vendor) throw new NotFoundException('Tienda no encontrada');
    return { id: vendor.id, name: vendor.storeName, slug: vendor.slug, logo: vendor.settings?.headerConfig?.logo || vendor.logo };
  }

  async currentShift(session: PosSession) {
    const shift = await this.findCurrentShift(session);
    return shift ? this.decorateShift(shift) : null;
  }

  async openShift(session: PosSession, registerId: string, openingCash: number) {
    const register = await this.registers.findOne({ where: { id: registerId, vendorId: session.vendorId, isActive: true } });
    if (!register) throw new BadRequestException('Selecciona una caja activa');
    if (await this.shifts.findOne({ where: { vendorId: session.vendorId, staffId: session.staffId, status: 'open' } })) throw new BadRequestException('Ya tienes un turno abierto');
    if (await this.shifts.findOne({ where: { vendorId: session.vendorId, registerId, status: 'open' } })) throw new BadRequestException('La caja ya está siendo utilizada');
    const shift = await this.shifts.save(this.shifts.create({
      vendorId: session.vendorId,
      registerId,
      staffId: session.staffId,
      status: 'open',
      openingCash: Math.max(0, Number(openingCash) || 0),
      cashSales: 0,
      debitSales: 0,
      creditSales: 0,
      transferSales: 0,
      openedAt: new Date(),
    }));
    return this.decorateShift(shift);
  }

  async requireOpenShift(session: PosSession, shiftId?: string) {
    const shift = await this.shifts.findOne({
      where: shiftId
        ? { id: shiftId, vendorId: session.vendorId, status: 'open' }
        : { vendorId: session.vendorId, staffId: session.staffId, status: 'open' },
    });
    if (!shift) {
      throw new BadRequestException(
        shiftId
          ? 'El turno seleccionado ya no está abierto. Vuelve a ingresar al punto de venta'
          : 'Debes abrir un turno antes de registrar ventas',
      );
    }
    return shift;
  }

  async addMovement(session: PosSession, shiftId: string, body: { type: 'income' | 'withdrawal'; amount: number; reason: string }) {
    const shift = await this.requireOpenShift(session, shiftId);
    if (shift.staffId !== session.staffId) throw new BadRequestException('El turno no corresponde al cajero');
    if (!['income', 'withdrawal'].includes(body.type) || Number(body.amount) <= 0 || !body.reason?.trim()) throw new BadRequestException('Completa el tipo, monto y motivo del movimiento');
    return this.movements.save(this.movements.create({ vendorId: session.vendorId, shiftId, staffId: session.staffId, type: body.type, amount: Number(body.amount), reason: body.reason.trim() }));
  }

  async closeShift(session: PosSession, shiftId: string, countedCash: number, note?: string) {
    const shift = await this.requireOpenShift(session, shiftId);
    if (shift.staffId !== session.staffId) throw new BadRequestException('El turno no corresponde al cajero');
    const raw = await this.orders.createQueryBuilder('o')
      .select("SUM(CASE WHEN o.paymentMethod = 'efectivo' THEN o.total ELSE 0 END)", 'cash')
      .addSelect("SUM(CASE WHEN o.paymentMethod = 'efectivo' THEN 1 ELSE 0 END)", 'cashCount')
      .addSelect("SUM(CASE WHEN o.paymentMethod = 'debito' THEN o.total ELSE 0 END)", 'debit')
      .addSelect("SUM(CASE WHEN o.paymentMethod = 'debito' THEN 1 ELSE 0 END)", 'debitCount')
      .addSelect("SUM(CASE WHEN o.paymentMethod = 'credito' THEN o.total ELSE 0 END)", 'credit')
      .addSelect("SUM(CASE WHEN o.paymentMethod = 'credito' THEN 1 ELSE 0 END)", 'creditCount')
      .addSelect("SUM(CASE WHEN o.paymentMethod = 'transferencia' THEN o.total ELSE 0 END)", 'transfer')
      .addSelect("SUM(CASE WHEN o.paymentMethod = 'transferencia' THEN 1 ELSE 0 END)", 'transferCount')
      .addSelect('COUNT(o.id)', 'orderCount')
      .addSelect('SUM(o.total)', 'totalSales')
      .where('o.posShiftId = :shiftId', { shiftId }).getRawOne();
    const movementRows = await this.movements.find({ where: { shiftId, vendorId: session.vendorId } });
    const movementTotals = movementRows.reduce((totals, item) => {
      if (item.type === 'income') totals.income += Number(item.amount);
      else totals.withdrawal += Number(item.amount);
      return totals;
    }, { income: 0, withdrawal: 0 });
    const movementNet = movementTotals.income - movementTotals.withdrawal;
    shift.cashSales = Number(raw?.cash || 0); shift.debitSales = Number(raw?.debit || 0);
    shift.creditSales = Number(raw?.credit || 0); shift.transferSales = Number(raw?.transfer || 0);
    shift.expectedCash = Number(shift.openingCash) + shift.cashSales + movementNet;
    shift.countedCash = Math.max(0, Number(countedCash) || 0);
    shift.difference = shift.countedCash - shift.expectedCash;
    shift.closingNote = note?.trim() || null; shift.status = 'closed'; shift.closedAt = new Date();
    const closedShift = await this.decorateShift(await this.shifts.save(shift));
    return {
      ...closedShift,
      summary: {
        orderCount: Number(raw?.orderCount || 0),
        totalSales: Number(raw?.totalSales || 0),
        paymentMethods: {
          cash: { count: Number(raw?.cashCount || 0), total: shift.cashSales },
          debit: { count: Number(raw?.debitCount || 0), total: shift.debitSales },
          credit: { count: Number(raw?.creditCount || 0), total: shift.creditSales },
          transfer: { count: Number(raw?.transferCount || 0), total: shift.transferSales },
        },
        cashMovements: movementTotals,
      },
    };
  }

  async closeCurrentShift(session: PosSession, countedCash: number, note?: string) {
    const shift = await this.findCurrentShift(session);
    if (!shift) throw new BadRequestException('No tienes un turno abierto para cerrar');
    return this.closeShift(session, shift.id, countedCash, note);
  }

  listHistory(vendorId: string) {
    return this.shifts.find({ where: { vendorId }, order: { openedAt: 'DESC' }, take: 100 });
  }

  private async decorateShift(shift: PosShift) {
    const [register, member] = await Promise.all([
      this.registers.findOne({ where: { id: shift.registerId } }),
      this.staff.findOne({ where: { id: shift.staffId } }),
    ]);
    return {
      id: shift.id,
      vendorId: shift.vendorId,
      registerId: shift.registerId,
      staffId: shift.staffId,
      status: shift.status,
      openingCash: Number(shift.openingCash || 0),
      expectedCash: shift.expectedCash === null ? null : Number(shift.expectedCash),
      countedCash: shift.countedCash === null ? null : Number(shift.countedCash),
      difference: shift.difference === null ? null : Number(shift.difference),
      cashSales: Number(shift.cashSales || 0),
      debitSales: Number(shift.debitSales || 0),
      creditSales: Number(shift.creditSales || 0),
      transferSales: Number(shift.transferSales || 0),
      closingNote: shift.closingNote,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      register: register ? { id: register.id, name: register.name } : null,
      staff: member ? { id: member.id, name: member.name, role: member.role } : null,
    };
  }

  private findCurrentShift(session: PosSession) {
    return this.shifts.findOne({
      where: { vendorId: session.vendorId, staffId: session.staffId, status: 'open' },
      order: { openedAt: 'DESC' },
    });
  }
}
