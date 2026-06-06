import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAlergenos1780787056282 implements MigrationInterface {
    name = 'CreateAlergenos1780787056282'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "alergenos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "nombre" character varying(100) NOT NULL, "descripcion" character varying(300), "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d568b2d3851d4356642396a3c8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d76d6083048c45096bd7b4cb1e" ON "alergenos" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_alergenos_tenant_nombre" ON "alergenos" ("tenant_id", "nombre") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_alergenos_tenant_nombre"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d76d6083048c45096bd7b4cb1e"`);
        await queryRunner.query(`DROP TABLE "alergenos"`);
    }

}
