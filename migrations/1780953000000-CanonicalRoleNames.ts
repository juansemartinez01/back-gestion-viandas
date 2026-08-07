import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalRoleNames1780953000000 implements MigrationInterface {
  name = 'CanonicalRoleNames1780953000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "roles" ("name", "tenant_id")
      VALUES ('Admin', NULL), ('Vendedor', NULL), ('Cocina', NULL)
      ON CONFLICT ("name") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_roles" ("user_id", "role_id")
      SELECT DISTINCT ur."user_id", target."id"
      FROM "user_roles" ur
      INNER JOIN "roles" source ON source."id" = ur."role_id"
      INNER JOIN "roles" target ON target."name" = 'Admin'
      WHERE lower(trim(source."name")) IN ('admin', 'administrador', 'supervisor')
        AND source."name" <> 'Admin'
      ON CONFLICT ("user_id", "role_id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_roles" ("user_id", "role_id")
      SELECT DISTINCT ur."user_id", target."id"
      FROM "user_roles" ur
      INNER JOIN "roles" source ON source."id" = ur."role_id"
      INNER JOIN "roles" target ON target."name" = 'Vendedor'
      WHERE lower(trim(source."name")) IN ('operador_caja', 'vendedor')
        AND source."name" <> 'Vendedor'
      ON CONFLICT ("user_id", "role_id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_roles" ("user_id", "role_id")
      SELECT DISTINCT ur."user_id", target."id"
      FROM "user_roles" ur
      INNER JOIN "roles" source ON source."id" = ur."role_id"
      INNER JOIN "roles" target ON target."name" = 'Cocina'
      WHERE lower(trim(source."name")) = 'cocina'
        AND source."name" <> 'Cocina'
      ON CONFLICT ("user_id", "role_id") DO NOTHING
    `);

    await queryRunner.query(`
      DELETE FROM "user_roles" ur
      USING "roles" source
      WHERE ur."role_id" = source."id"
        AND (
          lower(trim(source."name")) IN ('admin', 'administrador', 'supervisor', 'operador_caja', 'vendedor', 'cocina')
        )
        AND source."name" NOT IN ('Admin', 'Vendedor', 'Cocina')
    `);

    await queryRunner.query(`
      DELETE FROM "roles" source
      WHERE lower(trim(source."name")) IN ('admin', 'administrador', 'supervisor', 'operador_caja', 'vendedor', 'cocina')
        AND source."name" NOT IN ('Admin', 'Vendedor', 'Cocina')
        AND NOT EXISTS (
          SELECT 1 FROM "user_roles" ur WHERE ur."role_id" = source."id"
        )
    `);
  }

  public async down(): Promise<void> {
    // This data migration merges legacy roles into canonical role names.
    // It cannot safely reconstruct each user's original legacy roles.
  }
}
