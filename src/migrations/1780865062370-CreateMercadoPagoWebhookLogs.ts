import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMercadoPagoWebhookLogs1780865062370 implements MigrationInterface {
    name = 'CreateMercadoPagoWebhookLogs1780865062370'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_74ecd9c88460814c341649cdbbb"`);
        await queryRunner.query(`CREATE TABLE "mercado_pago_webhook_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "pedido_id" uuid, "tipo_evento" character varying(100) NOT NULL, "referencia_externa" character varying(200), "payload" jsonb NOT NULL, "resultado_procesamiento" character varying(50) NOT NULL DEFAULT 'pendiente_revision', "mensaje_error" text, "fecha_recepcion" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_79f48a4725cfedf0b8a74683597" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_99ba439ac4ea5f1ddd0bcdeaec" ON "mercado_pago_webhook_logs" ("tenant_id", "resultado_procesamiento") `);
        await queryRunner.query(`CREATE INDEX "IDX_daa8ef60a1028989a22eb5d6e5" ON "mercado_pago_webhook_logs" ("tenant_id", "pedido_id") `);
        await queryRunner.query(`ALTER TABLE "pedidos" ADD "mp_preference_id" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "pedidos" ADD "mp_init_point" text`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_74ecd9c88460814c341649cdbbb" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_74ecd9c88460814c341649cdbbb"`);
        await queryRunner.query(`ALTER TABLE "pedidos" DROP COLUMN "mp_init_point"`);
        await queryRunner.query(`ALTER TABLE "pedidos" DROP COLUMN "mp_preference_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_daa8ef60a1028989a22eb5d6e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_99ba439ac4ea5f1ddd0bcdeaec"`);
        await queryRunner.query(`DROP TABLE "mercado_pago_webhook_logs"`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_74ecd9c88460814c341649cdbbb" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
