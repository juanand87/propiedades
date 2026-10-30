import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { MediaFolder } from './media-folder.entity';

@Entity('media_files')
export class MediaFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @Column()
  url: string;

  @Column({ type: 'varchar', nullable: true })
  folderId: string;

  @ManyToOne(() => MediaFolder, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folderId' })
  folder: MediaFolder;

  @Column({ type: 'varchar' })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @CreateDateColumn()
  createdAt: Date;
}
