import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSedes1780760025864 implements MigrationInterface {
    name = 'CreateSedes1780760025864'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sedes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "nombre" character varying(150) NOT NULL, "direccion" character varying(300) NOT NULL, "telefono_contacto" character varying(50), "observaciones" text, "activa" boolean NOT NULL DEFAULT true, "orden_visualizacion" integer, CONSTRAINT "PK_842a6b0ebcf810b57487748b822" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8d5f75cca899262fe359237ab8" ON "sedes" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_sedes_tenant_nombre" ON "sedes" ("tenant_id", "nombre") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_sedes_tenant_nombre"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d5f75cca899262fe359237ab8"`);
        await queryRunner.query(`DROP TABLE "sedes"`);
    }

}
