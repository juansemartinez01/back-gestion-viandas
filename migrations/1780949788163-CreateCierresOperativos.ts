import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCierresOperativos1780949788163 implements MigrationInterface {
    name = 'CreateCierresOperativos1780949788163'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cierres_operativos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "fecha_operativa" date NOT NULL, "sede_id" uuid NOT NULL, "punto_retiro_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "fecha_cierre" TIMESTAMP WITH TIME ZONE NOT NULL, "cantidad_pedidos_entregados" integer NOT NULL DEFAULT '0', "cantidad_pedidos_no_retirados" integer NOT NULL DEFAULT '0', "cantidad_ventas_sobrantes" integer NOT NULL DEFAULT '0', "recaudacion_presencial" numeric(10,2) NOT NULL DEFAULT '0', "observacion" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4449f8d961a881586118e3a255f" UNIQUE ("tenant_id", "fecha_operativa", "sede_id", "punto_retiro_id"), CONSTRAINT "PK_6883355dd22346575710409b687" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a436cfb1731062cb8c67677ba2" ON "cierres_operativos" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_cierre_tenant_fecha_sede" ON "cierres_operativos" ("tenant_id", "fecha_operativa", "sede_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_cierre_tenant_fecha_sede"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a436cfb1731062cb8c67677ba2"`);
        await queryRunner.query(`DROP TABLE "cierres_operativos"`);
    }

}
