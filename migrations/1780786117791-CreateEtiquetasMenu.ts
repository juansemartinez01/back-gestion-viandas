import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEtiquetasMenu1780786117791 implements MigrationInterface {
    name = 'CreateEtiquetasMenu1780786117791'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "etiquetas_menu" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "nombre" character varying(100) NOT NULL, "descripcion" character varying(300), "activa" boolean NOT NULL DEFAULT true, "orden_visualizacion" integer, CONSTRAINT "PK_440e60f93b5bd5fcc5599b5b50d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cc6e16a72c70363f77e7c97b33" ON "etiquetas_menu" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_etiquetas_menu_tenant_nombre" ON "etiquetas_menu" ("tenant_id", "nombre") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_etiquetas_menu_tenant_nombre"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc6e16a72c70363f77e7c97b33"`);
        await queryRunner.query(`DROP TABLE "etiquetas_menu"`);
    }

}
