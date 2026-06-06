import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/database/base.entity';

@Entity('clientes')
@Index('UQ_clientes_tenant_dni', ['tenant_id', 'dni'], { unique: true })
export class Cliente extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  dni!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 100 })
  apellido!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  @Column({ type: 'date' })
  fecha_primera_operacion!: Date;

  @Column({ type: 'date' })
  fecha_ultima_operacion!: Date;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;
}
