import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('payku_liquidaciones')
export class Liquidacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Identificador/vaucher (único, clave de upsert)
  @Index({ unique: true })
  @Column({ length: 255 })
  identificador: string;

  // Fecha
  @Column({ type: 'datetime', nullable: true })
  fecha: Date | null;

  // Concepto
  @Column({ type: 'text', nullable: true })
  concepto: string | null;

  // Orden
  @Column({ type: 'varchar', length: 255, nullable: true })
  orden: string | null;

  // Monto
  @Column({ type: 'decimal', precision: 14, scale: 0, nullable: true, transformer: clpTransformer })
  monto: number | null;

  // Comisión
  @Column({ type: 'decimal', precision: 14, scale: 0, nullable: true, transformer: clpTransformer })
  comision: number | null;

  // Monto Final
  @Column({ type: 'decimal', precision: 14, scale: 0, nullable: true, transformer: clpTransformer })
  montoFinal: number | null;

  // Email
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  // Liquidación
  @Column({ type: 'varchar', length: 255, nullable: true })
  liquidacion: string | null;

  @Column({ name: 'fecha_deposito', type: 'datetime', nullable: true })
  fechaDeposito: Date | null;

  @Column({ name: 'estatus_liquidacion', type: 'varchar', length: 100, nullable: true })
  estatusLiquidacion: string | null;

  // 4 últimos dígitos de la tarjeta
  @Column({ type: 'varchar', length: 20, nullable: true })
  ultimosDigitos: string | null;

  // Medio de pago
  @Column({ type: 'varchar', length: 100, nullable: true })
  medioDePago: string | null;

  // Orden Externa
  @Column({ type: 'varchar', length: 255, nullable: true })
  ordenExterna: string | null;

  // Débito / Crédito
  @Column({ type: 'varchar', length: 50, nullable: true })
  debitoCredito: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
