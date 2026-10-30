import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { Customer } from './customer.entity';
import { CustomerAccessToken } from './customer-access-token.entity';
import { Order } from '../orders/order.entity';
import { JwtService } from '@nestjs/jwt';
import { EmailTemplatesService } from '../email-templates/email-templates.service';

@Injectable()
export class CustomerAccessService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    @InjectRepository(CustomerAccessToken)
    private accessTokensRepository: Repository<CustomerAccessToken>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private jwtService: JwtService,
    private emailTemplatesService: EmailTemplatesService,
  ) {}

  async findOrCreateByEmail(email: string, orderData?: { name?: string; phone?: string; rut?: string }): Promise<Customer> {
    let customer = await this.customersRepository.findOne({ where: { email } });

    if (!customer) {
      customer = this.customersRepository.create({
        email,
        name: orderData?.name,
        phone: orderData?.phone,
        rut: orderData?.rut,
      });
      await this.customersRepository.save(customer);
      console.log('✅ Customer created:', email);
    } else if (orderData && !customer.name) {
      // Actualizar datos si no existían
      customer.name = orderData.name || customer.name;
      customer.phone = orderData.phone || customer.phone;
      customer.rut = orderData.rut || customer.rut;
      await this.customersRepository.save(customer);
      console.log('✅ Customer updated with order data:', email);
    }

    return customer;
  }

  async linkOrderToCustomer(orderId: string, customerEmail: string): Promise<void> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) {
      console.error('❌ Order not found:', orderId);
      return;
    }

    const customer = await this.findOrCreateByEmail(customerEmail, {
      name: order.shippingName,
      phone: order.shippingPhone,
      rut: order.shippingRut,
    });

    // Vincular orden al customer
    order.customerId = customer.id;
    await this.ordersRepository.save(order);

    // Actualizar estadísticas del customer
    await this.updateCustomerStats(customer.id);

    console.log('✅ Order linked to customer:', orderId, '→', customer.email);
  }

  async updateCustomerStats(customerId: string): Promise<void> {
    const customer = await this.customersRepository.findOne({ 
      where: { id: customerId },
      relations: ['orders']
    });

    if (!customer) return;

    const paidOrders = customer.orders.filter(order => 
      order.status === 'paid' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered'
    );

    customer.totalOrders = paidOrders.length;
    customer.totalSpent = paidOrders.reduce((sum, order) => sum + Number(order.total), 0);

    if (paidOrders.length > 0) {
      const sortedOrders = paidOrders.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      customer.firstOrderAt = sortedOrders[0].createdAt;
      customer.lastOrderAt = sortedOrders[sortedOrders.length - 1].createdAt;

      // Segmentación automática
      if (customer.totalOrders >= 10) {
        customer.segment = 'vip';
      } else if (customer.totalOrders >= 3) {
        customer.segment = 'regular';
      } else {
        customer.segment = 'new';
      }
    }

    await this.customersRepository.save(customer);
    console.log('✅ Customer stats updated:', customer.email, '- Orders:', customer.totalOrders);
  }

  async requestAccess(email: string): Promise<{ success: boolean }> {
    // Verificar que el email tenga al menos una orden
    const orderCount = await this.ordersRepository.count({ where: { customerEmail: email } });
    if (orderCount === 0) {
      throw new BadRequestException('No se encontraron pedidos con este email');
    }

    // Generar código de 6 dígitos
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Válido por 15 minutos

    // Guardar token
    const accessToken = this.accessTokensRepository.create({
      email,
      token,
      expiresAt,
    });
    await this.accessTokensRepository.save(accessToken);

    // Enviar email con código
    await this.emailTemplatesService.sendCustomerAccessCode(email, token);

    console.log('✅ Access code sent to:', email);
    return { success: true };
  }

  async verifyAccess(email: string, token: string): Promise<{ accessToken: string }> {
    // Buscar token válido
    const accessToken = await this.accessTokensRepository.findOne({
      where: {
        email,
        token,
        used: false,
      },
    });

    if (!accessToken) {
      throw new UnauthorizedException('Código inválido');
    }

    if (new Date() > accessToken.expiresAt) {
      throw new UnauthorizedException('Código expirado');
    }

    // Marcar token como usado
    accessToken.used = true;
    await this.accessTokensRepository.save(accessToken);

    // Generar JWT temporal (válido 24 horas)
    const jwt = this.jwtService.sign(
      { email, type: 'customer' },
      { expiresIn: '24h' }
    );

    console.log('✅ Access verified for:', email);
    return { accessToken: jwt };
  }

  async getCustomerOrders(email: string): Promise<Order[]> {
    const orders = await this.ordersRepository.find({
      where: { customerEmail: email },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    console.log('✅ Retrieved', orders.length, 'orders for:', email);
    return orders;
  }

  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.accessTokensRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    console.log('🧹 Cleaned up', result.affected, 'expired access tokens');
  }

  async linkExistingOrdersByEmail(email: string): Promise<void> {
    const customer = await this.customersRepository.findOne({ where: { email } });
    if (!customer) return;

    const unlinkedOrders = await this.ordersRepository.find({
      where: {
        customerEmail: email,
        customerId: IsNull(),
      },
    });

    for (const order of unlinkedOrders) {
      order.customerId = customer.id;
      await this.ordersRepository.save(order);
    }

    if (unlinkedOrders.length > 0) {
      await this.updateCustomerStats(customer.id);
      console.log('✅ Linked', unlinkedOrders.length, 'existing orders to customer:', email);
    }
  }
}
