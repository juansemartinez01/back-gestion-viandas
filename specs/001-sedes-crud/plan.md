# Implementation Plan: Gestión de Sedes

**Branch**: `001-sedes-crud` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-sedes-crud/spec.md`

## Summary

Implement the `sedes` module — the root master-data entity of the Rochester Viandas system.
A **sede** is a physical location of Rochester from which viandas are offered, produced,
delivered, or sold. This module is **Stage 1** of the implementation plan and is a prerequisite
for all other business modules.

**Technical approach**: Type A CRUD module — `SedesService` extends `BaseCrudTenantService<Sede>`,
with additional domain methods for `activar()`, `inactivar()`, and validated `remove()`. Two
controllers: `SedesController` (back office, JWT-protected) and `PublicSedesController`
(unauthenticated, tenant-from-header). Migration in `migrations/` at repo root.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**:
- NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/typeorm`)
- TypeORM 0.3.x
- class-validator + class-transformer (DTOs)
- `BaseCrudTenantService` — `src/common/crud/base-crud.service.ts`
- `AuditService` — `src/modules/audit/audit.service.ts`
- `TenancyService` — `src/modules/tenancy/tenancy.service.ts`
- `AppError` + `ErrorCodes` — `src/common/errors/`
- `ok()`, `page()` helpers — `src/common/http/api-response.ts`

**Storage**: PostgreSQL — table `sedes`, migrations at `migrations/` (repo root)

**Testing**: Jest (unit), manual smoke tests via curl (see quickstart.md)

**Target Platform**: Linux server (Railway), NestJS HTTP server

**Project Type**: Web service (REST API module within existing NestJS monolith)

**Performance Goals**: Public endpoint < 500 ms p95 under normal load

**Constraints**:
- All queries MUST be tenant-scoped — no raw `repo.find()` without tenant filter
- `throw new Error()` is forbidden — always `AppError` with `ErrorCodes`
- Partial index `WHERE deleted_at IS NULL` must be applied manually to migration

**Scale/Scope**: ~50 sedes per tenant max for MVP; single module, no cross-module dependencies
at this stage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Template API Contract | ✅ Pass | All responses via `ok()`/`page()`; errors via `AppError`+`ErrorCodes`; new codes added to `error-codes.ts` |
| II. Multi-Tenancy by Default | ✅ Pass | `BaseCrudTenantService` with `strictTenant: true`; public endpoint uses `TenancyService.requireTenantId()` |
| III. Role-Based Access Control | ✅ Pass | `JwtAuthGuard` on all admin routes; `@Roles()` per endpoint; public route explicitly unguarded and documented |
| IV. Business Rule Integrity | ✅ Pass | Idempotency checks for activar/inactivar; active-state check before delete; unique name validation |
| V. Audit Trail | ✅ Pass | `AuditService.write()` on all 5 mutating actions from controller |
| VI. Module Architecture | ✅ Pass | Type A: `BaseCrudTenantService` + custom controller; full file set; no raw SQL; no business logic in controllers |
| VII. Implementation Discipline | ✅ Pass | Stage 1, first module — no dependencies skipped |

## Project Structure

### Documentation (this feature)

```text
specs/001-sedes-crud/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 findings
├── data-model.md        # Entity, DTOs, migration checklist
├── quickstart.md        # Validation guide
├── contracts/
│   └── api-endpoints.md # Full API contract (8 endpoints)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── common/
│   └── errors/
│       └── error-codes.ts                  # EDIT: add 5 SEDE_* codes
├── modules/
│   └── sedes/
│       ├── entities/
│       │   └── sede.entity.ts              # CREATE: Sede entity
│       ├── dto/
│       │   ├── create-sede.dto.ts          # CREATE
│       │   ├── update-sede.dto.ts          # CREATE (PartialType)
│       │   └── query-sede.dto.ts           # CREATE (extends PageQueryDto)
│       ├── sedes.service.ts                # CREATE (extends BaseCrudTenantService)
│       ├── sedes.controller.ts             # CREATE (admin routes, JwtAuthGuard)
│       ├── public-sedes.controller.ts      # CREATE (public route, no guard)
│       └── sedes.module.ts                 # CREATE
├── app.module.ts                           # EDIT: add SedesModule import
└── infra/
    └── db/
        └── ormconfig.ts                    # EDIT: migrationsRun: true

migrations/
└── <timestamp>-CreateSedes.ts              # GENERATED then manually adjusted
```

**Structure Decision**: Standard NestJS single-module layout with entity subfolder and dto
subfolder. Two controllers in the same module (admin + public). Migrations at repo root per
existing template config (`makeOrmConfig` resolves `migrations/*` from repo root).

## Complexity Tracking

> Documented deviation (not a violation):

The controller does not extend `BaseCrudController` because:
1. Two extra action endpoints (`/activar`, `/inactivar`) require custom route methods not in the base
2. A second public controller lives in the same module but has no JWT guard

The base service (`BaseCrudTenantService`) is still used. Constitution Principle VI is satisfied.

---

## Implementation Notes (for /speckit-tasks)

Key decisions from research.md critical for task ordering:

### Migrations at repo root
```bash
npm run db:migration:generate -- migrations/CreateSedes
# Output: migrations/<timestamp>-CreateSedes.ts
```

### Partial index — manual edit required
After generating the migration, replace the auto-generated unique index in `up()` with:
```sql
CREATE UNIQUE INDEX "UQ_sedes_tenant_nombre"
ON "sedes" ("tenant_id", "nombre")
WHERE "deleted_at" IS NULL;
```

### migrationsRun: true
In `src/infra/db/ormconfig.ts`, change `migrationsRun: false` → `migrationsRun: true`.

### Audit writes from controller
```typescript
await this.audit.write('admin', {
  request_id: req.id,
  method: req.method,
  path: req.url,
  status_code: 201,
  actor_user_id: req.user?.sub,
  actor_email: req.user?.email,
  action: 'sede.created',
  entity: 'sede',
  payload: { id: result.id, nombre: result.nombre },
});
```

### Public endpoint ordering
```typescript
qb.where('s.activa = true')
  .orderBy('s.orden_visualizacion', 'ASC', 'NULLS LAST')
  .addOrderBy('s.nombre', 'ASC');
```

### SedesService.list() configuration
```typescript
super.list(
  { page, limit, q, sortBy, sortOrder, filters: activa !== undefined ? { activa } : {} },
  {
    searchColumns: ['nombre', 'direccion'],
    sortAllowed: ['nombre', 'orden_visualizacion', 'created_at'],
    sortFallback: { by: 'nombre', order: 'ASC' },
    filterAllowed: ['activa'],
    strictTenant: true,
  },
)
```
