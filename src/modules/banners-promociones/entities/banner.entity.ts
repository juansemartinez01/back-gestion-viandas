import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';

@Entity('banners_promociones')
@Index('idx_banners_tenant_activo', ['tenant_id', 'activo'])
export class Banner extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  titulo!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen_public_id!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imagen_url!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url_destino!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ type: 'int', nullable: true })
  orden_visualizacion!: number | null;

  @Column({ type: 'date', nullable: true })
  fecha_inicio!: string | null;

  @Column({ type: 'date', nullable: true })
  fecha_fin!: string | null;
}
