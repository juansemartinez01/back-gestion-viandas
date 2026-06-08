import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ResultadoProcesamiento {
  PROCESADO_OK = 'procesado_ok',
  PROCESADO_ERROR = 'procesado_error',
  PENDIENTE_REVISION = 'pendiente_revision',
}

@Entity('mercado_pago_webhook_logs')
@Index(['tenant_id', 'pedido_id'])
@Index(['tenant_id', 'resultado_procesamiento'])
export class MercadoPagoWebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid', nullable: true })
  pedido_id!: string | null;

  @Column({ type: 'varchar', length: 100 })
  tipo_evento!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  referencia_externa!: string | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: ResultadoProcesamiento.PENDIENTE_REVISION })
  resultado_procesamiento!: ResultadoProcesamiento;

  @Column({ type: 'text', nullable: true })
  mensaje_error!: string | null;

  @Column({ type: 'timestamptz' })
  fecha_recepcion!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
