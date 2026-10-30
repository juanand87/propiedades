import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { ProductQuestion } from './product-question.entity';

@Entity('product_question_messages')
export class ProductQuestionMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  questionId: string;

  @ManyToOne(() => ProductQuestion, (question) => question.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: ProductQuestion;

  @Column({ type: 'varchar', length: 36, nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'authorId' })
  author: User | null;

  @Column({ type: 'enum', enum: ['customer', 'vendor'], default: 'customer' })
  authorType: 'customer' | 'vendor';

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  isHidden: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true })
  hiddenById: string | null;

  @Column({ type: 'text', nullable: true })
  moderationReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  hiddenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
