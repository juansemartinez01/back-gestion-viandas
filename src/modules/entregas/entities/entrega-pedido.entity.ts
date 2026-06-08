import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';

@Entity('entrega_pedidos')
@Unique(['pedido_id'])
@Index('idx_entrega_tenant_fecha_sede', ['tenant_id', 'fecha_entrega', 'sede_id'])
export class EntregaPedido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid' })
  pedido_id!: string;

  @Column({ type: 'uuid' })
  sede_id!: string;

  @Column({ type: 'uuid' })
  punto_retiro_id!: string;

  @Column({ type: 'uuid' })
  usuario_id!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  importe_cobrado_caja!: number;

  @Column({ type: 'timestamptz' })
  fecha_entrega!: Date;

  @Column({ type: 'text', nullable: true })
  observacion!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Pedido, { eager: false })
  @JoinColumn({ name: 'pedido_id' })
  pedido!: Pedido;
}
