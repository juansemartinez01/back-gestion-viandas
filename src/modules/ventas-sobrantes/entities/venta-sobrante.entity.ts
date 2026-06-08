import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sede } from 'src/modules/sedes/entities/sede.entity';
import { PuntoRetiro } from 'src/modules/puntos-retiro/entities/punto-retiro.entity';
import { MenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';

@Entity('ventas_sobrantes')
@Index('idx_vs_tenant_fecha_sede', ['tenant_id', 'fecha', 'sede_id'])
export class VentaSobrante {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ type: 'uuid' })
  sede_id!: string;

  @Column({ type: 'uuid' })
  punto_retiro_id!: string;

  @Column({ type: 'uuid' })
  menu_publicado_id!: string;

  @Column({ type: 'int' })
  cantidad!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio_unitario!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  importe_total!: number;

  @Column({ type: 'uuid' })
  usuario_id!: string;

  @Column({ type: 'text', nullable: true })
  observacion!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

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
