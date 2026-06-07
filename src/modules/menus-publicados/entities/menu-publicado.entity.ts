import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';
import { MenuBase } from 'src/modules/menus-base/entities/menu-base.entity';
import { Sede } from 'src/modules/sedes/entities/sede.entity';
import { PuntoRetiro } from 'src/modules/puntos-retiro/entities/punto-retiro.entity';

export enum EstadoMenuPublicado {
  ACTIVO = 'activo',
  PAUSADO = 'pausado',
  CERRADO = 'cerrado',
  AGOTADO = 'agotado',
  CANCELADO = 'cancelado',
}

export enum TipoSobreproduccion {
  CANTIDAD_FIJA = 'cantidad_fija',
  PORCENTAJE = 'porcentaje',
}

@Entity('menus_publicados')
@Index('idx_mp_tenant_fecha', ['tenant_id', 'fecha_venta'])
@Index('idx_mp_tenant_sede_estado', ['tenant_id', 'sede_id', 'estado'])
export class MenuPublicado extends BaseEntity {
  @Column({ type: 'uuid' })
  menu_base_id!: string;

  @Column({ type: 'uuid' })
  sede_id!: string;

  @Column({ type: 'date' })
  fecha_venta!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio_encargo!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  precio_sobrante!: number | null;

  @Column({ type: 'timestamptz' })
  fecha_hora_limite_encargo!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_hora_limite_cancelacion!: Date | null;

  @Column({ type: 'int', nullable: true })
  limite_maximo_viandas!: number | null;

  @Column({
    type: 'enum',
    enum: TipoSobreproduccion,
    nullable: true,
  })
  tipo_sobreproduccion!: TipoSobreproduccion | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  valor_sobreproduccion!: number | null;

  @Column({
    type: 'enum',
    enum: EstadoMenuPublicado,
    default: EstadoMenuPublicado.ACTIVO,
  })
  estado!: EstadoMenuPublicado;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen_public_id!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imagen_url!: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @ManyToOne(() => MenuBase, { eager: false })
  @JoinColumn({ name: 'menu_base_id' })
  menuBase!: MenuBase;

  @ManyToOne(() => Sede, { eager: false })
  @JoinColumn({ name: 'sede_id' })
  sede!: Sede;

  @ManyToMany(() => PuntoRetiro)
  @JoinTable({
    name: 'menu_publicado_puntos_retiro',
    joinColumn: { name: 'menu_publicado_id' },
    inverseJoinColumn: { name: 'punto_retiro_id' },
  })
  puntosRetiro!: PuntoRetiro[];
}
