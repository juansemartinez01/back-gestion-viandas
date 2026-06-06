import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';

@Entity('etiquetas_menu')
@Index('UQ_etiquetas_menu_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })
export class EtiquetaMenu extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion!: string | null;

  @Column({ type: 'boolean', default: true })
  activa!: boolean;

  @Column({ type: 'int', nullable: true })
  orden_visualizacion!: number | null;
}
