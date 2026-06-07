import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePagos1780863559085 implements MigrationInterface {
    name = 'CreatePagos1780863559085'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."pagos_medio_pago_enum" AS ENUM('mercado_pago', 'presencial')`);
        await queryRunner.query(`CREATE TYPE "public"."pagos_estado_enum" AS ENUM('pendiente', 'aprobado', 'rechazado', 'cancelado', 'presencial_pendiente', 'presencial_cobrado')`);
        await queryRunner.query(`CREATE TABLE "pagos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "pedido_id" uuid NOT NULL, "medio_pago" "public"."pagos_medio_pago_enum" NOT NULL, "estado" "public"."pagos_estado_enum" NOT NULL, "importe" numeric(10,2) NOT NULL, "referencia_externa" character varying(200), "fecha_generacion" TIMESTAMP WITH TIME ZONE NOT NULL, "fecha_aprobacion" TIMESTAMP WITH TIME ZONE, "fecha_registro_presencial" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_74ecd9c88460814c341649cdbbb" UNIQUE ("pedido_id"), CONSTRAINT "PK_37321ca70a2ed50885dc205beb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3308decad2845823a1bb4d4705" ON "pagos" ("tenant_id", "pedido_id") `);
        await queryRunner.query(`ALTER TABLE "pagos" ADD CONSTRAINT "FK_74ecd9c88460814c341649cdbbb" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagos" DROP CONSTRAINT "FK_74ecd9c88460814c341649cdbbb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3308decad2845823a1bb4d4705"`);
        await queryRunner.query(`DROP TABLE "pagos"`);
        await queryRunner.query(`DROP TYPE "public"."pagos_estado_enum"`);
        await queryRunner.query(`DROP TYPE "public"."pagos_medio_pago_enum"`);
    }

}
