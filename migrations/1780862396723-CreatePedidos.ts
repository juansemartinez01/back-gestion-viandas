import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePedidos1780862396723 implements MigrationInterface {
    name = 'CreatePedidos1780862396723'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."pedidos_medio_pago_enum" AS ENUM('mercado_pago', 'presencial')`);
        await queryRunner.query(`CREATE TYPE "public"."pedidos_estado_pedido_enum" AS ENUM('pendiente_pago_online', 'confirmado_pago_online', 'confirmado_pago_presencial', 'entregado', 'no_retirado', 'cancelado')`);
        await queryRunner.query(`CREATE TYPE "public"."pedidos_estado_pago_enum" AS ENUM('pendiente', 'aprobado', 'rechazado', 'cancelado', 'presencial_pendiente', 'presencial_cobrado')`);
        await queryRunner.query(`CREATE TYPE "public"."pedidos_cancelado_por_enum" AS ENUM('cliente', 'administracion')`);
        await queryRunner.query(`CREATE TABLE "pedidos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "codigo_publico" character varying(30) NOT NULL, "cliente_id" uuid NOT NULL, "menu_publicado_id" uuid NOT NULL, "sede_id" uuid NOT NULL, "punto_retiro_id" uuid NOT NULL, "dni_informado" character varying(20) NOT NULL, "nombre_informado" character varying(100) NOT NULL, "apellido_informado" character varying(100) NOT NULL, "telefono_informado" character varying(50), "email_informado" character varying(200), "fecha_pedido" date NOT NULL, "fecha_retiro" date NOT NULL, "cantidad" integer NOT NULL, "precio_unitario" numeric(10,2) NOT NULL, "importe_total" numeric(10,2) NOT NULL, "medio_pago" "public"."pedidos_medio_pago_enum" NOT NULL, "estado_pedido" "public"."pedidos_estado_pedido_enum" NOT NULL DEFAULT 'pendiente_pago_online', "estado_pago" "public"."pedidos_estado_pago_enum" NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE, "fecha_confirmacion" TIMESTAMP WITH TIME ZONE, "fecha_cancelacion" TIMESTAMP WITH TIME ZONE, "cancelado_por" "public"."pedidos_cancelado_por_enum", "usuario_cancelacion_id" uuid, "motivo_cancelacion" text, "devolucion_pendiente" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_727ebda9c28d0eead9ab4fd805a" UNIQUE ("codigo_publico"), CONSTRAINT "PK_ebb5680ed29a24efdc586846725" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9f7acc7942b79ddd6454777f7f" ON "pedidos" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_pedidos_tenant_expires" ON "pedidos" ("tenant_id", "expires_at") `);
        await queryRunner.query(`CREATE INDEX "idx_pedidos_tenant_mp_estado" ON "pedidos" ("tenant_id", "menu_publicado_id", "estado_pedido") `);
        await queryRunner.query(`CREATE INDEX "idx_pedidos_tenant_dni" ON "pedidos" ("tenant_id", "dni_informado") `);
        await queryRunner.query(`ALTER TABLE "pedidos" ADD CONSTRAINT "FK_2fc639de84f845569ac2c9f78aa" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pedidos" ADD CONSTRAINT "FK_1c8a5457c85998836d44117d3cc" FOREIGN KEY ("menu_publicado_id") REFERENCES "menus_publicados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pedidos" ADD CONSTRAINT "FK_87db4a4c359cd73fb324819ef9e" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pedidos" ADD CONSTRAINT "FK_d04f76c66269be8831625c7f76a" FOREIGN KEY ("punto_retiro_id") REFERENCES "puntos_retiro"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pedidos" DROP CONSTRAINT "FK_d04f76c66269be8831625c7f76a"`);
        await queryRunner.query(`ALTER TABLE "pedidos" DROP CONSTRAINT "FK_87db4a4c359cd73fb324819ef9e"`);
        await queryRunner.query(`ALTER TABLE "pedidos" DROP CONSTRAINT "FK_1c8a5457c85998836d44117d3cc"`);
        await queryRunner.query(`ALTER TABLE "pedidos" DROP CONSTRAINT "FK_2fc639de84f845569ac2c9f78aa"`);
        await queryRunner.query(`DROP INDEX "public"."idx_pedidos_tenant_dni"`);
        await queryRunner.query(`DROP INDEX "public"."idx_pedidos_tenant_mp_estado"`);
        await queryRunner.query(`DROP INDEX "public"."idx_pedidos_tenant_expires"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9f7acc7942b79ddd6454777f7f"`);
        await queryRunner.query(`DROP TABLE "pedidos"`);
        await queryRunner.query(`DROP TYPE "public"."pedidos_cancelado_por_enum"`);
        await queryRunner.query(`DROP TYPE "public"."pedidos_estado_pago_enum"`);
        await queryRunner.query(`DROP TYPE "public"."pedidos_estado_pedido_enum"`);
        await queryRunner.query(`DROP TYPE "public"."pedidos_medio_pago_enum"`);
    }

}
