import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCierresOperativos1780949788163 implements MigrationInterface {
    name = 'CreateCierresOperativos1780949788163'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ventas_sobrantes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "fecha" date NOT NULL, "sede_id" uuid NOT NULL, "punto_retiro_id" uuid NOT NULL, "menu_publicado_id" uuid NOT NULL, "cantidad" integer NOT NULL, "precio_unitario" numeric(10,2) NOT NULL, "importe_total" numeric(10,2) NOT NULL, "usuario_id" uuid NOT NULL, "observacion" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6c3670a9904ed01f21adef992ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b3d25fa929334bda258006ced4" ON "ventas_sobrantes" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_vs_tenant_fecha_sede" ON "ventas_sobrantes" ("tenant_id", "fecha", "sede_id") `);
        await queryRunner.query(`CREATE TABLE "cierres_operativos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "fecha_operativa" date NOT NULL, "sede_id" uuid NOT NULL, "punto_retiro_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "fecha_cierre" TIMESTAMP WITH TIME ZONE NOT NULL, "cantidad_pedidos_entregados" integer NOT NULL DEFAULT '0', "cantidad_pedidos_no_retirados" integer NOT NULL DEFAULT '0', "cantidad_ventas_sobrantes" integer NOT NULL DEFAULT '0', "recaudacion_presencial" numeric(10,2) NOT NULL DEFAULT '0', "observacion" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4449f8d961a881586118e3a255f" UNIQUE ("tenant_id", "fecha_operativa", "sede_id", "punto_retiro_id"), CONSTRAINT "PK_6883355dd22346575710409b687" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a436cfb1731062cb8c67677ba2" ON "cierres_operativos" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_cierre_tenant_fecha_sede" ON "cierres_operativos" ("tenant_id", "fecha_operativa", "sede_id") `);
        await queryRunner.query(`ALTER TABLE "ventas_sobrantes" ADD CONSTRAINT "FK_0fc646202c9b10547a2a6784fa0" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ventas_sobrantes" ADD CONSTRAINT "FK_a0821e68ae4eb3ab4e1e9681aa1" FOREIGN KEY ("punto_retiro_id") REFERENCES "puntos_retiro"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ventas_sobrantes" ADD CONSTRAINT "FK_e68e22af61e1d0fa68d500ee118" FOREIGN KEY ("menu_publicado_id") REFERENCES "menus_publicados"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ventas_sobrantes" DROP CONSTRAINT "FK_e68e22af61e1d0fa68d500ee118"`);
        await queryRunner.query(`ALTER TABLE "ventas_sobrantes" DROP CONSTRAINT "FK_a0821e68ae4eb3ab4e1e9681aa1"`);
        await queryRunner.query(`ALTER TABLE "ventas_sobrantes" DROP CONSTRAINT "FK_0fc646202c9b10547a2a6784fa0"`);
        await queryRunner.query(`DROP INDEX "public"."idx_cierre_tenant_fecha_sede"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a436cfb1731062cb8c67677ba2"`);
        await queryRunner.query(`DROP TABLE "cierres_operativos"`);
        await queryRunner.query(`DROP INDEX "public"."idx_vs_tenant_fecha_sede"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3d25fa929334bda258006ced4"`);
        await queryRunner.query(`DROP TABLE "ventas_sobrantes"`);
    }

}
