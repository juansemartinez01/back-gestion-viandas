import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateClientes1780788157789 implements MigrationInterface {
    name = 'CreateClientes1780788157789'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "clientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "dni" character varying(20) NOT NULL, "nombre" character varying(100) NOT NULL, "apellido" character varying(100) NOT NULL, "telefono" character varying(50), "email" character varying(200), "fecha_primera_operacion" date NOT NULL, "fecha_ultima_operacion" date NOT NULL, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf88bfa9c562e75257f06f08de" ON "clientes" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_clientes_tenant_dni" ON "clientes" ("tenant_id", "dni") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_clientes_tenant_dni"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf88bfa9c562e75257f06f08de"`);
        await queryRunner.query(`DROP TABLE "clientes"`);
    }

}
