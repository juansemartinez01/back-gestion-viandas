import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';
import { Sede } from 'src/modules/sedes/entities/sede.entity';
import { PuntoRetiro } from 'src/modules/puntos-retiro/entities/punto-retiro.entity';
import { MenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';
import { OrdenProduccionVianda } from 'src/modules/produccion-viandas/entities/orden-produccion-vianda.entity';

@Entity('stock_viandas')
@Index('idx_sv_tenant_fecha_sede', ['tenant_id', 'fecha', 'sede_id'])
@Unique('uq_sv_combinacion', [
  'tenant_id',
  'fecha',
  'sede_id',
  'punto_retiro_id',
  'menu_publicado_id',
])
export class StockVianda extends BaseEntity {
  @Column({ type: 'date' })
  fecha!: string;

  @Column({ type: 'uuid' })
  sede_id!: string;

  @Column({ type: 'uuid' })
  punto_retiro_id!: string;

  @Column({ type: 'uuid' })
  menu_publicado_id!: string;

  @Column({ type: 'uuid' })
  orden_produccion_id!: string;

  @Column({ type: 'int', default: 0 })
  stock_reservado_encargues!: number;

  @Column({ type: 'int', default: 0 })
  stock_disponible_sobrantes!: number;

  @Column({ type: 'int', default: 0 })
  stock_entregado!: number;

  @Column({ type: 'int', default: 0 })
  stock_vendido_sobrante!: number;

  @Column({ type: 'int', default: 0 })
  stock_ajustado!: number;

  @Column({ type: 'int', default: 0 })
  stock_restante!: number;

  @ManyToOne(() => Sede, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sede_id' })
  sede!: Sede;

  @ManyToOne(() => PuntoRetiro, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'punto_retiro_id' })
  puntoRetiro!: PuntoRetiro;

  @ManyToOne(() => MenuPublicado, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'menu_publicado_id' })
  menuPublicado!: MenuPublicado;

  @ManyToOne(() => OrdenProduccionVianda, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orden_produccion_id' })
  ordenProduccion!: OrdenProduccionVianda;
}
