---
description: "Task list for puntos-retiro module — Stage 1 master data (segundo módulo)"
---

# Tasks: Gestión de Puntos de Retiro

**Input**: Design documents from `specs/002-puntos-retiro/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api-endpoints.md ✅

**Tests**: Not explicitly requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and validation.

**Dependencia de módulo previo**: `SedesModule` debe estar completamente implementado e importado en `AppModule` antes de comenzar.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Agregar los error codes nuevos antes de que cualquier código del módulo los referencie.

- [x] T001 Add 6 new error codes to `src/common/errors/error-codes.ts`: PUNTO_RETIRO_NOT_FOUND, PUNTO_RETIRO_NOMBRE_DUPLICADO, PUNTO_RETIRO_YA_ACTIVO, PUNTO_RETIRO_YA_INACTIVO, PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR, SEDE_INACTIVA (verificar si ya existe antes de agregar)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entidad, migración y DTOs que todas las user stories necesitan.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create `src/modules/puntos-retiro/entities/punto-retiro.entity.ts` — extends `BaseEntity`, agrega columnas: sede_id (uuid Column), nombre varchar(150), descripcion varchar(300) nullable, activo boolean default true, orden_visualizacion int nullable, observaciones text nullable. Agrega `@ManyToOne(() => Sede, { eager: false })` con `@JoinColumn({ name: 'sede_id' })`. Agrega `@Index('UQ_puntos_retiro_tenant_sede_nombre', ['tenant_id', 'sede_id', 'nombre'], { unique: true })` a nivel de clase (será reemplazado por índice parcial en migración).
- [x] T003 Run `npm run db:migration:generate -- migrations/CreatePuntosRetiro` to generate `migrations/<timestamp>-CreatePuntosRetiro.ts` (requires T002)
- [x] T004 Edit generated migration file `migrations/<timestamp>-CreatePuntosRetiro.ts`: reemplazar el índice único auto-generado sobre (tenant_id, sede_id, nombre) por índice parcial en `up()`:
  ```sql
  CREATE UNIQUE INDEX "UQ_puntos_retiro_tenant_sede_nombre"
  ON "puntos_retiro" ("tenant_id", "sede_id", "nombre")
  WHERE "deleted_at" IS NULL;
  ```
  Agregar `DROP INDEX IF EXISTS "UQ_puntos_retiro_tenant_sede_nombre"` en `down()`. Verificar que la FK a `sedes` esté presente.
- [x] T005 [P] Create `src/modules/puntos-retiro/dto/create-punto-retiro.dto.ts` — campos: sede_id (@IsUUID, @IsNotEmpty), nombre (@IsString, @IsNotEmpty, @MaxLength(150)), descripcion (@IsOptional, @IsString, @MaxLength(300)), activo (@IsOptional, @IsBoolean), orden_visualizacion (@IsOptional, @IsInt, @Min(1), @Type(() => Number)), observaciones (@IsOptional, @IsString)
- [x] T006 [P] Create `src/modules/puntos-retiro/dto/update-punto-retiro.dto.ts` — todos los campos de CreatePuntoRetiroDto EXCEPTO sede_id, declarados explícitamente como opcionales. NO usar PartialType (paquete no instalado). nombre con @IsOptional @IsString @IsNotEmpty @MaxLength(150).
- [ ] T007 [P] Create `src/modules/puntos-retiro/dto/query-punto-retiro.dto.ts` — extiende PageQueryDto del template, agrega: q (@IsOptional, @IsString), sede_id (@IsOptional, @IsUUID), activo (@IsOptional, @IsBoolean, @Transform(({ value }) => value === 'true' || value === true)), sortBy (@IsOptional, @IsString), sortOrder (@IsOptional, @IsIn(['ASC','DESC']))

**Checkpoint**: Entidad compilada, migración generada y ajustada, DTOs completos — implementación de user stories puede comenzar.

---

## Phase 3: User Story 1 — Administrador gestiona el catálogo de puntos de retiro (Priority: P1) 🎯 MVP

**Goal**: Admin puede crear, listar, ver detalle, editar y eliminar puntos de retiro via back office. La creación valida que la sede exista en el tenant y esté activa. El delete requiere inactivación previa.

**Independent Test**: Boot app, obtener JWT con rol `administrador`, luego:
1. `POST /admin/puntos-retiro` → crea punto en sede activa
2. `GET /admin/puntos-retiro` → aparece en listado
3. `GET /admin/puntos-retiro/:id` → detalle correcto
4. `PATCH /admin/puntos-retiro/:id` → cambio reflejado
5. `DELETE /admin/puntos-retiro/:id` → falla con PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR (delete completo requiere US3)

### Implementation for User Story 1

- [ ] T008 [US1] Create `src/modules/puntos-retiro/puntos-retiro.service.ts` extending `BaseCrudTenantService<PuntoRetiro>`:
  - Constructor: `@InjectRepository(PuntoRetiro) private puntoRetiroRepo`, `private sedesService: SedesService`, llama `super(puntoRetiroRepo)`
  - `list(query: QueryPuntoRetiroDto)` — llama `super.list()` con searchColumns ['nombre'], filterAllowed ['activo', 'sede_id'], sortAllowed ['nombre', 'orden_visualizacion', 'created_at'], filters construidos de query.activo y query.sede_id, strictTenant: true
  - `findOne(id: string)` — llama `this.findById(id, { strictTenant: true })`, lanza PUNTO_RETIRO_NOT_FOUND si no existe
  - `create(dto: CreatePuntoRetiroDto)` — llama `sedesService.findOne(dto.sede_id)` (lanza SEDE_NOT_FOUND si no existe), si `!sede.activa` lanza SEDE_INACTIVA (409), llama `assertNombreUnico(dto.nombre, dto.sede_id)`, luego `super.create(dto, { strictTenant: true })`
  - `update(id, dto: UpdatePuntoRetiroDto)` — findOne, si dto.nombre presente llama `assertNombreUnico(dto.nombre, punto.sede_id, id)`, luego `super.update(id, dto, { strictTenant: true })`
  - `activar(id)` — findOne, valida `activo === false` (PUNTO_RETIRO_YA_ACTIVO 409), activo=true, `puntoRetiroRepo.save()`
  - `inactivar(id)` — findOne, valida `activo === true` (PUNTO_RETIRO_YA_INACTIVO 409), activo=false, `puntoRetiroRepo.save()`
  - `remove(id)` — findOne, valida `activo === false` (PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR 409), `super.softDelete(id, { strictTenant: true })`
  - `listPublic(sedeId: string)` — QB propio: `applyTenantScopeQb(qb, 'p', { strictTenant: true })`, andWhere activo=true, andWhere sede_id=sedeId, orderBy orden_visualizacion ASC NULLS LAST, addOrderBy nombre ASC, getMany()
  - Private `assertNombreUnico(nombre, sedeId, excludeId?)` — QB con LOWER(p.nombre)=LOWER(:nombre) AND p.tenant_id=:tenantId AND p.sede_id=:sedeId AND deleted_at IS NULL [AND id != excludeId], lanza PUNTO_RETIRO_NOMBRE_DUPLICADO si existe

- [ ] T009 [US1] Create `src/modules/puntos-retiro/puntos-retiro.controller.ts` con prefix `/admin/puntos-retiro`, `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel clase, inyecta `PuntosRetiroService`, `AuditService`, `PinoLogger`:
  - `GET /` — `@Roles('administrador','supervisor')`, llama `svc.list(query)`, retorna `page(items, query.page, query.limit, total)`
  - `GET /:id` — `@Roles('administrador','supervisor')`, llama `svc.findOne(id)`, retorna `ok(punto)`
  - `POST /` — `@Roles('administrador')`, `@HttpCode(201)`, llama `svc.create(dto)`, audita `punto_retiro.created`, retorna `ok(punto)`
  - `PATCH /:id` — `@Roles('administrador')`, llama `svc.update(id, dto)`, audita `punto_retiro.updated`, retorna `ok(punto)`
  - `DELETE /:id` — `@Roles('administrador')`, llama `svc.remove(id)`, audita `punto_retiro.deleted`, retorna `ok({ id })`
  - Nota: PATCH activar/inactivar se agregan en T014 (US3)

- [ ] T010 [US1] Create stub `src/modules/puntos-retiro/public-puntos-retiro.controller.ts` — controlador vacío con `@Controller('public/puntos-retiro')` para que el módulo compile. Se completa en T013 (US2).

- [ ] T011 [US1] Create `src/modules/puntos-retiro/puntos-retiro.module.ts` — imports: `TypeOrmModule.forFeature([PuntoRetiro])`, `SedesModule`, `AuditModule`; providers: `[PuntosRetiroService]`; controllers: `[PuntosRetiroController, PublicPuntosRetiroController]`; exports: `[PuntosRetiroService]`

- [ ] T012 [US1] Add `PuntosRetiroModule` to the imports array in `src/app.module.ts`

**Checkpoint**: `npm run start:dev` arranca sin errores. Endpoints admin CRUD responden correctamente. Nombre duplicado en misma sede retorna 409. Delete de punto activo retorna 409.

---

## Phase 4: User Story 2 — Cliente selecciona punto de retiro en portal público (Priority: P2)

**Goal**: GET /public/puntos-retiro?sede_id=:id devuelve solo puntos activos de esa sede, ordenados por orden_visualizacion ASC NULLS LAST, desempate por nombre ASC. Requiere x-tenant-key header.

**Independent Test**: `curl "http://localhost:3000/public/puntos-retiro?sede_id=$ID" -H "x-tenant-key: rochester"` → solo activos en orden correcto. Sin header → 400 TENANT_REQUIRED. Sin sede_id → 400 validation error.

### Implementation for User Story 2

- [ ] T013 [US2] Implement full `src/modules/puntos-retiro/public-puntos-retiro.controller.ts` (reemplaza stub de T010): prefix `/public/puntos-retiro`, SIN JwtAuthGuard. `GET /` con `@Query() query: PublicQueryPuntoRetiroDto` donde `sede_id` es `@IsUUID @IsNotEmpty` (sin @IsOptional). Llama `svc.listPublic(query.sede_id)`, retorna `ok(puntos)`. Crear clase `PublicQueryPuntoRetiroDto` inline o en el mismo archivo con `sede_id` obligatorio.

**Checkpoint**: Endpoint público retorna solo activos en orden correcto. Sin x-tenant-key → 400 TENANT_REQUIRED.

---

## Phase 5: User Story 3 — Administrador activa o inactiva un punto de retiro (Priority: P3)

**Goal**: Admin puede cambiar estado activo/inactivo. Activar falla si ya activo; inactivar falla si ya inactivo.

**Independent Test**:
1. Crear punto (activo=true por defecto)
2. PATCH /admin/puntos-retiro/:id/inactivar → activo=false
3. PATCH /admin/puntos-retiro/:id/inactivar de nuevo → 409 PUNTO_RETIRO_YA_INACTIVO
4. PATCH /admin/puntos-retiro/:id/activar → activo=true
5. PATCH /admin/puntos-retiro/:id/activar de nuevo → 409 PUNTO_RETIRO_YA_ACTIVO

### Implementation for User Story 3

- [ ] T014 [US3] Add `PATCH /:id/activar` and `PATCH /:id/inactivar` endpoints to `src/modules/puntos-retiro/puntos-retiro.controller.ts`:
  - `PATCH /:id/activar` — `@Roles('administrador')`, llama `svc.activar(id)`, audita `punto_retiro.activated`, retorna `ok(punto)`
  - `PATCH /:id/inactivar` — `@Roles('administrador')`, llama `svc.inactivar(id)`, audita `punto_retiro.deactivated`, retorna `ok(punto)`
  - Los métodos `activar()` e `inactivar()` ya están implementados en T008. Esta tarea solo agrega los route handlers.

**Checkpoint**: Ciclo completo funciona — crear → inactivar → eliminar. Idempotencia activar/inactivar (doble llamada retorna 409).

---

## Phase 6: User Story 4 — Administrador elimina un punto de retiro fuera de uso (Priority: P4)

**Goal**: Admin puede eliminar lógicamente un punto inactivo. Eliminar uno activo retorna error.

**Independent Test**:
1. Crear punto
2. Intentar DELETE → 409 PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR
3. PATCH /inactivar
4. DELETE → 200, punto desaparece de listados

### Implementation for User Story 4

> El servicio (`remove()`, T008) y el endpoint (`DELETE /:id`, T009) ya están implementados. Esta fase valida que el ciclo completo funciona correctamente.

- [ ] T015 [US4] Verify full delete lifecycle using quickstart.md ST-05: inactivar punto → eliminar → verificar que no aparece en GET /admin/puntos-retiro ni en GET /public/puntos-retiro. Si hay bugs, corregirlos en `puntos-retiro.service.ts`.

**Checkpoint**: Ciclo de vida completo validado — crear → listar → editar → inactivar → eliminar.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validación final, verificación de audit trail y tenant isolation.

- [ ] T016 [P] Verify all 5 audit actions write to `audit_logs` table (requires running app): punto_retiro.created, punto_retiro.updated, punto_retiro.activated, punto_retiro.deactivated, punto_retiro.deleted. Verificar via query SQL en `audit_logs`.
- [ ] T017 [P] Verify tenant isolation (requires running app): intentar GET /admin/puntos-retiro/:id de un punto de otro tenant (usando JWT de otro tenant) → debe retornar PUNTO_RETIRO_NOT_FOUND.
- [ ] T018 Run all quickstart.md smoke tests (ST-01 a ST-07) y confirmar respuestas esperadas.
- [ ] T019 [P] Verify `npm run build` compiles without TypeScript errors.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar inmediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA todas las user stories.
  - T002 → T003 → T004 (secuencial: entity → generate → edit)
  - T005, T006, T007 paralelos entre sí (después de T001)
- **User Story 1 (Phase 3)**: Depende de TODO Phase 2
  - T008 → T009 → T010 → T011 → T012 (secuencial: service → controller → public stub → module → AppModule)
- **User Story 2 (Phase 4)**: Depende de Phase 3 (usa PuntosRetiroService.listPublic() ya implementado)
  - T013 (reemplaza stub de T010)
- **User Story 3 (Phase 5)**: Depende de Phase 3 (agrega rutas al controller existente)
  - T014 (agrega endpoints a puntos-retiro.controller.ts)
- **User Story 4 (Phase 6)**: Depende de Phase 3 y 5 (servicio y controller completos)
  - T015 (validación, no new code)
- **Polish (Phase 7)**: Depende de todas las user stories completadas

### Parallel Opportunities

```bash
# Phase 1 — tarea única:
Task: "T001 Add error codes"

# Phase 2 — después de T002+T003+T004 se pueden paralelizar los DTOs:
Task: "T005 CreatePuntoRetiroDto"
Task: "T006 UpdatePuntoRetiroDto"
Task: "T007 QueryPuntoRetiroDto"

# Phase 7 — run together:
Task: "T016 Verify audit logs"
Task: "T017 Verify tenant isolation"
Task: "T019 Verify npm run build"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001)
2. Completar Phase 2: Foundational (T002→T003→T004, T005+T006+T007)
3. Completar Phase 3: User Story 1 (T008→T009→T010→T011→T012)
4. **STOP AND VALIDATE**: Boot app, ejecutar smoke tests ST-01 a ST-04 de quickstart.md
5. Deploy si está listo — back office CRUD para puntos de retiro operativo

### Incremental Delivery

1. Setup + Foundational → DB table exists, DTOs ready
2. US1 → Admin puede gestionar puntos de retiro (MVP back office)
3. US2 → Portal público puede mostrar puntos por sede
4. US3 → Ciclo de vida activo/inactivo completo
5. US4 → Validado el ciclo de eliminación lógica

---

## Notes

- `[P]` tasks = different files, no blocking dependencies between them
- T008 implementa TODOS los métodos del servicio en una sola pasada (incluyendo activar/inactivar y listPublic)
- T014 solo agrega los route handlers del controller (la lógica del servicio ya existe desde T008)
- T015 es validación pura — si encuentra bugs, corregir en los archivos del servicio o controller
- Los audits van en el **controller**, no en el servicio (el controller tiene acceso a `@Req()` para requestId/method/url)
- El endpoint público usa NULLS LAST — siempre via QB propio, no super.list()
- `UpdatePuntoRetiroDto` NO incluye `sede_id` — declarar campos explícitamente (sin PartialType)
- `SedesModule` debe estar ya importado en AppModule antes de comenzar este módulo
