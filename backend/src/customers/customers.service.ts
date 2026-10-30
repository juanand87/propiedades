import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CustomerProfile } from './customer-profile.entity';
import { Customer } from './customer.entity';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerProfile)
    private customerProfileRepository: Repository<CustomerProfile>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  async getProfile(userId: string): Promise<CustomerProfile> {
    const profile = await this.customerProfileRepository.findOne({
      where: { userId },
      relations: ['region', 'commune'],
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    updateData: Partial<CustomerProfile>,
  ): Promise<CustomerProfile> {
    const profile = await this.customerProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    Object.assign(profile, updateData);
    return this.customerProfileRepository.save(profile);
  }

  async getCustomerOrders(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { customerId: userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderDetail(userId: string, orderId: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validar que el orden pertenece al usuario
    if (order.customerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  async createProfileFromCheckout(
    userId: string,
    checkoutData: {
      phone: string;
      address: string;
      city: string;
      regionId?: number;
      communeId?: number;
      zipCode?: string;
    },
  ): Promise<CustomerProfile> {
    const existingProfile = await this.customerProfileRepository.findOne({
      where: { userId },
    });

    if (existingProfile) {
      return existingProfile;
    }

    const profile = this.customerProfileRepository.create({
      userId,
      ...checkoutData,
      defaultAddress: true,
      preferences: {
        newsletter: false,
        notifications: true,
        smsNotifications: false,
      },
    });

    return this.customerProfileRepository.save(profile);
  }

  /**
   * Convierte un guest (compra sin cuenta) en un cliente registrado
   * @param orderNumber Número de orden del guest
   * @param email Email usado en la compra
   * @param password Nueva contraseña para la cuenta
   * @returns Customer creado con las órdenes asociadas
   */
  async convertGuestToCustomer(
    orderNumber: string,
    email: string,
    password: string,
  ): Promise<{ customer: Customer; ordersLinked: number }> {
    // 1. Buscar la orden guest por número y email
    const order = await this.ordersRepository.findOne({
      where: {
        orderNumber,
        customerEmail: email,
        customerId: IsNull(), // Solo órdenes guest
      },
    });

    if (!order) {
      throw new NotFoundException(
        'Orden no encontrada o ya está asociada a una cuenta',
      );
    }

    // 2. Verificar si ya existe un cliente con ese email
    let customer = await this.customerRepository.findOne({
      where: { email },
    });

    if (customer) {
      // Si ya existe, solo asociar la orden
      order.customerId = customer.id;
      order.guestData = null;
      await this.ordersRepository.save(order);

      // Actualizar estadísticas del cliente
      await this.updateCustomerStats(customer.id);

      return { customer, ordersLinked: 1 };
    }

    // 3. Crear nuevo cliente con contraseña hasheada
    const hashedPassword = await bcrypt.hash(password, 10);

    customer = this.customerRepository.create({
      email,
      password: hashedPassword,
      name: order.shippingName,
      phone: order.shippingPhone,
      rut: order.shippingRut,
      savedAddress: {
        address: order.shippingAddress,
        commune: order.shippingCommune,
        communeId: order.shippingCommuneId,
        region: order.shippingRegion,
        regionId: order.shippingRegionId,
        phone: order.shippingPhone,
        rut: order.shippingRut,
      },
      convertedFromGuest: true,
      convertedAt: new Date(),
    });

    customer = await this.customerRepository.save(customer);

    // 4. Asociar todas las órdenes guest con este email al nuevo customer
    const guestOrders = await this.ordersRepository.find({
      where: {
        customerEmail: email,
        customerId: IsNull(),
      },
    });

    for (const guestOrder of guestOrders) {
      guestOrder.customerId = customer.id;
      guestOrder.guestData = null;
      await this.ordersRepository.save(guestOrder);
    }

    // 5. Actualizar estadísticas del cliente
    await this.updateCustomerStats(customer.id);

    return { customer, ordersLinked: guestOrders.length };
  }

  /**
   * Actualiza las estadísticas de un cliente (total de órdenes y gasto total)
   */
  private async updateCustomerStats(customerId: string): Promise<void> {
    const orders = await this.ordersRepository.find({
      where: { customerId },
    });

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const firstOrderAt = orders.length > 0 ? orders[orders.length - 1].createdAt : undefined;
    const lastOrderAt = orders.length > 0 ? orders[0].createdAt : undefined;

    await this.customerRepository.update(customerId, {
      totalOrders,
      totalSpent,
      ...(firstOrderAt && { firstOrderAt }),
      ...(lastOrderAt && { lastOrderAt }),
    });
  }
}
