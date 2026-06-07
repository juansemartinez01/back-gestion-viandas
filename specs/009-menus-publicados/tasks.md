# Tasks: Menús Publicados

**Input**: Design documents from `specs/009-menus-publicados/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Tests**: No se solicitan tareas de tests automatizados en esta feature.

**Organization**: Tasks agrupadas por user story para habilitar implementación y validación independiente de cada historia.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede correr en paralelo (distintos archivos, sin dependencias incompletas)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1–US6)
- Todas las tareas incluyen ruta exacta de archivo

---

## Phase 1: Setup (Estructura del módulo)

**Purpose**: Crear la estructura de directorios del módulo vacía para que las tareas posteriores puedan trabajar en paralelo sobre archivos separados.

- [x] T001 Create module directory structure: `src/modules/menus-publicados/entities/`, `src/modules/menus-publicados/dto/`

---

## Phase 2: Foundational (Prereqs bloqueantes)

**Purpose**: Infraestructura compartida que DEBE completarse antes de implementar cualquier historia de usuario.

**⚠️ CRÍTICO**: Ninguna user story puede comenzar hasta que esta fase esté completa.

- [x] T002 Add 7 `MENU_PUBLICADO_*` error codes to `src/common/errors/error-codes.ts` (section `// menus-publicados`): `MENU_PUBLICADO_NOT_FOUND`, `MENU_PUBLICADO_TRANSICION_INVALIDA`, `MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS`, `MENU_PUBLICADO_PRECIO_INVALIDO`, `MENU_PUBLICADO_FECHA_LIMITE_INVALIDA`, `MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA`, `MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE`
- [x] T003 [P] Create enums `EstadoMenuPublicado` and `TipoSobreproduccion` and full `MenuPublicado` entity class (columns, M2M join table `menu_publicado_puntos_retiro`, `@ManyToOne` to `MenuBase` and `Sede`, two `@Index` decorators for `tenant_id+fecha_venta` and `tenant_id+sede_id+estado`) in `src/modules/menus-publicados/entities/menu-publicado.entity.ts`
- [x] T004 [P] Create `QueryMenuPublicadoDto` extending `PageQueryDto` with optional fields `fecha_venta (@IsDateString)`, `sede_id (@IsUUID)`, `estado (@IsEnum EstadoMenuPublicado)`, `menu_base_id (@IsUUID)` in `src/modules/menus-publicados/dto/query-menu-publicado.dto.ts`
- [x] T005 [P] Create `QueryMenusDisponiblesDto` with required `sede_id (@IsUUID @IsNotEmpty)` and optional `punto_retiro_id (@IsOptional @IsUUID)` in `src/modules/menus-publicados/dto/query-menus-disponibles.dto.ts`
- [x] T006 Create `MenusPublicadosService` class skeleton extending `BaseCrudTenantService<MenuPublicado>` with constructor injecting `@InjectRepository(MenuPublicado)`, `@InjectRepository(PuntoRetiro)`, `MenusBaseService`, `SedesService`; implement `findOne(id: string)` method using QB with LEFT JOIN to `menuBase` (with categorias/etiquetas/alergenos), `sede`, and `puntosRetiro`, scoped by `tenant_id` and `deleted_at IS NULL`; throw `AppError MENU_PUBLICADO_NOT_FOUND` if not found — in `src/modules/menus-publicados/menus-publicados.service.ts`
- [x] T007 Create `MenusPublicadosModule` with `TypeOrmModule.forFeature([MenuPublicado, MenuBase, Sede, PuntoRetiro])`, imports `[MenusBaseModule, SedesModule, PuntosRetiroModule, AuditModule]`, providers `[MenusPublicadosService]`, exports `[MenusPublicadosService]` — in `src/modules/menus-publicados/menus-publicados.module.ts`; add controllers array placeholder (leave empty until controllers are created)
- [x] T008 Register `MenusPublicadosModule` in `src/app.module.ts` imports array (after `MenusBaseModule`) and add corresponding import statement
- [x] T009 Generate TypeORM migration: run `npm run db:migration:generate -- migrations/CreateMenusPublicados`; verify generated file includes table `menus_publicados`, join table `menu_publicado_puntos_retiro` with FKs, PostgreSQL enums, and the two indexes defined in the entity; run `npm run db:migration:run` to apply

**Checkpoint**: Compilar y arrancar el servidor (`npm run start:dev`) sin errores. La tabla `menus_publicados` y la tabla intermedia `menu_publicado_puntos_retiro` deben existir en la base de datos.

---

## Phase 3: User Story 1 — Crear un menú publicado (Priority: P1) 🎯 MVP

**Goal**: Permitir a administradores y supervisores crear un menú publicado válido asociando menú base, sede, puntos de retiro, precio y fechas. Retorna el menú completo con relaciones.

**Independent Test**: `POST /admin/menus-publicados` con payload válido retorna 201 con el menú publicado en estado activo, con los puntos de retiro y menú base embebidos. Las validaciones de negocio (precio ≤ 0, fecha límite inválida, punto de retiro de otra sede) retornan 422/404 según el contrato.

### Implementation for User Story 1

- [x] T010 [P] [US1] Create `CreateMenuPublicadoDto` with all required and optional fields per `contracts/api.md` (menu_base_id, sede_id, puntos_retiro_ids `@IsArray @ArrayMinSize(1) @IsUUID({each:true})`, fecha_venta, precio_encargo `@Min(0.01)`, and all optional fields) in `src/modules/menus-publicados/dto/create-menu-publicado.dto.ts`
- [x] T011 [P] [US1] Add private validator helpers to `src/modules/menus-publicados/menus-publicados.service.ts`: `assertPrecioValido(precio)` throwing `MENU_PUBLICADO_PRECIO_INVALIDO` if `precio <= 0`; `assertFechaLimiteValida(fechaLimite, fechaVenta)` throwing `MENU_PUBLICADO_FECHA_LIMITE_INVALIDA` if `new Date(fechaLimite) > new Date(fechaVenta + 'T23:59:59Z')`; `assertSobreproduccionCoherente(tipo, valor)` throwing `MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA` if one is present and the other is not
- [x] T012 [US1] Add private `assertPuntosRetiroValidos(ids: string[], sedeId: string): Promise<PuntoRetiro[]>` to `src/modules/menus-publicados/menus-publicados.service.ts` — for each id, QB query on `puntoRetiroRepo` with `tenant_id`, `activo=true`, `sede_id=sedeId`; throw `MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS` (status 422) if any id fails; return valid `PuntoRetiro[]`
- [x] T013 [US1] Implement `create(dto: CreateMenuPublicadoDto): Promise<MenuPublicado>` in `src/modules/menus-publicados/menus-publicados.service.ts`: call `menusBaseService.findOne(dto.menu_base_id)` (validates activo), `sedesService.findOne(dto.sede_id)` (validates activa), then all four assertors, then `mpRepo.create({...dto fields, tenant_id, estado: EstadoMenuPublicado.ACTIVO, puntosRetiro})`, save, return `findOne(saved.id)`
- [x] T014 [US1] Create `MenusPublicadosController` in `src/modules/menus-publicados/menus-publicados.controller.ts` with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Controller('admin/menus-publicados')`; inject `MenusPublicadosService`, `PinoLogger`, `AuditService`; implement `@Post()` endpoint with `@Roles('administrador','supervisor')`, `@HttpCode(201)`, calling `svc.create(dto)` and writing audit log `menu_publicado.created` using `auditLogPayload` + `logger.info` + `audit.write` pattern from `MenusBaseController`
- [x] T015 [US1] Register `MenusPublicadosController` in `controllers` array of `src/modules/menus-publicados/menus-publicados.module.ts`

**Checkpoint**: `POST /admin/menus-publicados` retorna 201 con el menú publicado completo. Validaciones de negocio (precio inválido, fecha inválida, punto de retiro de otra sede) retornan los errores correctos.

---

## Phase 4: User Story 2 — Consultar menús disponibles en el portal público (Priority: P2)

**Goal**: Exponer un endpoint público que lista menús en estado activo para hoy y los próximos 7 días, filtrado por sede y opcionalmente por punto de retiro, con datos del menú base embebidos.

**Independent Test**: `GET /public/menus-disponibles?sede_id=<uuid>` con header `x-tenant-key` retorna 200 con un array de menús activos que tienen `menuBase` embebido con categorías, etiquetas y alérgenos. Menús en estado pausado/cerrado/agotado/cancelado no aparecen. Menús con `fecha_venta > hoy + 7 días` no aparecen.

### Implementation for User Story 2

- [x] T016 [US2] Implement `listDisponiblesPublic(query: QueryMenusDisponiblesDto): Promise<MenuPublicado[]>` in `src/modules/menus-publicados/menus-publicados.service.ts`: define constant `DIAS_HORIZONTE_PUBLICO = 7`; QB with `estado=ACTIVO`, `sede_id=query.sede_id`, `fecha_venta >= hoy` and `<= hoy+7 días`, LEFT JOIN menuBase with categorias/etiquetas/alergenos, LEFT JOIN puntosRetiro; if `query.punto_retiro_id` add `innerJoin('mp.puntosRetiro', 'prf', 'prf.id = :prId', { prId: query.punto_retiro_id })`; order by `fecha_venta ASC`, `mb.nombre ASC`; tenant-scoped
- [x] T017 [US2] Create `PublicMenusPublicadosController` in `src/modules/menus-publicados/public-menus-publicados.controller.ts` with `@Controller('public/menus-disponibles')` (no guards); inject `MenusPublicadosService`; implement `@Get()` calling `svc.listDisponiblesPublic(query)` and returning `ok(menus)`; register controller in `src/modules/menus-publicados/menus-publicados.module.ts`

**Checkpoint**: `GET /public/menus-disponibles?sede_id=<uuid>` con header `x-tenant-key` retorna el listado correcto. Filtro por `punto_retiro_id` funciona. Sin `x-tenant-key` retorna 400.

---

## Phase 5: User Story 3 — Gestionar el ciclo de vida del menú publicado (Priority: P3)

**Goal**: Permitir cambios de estado (pausar, reactivar, cerrar, agotar, cancelar) con validación estricta de la máquina de estados. Solo admin puede cancelar desde cerrado/agotado.

**Independent Test**: Ejecutar cada transición de estado válida en secuencia sobre un menú creado en US1. Verificar que las transiciones inválidas retornan 409. Verificar que supervisor no puede cancelar desde cerrado/agotado.

### Implementation for User Story 3

- [x] T018 [P] [US3] Implement `pausar(id)`, `reactivar(id)`, `cerrar(id)`, `agotar(id)` state transition methods in `src/modules/menus-publicados/menus-publicados.service.ts`: each calls `findOne(id)`, validates allowed predecessor state(s) against the transition matrix in `data-model.md`, sets new `estado`, calls `mpRepo.save(mp)` and returns updated entity; throw `AppError MENU_PUBLICADO_TRANSICION_INVALIDA (409)` on invalid state
- [x] T019 [US3] Implement `cancelar(id: string, rolUsuario: string): Promise<MenuPublicado>` in `src/modules/menus-publicados/menus-publicados.service.ts`: if `estado === CANCELADO` throw `MENU_PUBLICADO_TRANSICION_INVALIDA`; if `estado` in `[CERRADO, AGOTADO]` and `rolUsuario !== 'administrador'` throw `MENU_PUBLICADO_TRANSICION_INVALIDA` with `details: { reason: 'rol insuficiente para cancelar desde este estado' }`; set `estado = CANCELADO`, save, return entity
- [x] T020 [US3] Add five PATCH sub-resource endpoints to `src/modules/menus-publicados/menus-publicados.controller.ts`: `/:id/pausar` `@Roles('administrador','supervisor')` → `svc.pausar(id)` → audit `menu_publicado.pausado`; `/:id/reactivar` → `svc.reactivar(id)` → audit `menu_publicado.reactivado`; `/:id/cerrar` → `svc.cerrar(id)` → audit `menu_publicado.cerrado`; `/:id/agotar` → `svc.agotar(id)` → audit `menu_publicado.agotado`; `/:id/cancelar` → extract `req.user?.rol` → `svc.cancelar(id, rol)` → audit `menu_publicado.cancelado` (verify the JWT payload property name for rol in `src/common/types/express.d.ts` before implementing)

**Checkpoint**: Ciclo completo activo→pausado→activo→cerrado→cancelado funciona. Supervisor recibe 409 al intentar cancelar desde cerrado. Estado cancelado no permite más transiciones.

---

## Phase 6: User Story 4 — Listar y filtrar en el back office (Priority: P4)

**Goal**: Proveer listado paginado con filtros por fecha_venta, sede_id, estado y menu_base_id; y detalle completo por ID.

**Independent Test**: `GET /admin/menus-publicados?estado=activo&sede_id=<uuid>` retorna página paginada con solo menús activos de esa sede. `GET /admin/menus-publicados/<id>` retorna el menú completo con menuBase (incluye categorias/etiquetas/alergenos), sede y puntosRetiro.

### Implementation for User Story 4

- [x] T021 [US4] Implement `list(query: QueryMenuPublicadoDto)` in `src/modules/menus-publicados/menus-publicados.service.ts`: QB on `mpRepo` with `tenant_id` scope, `deleted_at IS NULL`, LEFT JOIN `menuBase` and `puntosRetiro`; apply filters conditionally (`fecha_venta`, `sede_id`, `estado`, `menu_base_id`); apply sort (`sortBy` whitelist: `created_at`, `fecha_venta`, `precio_encargo`; fallback `created_at DESC`); paginate with `page`/`limit`; return `{ items, total, page, limit }`
- [x] T022 [US4] Add two GET endpoints to `src/modules/menus-publicados/menus-publicados.controller.ts`: `@Get()` with `@Roles('administrador','supervisor')` calling `svc.list(query)` and returning `page(result.items, result.page, result.limit, result.total)`; `@Get(':id')` with same roles calling `svc.findOne(id)` and returning `ok(menu)`

**Checkpoint**: `GET /admin/menus-publicados` con distintas combinaciones de filtros retorna resultados paginados correctos. `GET /admin/menus-publicados/:id` retorna menú completo con relaciones cargadas.

---

## Phase 7: User Story 5 — Editar un menú publicado (Priority: P5)

**Goal**: Permitir a administradores modificar campos del menú publicado y/o reemplazar los puntos de retiro.

**Independent Test**: `PATCH /admin/menus-publicados/:id` solo admin puede acceder; actualiza precio, puntos de retiro u otros campos; retorna el menú actualizado completo; rechaza puntos_retiro_ids vacíos y precios inválidos.

### Implementation for User Story 5

- [x] T023 [US5] Create `UpdateMenuPublicadoDto` using `PartialType` of `CreateMenuPublicadoDto` excluding `menu_base_id`, `sede_id`, `fecha_venta` (fields not editable after creation); ensure `puntos_retiro_ids` retains `@IsOptional` but when present keeps `@ArrayMinSize(1)` — in `src/modules/menus-publicados/dto/update-menu-publicado.dto.ts`
- [x] T024 [US5] Implement `update(id: string, dto: UpdateMenuPublicadoDto): Promise<MenuPublicado>` in `src/modules/menus-publicados/menus-publicados.service.ts`: `findOne(id)`, conditionally validate `precio_encargo` (if present), `fecha_hora_limite_encargo` against `mp.fecha_venta` (if present), sobreproduccion coherence (if either field present), `puntos_retiro_ids` against `mp.sede_id` (if present); apply all defined fields to entity; save; return `findOne(id)`
- [x] T025 [US5] Add `@Patch(':id')` endpoint to `src/modules/menus-publicados/menus-publicados.controller.ts` with `@Roles('administrador')` (admin only), calling `svc.update(id, dto)` and writing audit log `menu_publicado.updated` with `extra: { menuPublicadoId: id, fields: Object.keys(dto) }`

**Checkpoint**: `PATCH /admin/menus-publicados/:id` como admin actualiza correctamente. Supervisor recibe 403. Puntos de retiro de otra sede retorna 422.

---

## Phase 8: User Story 6 — Eliminar (soft delete) un menú cancelado (Priority: P6)

**Goal**: Permitir a administradores hacer soft delete de menús en estado cancelado.

**Independent Test**: `DELETE /admin/menus-publicados/:id` con menú en estado cancelado retorna 200 y el menú ya no aparece en listados. El mismo DELETE sobre un menú activo/pausado/cerrado/agotado retorna 409 con `MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE`.

### Implementation for User Story 6

- [x] T026 [US6] Implement `remove(id: string): Promise<void>` in `src/modules/menus-publicados/menus-publicados.service.ts`: `findOne(id)`; if `mp.estado !== EstadoMenuPublicado.CANCELADO` throw `AppError MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE (409)`; call `mpRepo.softDelete(id)`
- [x] T027 [US6] Add `@Delete(':id')` endpoint to `src/modules/menus-publicados/menus-publicados.controller.ts` with `@Roles('administrador')` (admin only), calling `svc.remove(id)`, writing audit log `menu_publicado.deleted` with `extra: { menuPublicadoId: id }`, returning `ok({ id })`

**Checkpoint**: `DELETE /admin/menus-publicados/:id` sobre cancelado retorna 200. Sobre cualquier otro estado retorna 409. Supervisor recibe 403.

---

## Phase 9: Polish & Verificación cruzada

**Purpose**: Revisiones finales cross-cutting que afectan a todas las historias.

- [x] T028 [P] Verify `req.user?.rol` property name in `src/common/types/express.d.ts` matches what the JWT guard injects; adjust `cancelar()` controller call if property is named differently (e.g., `role`, `roles`, `perfil`)
- [x] T029 [P] Verify `SedesService.findOne()` and `MenusBaseService.findOne()` both throw an error when the entity is inactive (not just when not found); if `sedesService.findOne()` does not check `activa`, add explicit check in `MenusPublicadosService.create()` after fetching the sede
- [ ] T030 Perform end-to-end flow test: create a menu → list it → get detail → pause → reactivate → close → cancel → delete; verify audit log entries exist for each action in the audit table
- [x] T031 [P] Verify `npm run build` passes with no TypeScript errors; fix any type issues in the new module

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sin dependencias — comenzar inmediatamente
- **Phase 2 (Foundational)**: Depende de Phase 1 — BLOQUEA todas las historias
- **Phase 3 (US1 - Crear)**: Depende de Phase 2 completo
- **Phase 4 (US2 - Portal público)**: Depende de Phase 2; puede correr en paralelo con Phase 3 (distinto método del servicio)
- **Phase 5 (US3 - Estados)**: Depende de Phase 3 (requiere `findOne` y menú existente para probar)
- **Phase 6 (US4 - Listar)**: Depende de Phase 2; puede correr en paralelo con Phases 3–5
- **Phase 7 (US5 - Editar)**: Depende de Phase 3 (requiere `findOne` y menú existente)
- **Phase 8 (US6 - Eliminar)**: Depende de Phase 5 (requiere `cancelar()` para tener un menú cancelable)
- **Phase 9 (Polish)**: Depende de Phases 3–8 completas

### User Story Dependencies

| Historia | Depende de | Nota |
|----------|-----------|------|
| US1 - Crear | Phase 2 (Foundational) | Bloque inicial de valor |
| US2 - Portal público | Phase 2 | Independiente de US1 en código (distinto método) |
| US3 - Estados | US1 (para tener un menú que transicionar) | findOne() ya existe en foundational |
| US4 - Listar | Phase 2 | Independiente; reutiliza findOne() foundational |
| US5 - Editar | US1 (findOne), US4 (UpdateDto puede referenciar create patterns) | |
| US6 - Eliminar | US3 (necesita `cancelar()` para tener un menú en estado cancelado) | |

### Parallel Opportunities

Dentro de Phase 2 (Foundational), T003, T004, T005 pueden ejecutarse en paralelo:
- T003 (entity) — `src/modules/menus-publicados/entities/menu-publicado.entity.ts`
- T004 (QueryMenuPublicadoDto) — `src/modules/menus-publicados/dto/query-menu-publicado.dto.ts`
- T005 (QueryMenusDisponiblesDto) — `src/modules/menus-publicados/dto/query-menus-disponibles.dto.ts`

Dentro de Phase 3 (US1), T010 y T011 pueden ejecutarse en paralelo:
- T010 (CreateMenuPublicadoDto) — nuevo archivo DTO
- T011 (private validators) — sección del service

Dentro de Phase 5 (US3), T018 puede ejecutarse mientras T019 corre separado:
- T018 (pausar/reactivar/cerrar/agotar) — 4 métodos independientes entre sí
- T019 (cancelar) — lógica de rol separada

---

## Parallel Example: Phase 2 (Foundational)

```
# Ejecutar en paralelo (archivos distintos):
T002: error-codes.ts (src/common/errors/)
T003: menu-publicado.entity.ts (src/modules/menus-publicados/entities/)
T004: query-menu-publicado.dto.ts (src/modules/menus-publicados/dto/)
T005: query-menus-disponibles.dto.ts (src/modules/menus-publicados/dto/)

# Luego secuencial (dependen de entidad):
T006: menus-publicados.service.ts (skeleton + findOne)
T007: menus-publicados.module.ts
T008: app.module.ts
T009: migration
```

## Parallel Example: Phase 3 (US1)

```
# En paralelo (archivos distintos):
T010: create-menu-publicado.dto.ts
T011: private validators in service

# Luego secuencial:
T012: assertPuntosRetiroValidos (depende de T011)
T013: create() (depende de T011, T012)
T014: POST endpoint in controller (depende de T013)
T015: register controller in module
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational ← CRÍTICO, bloquea todo
3. Completar Phase 3: US1 (crear) ← MVP core
4. Completar Phase 4: US2 (portal público) ← el cliente ya puede ver menús
5. **PARAR Y VALIDAR**: El sistema puede crear menús y exponerlos al público
6. Continuar con US3, US4, US5, US6 en orden de prioridad

### Incremental Delivery

1. Setup + Foundational → compilación limpia, tabla existe
2. + US1 (crear) → administradores pueden publicar menús (MVP)
3. + US2 (portal) → clientes pueden ver menús disponibles
4. + US3 (estados) → ciclo de vida operativo completo
5. + US4 (listar) → back office completamente navegable
6. + US5 (editar) → correcciones de datos posibles
7. + US6 (eliminar) → limpieza de registros cancelados

---

## Notes

- [P] = distintos archivos, sin dependencias → pueden correr en paralelo
- [USn] = trazabilidad a la historia de usuario en spec.md
- Cada historia es independientemente comprobable vía su **Checkpoint**
- El JWT property de rol (`req.user?.rol`) debe verificarse en T028 antes de finalizar T020 en producción
- `migrationsRun: true` ya está configurado — la migración se aplica al arrancar
- No usar `throw new Error()` — solo `throw new AppError({...})`
- No usar `repo.find()` sin scope de tenant — siempre QB con `tenant_id`
- Commit después de cada fase o grupo lógico
