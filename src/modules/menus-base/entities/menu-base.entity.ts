import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';
import { CategoriaMenu } from 'src/modules/categorias-menu/entities/categoria-menu.entity';
import { EtiquetaMenu } from 'src/modules/etiquetas-menu/entities/etiqueta-menu.entity';
import { Alergeno } from 'src/modules/alergenos/entities/alergeno.entity';

@Entity('menus_base')
@Index('UQ_menus_base_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })
export class MenuBase extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen_public_id!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imagen_url!: string | null;

  @Column({ type: 'text', nullable: true })
  ingredientes_principales!: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  calorias_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  proteinas_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  carbohidratos_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  grasas_aprox!: number | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @ManyToMany(() => CategoriaMenu)
  @JoinTable({
    name: 'menu_base_categorias',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'categoria_menu_id' },
  })
  categorias!: CategoriaMenu[];

  @ManyToMany(() => EtiquetaMenu)
  @JoinTable({
    name: 'menu_base_etiquetas',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'etiqueta_menu_id' },
  })
  etiquetas!: EtiquetaMenu[];

  @ManyToMany(() => Alergeno)
  @JoinTable({
    name: 'menu_base_alergenos',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'alergeno_id' },
  })
  alergenos!: Alergeno[];
}
