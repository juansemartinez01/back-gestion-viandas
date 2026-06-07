# Tasks: Módulo Menús Base

**Input**: Design documents from `specs/008-menus-base-crud/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story (US1 P1, US2 P1, US3 P2, US4 P3, US5 P2) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or no cross-dependency with other [P] tasks)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Inicializar infraestructura compartida antes de cualquier user story

- [X] T001 Add 6 MENU_BASE_* error codes to `src/common/errors/error-codes.ts`: MENU_BASE_NOT_FOUND, MENU_BASE_NOMBRE_DUPLICADO, MENU_BASE_YA_ACTIVO, MENU_BASE_YA_INACTIVO, MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR, MENU_BASE_RELACION_INVALIDA

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entidad, DTOs, module skeleton y migración — DEBEN completarse antes de cualquier user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create `src/modules/menus-base/entities/menu-base.entity.ts` — entidad MenuBase con todos los campos escalares, 3 relaciones @ManyToMany/@JoinTable (categorias/etiquetas/alergenos), @Index UQ parcial por tenant_id+nombre, extiende BaseEntity. Ver plan.md Fase 0.
- [X] T003 [P] Create `src/modules/menus-base/dto/create-menu-base.dto.ts` — todos los campos de CreateMenuBaseDto con validadores: nombre (@IsString @IsNotEmpty @MaxLength(200)), campos opcionales escalares, categoria_ids/etiqueta_ids/alergeno_ids (@IsOptional @IsArray @IsUUID). Ver data-model.md.
- [X] T004 [P] Create `src/modules/menus-base/dto/update-menu-base.dto.ts` — mismos campos que Create pero todos @IsOptional, declarados explícitamente (sin PartialType). Ver data-model.md.
- [X] T005 [P] Create `src/modules/menus-base/dto/query-menu-base.dto.ts` — extiende PageQueryDto, agrega q, activo (@Transform bool), categoria_id/etiqueta_id/alergeno_id (@IsUUID), sortBy (@IsIn(['nombre','created_at'])), sortOrder (@IsIn(['ASC','DESC'])). Ver data-model.md.
- [X] T006 Create `src/modules/menus-base/menus-base.service.ts` — skeleton del service: clase MenusBaseService extiende BaseCrudTenantService<MenuBase>, constructor con @InjectRepository para MenuBase/CategoriaMenu/EtiquetaMenu/Alergeno e inyección de AuditService. Implementar findOne(id): QB con tenant scope, deleted_at IS NULL, leftJoinAndSelect para las 3 relaciones, lanza AppError MENU_BASE_NOT_FOUND si no existe. Ver plan.md Fase 2.
- [X] T007 Create `src/modules/menus-base/menus-base.module.ts` — TypeOrmModule.forFeature([MenuBase, CategoriaMenu, EtiquetaMenu, Alergeno]), imports AuditModule, providers MenusBaseService, controllers [MenusBaseController, PublicMenusBaseController], exports MenusBaseService. Ver data-model.md sección Módulo.
- [X] T008 Register MenusBaseModule in `src/app.module.ts` — import MenusBaseModule en el array imports del AppModule.
- [X] T009 Generate migration: run `npm run db:migration:generate -- migrations/CreateMenusBase`. Verificar que genera tabla menus_base + 3 tablas intermedias + FKs. Editar manualmente el índice único generado para convertirlo a parcial: `CREATE UNIQUE INDEX "UQ_menus_base_tenant_nombre" ON "menus_base" ("tenant_id","nombre") WHERE "deleted_at" IS NULL`. Agregar `DROP INDEX IF EXISTS "UQ_menus_base_tenant_nombre"` en down(). Ver plan.md Fase 5.

**Checkpoint**: Entidad registrada, DTOs listos, módulo compilable, migración lista para aplicar.

---

## Phase 3: User Story 1 — Administrador crea y edita menús base (Priority: P1) 🎯 MVP

**Goal**: POST /admin/menus-base y PATCH /admin/menus-base/:id funcionales con validación completa de relaciones y nombre único.

**Independent Test**: `POST /admin/menus-base` con categoría/etiqueta/alérgeno válidos del tenant → menú creado con relaciones. Mismo nombre → 409. Categoría de otro tenant → 422. `PATCH /:id` con categoria_ids:[] → categorías reemplazadas a array vacío.

### Implementation for User Story 1

- [X] T010 [US1] Implement `assertNombreUnico(nombre, excludeId?)` private method in `src/modules/menus-base/menus-base.service.ts` — QB con LOWER(nombre)=LOWER(:nombre), tenant_id, deleted_at IS NULL, excluye excludeId si presente, lanza AppError MENU_BASE_NOMBRE_DUPLICADO 409. Ver plan.md sección assertNombreUnico.
- [X] T011 [P] [US1] Implement `assertCategoriasValidas(ids)` private method in `src/modules/menus-base/menus-base.service.ts` — para cada id: QB alias 'cat', filtra cat.tenant_id=tenantId AND cat.deleted_at IS NULL AND cat.activa=true (femenino), lanza AppError MENU_BASE_RELACION_INVALIDA 422 si no existe. Retorna CategoriaMenu[]. Ver research.md R-003.
- [X] T012 [P] [US1] Implement `assertEtiquetasValidas(ids)` private method in `src/modules/menus-base/menus-base.service.ts` — para cada id: QB alias 'et', filtra et.tenant_id=tenantId AND et.deleted_at IS NULL AND et.activa=true (femenino), lanza AppError MENU_BASE_RELACION_INVALIDA 422 si no existe. Retorna EtiquetaMenu[]. Ver research.md R-003.
- [X] T013 [P] [US1] Implement `assertAlergenosValidos(ids)` private method in `src/modules/menus-base/menus-base.service.ts` — para cada id: QB alias 'al', filtra al.tenant_id=tenantId AND al.deleted_at IS NULL AND al.activo=true (masculino), lanza AppError MENU_BASE_RELACION_INVALIDA 422 si no existe. Retorna Alergeno[]. Ver research.md R-003.
- [X] T014 [US1] Implement `create(dto: CreateMenuBaseDto)` in `src/modules/menus-base/menus-base.service.ts` — (1) assertNombreUnico(dto.nombre), (2) assertCategoriasValidas/assertEtiquetasValidas/assertAlergenosValidos si los arrays vienen y tienen elementos, (3) menuBaseRepo.create con campos escalares + activo:true + relaciones, (4) menuBaseRepo.save, (5) auditService.write('menu_base.created', id), (6) retornar findOne(saved.id). Ver plan.md Fase 2.
- [X] T015 [US1] Implement `update(id, dto: UpdateMenuBaseDto)` in `src/modules/menus-base/menus-base.service.ts` — (1) findOne(id), (2) si dto.nombre: assertNombreUnico(dto.nombre, id), (3) actualizar campos escalares si vienen (if dto.x !== undefined), (4) si dto.categoria_ids !== undefined: menu.categorias = [...] usando assertCategoriasValidas o [] si vacío, igual para etiqueta_ids y alergeno_ids, (5) menuBaseRepo.save, (6) auditService.write('menu_base.updated', id), (7) retornar findOne(id). Ver plan.md Fase 2 y research.md R-004.
- [X] T016 [US1] Create `src/modules/menus-base/menus-base.controller.ts` with POST /admin/menus-base (Roles: administrador) calling create() + ok(), and PATCH /admin/menus-base/:id (Roles: administrador) calling update() + ok(). Usar @Controller('admin/menus-base') @UseGuards(JwtAuthGuard, RolesGuard). Ver plan.md Fase 3.

**Checkpoint**: POST y PATCH funcionales, validaciones de nombre y relaciones operando correctamente.

---

## Phase 4: User Story 2 — Administrador y supervisor listan y consultan menús base (Priority: P1)

**Goal**: GET /admin/menus-base (paginado, con filtros) y GET /admin/menus-base/:id (con relaciones) funcionales para roles administrador y supervisor.

**Independent Test**: `GET /admin/menus-base?q=milane&activo=true` → solo activos con nombre matching. `GET /admin/menus-base?categoria_id=X` → solo menús de esa categoría. `GET /admin/menus-base/:id` → objeto completo con categorias/etiquetas/alergenos.

### Implementation for User Story 2

- [X] T017 [US2] Implement `list(query: QueryMenuBaseDto)` in `src/modules/menus-base/menus-base.service.ts` — QB alias 'mb': (1) base: tenant_id, deleted_at IS NULL; (2) leftJoinAndSelect para las 3 relaciones; (3) ILIKE en nombre si q; (4) activo si activo !== undefined; (5) innerJoin('mb.categorias','catf') si categoria_id, igual para etiqueta_id y alergeno_id; (6) orderBy mb.sortBy sortOrder; (7) skip/take para paginación; (8) getManyAndCount(), retornar {items, total, page, limit}. Ver plan.md Fase 2 y research.md R-002.
- [X] T018 [US2] Add GET /admin/menus-base and GET /admin/menus-base/:id handlers to `src/modules/menus-base/menus-base.controller.ts` — GET / con Roles('administrador','supervisor') llama list(query) y retorna page(result); GET /:id con Roles('administrador','supervisor') llama findOne(id) y retorna ok(menu). Ver plan.md Fase 3.

**Checkpoint**: Listado con todos los filtros (q, activo, categoria_id, etiqueta_id, alergeno_id, sortBy, sortOrder, page, limit) y detalle por ID funcionales.

---

## Phase 5: User Story 3 — Ciclo de vida: activar e inactivar menús base (Priority: P2)

**Goal**: PATCH /admin/menus-base/:id/activar y /inactivar funcionales con guards de estado.

**Independent Test**: Inactivar un menú activo → activo:false. Inactivar uno ya inactivo → 409 MENU_BASE_YA_INACTIVO. Activar uno ya activo → 409 MENU_BASE_YA_ACTIVO.

### Implementation for User Story 3

- [X] T019 [P] [US3] Implement `activar(id)` in `src/modules/menus-base/menus-base.service.ts` — findOne(id) → if activo throw AppError MENU_BASE_YA_ACTIVO 409 → menu.activo=true → save → auditService.write('menu_base.activated', id) → return menu. Ver plan.md Fase 2.
- [X] T020 [P] [US3] Implement `inactivar(id)` in `src/modules/menus-base/menus-base.service.ts` — findOne(id) → if !activo throw AppError MENU_BASE_YA_INACTIVO 409 → menu.activo=false → save → auditService.write('menu_base.deactivated', id) → return menu. Ver plan.md Fase 2.
- [X] T021 [US3] Add PATCH /admin/menus-base/:id/activar and PATCH /admin/menus-base/:id/inactivar to `src/modules/menus-base/menus-base.controller.ts` — ambos con Roles('administrador'), llaman activar()/inactivar() y retornan ok(menu). Ver plan.md Fase 3.

**Checkpoint**: Ciclo activo/inactivo funcional con idempotency guards.

---

## Phase 6: User Story 4 — Eliminar lógicamente un menú base (Priority: P3)

**Goal**: DELETE /admin/menus-base/:id funcional, solo sobre menús inactivos.

**Independent Test**: DELETE sobre menú activo → 409 MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR. DELETE sobre menú inactivo → ok, ya no aparece en listados.

### Implementation for User Story 4

- [X] T022 [US4] Implement `remove(id)` in `src/modules/menus-base/menus-base.service.ts` — findOne(id) → if activo throw AppError MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR 409 → menuBaseRepo.softDelete(id) → auditService.write('menu_base.deleted', id). Ver plan.md Fase 2.
- [X] T023 [US4] Add DELETE /admin/menus-base/:id to `src/modules/menus-base/menus-base.controller.ts` — Roles('administrador'), llama remove(id), retorna ok(null). Ver plan.md Fase 3.

**Checkpoint**: Soft delete operando con guard activo→solo-inactivos. Menú eliminado no aparece en listados.

---

## Phase 7: User Story 5 — Portal público lista y consulta menús base activos (Priority: P2)

**Goal**: GET /public/menus-base y GET /public/menus-base/:id sin autenticación, solo menús activos, con tenant resuelto de x-tenant-key.

**Independent Test**: `GET /public/menus-base` con x-tenant-key válido → solo activos ordenados por nombre ASC con relaciones. `GET /public/menus-base/:id` sobre menú inactivo → 404 MENU_BASE_NOT_FOUND.

### Implementation for User Story 5

- [X] T024 [P] [US5] Implement `findOnePublic(id)` in `src/modules/menus-base/menus-base.service.ts` — QB con tenant scope, deleted_at IS NULL, activo=true, leftJoinAndSelect 3 relaciones, lanza AppError MENU_BASE_NOT_FOUND si no existe o inactivo. Ver plan.md Fase 2.
- [X] T025 [P] [US5] Implement `listPublic()` in `src/modules/menus-base/menus-base.service.ts` — QB con tenant scope, deleted_at IS NULL, activo=true, leftJoinAndSelect 3 relaciones, orderBy mb.nombre ASC, getMany(). Ver plan.md Fase 2.
- [X] T026 [US5] Create `src/modules/menus-base/public-menus-base.controller.ts` — @Controller('public/menus-base') SIN UseGuards ni JwtAuthGuard: GET / llama listPublic() + ok(menus); GET /:id llama findOnePublic(id) + ok(menu). Ver plan.md Fase 3.

**Checkpoint**: Portal público funcional, solo activos visibles, tenant scope aplicado, menús inactivos devuelven 404.

---

## Phase 8: Polish & Validación Final

**Purpose**: Migración aplicada, build limpio, smoke tests ejecutados

- [X] T027 Apply migration: run `npm run db:migration:run` and verify tables menus_base, menu_base_categorias, menu_base_etiquetas, menu_base_alergenos exist with correct columns and FKs. Verify partial unique index exists on menus_base(tenant_id, nombre) WHERE deleted_at IS NULL.
- [X] T028 Verify build: run `npm run build` and confirm zero TypeScript errors across all new files in src/modules/menus-base/.
- [ ] T029 Run smoke tests from `specs/008-menus-base-crud/quickstart.md` — PENDING: requires running server (requires running server + DB) — tests T1–T10: crear, duplicado, filtros, detalle, reemplazo de relaciones, ciclo de vida, delete, portal público, cross-tenant, RBAC. Marcar como pending si el servidor no está disponible.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (findOne en service skeleton requerido por create/update)
- **US2 (Phase 4)**: Depends on Phase 2. Puede implementarse en paralelo con US1.
- **US3 (Phase 5)**: Depends on Phase 2. Puede implementarse en paralelo con US1 y US2.
- **US4 (Phase 6)**: Depends on Phase 2. Puede implementarse en paralelo con US1–US3.
- **US5 (Phase 7)**: Depends on Phase 2. Puede implementarse en paralelo con US1–US4.
- **Polish (Phase 8)**: Depends on all user stories complete (T027 después de T002–T008, T028–T029 al final).

### User Story Dependencies

- **US1 (P1)**: Blocking para create/update — recomendado implementar primero.
- **US2 (P1)**: list/findOne independientes de US1 (comparten findOne del skeleton).
- **US3 (P2)**: activar/inactivar independientes — pueden implementarse luego de US2.
- **US4 (P3)**: remove independiente — el último método de escritura.
- **US5 (P2)**: public endpoints totalmente independientes de US1–US4.

### Within Each User Story

- Methods privados (assert*) → antes que create/update
- findOne → antes que todos los métodos que retornan entidad
- Service methods → antes que controller handlers

### Parallel Opportunities

- T003, T004, T005 (DTOs) pueden correr en paralelo
- T011, T012, T013 (assertCategoriasValidas, assertEtiquetasValidas, assertAlergenosValidos) pueden implementarse en paralelo
- T019, T020 (activar, inactivar) pueden implementarse en paralelo
- T024, T025 (findOnePublic, listPublic) pueden implementarse en paralelo
- US2, US3, US4, US5 pueden iniciarse en paralelo una vez completada Phase 2

---

## Parallel Example: Phase 2 (Foundational)

```
Parallel launch:
  T003 — Create create-menu-base.dto.ts
  T004 — Create update-menu-base.dto.ts
  T005 — Create query-menu-base.dto.ts

Sequential after T002:
  T006 — Service skeleton (needs entity)
  T007 — Module (needs service + controllers)
  T008 — AppModule registration (needs module)
  T009 — Migration (needs entity)
```

## Parallel Example: User Story 1

```
Sequential: T010 (assertNombreUnico)
Parallel:   T011 (assertCategoriasValidas)
            T012 (assertEtiquetasValidas)
            T013 (assertAlergenosValidos)
Sequential: T014 (create — needs all asserts)
            T015 (update — needs all asserts + create pattern)
            T016 (controller POST + PATCH)
```

---

## Implementation Strategy

### MVP First (US1 + US2 — P1 Stories)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T009)
3. Complete Phase 3: US1 (T010–T016) — crear y editar
4. Complete Phase 4: US2 (T017–T018) — listar y consultar
5. **STOP and VALIDATE**: API de creación/edición/listado funcional
6. Apply migration (T027) + verify build (T028)

### Incremental Delivery

1. Setup + Foundational → módulo compila y migración lista
2. US1 → create/update con relaciones M2M funcionando ✅
3. US2 → list/findOne con filtros funcionando ✅
4. US3 → activar/inactivar funcionando ✅
5. US4 → soft delete funcionando ✅
6. US5 → portal público funcionando ✅
7. Polish → migration aplicada, build limpio, smoke tests ✅

---

## Notes

- **activo vs activa**: `assertCategoriasValidas` y `assertEtiquetasValidas` filtran por `activa` (femenino); `assertAlergenosValidos` filtra por `activo` (masculino). Critical — leer research.md R-003 antes de implementar T011–T013.
- **No eager loading**: Las relaciones NUNCA se configuran con `eager: true` en la entidad. Solo se cargan explícitamente via `leftJoinAndSelect` donde se necesitan. Critical — leer research.md R-001.
- **INNER JOIN para filtros**: Cuando `categoria_id`/`etiqueta_id`/`alergeno_id` está presente en query, usar `innerJoin` (no `leftJoinAndSelect`) para el filtrado. El `leftJoinAndSelect` de carga siempre está presente independientemente. Leer research.md R-002.
- **Índice parcial en migración**: TypeORM genera un índice completo — editar manualmente para agregar `WHERE "deleted_at" IS NULL`.
- **No throw new Error()**: Todos los errores de negocio son `AppError` con código de `ErrorCodes`. PROHIBIDO `throw new Error()`.
- **No PartialType en UpdateMenuBaseDto**: Declarar todos los campos explícitamente con `@IsOptional()`.
