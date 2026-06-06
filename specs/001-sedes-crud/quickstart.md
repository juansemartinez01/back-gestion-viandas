# Quickstart: Gestión de Sedes

**Feature**: 001-sedes-crud
**Date**: 2026-06-06

## Prerequisites

- PostgreSQL running and `DATABASE_URL` set in `.env.local`
- App dependencies installed: `npm install`

## Implementation Steps

### 1. Add ErrorCodes

Edit `src/common/errors/error-codes.ts` — add to the object:

```typescript
// sedes
SEDE_NOT_FOUND: 'SEDE_NOT_FOUND',
SEDE_NOMBRE_DUPLICADO: 'SEDE_NOMBRE_DUPLICADO',
SEDE_YA_ACTIVA: 'SEDE_YA_ACTIVA',
SEDE_YA_INACTIVA: 'SEDE_YA_INACTIVA',
SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
```

### 2. Create the Entity

Create `src/modules/sedes/entities/sede.entity.ts` (see data-model.md for full schema).

### 3. Generate Migration

```bash
npm run db:migration:generate -- migrations/CreateSedes
```

This creates `migrations/<timestamp>-CreateSedes.ts`.

**Manual adjustment required**: Replace the auto-generated unique index with a partial index:

```typescript
// In the up() method, replace any unique index on (tenant_id, nombre) with:
await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_sedes_tenant_nombre"
  ON "sedes" ("tenant_id", "nombre")
  WHERE "deleted_at" IS NULL
`);
```

### 4. Enable migrationsRun

Edit `src/infra/db/ormconfig.ts`:

```typescript
migrationsRun: true,   // was false
```

### 5. Create DTOs

- `src/modules/sedes/dto/create-sede.dto.ts`
- `src/modules/sedes/dto/update-sede.dto.ts` (PartialType of CreateSedeDto)
- `src/modules/sedes/dto/query-sede.dto.ts` (extends PageQueryDto)

### 6. Create Service

`src/modules/sedes/sedes.service.ts` — extends `BaseCrudTenantService<Sede>`.

Key methods to implement beyond the base:
- `activar(id)` — validate not already active, set `activa=true`, return saved entity
- `inactivar(id)` — validate not already inactive, set `activa=false`, return saved entity
- `remove(id)` — validate `activa=false`, call `super.softDelete(id)`
- `listPublic(tenantId)` — raw QueryBuilder for public endpoint ordering

### 7. Create Controllers

- `src/modules/sedes/sedes.controller.ts` — prefix `/admin/sedes`, `JwtAuthGuard`, `RolesGuard`
- `src/modules/sedes/public-sedes.controller.ts` — prefix `/public/sedes`, no guards

### 8. Create Module and Register

`src/modules/sedes/sedes.module.ts`:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Sede]), AuditModule],
  providers: [SedesService],
  controllers: [SedesController, PublicSedesController],
  exports: [SedesService],
})
export class SedesModule {}
```

Add to `src/app.module.ts` imports array: `SedesModule`.

## Validation

### Run the app

```bash
npm run start:dev
```

Check for:
- No TypeScript errors
- Migration runs automatically on startup (check logs for "Migration X has been executed")

### Smoke Tests

```bash
# 1. Create a sede (replace TOKEN and BASE_URL)
curl -X POST http://localhost:3000/admin/sedes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Campus Norte","direccion":"Av. Test 123"}'

# Expected: { ok: true, data: { id: "...", nombre: "Campus Norte", activa: true } }

# 2. Duplicate name should fail
curl -X POST http://localhost:3000/admin/sedes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Campus Norte","direccion":"Otra direccion"}'

# Expected: { ok: false, error: { code: "SEDE_NOMBRE_DUPLICADO" } }

# 3. Public endpoint
curl http://localhost:3000/public/sedes \
  -H "x-tenant-key: $TENANT_KEY"

# Expected: { ok: true, data: [ ... active sedes only ... ] }

# 4. Public endpoint without tenant header
curl http://localhost:3000/public/sedes

# Expected: { ok: false, error: { code: "TENANT_REQUIRED" } }

# 5. Inactivar then delete
SEDE_ID="<id from step 1>"
curl -X PATCH http://localhost:3000/admin/sedes/$SEDE_ID/inactivar \
  -H "Authorization: Bearer $TOKEN"
# Expected: { ok: true, data: { activa: false } }

curl -X DELETE http://localhost:3000/admin/sedes/$SEDE_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: { ok: true, data: { id: "..." } }

# 6. Delete active sede should fail
SEDE_ID2="<new active sede id>"
curl -X DELETE http://localhost:3000/admin/sedes/$SEDE_ID2 \
  -H "Authorization: Bearer $TOKEN"
# Expected: { ok: false, error: { code: "SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR" } }
```
