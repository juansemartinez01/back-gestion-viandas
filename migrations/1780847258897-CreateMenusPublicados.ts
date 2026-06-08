import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMenusPublicados1780847258897 implements MigrationInterface {
    name = 'CreateMenusPublicados1780847258897'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_menus_base_tenant_nombre"`);
        await queryRunner.query(`CREATE TYPE "public"."menus_publicados_tipo_sobreproduccion_enum" AS ENUM('cantidad_fija', 'porcentaje')`);
        await queryRunner.query(`CREATE TYPE "public"."menus_publicados_estado_enum" AS ENUM('activo', 'pausado', 'cerrado', 'agotado', 'cancelado')`);
        await queryRunner.query(`CREATE TABLE "menus_publicados" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "menu_base_id" uuid NOT NULL, "sede_id" uuid NOT NULL, "fecha_venta" date NOT NULL, "precio_encargo" numeric(10,2) NOT NULL, "precio_sobrante" numeric(10,2), "fecha_hora_limite_encargo" TIMESTAMP WITH TIME ZONE NOT NULL, "fecha_hora_limite_cancelacion" TIMESTAMP WITH TIME ZONE, "limite_maximo_viandas" integer, "tipo_sobreproduccion" "public"."menus_publicados_tipo_sobreproduccion_enum", "valor_sobreproduccion" numeric(8,2), "estado" "public"."menus_publicados_estado_enum" NOT NULL DEFAULT 'activo', "imagen_public_id" character varying(500), "imagen_url" character varying(1000), "observaciones" text, CONSTRAINT "PK_6a0a689a6d7b6d03dc3941802a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6d60c67bf4316388bbf520bd12" ON "menus_publicados" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_mp_tenant_sede_estado" ON "menus_publicados" ("tenant_id", "sede_id", "estado") `);
        await queryRunner.query(`CREATE INDEX "idx_mp_tenant_fecha" ON "menus_publicados" ("tenant_id", "fecha_venta") `);
        await queryRunner.query(`CREATE TABLE "menu_publicado_puntos_retiro" ("menu_publicado_id" uuid NOT NULL, "punto_retiro_id" uuid NOT NULL, CONSTRAINT "PK_ff6ed682751fd1fcf5b13ecee5c" PRIMARY KEY ("menu_publicado_id", "punto_retiro_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_99b05ce7ddd62e0672dc8b6ec0" ON "menu_publicado_puntos_retiro" ("menu_publicado_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ec029970f883ea87d256c47d80" ON "menu_publicado_puntos_retiro" ("punto_retiro_id") `);
        await queryRunner.query(`ALTER TABLE "menus_publicados" ADD CONSTRAINT "FK_43d9fe1a41404a2a0f71bbc564b" FOREIGN KEY ("menu_base_id") REFERENCES "menus_base"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "menus_publicados" ADD CONSTRAINT "FK_502c42b4da5d428a6e78f72df06" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "menu_publicado_puntos_retiro" ADD CONSTRAINT "FK_99b05ce7ddd62e0672dc8b6ec00" FOREIGN KEY ("menu_publicado_id") REFERENCES "menus_publicados"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "menu_publicado_puntos_retiro" ADD CONSTRAINT "FK_ec029970f883ea87d256c47d80e" FOREIGN KEY ("punto_retiro_id") REFERENCES "puntos_retiro"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menu_publicado_puntos_retiro" DROP CONSTRAINT "FK_ec029970f883ea87d256c47d80e"`);
        await queryRunner.query(`ALTER TABLE "menu_publicado_puntos_retiro" DROP CONSTRAINT "FK_99b05ce7ddd62e0672dc8b6ec00"`);
        await queryRunner.query(`ALTER TABLE "menus_publicados" DROP CONSTRAINT "FK_502c42b4da5d428a6e78f72df06"`);
        await queryRunner.query(`ALTER TABLE "menus_publicados" DROP CONSTRAINT "FK_43d9fe1a41404a2a0f71bbc564b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec029970f883ea87d256c47d80"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_99b05ce7ddd62e0672dc8b6ec0"`);
        await queryRunner.query(`DROP TABLE "menu_publicado_puntos_retiro"`);
        await queryRunner.query(`DROP INDEX "public"."idx_mp_tenant_fecha"`);
        await queryRunner.query(`DROP INDEX "public"."idx_mp_tenant_sede_estado"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d60c67bf4316388bbf520bd12"`);
        await queryRunner.query(`DROP TABLE "menus_publicados"`);
        await queryRunner.query(`DROP TYPE "public"."menus_publicados_estado_enum"`);
        await queryRunner.query(`DROP TYPE "public"."menus_publicados_tipo_sobreproduccion_enum"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_menus_base_tenant_nombre" ON "menus_base" ("nombre", "tenant_id") WHERE (deleted_at IS NULL)`);
    }

}
