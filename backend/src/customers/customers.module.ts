import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomerAccessService } from './customer-access.service';
import { CustomerAccessController } from './customer-access.controller';
import { CustomerProfile } from './customer-profile.entity';
import { Customer } from './customer.entity';
import { CustomerAccessToken } from './customer-access-token.entity';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerProfile, 
      Customer, 
      CustomerAccessToken, 
      User, 
      Order
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    EmailTemplatesModule,
  ],
  providers: [CustomersService, CustomerAccessService],
  controllers: [CustomersController, CustomerAccessController],
  exports: [CustomersService, CustomerAccessService],
})
export class CustomersModule {}
