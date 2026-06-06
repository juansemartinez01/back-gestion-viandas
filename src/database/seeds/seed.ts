import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../../app.module';
import { UsersService } from '../../modules/users/users.service';
import { ConfigService } from '@nestjs/config';
import { tenantContext } from '../../modules/tenancy/tenant-context';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  const usersService = app.get(UsersService);
  const config = app.get(ConfigService);

  const seedTenantId = config.get<string>('SEED_TENANT_ID');
  if (!seedTenantId) {
    throw new Error('SEED_TENANT_ID is required');
  }

  // UsersService methods require a tenant context (AsyncLocalStorage).
  // We set it manually here since there is no HTTP request in the seed runner.
  await tenantContext.run({ tenantId: seedTenantId, tenantKey: null }, async () => {
    // ── Seed 1: env-configured admin (original, preservado) ─────────────────
    const adminEmail = config.get<string>('SEED_ADMIN_EMAIL');
    const adminPassword = config.get<string>('SEED_ADMIN_PASSWORD');

    if (adminEmail && adminPassword) {
      const existing = await usersService.findByEmail(adminEmail);
      if (existing) {
        console.log(`✅ [seed1] ${adminEmail} ya existe, omitiendo`);
      } else {
        const password_hash = await bcrypt.hash(adminPassword, 10);
        const admin = await usersService.createUser({
          tenant_id: seedTenantId,
          email: adminEmail,
          password_hash,
          roleNames: ['admin'],
        });
        console.log('✅ [seed1] Admin creado:', admin.email, '| roles:', admin.roles.map((r) => r.name));
      }
    }

    // ── Seed 2: Rochester admin ──────────────────────────────────────────────
    const rochesterEmail = 'admininnoview@innoview.com';
    const rochesterPassword = 'admin123';

    const existingRochester = await usersService.findByEmail(rochesterEmail);
    if (existingRochester) {
      console.log(`✅ [seed2] ${rochesterEmail} ya existe, omitiendo`);
    } else {
      const password_hash = await bcrypt.hash(rochesterPassword, 10);
      const rochesterAdmin = await usersService.createUser({
        tenant_id: seedTenantId,
        email: rochesterEmail,
        password_hash,
        roleNames: ['administrador'],
      });
      console.log(
        '✅ [seed2] Rochester admin creado:',
        rochesterAdmin.email,
        '| roles:',
        rochesterAdmin.roles.map((r) => r.name),
      );
    }
  });

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seed failed', err);
  process.exit(1);
});
