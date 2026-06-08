import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrdenProduccionVianda1780925856343 implements MigrationInterface {
    name = 'CreateOrdenProduccionVianda1780925856343'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_74ecd9c88460814c341649cdbbb"`);
        await queryRunner.query(`CREATE TYPE "public"."orden_produccion_vianda_estado_enum" AS ENUM('pendiente', 'en_produccion', 'confirmada_completa', 'confirmada_con_diferencia', 'cancelada')`);
        await queryRunner.query(`CREATE TABLE "orden_produccion_vianda" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "fecha_produccion" date NOT NULL, "sede_id" uuid NOT NULL, "punto_retiro_id" uuid NOT NULL, "menu_publicado_id" uuid NOT NULL, "cantidad_pago_online" integer NOT NULL DEFAULT '0', "cantidad_pago_presencial" integer NOT NULL DEFAULT '0', "cantidad_cancelaciones_descontadas" integer NOT NULL DEFAULT '0', "sobreproduccion_configurada" integer NOT NULL DEFAULT '0', "total_sugerido" integer NOT NULL DEFAULT '0', "cantidad_real_producida" integer, "diferencia" integer, "estado" "public"."orden_produccion_vianda_estado_enum" NOT NULL DEFAULT 'pendiente', "usuario_confirmacion_id" uuid, "fecha_confirmacion" TIMESTAMP WITH TIME ZONE, "observacion" text, CONSTRAINT "uq_opv_combinacion" UNIQUE ("tenant_id", "fecha_produccion", "sede_id", "punto_retiro_id", "menu_publicado_id"), CONSTRAINT "PK_f9d62ac423e973fa5ac3bbb133a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_47fc97df9f9f9d61f621a70dc6" ON "orden_produccion_vianda" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_opv_tenant_fecha_sede" ON "orden_produccion_vianda" ("tenant_id", "fecha_produccion", "sede_id") `);
        await queryRunner.query(`CREATE TABLE "mercado_pago_webhook_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "pedido_id" uuid, "tipo_evento" character varying(100) NOT NULL, "referencia_externa" character varying(200), "payload" jsonb NOT NULL, "resultado_procesamiento" character varying(50) NOT NULL DEFAULT 'pendiente_revision', "mensaje_error" text, "fecha_recepcion" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_79f48a4725cfedf0b8a74683597" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_99ba439ac4ea5f1ddd0bcdeaec" ON "mercado_pago_webhook_logs" ("tenant_id", "resultado_procesamiento") `);
        await queryRunner.query(`CREATE INDEX "IDX_daa8ef60a1028989a22eb5d6e5" ON "mercado_pago_webhook_logs" ("tenant_id", "pedido_id") `);
        await queryRunner.query(`ALTER TABLE "pedidos" ADD "mp_preference_id" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "pedidos" ADD "mp_init_point" text`);
        await queryRunner.query(`ALTER TABLE "orden_produccion_vianda" ADD CONSTRAINT "FK_43ad6cf75c6eb27d13fbefec2b8" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_produccion_vianda" ADD CONSTRAINT "FK_f2673ced269dd3d0f16e61e5e50" FOREIGN KEY ("punto_retiro_id") REFERENCES "puntos_retiro"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_produccion_vianda" ADD CONSTRAINT "FK_2b3e37ba9997f86354c12a5da11" FOREIGN KEY ("menu_publicado_id") REFERENCES "menus_publicados"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_74ecd9c88460814c341649cdbbb" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_74ecd9c88460814c341649cdbbb"`);
        await queryRunner.query(`ALTER TABLE "orden_produccion_vianda" DROP CONSTRAINT "FK_2b3e37ba9997f86354c12a5da11"`);
        await queryRunner.query(`ALTER TABLE "orden_produccion_vianda" DROP CONSTRAINT "FK_f2673ced269dd3d0f16e61e5e50"`);
        await queryRunner.query(`ALTER TABLE "orden_produccion_vianda" DROP CONSTRAINT "FK_43ad6cf75c6eb27d13fbefec2b8"`);
        await queryRunner.query(`ALTER TABLE "pedidos" DROP COLUMN "mp_init_point"`);
        await queryRunner.query(`ALTER TABLE "pedidos" DROP COLUMN "mp_preference_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_daa8ef60a1028989a22eb5d6e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_99ba439ac4ea5f1ddd0bcdeaec"`);
        await queryRunner.query(`DROP TABLE "mercado_pago_webhook_logs"`);
        await queryRunner.query(`DROP INDEX "public"."idx_opv_tenant_fecha_sede"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47fc97df9f9f9d61f621a70dc6"`);
        await queryRunner.query(`DROP TABLE "orden_produccion_vianda"`);
        await queryRunner.query(`DROP TYPE "public"."orden_produccion_vianda_estado_enum"`);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_74ecd9c88460814c341649cdbbb" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
