import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';

@Entity('media_folders')
export class MediaFolder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  parentId: string;

  @ManyToOne(() => MediaFolder, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: MediaFolder;

  @OneToMany(() => MediaFolder, (folder) => folder.parent)
  children: MediaFolder[];

  @Column({ type: 'varchar' })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @CreateDateColumn()
  createdAt: Date;
}
