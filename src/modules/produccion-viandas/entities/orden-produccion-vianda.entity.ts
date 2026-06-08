import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';
import { Sede } from 'src/modules/sedes/entities/sede.entity';
import { PuntoRetiro } from 'src/modules/puntos-retiro/entities/punto-retiro.entity';
import { MenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';

export enum EstadoOrdenProduccion {
  PENDIENTE = 'pendiente',
  EN_PRODUCCION = 'en_produccion',
  CONFIRMADA_COMPLETA = 'confirmada_completa',
  CONFIRMADA_CON_DIFERENCIA = 'confirmada_con_diferencia',
  CANCELADA = 'cancelada',
}

@Entity('orden_produccion_vianda')
@Index('idx_opv_tenant_fecha_sede', ['tenant_id', 'fecha_produccion', 'sede_id'])
@Unique('uq_opv_combinacion', ['tenant_id', 'fecha_produccion', 'sede_id', 'punto_retiro_id', 'menu_publicado_id'])
export class OrdenProduccionVianda extends BaseEntity {
  @Column({ type: 'date' })
  fecha_produccion!: string;

  @Column({ type: 'uuid' })
  sede_id!: string;

  @Column({ type: 'uuid' })
  punto_retiro_id!: string;

  @Column({ type: 'uuid' })
  menu_publicado_id!: string;

  @Column({ type: 'int', default: 0 })
  cantidad_pago_online!: number;

  @Column({ type: 'int', default: 0 })
  cantidad_pago_presencial!: number;

  @Column({ type: 'int', default: 0 })
  cantidad_cancelaciones_descontadas!: number;

  @Column({ type: 'int', default: 0 })
  sobreproduccion_configurada!: number;

  @Column({ type: 'int', default: 0 })
  total_sugerido!: number;

  @Column({ type: 'int', nullable: true })
  cantidad_real_producida!: number | null;

  @Column({ type: 'int', nullable: true })
  diferencia!: number | null;

  @Column({
    type: 'enum',
    enum: EstadoOrdenProduccion,
    default: EstadoOrdenProduccion.PENDIENTE,
  })
  estado!: EstadoOrdenProduccion;

  @Column({ type: 'uuid', nullable: true })
  usuario_confirmacion_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_confirmacion!: Date | null;

  @Column({ type: 'text', nullable: true })
  observacion!: string | null;

  @ManyToOne(() => Sede, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sede_id' })
  sede!: Sede;

  @ManyToOne(() => PuntoRetiro, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'punto_retiro_id' })
  puntoRetiro!: PuntoRetiro;

  @ManyToOne(() => MenuPublicado, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'menu_publicado_id' })
  menuPublicado!: MenuPublicado;
}
