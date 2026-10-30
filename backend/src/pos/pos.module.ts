import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { PosCashMovement } from './pos-cash-movement.entity';
import { PosController } from './pos.controller';
import { PosRegister } from './pos-register.entity';
import { PosService } from './pos.service';
import { PosShift } from './pos-shift.entity';
import { PosStaff } from './pos-staff.entity';
import { Vendor } from '../vendors/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PosRegister, PosStaff, PosShift, PosCashMovement, Order, Vendor]),
    JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }) }),
  ],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
