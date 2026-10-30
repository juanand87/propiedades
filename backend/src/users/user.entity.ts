import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Vendor } from '../vendors/vendor.entity';
import { Order } from '../orders/order.entity';
import { CustomerProfile } from '../customers/customer-profile.entity';

export enum UserRole {
  ADMIN = 'admin',
  VENDOR = 'vendor',
  CUSTOMER = 'customer',
}

export enum UserCreatedBy {
  SELF_REGISTRATION = 'self-registration',
  CHECKOUT_ORDER = 'checkout-order',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({ default: false })
  requirePasswordChange: boolean;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  @Exclude()
  tempPassword: string;

  @Column({
    type: 'enum',
    enum: UserCreatedBy,
    default: UserCreatedBy.SELF_REGISTRATION,
  })
  createdBy: UserCreatedBy;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relaciones
  @OneToOne(() => Vendor, (vendor) => vendor.user)
  vendor: Vendor;

  @OneToOne(() => CustomerProfile, (profile) => profile.user)
  customerProfile: CustomerProfile;

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];
}
