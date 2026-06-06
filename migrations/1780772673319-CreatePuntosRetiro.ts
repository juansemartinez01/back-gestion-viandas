import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePuntosRetiro1780772673319 implements MigrationInterface {
    name = 'CreatePuntosRetiro1780772673319'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "puntos_retiro" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "sede_id" uuid NOT NULL, "nombre" character varying(150) NOT NULL, "descripcion" character varying(300), "activo" boolean NOT NULL DEFAULT true, "orden_visualizacion" integer, "observaciones" text, CONSTRAINT "PK_91d0513e83b2b7afc33ad00bfe2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_26287876423d21e110bab7009f" ON "puntos_retiro" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_puntos_retiro_tenant_sede_nombre" ON "puntos_retiro" ("tenant_id", "sede_id", "nombre") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_tenant_user_revoked" ON "refresh_tokens" ("tenant_id", "user_id", "revoked_at") `);
        await queryRunner.query(`ALTER TABLE "puntos_retiro" ADD CONSTRAINT "FK_10390fadf9d1b9350982ad9d0d1" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "puntos_retiro" DROP CONSTRAINT "FK_10390fadf9d1b9350982ad9d0d1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_tenant_user_revoked"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_puntos_retiro_tenant_sede_nombre"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26287876423d21e110bab7009f"`);
        await queryRunner.query(`DROP TABLE "puntos_retiro"`);
    }

}
