---
description: "Task list for categorias-menu module — Type A CRUD tenant-safe"
---

# Tasks: Módulo Categorías de Menú

**Input**: Design documents from `specs/003-categorias-menu-crud/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-endpoints.md ✅, quickstart.md ✅

**Tests**: No se incluyen tareas de tests (no solicitadas en la spec).

**Organization**: Las tareas están agrupadas por historia de usuario para habilitar implementación y prueba independiente de cada historia. Las fases 1 y 2 son prerequisitos bloqueantes.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1–US5 del spec.md)

---

## Phase 1: Setup

**Purpose**: Preparar la infraestructura compartida del módulo antes de cualquier historia de usuario.

- [x] T001 Agregar 5 códigos de error en `src/common/errors/error-codes.ts`: `CATEGORIA_MENU_NOT_FOUND`, `CATEGORIA_MENU_NOMBRE_DUPLICADO`, `CATEGORIA_MENU_YA_ACTIVA`, `CATEGORIA_MENU_YA_INACTIVA`, `CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`
- [x] T002 Crear estructura de directorios `src/modules/categorias-menu/entities/` y `src/modules/categorias-menu/dto/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entidad, migración, DTOs y servicio base que TODAS las historias de usuario requieren.

**⚠️ CRÍTICO**: Ninguna historia de usuario puede implementarse hasta que esta fase esté completa.

- [x] T003 [P] Crear entidad `CategoriaMenu` en `src/modules/categorias-menu/entities/categoria-menu.entity.ts` — campos: `nombre varchar(100)`, `descripcion varchar(300) nullable`, `activa boolean default true`, `orden_visualizacion int nullable`; `@Index('UQ_categorias_menu_tenant_nombre', ['tenant_id','nombre'], {unique:true})`; extiende `BaseEntity`; `@DeleteDateColumn` para soft delete
- [x] T004 [P] Crear `CreateCategoriaMenuDto` en `src/modules/categorias-menu/dto/create-categoria-menu.dto.ts` — `nombre` (`@IsString @IsNotEmpty @MaxLength(100)`), `descripcion` (`@IsOptional @IsString @MaxLength(300)`), `orden_visualizacion` (`@IsOptional @Type(()=>Number) @IsInt @Min(1)`)
- [x] T005 [P] Crear `UpdateCategoriaMenuDto` en `src/modules/categorias-menu/dto/update-categoria-menu.dto.ts` — mismos campos que Create pero todos con `@IsOptional`; sin PartialType (declarar explícitamente)
- [x] T006 [P] Crear `QueryCategoriaMenuDto` en `src/modules/categorias-menu/dto/query-categoria-menu.dto.ts` — extiende `PageQueryDto`; agrega `q` (`@IsOptional @IsString`), `activa` (`@IsOptional @Transform @IsBoolean`), `sortBy` (`@IsOptional @IsString`), `sortOrder` (`@IsOptional @IsIn(['ASC','DESC'])`)
- [x] T007 Generar migración con `npm run db:migration:generate -- migrations/CreateCategoriasMenu` y editar el archivo generado: reemplazar el índice único auto-generado por `CREATE UNIQUE INDEX "UQ_categorias_menu_tenant_nombre" ON "categorias_menu" ("tenant_id","nombre") WHERE "deleted_at" IS NULL`; agregar `DROP INDEX IF EXISTS "UQ_categorias_menu_tenant_nombre"` en `down()`; verificar que la tabla y columnas sean correctas (depende de T003)
- [x] T008 Implementar la base de `CategoriasMenuService` en `src/modules/categorias-menu/categorias-menu.service.ts` — clase `CategoriasMenuService extends BaseCrudTenantService<CategoriaMenu>`; constructor con `@InjectRepository(CategoriaMenu) private readonly categoriaMenuRepo`; método privado `assertNombreUnico(nombre, excludeId?)` con QB LOWER+tenant+deleted_at; método `findOne(id)` con `findById` + throw `CATEGORIA_MENU_NOT_FOUND` (depende de T003, T001)
- [x] T009 Crear `CategoriasMenuModule` en `src/modules/categorias-menu/categorias-menu.module.ts` — `TypeOrmModule.forFeature([CategoriaMenu])`, imports: `[AuditModule]`, providers: `[CategoriasMenuService]`, exports: `[CategoriasMenuService]`; luego importar `CategoriasMenuModule` en `src/app.module.ts` (depende de T008)

**Checkpoint**: Entidad, DTOs, servicio base y módulo listos. Se puede ejecutar `npm run start:dev` para verificar que el módulo compila sin errores.

---

## Phase 3: User Story 1 + User Story 5 — Admin CRUD core (Priority: P1) 🎯 MVP

**US1 Goal**: El administrador puede crear y editar categorías desde el back office.
**US5 Goal**: Administrador y supervisor pueden listar y ver el detalle de categorías.

**Independent Test**: `POST /admin/categorias-menu` crea una categoría y `GET /admin/categorias-menu` la devuelve paginada. `GET /admin/categorias-menu/:id` devuelve el detalle. Nombre duplicado devuelve 409. Supervisor puede listar pero no crear.

### Implementación US1 + US5

- [x] T010 [US1] [US5] Agregar método `list(query: QueryCategoriaMenuDto)` a `src/modules/categorias-menu/categorias-menu.service.ts` — llama `super.list()` con `searchColumns: ['nombre']`, `sortAllowed: ['nombre','orden_visualizacion','created_at']`, `sortFallback: {by:'nombre',order:'ASC'}`, `filterAllowed: ['activa']`, `strictTenant: true`
- [x] T011 [US1] Agregar métodos `create(dto)` y `update(id, dto)` a `src/modules/categorias-menu/categorias-menu.service.ts` — `create`: llama `assertNombreUnico` → `super.create(dto, {strictTenant:true})`; `update`: llama `findOne` → si `dto.nombre` viene llama `assertNombreUnico(nombre, id)` → `super.update(id, dto, {strictTenant:true})`
- [x] T012 [US1] [US5] Implementar `CategoriasMenuController` en `src/modules/categorias-menu/categorias-menu.controller.ts` — `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel clase; `@Controller('admin/categorias-menu')`; métodos: `GET /` con `@Roles('administrador','supervisor')` retorna `page(items,...)`, `GET /:id` con `@Roles('administrador','supervisor')` retorna `ok(cat)`, `POST /` con `@Roles('administrador')` `@HttpCode(201)` llama `svc.create` + `auditLogPayload('categoria_menu.created')` + `audit.write` + retorna `ok(cat)`, `PATCH /:id` con `@Roles('administrador')` llama `svc.update` + audit `categoria_menu.updated` + retorna `ok(cat)` (depende de T009, T010, T011)

**Checkpoint**: `POST /admin/categorias-menu`, `GET /admin/categorias-menu`, `GET /admin/categorias-menu/:id`, `PATCH /admin/categorias-menu/:id` funcionan. Smoke tests T1–T3 del quickstart.md pasan.

---

## Phase 4: User Story 2 — Ciclo de vida: activar e inactivar (Priority: P2)

**Goal**: El administrador puede activar o inactivar una categoría para controlar qué categorías están disponibles para nuevos menús y cuáles aparecen en el portal público.

**Independent Test**: `PATCH /admin/categorias-menu/:id/inactivar` cambia `activa` a `false`. Intentar inactivar una ya inactiva devuelve `CATEGORIA_MENU_YA_INACTIVA`. `PATCH /admin/categorias-menu/:id/activar` revierte el estado.

### Implementación US2

- [x] T013 [US2] Agregar métodos `activar(id)` e `inactivar(id)` a `src/modules/categorias-menu/categorias-menu.service.ts` — `activar`: `findOne` → si `activa===true` throw `CATEGORIA_MENU_YA_ACTIVA 409` → `cat.activa=true` → `repo.save(cat)`; `inactivar`: `findOne` → si `!activa` throw `CATEGORIA_MENU_YA_INACTIVA 409` → `cat.activa=false` → `repo.save(cat)` con comentario MVP sobre menús base
- [x] T014 [US2] Agregar `PATCH /:id/activar` y `PATCH /:id/inactivar` a `src/modules/categorias-menu/categorias-menu.controller.ts` — ambos con `@Roles('administrador')`; llaman `svc.activar(id)` / `svc.inactivar(id)` respectivamente; audit `categoria_menu.activated` / `categoria_menu.deactivated`; retornan `ok(cat)` (depende de T013)

**Checkpoint**: Smoke tests T4–T5 del quickstart.md pasan. `activa` cambia correctamente en ambas direcciones.

---

## Phase 5: User Story 4 — Portal público (Priority: P2)

**Goal**: El portal público puede obtener todas las categorías activas del tenant, ordenadas para mostrar al cliente final, sin autenticación.

**Independent Test**: `GET /public/categorias-menu` con header `x-tenant-key` devuelve solo categorías activas ordenadas por `orden_visualizacion ASC NULLS LAST`, desempate por `nombre ASC`. Sin header devuelve error `TENANT_REQUIRED`.

### Implementación US4

- [x] T015 [US4] Agregar método `listPublic()` a `src/modules/categorias-menu/categorias-menu.service.ts` — QB propio: `createQueryBuilder('cm')` + `applyTenantScopeQb(qb,'cm',{strictTenant:true})` + `andWhere('cm.activa = true')` + `.orderBy('cm.orden_visualizacion','ASC','NULLS LAST')` + `.addOrderBy('cm.nombre','ASC')` + `.getMany()`
- [x] T016 [US4] Crear `PublicCategoriasMenuController` en `src/modules/categorias-menu/public-categorias-menu.controller.ts` — `@Controller('public/categorias-menu')` SIN `JwtAuthGuard`; `@Get()` llama `svc.listPublic()` retorna `ok(categorias)`; registrar en `CategoriasMenuModule.controllers` junto al admin controller (depende de T015)

**Checkpoint**: Smoke tests T7–T8 del quickstart.md pasan. Categorías inactivas NO aparecen. Tenant incorrecto devuelve error.

---

## Phase 6: User Story 3 — Soft delete (Priority: P3)

**Goal**: El administrador puede eliminar lógicamente una categoría inactiva para limpiar el catálogo sin perder trazabilidad histórica.

**Independent Test**: `DELETE /admin/categorias-menu/:id` sobre categoría activa devuelve `CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`. Inactivar primero y luego eliminar funciona correctamente.

### Implementación US3

- [x] T017 [US3] Agregar método `remove(id)` a `src/modules/categorias-menu/categorias-menu.service.ts` — `findOne` → si `activa===true` throw `CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR 409` → `super.softDelete(id, {strictTenant:true})`
- [x] T018 [US3] Agregar `DELETE /:id` a `src/modules/categorias-menu/categorias-menu.controller.ts` — `@Roles('administrador')`; llama `svc.remove(id)` → audit `categoria_menu.deleted`; retorna `ok({id})` (depende de T017)

**Checkpoint**: Smoke test T6 del quickstart.md pasa. El registro queda con `deleted_at` seteado y no aparece en listados.

---

## Phase 7: Polish & Verificación Final

**Purpose**: Validar el módulo completo antes de considerarlo entregado.

- [x] T019 Ejecutar `npm run build` y verificar que el proyecto compila sin errores TypeScript
- [ ] T020 Ejecutar todos los smoke tests del `specs/003-categorias-menu-crud/quickstart.md` (T1–T9) contra el servidor en local y confirmar que todos pasan

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Setup — BLOQUEA todas las historias de usuario
- **US1+US5 (Phase 3)**: Depende de Phase 2 completa
- **US2 (Phase 4)**: Depende de Phase 2 completa (puede ejecutarse en paralelo con Phase 3 si se separa el trabajo en el service)
- **US4 (Phase 5)**: Depende de Phase 2 completa (puede ejecutarse en paralelo con Phase 3/4)
- **US3 (Phase 6)**: Depende de Phase 4 completa (soft delete requiere que inactivar exista)
- **Polish (Phase 7)**: Depende de todas las historias completas

### User Story Dependencies

- **US1+US5 (P1)**: Puede comenzar después de Phase 2 — core MVP
- **US2 (P2)**: Puede comenzar después de Phase 2 — servicio independiente del controller US1
- **US4 (P2)**: Puede comenzar después de Phase 2 — controller completamente independiente
- **US3 (P3)**: Requiere US2 completa (necesita `inactivar` para el flujo de prueba correcto)

### Within Each Phase

- DTOs y entidad (T003–T006) pueden ejecutarse en paralelo
- Migración (T007) espera la entidad (T003)
- Service base (T008) espera entidad + ErrorCodes (T003, T001)
- Module (T009) espera service base (T008)
- Los métodos del service en cada fase pueden agregarse antes que los endpoints del controller correspondiente

---

## Parallel Opportunities

```
Phase 1:
  T001 ──┐
  T002 ──┘ (ambos sin dependencias)

Phase 2:
  T003 ──┐
  T004 ──┤ (en paralelo — archivos distintos)
  T005 ──┤
  T006 ──┘
  T007 ── (espera T003)
  T008 ── (espera T001, T003)
  T009 ── (espera T008)

Después de Phase 2:
  Phase 3 (T010, T011, T012) ──┐
  Phase 5 (T015, T016)        ──┤ (pueden comenzar en paralelo)
  Phase 4 (T013, T014)        ──┘
```

---

## Implementation Strategy

### MVP First (US1 + US5 únicamente)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRÍTICO — bloquea todo)
3. Completar Phase 3: US1 + US5 (crear, editar, listar, detalle)
4. **PARAR Y VALIDAR**: Probar los smoke tests T1–T3 del quickstart.md
5. El módulo ya entrega valor — el administrador puede gestionar categorías

### Entrega Incremental

1. Setup + Foundational → Base lista
2. Phase 3 (US1+US5) → MVP: admin puede crear y consultar categorías ✅
3. Phase 4 (US2) → Ciclo de vida: activar/inactivar ✅
4. Phase 5 (US4) → Portal público visible para clientes ✅
5. Phase 6 (US3) → Limpieza de catálogo: soft delete ✅
6. Phase 7 → Verificación final y entrega

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes en esa fase
- `[Story]` mapea la tarea a su historia de usuario para trazabilidad
- El campo en la entidad es `activa` (femenino) — NO confundir con `activo` de puntos-retiro
- El endpoint público NO tiene query params — solo `x-tenant-key` header
- No usar `throw new Error()` — solo `AppError` con `ErrorCodes`
- No usar `repo.find()` sin scope de tenant
- Todas las respuestas via `ok()` y `page()` de `api-response.ts`
- Las operaciones mutantes del controller admin requieren `@Req() req` para la auditoría
- `migrationsRun: true` ya configurado — no tocar la config de DB
