import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBanners1780849628694 implements MigrationInterface {
    name = 'CreateBanners1780849628694'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "banners_promociones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "titulo" character varying(200) NOT NULL, "descripcion" text, "imagen_public_id" character varying(500), "imagen_url" character varying(1000), "url_destino" character varying(500), "activo" boolean NOT NULL DEFAULT true, "orden_visualizacion" integer, "fecha_inicio" date, "fecha_fin" date, CONSTRAINT "PK_5b53f9e453213f3be5bfcbf9b9b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_18936ddd6eeabf4ce03c82f70a" ON "banners_promociones" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_banners_tenant_activo" ON "banners_promociones" ("tenant_id", "activo") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_banners_tenant_activo"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18936ddd6eeabf4ce03c82f70a"`);
        await queryRunner.query(`DROP TABLE "banners_promociones"`);
    }

}
