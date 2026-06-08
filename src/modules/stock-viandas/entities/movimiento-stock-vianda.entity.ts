import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoMovimientoStockVianda } from '../stock-vianda.enums';
import { StockVianda } from './stock-vianda.entity';

@Entity('movimientos_stock_viandas')
export class MovimientoStockVianda {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  stock_vianda_id!: string;

  @Column({ type: 'enum', enum: TipoMovimientoStockVianda })
  tipo_movimiento!: TipoMovimientoStockVianda;

  @Column({ type: 'int' })
  cantidad!: number;

  @Column({ type: 'uuid', nullable: true })
  pedido_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  venta_sobrante_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  usuario_id!: string | null;

  @Column({ type: 'text', nullable: true })
  observacion!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => StockVianda, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stock_vianda_id' })
  stockVianda!: StockVianda;
}
