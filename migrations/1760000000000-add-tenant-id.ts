import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantIdCoreTables1769990000000 implements MigrationInterface {
  name = 'AddTenantIdCoreTables1769990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================
    // users (tenant-scoped)
    // =========================
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "tenant_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_tenant_id"
      ON "users" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_tenant_id_email"
      ON "users" ("tenant_id", "email")
    `);

    // =========================
    // refresh_tokens (tenant-scoped)
    // =========================
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN IF NOT EXISTS "tenant_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_tenant_id"
      ON "refresh_tokens" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_tenant_id_user_id"
      ON "refresh_tokens" ("tenant_id", "user_id")
    `);

    // =========================
    // audit_logs (tenant-scoped)
    // AuditLogsInit (timestamp 1769994196078) crea esta tabla DESPUÉS de esta
    // migración. Cuando la tabla ya existe (por AuditLogsInit o una DB preexistente),
    // el ADD COLUMN IF NOT EXISTS es un no-op seguro. Si todavía no existe, la
    // saltamos: AuditLogsInit la creará con tenant_id incluido desde el CREATE TABLE.
    // =========================
    const auditLogsExists = await queryRunner.hasTable('audit_logs');
    if (auditLogsExists) {
      await queryRunner.query(`
        ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "tenant_id" uuid
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_id"
        ON "audit_logs" ("tenant_id")
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_id_created_at"
        ON "audit_logs" ("tenant_id", "created_at")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // audit_logs — solo revertir si la tabla existe
    const auditLogsExists = await queryRunner.hasTable('audit_logs');
    if (auditLogsExists) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_audit_logs_tenant_id_created_at"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_audit_logs_tenant_id"`,
      );
      // No eliminar la columna si fue creada por AuditLogsInit (el CREATE TABLE ya la trae)
      // Solo eliminarla si la columna existe y fue agregada por esta migración
      await queryRunner.query(
        `ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "tenant_id"`,
      );
    }

    // refresh_tokens
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_refresh_tokens_tenant_id_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_refresh_tokens_tenant_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "tenant_id"`,
    );

    // users
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_id_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_id"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "tenant_id"`,
    );
  }
}
