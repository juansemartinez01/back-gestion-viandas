import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStockViandas1780927690720 implements MigrationInterface {
    name = 'CreateStockViandas1780927690720'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "stock_viandas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "fecha" date NOT NULL, "sede_id" uuid NOT NULL, "punto_retiro_id" uuid NOT NULL, "menu_publicado_id" uuid NOT NULL, "orden_produccion_id" uuid NOT NULL, "stock_reservado_encargues" integer NOT NULL DEFAULT '0', "stock_disponible_sobrantes" integer NOT NULL DEFAULT '0', "stock_entregado" integer NOT NULL DEFAULT '0', "stock_vendido_sobrante" integer NOT NULL DEFAULT '0', "stock_ajustado" integer NOT NULL DEFAULT '0', "stock_restante" integer NOT NULL DEFAULT '0', CONSTRAINT "uq_sv_combinacion" UNIQUE ("tenant_id", "fecha", "sede_id", "punto_retiro_id", "menu_publicado_id"), CONSTRAINT "PK_ffebc2922824512f52ae1d1d06e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0e3ee0c9fe803107a00147bf60" ON "stock_viandas" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sv_tenant_fecha_sede" ON "stock_viandas" ("tenant_id", "fecha", "sede_id") `);
        await queryRunner.query(`CREATE TYPE "public"."movimientos_stock_viandas_tipo_movimiento_enum" AS ENUM('alta_produccion', 'consumo_entrega', 'consumo_sobrante', 'ajuste_positivo', 'ajuste_negativo', 'reasignacion_cancelacion')`);
        await queryRunner.query(`CREATE TABLE "movimientos_stock_viandas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "stock_vianda_id" uuid NOT NULL, "tipo_movimiento" "public"."movimientos_stock_viandas_tipo_movimiento_enum" NOT NULL, "cantidad" integer NOT NULL, "pedido_id" uuid, "venta_sobrante_id" uuid, "usuario_id" uuid, "observacion" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_391d741a1762ef429d624e17ef0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2ea56ba9befa7318a2a840d987" ON "movimientos_stock_viandas" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_026f0ce6f84a5b1441ebd1ca03" ON "movimientos_stock_viandas" ("stock_vianda_id") `);
        await queryRunner.query(`ALTER TABLE "stock_viandas" ADD CONSTRAINT "FK_fa78fee610889b19816562a040b" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_viandas" ADD CONSTRAINT "FK_3dceb1958693e693a1edf809501" FOREIGN KEY ("punto_retiro_id") REFERENCES "puntos_retiro"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_viandas" ADD CONSTRAINT "FK_8d20df5c6f7a33eec0e306205e5" FOREIGN KEY ("menu_publicado_id") REFERENCES "menus_publicados"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_viandas" ADD CONSTRAINT "FK_18f42a8c71f25529d537185f8e3" FOREIGN KEY ("orden_produccion_id") REFERENCES "orden_produccion_vianda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimientos_stock_viandas" ADD CONSTRAINT "FK_026f0ce6f84a5b1441ebd1ca036" FOREIGN KEY ("stock_vianda_id") REFERENCES "stock_viandas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos_stock_viandas" DROP CONSTRAINT "FK_026f0ce6f84a5b1441ebd1ca036"`);
        await queryRunner.query(`ALTER TABLE "stock_viandas" DROP CONSTRAINT "FK_18f42a8c71f25529d537185f8e3"`);
        await queryRunner.query(`ALTER TABLE "stock_viandas" DROP CONSTRAINT "FK_8d20df5c6f7a33eec0e306205e5"`);
        await queryRunner.query(`ALTER TABLE "stock_viandas" DROP CONSTRAINT "FK_3dceb1958693e693a1edf809501"`);
        await queryRunner.query(`ALTER TABLE "stock_viandas" DROP CONSTRAINT "FK_fa78fee610889b19816562a040b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_026f0ce6f84a5b1441ebd1ca03"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ea56ba9befa7318a2a840d987"`);
        await queryRunner.query(`DROP TABLE "movimientos_stock_viandas"`);
        await queryRunner.query(`DROP TYPE "public"."movimientos_stock_viandas_tipo_movimiento_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sv_tenant_fecha_sede"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e3ee0c9fe803107a00147bf60"`);
        await queryRunner.query(`DROP TABLE "stock_viandas"`);
    }

}
