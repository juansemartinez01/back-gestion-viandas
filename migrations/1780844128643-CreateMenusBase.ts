import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMenusBase1780844128643 implements MigrationInterface {
    name = 'CreateMenusBase1780844128643'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "menus_base" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "nombre" character varying(200) NOT NULL, "descripcion" text, "imagen_public_id" character varying(500), "imagen_url" character varying(1000), "ingredientes_principales" text, "calorias_aprox" numeric(6,2), "proteinas_aprox" numeric(6,2), "carbohidratos_aprox" numeric(6,2), "grasas_aprox" numeric(6,2), "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_7b92cc2f74d5d705851cff29ff1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_03f506d7bfe5741cd46054b7c4" ON "menus_base" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_menus_base_tenant_nombre" ON "menus_base" ("tenant_id", "nombre") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE TABLE "menu_base_categorias" ("menu_base_id" uuid NOT NULL, "categoria_menu_id" uuid NOT NULL, CONSTRAINT "PK_26e7c07b38962f70598bb18309b" PRIMARY KEY ("menu_base_id", "categoria_menu_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8a11b3af28a65949ce19d520c8" ON "menu_base_categorias" ("menu_base_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6958c3d0c9ea7cf22ac4c234d" ON "menu_base_categorias" ("categoria_menu_id") `);
        await queryRunner.query(`CREATE TABLE "menu_base_etiquetas" ("menu_base_id" uuid NOT NULL, "etiqueta_menu_id" uuid NOT NULL, CONSTRAINT "PK_9ad0622e7c5ef457ab19ced346c" PRIMARY KEY ("menu_base_id", "etiqueta_menu_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_16c1bd97bec5b7c79882277bc4" ON "menu_base_etiquetas" ("menu_base_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_754cb5d263db7b5d434eb37756" ON "menu_base_etiquetas" ("etiqueta_menu_id") `);
        await queryRunner.query(`CREATE TABLE "menu_base_alergenos" ("menu_base_id" uuid NOT NULL, "alergeno_id" uuid NOT NULL, CONSTRAINT "PK_29067091af728b9f1aecf94b50c" PRIMARY KEY ("menu_base_id", "alergeno_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ec27d90e7eb1543e55017cfed" ON "menu_base_alergenos" ("menu_base_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_75db30d5cbde5bf0c0294d13c1" ON "menu_base_alergenos" ("alergeno_id") `);
        await queryRunner.query(`ALTER TABLE "menu_base_categorias" ADD CONSTRAINT "FK_8a11b3af28a65949ce19d520c80" FOREIGN KEY ("menu_base_id") REFERENCES "menus_base"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "menu_base_categorias" ADD CONSTRAINT "FK_e6958c3d0c9ea7cf22ac4c234df" FOREIGN KEY ("categoria_menu_id") REFERENCES "categorias_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "menu_base_etiquetas" ADD CONSTRAINT "FK_16c1bd97bec5b7c79882277bc4e" FOREIGN KEY ("menu_base_id") REFERENCES "menus_base"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "menu_base_etiquetas" ADD CONSTRAINT "FK_754cb5d263db7b5d434eb377565" FOREIGN KEY ("etiqueta_menu_id") REFERENCES "etiquetas_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "menu_base_alergenos" ADD CONSTRAINT "FK_0ec27d90e7eb1543e55017cfed4" FOREIGN KEY ("menu_base_id") REFERENCES "menus_base"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "menu_base_alergenos" ADD CONSTRAINT "FK_75db30d5cbde5bf0c0294d13c1b" FOREIGN KEY ("alergeno_id") REFERENCES "alergenos"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menu_base_alergenos" DROP CONSTRAINT "FK_75db30d5cbde5bf0c0294d13c1b"`);
        await queryRunner.query(`ALTER TABLE "menu_base_alergenos" DROP CONSTRAINT "FK_0ec27d90e7eb1543e55017cfed4"`);
        await queryRunner.query(`ALTER TABLE "menu_base_etiquetas" DROP CONSTRAINT "FK_754cb5d263db7b5d434eb377565"`);
        await queryRunner.query(`ALTER TABLE "menu_base_etiquetas" DROP CONSTRAINT "FK_16c1bd97bec5b7c79882277bc4e"`);
        await queryRunner.query(`ALTER TABLE "menu_base_categorias" DROP CONSTRAINT "FK_e6958c3d0c9ea7cf22ac4c234df"`);
        await queryRunner.query(`ALTER TABLE "menu_base_categorias" DROP CONSTRAINT "FK_8a11b3af28a65949ce19d520c80"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_75db30d5cbde5bf0c0294d13c1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ec27d90e7eb1543e55017cfed"`);
        await queryRunner.query(`DROP TABLE "menu_base_alergenos"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_754cb5d263db7b5d434eb37756"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16c1bd97bec5b7c79882277bc4"`);
        await queryRunner.query(`DROP TABLE "menu_base_etiquetas"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6958c3d0c9ea7cf22ac4c234d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a11b3af28a65949ce19d520c8"`);
        await queryRunner.query(`DROP TABLE "menu_base_categorias"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_menus_base_tenant_nombre"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_03f506d7bfe5741cd46054b7c4"`);
        await queryRunner.query(`DROP TABLE "menus_base"`);
    }

}
