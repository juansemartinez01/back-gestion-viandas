import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('cierres_operativos')
@Unique(['tenant_id', 'fecha_operativa', 'sede_id', 'punto_retiro_id'])
@Index('idx_cierre_tenant_fecha_sede', ['tenant_id', 'fecha_operativa', 'sede_id'])
export class CierreOperativo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'date' })
  fecha_operativa!: string;

  @Column({ type: 'uuid' })
  sede_id!: string;

  @Column({ type: 'uuid' })
  punto_retiro_id!: string;

  @Column({ type: 'uuid' })
  usuario_id!: string;

  @Column({ type: 'timestamptz' })
  fecha_cierre!: Date;

  @Column({ type: 'int', default: 0 })
  cantidad_pedidos_entregados!: number;

  @Column({ type: 'int', default: 0 })
  cantidad_pedidos_no_retirados!: number;

  @Column({ type: 'int', default: 0 })
  cantidad_ventas_sobrantes!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  recaudacion_presencial!: number;

  @Column({ type: 'text', nullable: true })
  observacion!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
