import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Region } from '../shipping/region.entity';
import { Commune } from '../shipping/commune.entity';

@Entity('customer_profiles')
export class CustomerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.customerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @ManyToOne(() => Region, { nullable: true })
  @JoinColumn({ name: 'regionId' })
  region: Region;

  @Column({ nullable: true })
  regionId: number;

  @ManyToOne(() => Commune, { nullable: true })
  @JoinColumn({ name: 'communeId' })
  commune: Commune;

  @Column({ nullable: true })
  communeId: number;

  @Column({ nullable: true })
  zipCode: string;

  @Column({ default: false })
  defaultAddress: boolean;

  @Column({ nullable: true })
  billingAddress: string;

  @Column({ type: 'simple-json', nullable: true })
  preferences: {
    newsletter?: boolean;
    notifications?: boolean;
    smsNotifications?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
