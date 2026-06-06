import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';
import { Sede } from 'src/modules/sedes/entities/sede.entity';

@Entity('puntos_retiro')
@Index('UQ_puntos_retiro_tenant_sede_nombre', ['tenant_id', 'sede_id', 'nombre'], { unique: true })
export class PuntoRetiro extends BaseEntity {
  @Column({ type: 'uuid' })
  sede_id!: string;

  @ManyToOne(() => Sede, { eager: false })
  @JoinColumn({ name: 'sede_id' })
  sede?: Sede;

  @Column({ type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ type: 'int', nullable: true })
  orden_visualizacion!: number | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;
}
