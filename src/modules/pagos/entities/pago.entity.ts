import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoPago, MedioPago } from '../pago.enums';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';

@Entity('pagos')
@Index(['tenant_id', 'pedido_id'])
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid', unique: true })
  pedido_id: string;

  @ManyToOne(() => Pedido, { nullable: false })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @Column({ type: 'enum', enum: MedioPago })
  medio_pago: MedioPago;

  @Column({ type: 'enum', enum: EstadoPago })
  estado: EstadoPago;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  importe: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  referencia_externa: string | null;

  @Column({ type: 'timestamptz' })
  fecha_generacion: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_aprobacion: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_registro_presencial: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
