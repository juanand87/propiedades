import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { ProductQuestionMessage } from './product-question-message.entity';

@Entity('vendor_question_penalties')
@Index('uq_vendor_question_penalty_message', ['messageId'], { unique: true })
export class VendorQuestionPenalty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  messageId: string;

  @ManyToOne(() => ProductQuestionMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: ProductQuestionMessage;

  @Column()
  administratorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'administratorId' })
  administrator: User;

  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
