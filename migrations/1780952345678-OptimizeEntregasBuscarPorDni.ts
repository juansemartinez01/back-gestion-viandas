import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeEntregasBuscarPorDni1780952345678 implements MigrationInterface {
  name = 'OptimizeEntregasBuscarPorDni1780952345678';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(
      `CREATE INDEX "idx_pedidos_entregas_busqueda" ON "pedidos" ("tenant_id", "fecha_retiro", "sede_id", "punto_retiro_id", "estado_pedido") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pedidos_dni_digits_trgm" ON "pedidos" USING gin ((regexp_replace("dni_informado", '\\D', '', 'g')) gin_trgm_ops) WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_pedidos_dni_digits_trgm"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_pedidos_entregas_busqueda"`,
    );
  }
}
