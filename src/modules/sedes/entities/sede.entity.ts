import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';

@Entity('sedes')
@Index('UQ_sedes_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })
export class Sede extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ type: 'varchar', length: 300 })
  direccion!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono_contacto!: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;

  @Column({ type: 'boolean', default: true })
  activa!: boolean;

  @Column({ type: 'int', nullable: true })
  orden_visualizacion!: number | null;
}
