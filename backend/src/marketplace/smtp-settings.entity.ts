import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('smtp_settings')
export class SmtpSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, length: 255 })
  smtpHost: string;

  @Column({ nullable: true })
  smtpPort: number;

  @Column({ nullable: true, default: false })
  smtpSecure: boolean;

  @Column({ nullable: true, length: 255 })
  smtpUser: string;

  @Column({ nullable: true, length: 255 })
  smtpPassword: string;

  @Column({ nullable: true, length: 255 })
  smtpFromEmail: string;

  @Column({ nullable: true, length: 255 })
  smtpFromName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
