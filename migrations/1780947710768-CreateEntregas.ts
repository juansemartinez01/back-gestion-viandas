import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEntregas1780947710768 implements MigrationInterface {
    name = 'CreateEntregas1780947710768'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "entrega_pedidos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "pedido_id" uuid NOT NULL, "sede_id" uuid NOT NULL, "punto_retiro_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "importe_cobrado_caja" numeric(10,2) NOT NULL DEFAULT '0', "fecha_entrega" TIMESTAMP WITH TIME ZONE NOT NULL, "observacion" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_78b070fd6cb80fcf92c83599336" UNIQUE ("pedido_id"), CONSTRAINT "PK_8511b78ec9be2f7de2c550561b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7084642f11ca90546774679a5f" ON "entrega_pedidos" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_entrega_tenant_fecha_sede" ON "entrega_pedidos" ("tenant_id", "fecha_entrega", "sede_id") `);
        await queryRunner.query(`ALTER TABLE "entrega_pedidos" ADD CONSTRAINT "FK_78b070fd6cb80fcf92c83599336" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entrega_pedidos" DROP CONSTRAINT "FK_78b070fd6cb80fcf92c83599336"`);
        await queryRunner.query(`DROP INDEX "public"."idx_entrega_tenant_fecha_sede"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7084642f11ca90546774679a5f"`);
        await queryRunner.query(`DROP TABLE "entrega_pedidos"`);
    }

}
