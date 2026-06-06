import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCategoriasMenu1780785206736 implements MigrationInterface {
    name = 'CreateCategoriasMenu1780785206736'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "categorias_menu" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "nombre" character varying(100) NOT NULL, "descripcion" character varying(300), "activa" boolean NOT NULL DEFAULT true, "orden_visualizacion" integer, CONSTRAINT "PK_351452dfeef8266bc6944e75bab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_19ec6eaf06dd70cff0726751f7" ON "categorias_menu" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_categorias_menu_tenant_nombre" ON "categorias_menu" ("tenant_id", "nombre") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_categorias_menu_tenant_nombre"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_19ec6eaf06dd70cff0726751f7"`);
        await queryRunner.query(`DROP TABLE "categorias_menu"`);
    }

}
