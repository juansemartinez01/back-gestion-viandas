import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';
import { Cliente } from 'src/modules/clientes/entities/cliente.entity';
import { MenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';
import { Sede } from 'src/modules/sedes/entities/sede.entity';
import { PuntoRetiro } from 'src/modules/puntos-retiro/entities/punto-retiro.entity';
import {
  EstadoPagoPedido,
  EstadoPedido,
  MedioPagoPedido,
  OrigenCancelacion,
} from '../pedido.enums';

@Entity('pedidos')
@Unique(['codigo_publico'])
@Index('idx_pedidos_tenant_dni', ['tenant_id', 'dni_informado'])
@Index('idx_pedidos_tenant_mp_estado', ['tenant_id', 'menu_publicado_id', 'estado_pedido'])
@Index('idx_pedidos_tenant_expires', ['tenant_id', 'expires_at'])
export class Pedido extends BaseEntity {
  @Column({ type: 'varchar', length: 30 })
  codigo_publico!: string;

  @Column({ type: 'uuid' })
  cliente_id!: string;

  @Column({ type: 'uuid' })
  menu_publicado_id!: string;

  @Column({ type: 'uuid' })
  sede_id!: string;

  @Column({ type: 'uuid' })
  punto_retiro_id!: string;

  @Column({ type: 'varchar', length: 20 })
  dni_informado!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre_informado!: string;

  @Column({ type: 'varchar', length: 100 })
  apellido_informado!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono_informado!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email_informado!: string | null;

  @Column({ type: 'date' })
  fecha_pedido!: string;

  @Column({ type: 'date' })
  fecha_retiro!: string;

  @Column({ type: 'int' })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio_unitario!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  importe_total!: number;

  @Column({ type: 'enum', enum: MedioPagoPedido })
  medio_pago!: MedioPagoPedido;

  @Column({
    type: 'enum',
    enum: EstadoPedido,
    default: EstadoPedido.PENDIENTE_PAGO_ONLINE,
  })
  estado_pedido!: EstadoPedido;

  @Column({ type: 'enum', enum: EstadoPagoPedido })
  estado_pago!: EstadoPagoPedido;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_confirmacion!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_cancelacion!: Date | null;

  @Column({ type: 'enum', enum: OrigenCancelacion, nullable: true })
  cancelado_por!: OrigenCancelacion | null;

  @Column({ type: 'uuid', nullable: true })
  usuario_cancelacion_id!: string | null;

  @Column({ type: 'text', nullable: true })
  motivo_cancelacion!: string | null;

  @Column({ type: 'boolean', default: false })
  devolucion_pendiente!: boolean;

  @ManyToOne(() => Cliente, { eager: false })
  @JoinColumn({ name: 'cliente_id' })
  cliente!: Cliente;

  @ManyToOne(() => MenuPublicado, { eager: false })
  @JoinColumn({ name: 'menu_publicado_id' })
  menuPublicado!: MenuPublicado;

  @ManyToOne(() => Sede, { eager: false })
  @JoinColumn({ name: 'sede_id' })
  sede!: Sede;

  @ManyToOne(() => PuntoRetiro, { eager: false })
  @JoinColumn({ name: 'punto_retiro_id' })
  puntoRetiro!: PuntoRetiro;
}
