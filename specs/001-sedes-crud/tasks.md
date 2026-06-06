---
description: "Task list for sedes module — Stage 1 master data"
---

# Tasks: Gestión de Sedes

**Input**: Design documents from `specs/001-sedes-crud/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api-endpoints.md ✅

**Tests**: Not explicitly requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and validation.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: One-line config changes needed before any code compiles correctly.

- [x] T001 Add 5 SEDE_* error codes to `src/common/errors/error-codes.ts`: SEDE_NOT_FOUND, SEDE_NOMBRE_DUPLICADO, SEDE_YA_ACTIVA, SEDE_YA_INACTIVA, SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR
- [x] T002 [P] Set `migrationsRun: true` in `src/infra/db/ormconfig.ts` (was `false`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entity, migration, and DTOs that ALL user story phases depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create `src/modules/sedes/entities/sede.entity.ts` — extends `BaseEntity`, adds columns: nombre varchar(150), direccion varchar(300), telefono_contacto varchar(50) nullable, observaciones text nullable, activa boolean default true, orden_visualizacion int nullable. Add `@Index('UQ_sedes_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })` (will be overridden in migration).
- [x] T004 Run `npm run db:migration:generate -- migrations/CreateSedes` to generate `migrations/<timestamp>-CreateSedes.ts` (requires T003)
- [x] T005 Edit generated migration file: replace the auto-generated unique index on (tenant_id, nombre) with a partial index in the `up()` method (depends on T004):
  ```sql
  CREATE UNIQUE INDEX "UQ_sedes_tenant_nombre"
  ON "sedes" ("tenant_id", "nombre")
  WHERE "deleted_at" IS NULL;
  ```
  Also add corresponding `DROP INDEX "UQ_sedes_tenant_nombre"` in `down()`.
- [x] T006 Create `src/modules/sedes/dto/create-sede.dto.ts` — fields: nombre (@IsString, @IsNotEmpty, @MaxLength(150)), direccion (@IsString, @IsNotEmpty, @MaxLength(300)), telefono_contacto (@IsOptional, @IsString, @MaxLength(50)), observaciones (@IsOptional, @IsString), orden_visualizacion (@IsOptional, @IsInt, @Min(1), @Type(() => Number))
- [x] T007 [P] Create `src/modules/sedes/dto/update-sede.dto.ts` — `PartialType(CreateSedeDto)`, all fields optional (depends on T006)
- [x] T008 [P] Create `src/modules/sedes/dto/query-sede.dto.ts` — extends `PageQueryDto`, adds: q (@IsOptional, @IsString), sortBy (@IsOptional, @IsString), sortOrder (@IsOptional, @IsIn(['ASC','DESC'])), activa (@IsOptional, @IsBoolean, @Transform(({ value }) => value === 'true' || value === true))

**Checkpoint**: Entity compiled, migration generated and adjusted, DTOs complete — user story implementation can begin.

---

## Phase 3: User Story 1 — Administrador gestiona el catálogo de sedes (Priority: P1) 🎯 MVP

**Goal**: Admin can create, list, view detail, update, and soft-delete sedes via back office.
Delete requires the sede to be inactive first.

**Independent Test**: Boot the app, obtain a JWT with role `administrador`, then:
1. `POST /admin/sedes` → creates sede
2. `GET /admin/sedes` → sede appears in list
3. `GET /admin/sedes/:id` → detail returned
4. `PATCH /admin/sedes/:id` → name change reflected
5. `DELETE /admin/sedes/:id` → fails with SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR (full delete requires US3)

### Implementation for User Story 1

- [x] T009 [US1] Create `src/modules/sedes/sedes.service.ts` extending `BaseCrudTenantService<Sede>`:
  - Constructor injects `@InjectRepository(Sede) private sedeRepo: Repository<Sede>`, calls `super(sedeRepo)`
  - `list(query: QuerySedeDto)` — calls `super.list()` with searchColumns ['nombre','direccion'], sortAllowed ['nombre','orden_visualizacion','created_at'], filterAllowed ['activa'], strictTenant: true
  - `findOne(id: string)` — calls `super.mustFindById(id, { strictTenant: true })`, throws SEDE_NOT_FOUND if not found
  - `create(dto: CreateSedeDto)` — validates nombre uniqueness via QueryBuilder (LOWER comparison, deleted_at IS NULL, same tenant), then calls `super.create(dto, { strictTenant: true })`. Throws SEDE_NOMBRE_DUPLICADO (409) if duplicate.
  - `update(id: string, dto: UpdateSedeDto)` — calls `mustFindById`, then validates nombre uniqueness excluding current id, then calls `super.update(id, dto)`
  - `remove(id: string)` — calls `mustFindById`, checks `activa === false` (throws SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR 409 if active), then calls `super.softDelete(id)`
  - `activar(id: string)` — calls `mustFindById`, checks `activa === true` (throws SEDE_YA_ACTIVA 409), sets `activa = true`, saves via `this.sedeRepo.save()`
  - `inactivar(id: string)` — calls `mustFindById`, checks `activa === false` (throws SEDE_YA_INACTIVA 409), sets `activa = false`, saves

- [x] T010 [US1] Create `src/modules/sedes/sedes.controller.ts` with prefix `/admin/sedes`, `@UseGuards(JwtAuthGuard)` at class level, injects `SedesService`, `AuditService`, and `PinoLogger`:
  - `GET /` — `@Roles('administrador','supervisor')`, calls `svc.list(query)`, returns `page(items, query.page, query.limit, total)`
  - `GET /:id` — `@Roles('administrador','supervisor')`, calls `svc.findOne(id)`, returns `ok(sede)`
  - `POST /` — `@Roles('administrador')`, calls `svc.create(dto)`, returns `ok(sede)` 201, calls `audit.write('admin', { action: 'sede.created', entity: 'sede', ... })`
  - `PATCH /:id` — `@Roles('administrador')`, calls `svc.update(id, dto)`, returns `ok(sede)`, calls `audit.write('admin', { action: 'sede.updated', ... })`
  - `DELETE /:id` — `@Roles('administrador')`, calls `svc.remove(id)`, returns `ok({ id })`, calls `audit.write('admin', { action: 'sede.deleted', ... })`

- [x] T011 [US1] Create `src/modules/sedes/sedes.module.ts` — imports `TypeOrmModule.forFeature([Sede])` and `AuditModule`, declares providers `[SedesService]`, controllers `[SedesController, PublicSedesController]` (PublicSedesController can be a stub for now), exports `[SedesService]`

- [x] T012 [US1] Add `SedesModule` to the imports array in `src/app.module.ts`

**Checkpoint**: `npm run start:dev` starts without errors. Admin CRUD endpoints respond correctly. Duplicate name returns 409. Delete of active sede returns 409.

---

## Phase 4: User Story 2 — Cliente selecciona sede en portal público (Priority: P2)

**Goal**: Unauthenticated GET /public/sedes returns only active sedes, ordered by orden_visualizacion ASC NULLS LAST then nombre ASC, when x-tenant-key header is provided.

**Independent Test**: `curl http://localhost:3000/public/sedes -H "x-tenant-key: $KEY"` returns only active sedes in correct order. Without header, returns TENANT_REQUIRED 400.

### Implementation for User Story 2

- [x] T013 [US2] Add `listPublic()` method to `src/modules/sedes/sedes.service.ts` — uses `this.sedeRepo.createQueryBuilder('s')`, applies `this.applyTenantScopeQb(qb, 's', { strictTenant: true })`, adds `andWhere('s.activa = true')`, orders by `s.orden_visualizacion ASC NULLS LAST` then `s.nombre ASC`, returns `getMany()`. Does NOT use super.list() — custom QB needed for NULLS LAST ordering.

- [x] T014 [US2] Create `src/modules/sedes/public-sedes.controller.ts` with prefix `/public/sedes`, NO `JwtAuthGuard`:
  - `GET /` — no roles guard, injects `SedesService`, calls `svc.listPublic()` (TenancyService.requireTenantId() is called internally in the service via applyTenantScopeQb with strictTenant: true). Returns `ok(sedes)`. If no x-tenant-key, the tenancy middleware/service will throw TENANT_REQUIRED automatically.
  - Update `sedes.module.ts` to ensure `PublicSedesController` is declared (replace stub if used in T011)

**Checkpoint**: Public endpoint returns only active sedes in correct order. Missing x-tenant-key returns TENANT_REQUIRED error.

---

## Phase 5: User Story 3 — Administrador activa o inactiva una sede (Priority: P3)

**Goal**: Admin can toggle sede state. Activar fails if already active; inactivar fails if already inactive.

**Independent Test**: 
1. Create sede (activa=true by default)
2. `PATCH /admin/sedes/:id/inactivar` → activa=false, audit entry written
3. `PATCH /admin/sedes/:id/inactivar` again → 409 SEDE_YA_INACTIVA
4. `PATCH /admin/sedes/:id/activar` → activa=true, audit entry written
5. `PATCH /admin/sedes/:id/activar` again → 409 SEDE_YA_ACTIVA
6. Verify inactive sede now appears in portal public after re-activation

### Implementation for User Story 3

- [x] T015 [US3] Add `PATCH /:id/activar` and `PATCH /:id/inactivar` endpoints to `src/modules/sedes/sedes.controller.ts`:
  - `PATCH /:id/activar` — `@Roles('administrador')`, calls `svc.activar(id)`, returns `ok(sede)`, calls `audit.write('admin', { action: 'sede.activated', entity: 'sede', payload: { id, nombre: sede.nombre } })`
  - `PATCH /:id/inactivar` — `@Roles('administrador')`, calls `svc.inactivar(id)`, returns `ok(sede)`, calls `audit.write('admin', { action: 'sede.deactivated', entity: 'sede', payload: { id, nombre: sede.nombre } })`
  - **Note**: The service methods `activar()` and `inactivar()` were already implemented in T009. This task only adds the controller route handlers.

**Checkpoint**: Full lifecycle works — create → inactivar → soft-delete. Activar/inactivar idempotency enforced (double-call returns 409). Audit log entries present for all state changes.

---

## Phase 6: User Story 4 — Supervisor/admin consulta con filtros avanzados (Priority: P4)

**Goal**: Admin list endpoint supports search by name, filter by activa, sort by nombre/orden_visualizacion, pagination.

**Independent Test**: Seed 5 sedes (3 active, 2 inactive), then:
1. `GET /admin/sedes?q=campus` → only sedes with "campus" in nombre/direccion
2. `GET /admin/sedes?activa=false` → only the 2 inactive
3. `GET /admin/sedes?sortBy=orden_visualizacion&sortOrder=ASC` → correct ordering
4. `GET /admin/sedes?page=2&limit=2` → page 2 with correct meta

### Implementation for User Story 4

**Note**: All filtering, search, sort, and pagination capabilities are already implemented in T009 (SedesService.list()) and T010 (SedesController GET /). The QuerySedeDto already has all the required fields from T008. US4 requires **no new code** — it is validated by confirming the existing implementation handles all query parameters correctly.

- [x] T016 [US4] Verify `GET /admin/sedes` handles all query parameters from `QuerySedeDto`: smoke-test each filter/sort/pagination combination using quickstart.md curl commands. Fix any issues found in the query configuration of `SedesService.list()`.

**Checkpoint**: All 4 query parameter combinations from US4 acceptance scenarios work correctly.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, code review against constitution checklist.

- [ ] T017 [P] Verify all 5 audit actions write to `audit_logs` table (requires running app): sede.created, sede.updated, sede.activated, sede.deactivated, sede.deleted. Check by querying DB after each operation.
- [ ] T018 [P] Verify tenant isolation: (requires running app) attempt to GET /admin/sedes/:id for a sede belonging to a different tenant (using a different JWT) — must return SEDE_NOT_FOUND (not the actual data).
- [ ] T019 Run all quickstart.md smoke tests (requires running app with DB) and confirm expected responses for all scenarios.
- [x] T020 [P] Verify `npm run build` compiles without TypeScript errors.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 and T002 can run in parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS** all user stories.
  - T003 → T004 → T005 (sequential: entity → generate → edit)
  - T006 → T007, T008 (T007 and T008 parallel after T006)
- **User Story 1 (Phase 3)**: Depends on ALL of Phase 2
  - T009 → T010 → T011 → T012 (sequential: service → controller → module → AppModule)
- **User Story 2 (Phase 4)**: Depends on Phase 3 completion (uses SedesService, SedesModule)
  - T013 → T014 (sequential: service method → controller)
- **User Story 3 (Phase 5)**: Depends on Phase 3 completion (modifies SedesController)
  - T015 (single task, adds endpoints to existing controller)
- **User Story 4 (Phase 6)**: Depends on Phase 3 completion (validates existing list endpoint)
  - T016 (verification task, no new code)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### Within Each Phase

- Service before controller (service methods must exist before controller calls them)
- Module before AppModule registration
- Migration must be verified before testing any endpoint

### Parallel Opportunities

```bash
# Phase 1 — run together:
Task: "T001 Add SEDE_* error codes"
Task: "T002 Set migrationsRun: true"

# Phase 2 after T006 — run together:
Task: "T007 Create update-sede.dto.ts"
Task: "T008 Create query-sede.dto.ts"

# Phase 7 — run together:
Task: "T017 Verify audit log entries"
Task: "T018 Verify tenant isolation"
Task: "T020 Verify npm run build"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003 → T004 → T005, T006 → T007+T008)
3. Complete Phase 3: User Story 1 (T009 → T010 → T011 → T012)
4. **STOP AND VALIDATE**: Boot app, run smoke tests from quickstart.md for CRUD flow
5. Deploy if ready — back office CRUD for sedes is operational

### Incremental Delivery

1. Setup + Foundational → DB table exists, DTOs ready
2. US1 complete → Admin can manage sedes (MVP for all downstream modules)
3. US2 complete → Public portal can display sedes to clients
4. US3 complete → Full lifecycle management (activate/deactivate)
5. US4 validated → Advanced filtering confirmed working

---

## Notes

- `[P]` tasks = different files, no blocking dependencies between them
- `[Story]` label maps to user story for traceability
- T005 (migration edit) is a **manual file edit** — not a code generation task
- T009 implements ALL service methods including activar/inactivar (single file, best done at once)
- T015 only adds controller route handlers for activar/inactivar (service logic already in T009)
- T016 is a validation task — if it uncovers bugs, fix them in the service (T009) or DTO (T008)
- Audit writes go in the **controller**, not the service (controller has access to `@Req() req` for requestId, method, path)
- Public endpoint ordering uses `NULLS LAST` — must use raw QB, not `super.list()`
