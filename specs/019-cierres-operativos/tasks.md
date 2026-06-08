# Tasks: Cierres Operativos

**Input**: Design documents from `specs/019-cierres-operativos/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api-endpoints.md ✅ | quickstart.md ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label — US1 through US4 (maps to spec.md priorities)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create module skeleton and register it in the application.

- [x] T001 Create module directory structure: `src/modules/cierres-operativos/entities/` and `src/modules/cierres-operativos/dto/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Error codes, entity, DTOs, migration, and module wire-up — must be complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add error codes `CIERRE_OPERATIVO_NOT_FOUND`, `CIERRE_YA_EXISTE`, `CIERRE_DIA_CERRADO` to `src/common/errors/error-codes.ts` under the `// cierres-operativos` section
- [x] T003 [P] Create `CierreOperativo` entity in `src/modules/cierres-operativos/entities/cierre-operativo.entity.ts` — fields: id (uuid PK), tenant_id (uuid, @Index), fecha_operativa (date), sede_id (uuid), punto_retiro_id (uuid), usuario_id (uuid), fecha_cierre (timestamptz), cantidad_pedidos_entregados (int default 0), cantidad_pedidos_no_retirados (int default 0), cantidad_ventas_sobrantes (int default 0), recaudacion_presencial (decimal 10,2 default 0), observacion (text nullable), created_at (@CreateDateColumn); decorators: @Entity('cierres_operativos'), @Unique(['tenant_id','fecha_operativa','sede_id','punto_retiro_id']), @Index('idx_cierre_tenant_fecha_sede', ['tenant_id','fecha_operativa','sede_id']); NO updated_at, NO deleted_at
- [x] T004 [P] Create `CrearCierreDto` in `src/modules/cierres-operativos/dto/crear-cierre.dto.ts` — fields: fecha_operativa (@IsDateString, @IsNotEmpty), sede_id (@IsUUID, @IsNotEmpty), punto_retiro_id (@IsUUID, @IsNotEmpty), observacion (@IsOptional, @IsString)
- [x] T005 [P] Create `QueryCierresDto` in `src/modules/cierres-operativos/dto/query-cierres.dto.ts` — fields: fecha_desde (@IsOptional, @IsDateString), fecha_hasta (@IsOptional, @IsDateString), sede_id (@IsOptional, @IsUUID), punto_retiro_id (@IsOptional, @IsUUID), page (@IsOptional, @IsInt, @Min(1), @Type(() => Number)), limit (@IsOptional, @IsInt, @Min(1), @Max(100), @Type(() => Number))
- [x] T006 [P] Create `QueryResumenPrevioDto` in `src/modules/cierres-operativos/dto/query-resumen-previo.dto.ts` — fields: fecha (@IsDateString, @IsNotEmpty), sede_id (@IsUUID, @IsNotEmpty), punto_retiro_id (@IsUUID, @IsNotEmpty)
- [x] T007 Generate and run database migration: `npm run db:migration:generate -- migrations/CreateCierresOperativos` then `npm run db:migration:run`; verify the generated file includes the UNIQUE constraint on `(tenant_id, fecha_operativa, sede_id, punto_retiro_id)` and the named index `idx_cierre_tenant_fecha_sede`, and has no `updated_at` or `deleted_at` columns
- [x] T008 Create `CierresOperativosService` skeleton (no methods yet) in `src/modules/cierres-operativos/cierres-operativos.service.ts` — inject: `@InjectRepository(CierreOperativo)`, `@InjectRepository(Pedido)`, `@InjectRepository(EntregaPedido)`, `@InjectRepository(VentaSobrante)`, `DataSource`, `TenancyService`, `AuditService`
- [x] T009 Create `CierresOperativosController` skeleton (no routes yet) in `src/modules/cierres-operativos/cierres-operativos.controller.ts` — decorator: `@Controller('admin/cierres-operativos')`, `@UseGuards(JwtAuthGuard, RolesGuard)`
- [x] T010 Create `CierresOperativosModule` in `src/modules/cierres-operativos/cierres-operativos.module.ts` — `TypeOrmModule.forFeature([CierreOperativo, Pedido, EntregaPedido, VentaSobrante])`, imports: `[AuditModule, TenancyModule]`, exports: `[CierresOperativosService]`; register controller and service
- [x] T011 Register `CierresOperativosModule` in `src/app.module.ts` imports array

**Checkpoint**: Foundation ready — `npm run build` must pass before user story work begins.

---

## Phase 3: User Story 1 — Ejecutar cierre del día operativo (Priority: P1) 🎯 MVP

**Goal**: Implement the transactional day-close that marks confirmed-undelivered orders as `no_retirado` and persists the `CierreOperativo` summary record with full audit.

**Independent Test**: `POST /admin/cierres-operativos` with a valid fecha/sede/punto that has confirmed orders → response 201 with correct totals; pedidos updated to `no_retirado`; second call returns 409 `CIERRE_YA_EXISTE`.

### Implementation for User Story 1

- [x] T012 [US1] Implement `ejecutarCierre(dto: CrearCierreDto, usuarioId: string): Promise<CierreOperativo>` in `src/modules/cierres-operativos/cierres-operativos.service.ts` using `DataSource.createQueryRunner()` with the 10-step flow defined in plan.md: (1) findOne uniqueness check → throw CIERRE_YA_EXISTE; (2) QB pedidos WITH `pessimistic_write` WHERE tenant_id, fecha_retiro=dto.fecha_operativa, sede_id, punto_retiro_id, estado_pedido IN [CONFIRMADO_PAGO_ONLINE, CONFIRMADO_PAGO_PRESENCIAL], deleted_at IS NULL; (3) set each pedido estado_pedido=NO_RETIRADO and save; (4) COUNT entrega_pedidos WHERE fecha_entrega::date = dto.fecha_operativa AND sede_id AND punto_retiro_id AND tenant_id; (5) SUM entrega_pedidos.importe_cobrado_caja (same filter); (6) COUNT ventas_sobrantes WHERE fecha = dto.fecha_operativa AND sede_id AND punto_retiro_id AND tenant_id; (7) SUM ventas_sobrantes.importe_total (same filter); (8) CREATE+SAVE CierreOperativo with all totals and fecha_cierre=new Date(); (9) auditService.write with action='cierre.operativo.registrado', entity='cierre_operativo'; (10) commitTransaction; catch: rollbackTransaction+rethrow; finally: release
- [x] T013 [US1] Add `POST /` handler to `CierresOperativosController` in `src/modules/cierres-operativos/cierres-operativos.controller.ts`: `@Post()`, `@Roles('administrador', 'operador_caja')`, `@HttpCode(201)`, extract `usuarioId` from `req.user.sub`, call `service.ejecutarCierre(dto, usuarioId)`, return `ok(cierre)`

**Checkpoint**: `POST /admin/cierres-operativos` is fully functional. Verify with a real request — orders marked `no_retirado`, cierre created, audit logged.

---

## Phase 4: User Story 4 — Bloqueo de operaciones en días ya cerrados (Priority: P1)

**Goal**: Export `isDiaCerrado` from `CierresOperativosService` and inject it into `EntregasService` and `VentasSobrantesService` to block mutations on closed days.

**Independent Test**: After executing a cierre for a day, attempt `POST /admin/entregas` for a pedido on that date/sede/punto → response 409 `CIERRE_DIA_CERRADO`. Same for `POST /admin/ventas-sobrantes`.

### Implementation for User Story 4

- [x] T014 [US4] Implement `isDiaCerrado(fecha: string, sedeId: string, puntoRetiroId: string, tenantId: string): Promise<boolean>` in `src/modules/cierres-operativos/cierres-operativos.service.ts` — use `this.cierreRepo.count({ where: { tenant_id: tenantId, fecha_operativa: fecha, sede_id: sedeId, punto_retiro_id: puntoRetiroId } })`, return `count > 0`; no transaction needed
- [x] T015 [US4] Add `CierresOperativosModule` to the `imports` array of `EntregasModule` in `src/modules/entregas/entregas.module.ts`
- [x] T016 [US4] Inject `CierresOperativosService` into `EntregasService` constructor in `src/modules/entregas/entregas.service.ts`; add guard at the start of `registrarEntrega` (after `requireTenantId`): call `isDiaCerrado(pedido.fecha_retiro, pedido.sede_id, pedido.punto_retiro_id, tenantId)`, if true throw `AppError({ code: ErrorCodes.CIERRE_DIA_CERRADO, message: 'El día operativo ya fue cerrado para este punto de retiro', status: 409 })`; add guard AFTER loading the pedido (so the date comes from the pedido entity)
- [x] T017 [US4] Add `CierresOperativosModule` to the `imports` array of `VentasSobrantesModule` in `src/modules/ventas-sobrantes/ventas-sobrantes.module.ts`
- [x] T018 [US4] Inject `CierresOperativosService` into `VentasSobrantesService` constructor in `src/modules/ventas-sobrantes/ventas-sobrantes.service.ts`; add guard at the start of `registrarVenta` (after `requireTenantId`): call `isDiaCerrado(dto.fecha, dto.sede_id, dto.punto_retiro_id, tenantId)`, if true throw `AppError({ code: ErrorCodes.CIERRE_DIA_CERRADO, message: 'El día operativo ya fue cerrado para este punto de retiro', status: 409 })`

**Checkpoint**: Entregas and ventas-sobrantes are blocked on closed days. `npm run build` passes without circular dependency errors.

---

## Phase 5: User Story 2 — Consultar resumen previo antes de cerrar (Priority: P2)

**Goal**: Read-only preview endpoint that returns the same totals the close operation would record, without modifying any data.

**Independent Test**: `GET /admin/cierres-operativos/resumen-previo?fecha=...&sede_id=...&punto_retiro_id=...` returns correct counts; calling it multiple times returns the same result (no side effects); `dia_ya_cerrado=true` if cierre already exists.

### Implementation for User Story 2

- [x] T019 [US2] Implement `calcularResumenPrevio(query: QueryResumenPrevioDto): Promise<ResumenPrevioResult>` in `src/modules/cierres-operativos/cierres-operativos.service.ts` (no QueryRunner, read-only): (1) count existing cierre → set `dia_ya_cerrado`; (2) COUNT entrega_pedidos for the day/sede/punto/tenant → `cantidad_pedidos_entregados`; (3) COUNT pedidos WHERE estado IN [CONFIRMADO_PAGO_ONLINE, CONFIRMADO_PAGO_PRESENCIAL] AND fecha_retiro=fecha AND sede AND punto AND tenant AND deleted_at IS NULL → `cantidad_pedidos_a_no_retirar`; (4) COUNT pedidos WHERE estado=CANCELADO AND same filters → `cantidad_pedidos_cancelados`; (5) COUNT ventas_sobrantes → `cantidad_ventas_sobrantes`; (6) SUM entrega_pedidos.importe_cobrado_caja + SUM ventas_sobrantes.importe_total → `recaudacion_presencial_estimada`; return plain object matching data-model.md resumen shape
- [x] T020 [US2] Add `GET /resumen-previo` handler to `CierresOperativosController` in `src/modules/cierres-operativos/cierres-operativos.controller.ts`: `@Get('resumen-previo')` declared as the **first** `@Get` route in the class; `@Roles('administrador', 'operador_caja')`; `@Query() query: QueryResumenPrevioDto`; call `service.calcularResumenPrevio(query)`; return `ok(resumen)`

**Checkpoint**: `GET /admin/cierres-operativos/resumen-previo` returns correct totals without side effects. Confirm route is declared before `GET /:id` in the controller file.

---

## Phase 6: User Story 3 — Consultar historial de cierres (Priority: P3)

**Goal**: List and detail endpoints for historical cierre records, scoped to tenant, with optional date/sede/punto filters.

**Independent Test**: `GET /admin/cierres-operativos?sede_id=...` returns only cierres for that sede within the tenant; `GET /admin/cierres-operativos/:id` returns full detail; nonexistent ID returns 404 `CIERRE_OPERATIVO_NOT_FOUND`.

### Implementation for User Story 3

- [x] T021 [US3] Implement `list(query: QueryCierresDto): Promise<{ items: CierreOperativo[]; total: number; page: number; limit: number }>` in `src/modules/cierres-operativos/cierres-operativos.service.ts`: QB on `cierres_operativos` scoped by `tenant_id`; optional filters: `fecha_desde` (WHERE fecha_operativa >= :fechaDesde), `fecha_hasta` (WHERE fecha_operativa <= :fechaHasta), `sede_id`, `punto_retiro_id`; ORDER BY `fecha_operativa DESC`; paginate with `page` and `limit` defaults (page=1, limit=20)
- [x] T022 [US3] Implement `findOne(id: string): Promise<CierreOperativo>` in `src/modules/cierres-operativos/cierres-operativos.service.ts`: QB WHERE id=:id AND tenant_id=:tenantId; throw `AppError({ code: ErrorCodes.CIERRE_OPERATIVO_NOT_FOUND, status: 404 })` if not found
- [x] T023 [US3] Add `GET /` handler to `CierresOperativosController`: `@Get()`, `@Roles('administrador', 'supervisor', 'operador_caja')`; call `service.list(query)`; return `page(items, { total, page, limit })`
- [x] T024 [US3] Add `GET /:id` handler to `CierresOperativosController`: `@Get(':id')` declared **after** `GET /resumen-previo` and `GET /`; `@Roles('administrador', 'supervisor', 'operador_caja')`; call `service.findOne(id)`; return `ok(cierre)`

**Checkpoint**: All 4 endpoints (`POST /`, `GET /resumen-previo`, `GET /`, `GET /:id`) are functional. Route order verified in controller source.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification, build validation, and integration smoke test.

- [x] T025 Verify controller route order in `src/modules/cierres-operativos/cierres-operativos.controller.ts`: `@Get('resumen-previo')` must appear before `@Get(':id')` — this is critical for correct NestJS routing
- [x] T026 [P] Run `npm run build` and confirm zero TypeScript compilation errors for the new module and all modified files
- [x] T027 [P] Run `npm run db:migration:run` on a clean dev database and confirm: table `cierres_operativos` created, UNIQUE constraint present, index `idx_cierre_tenant_fecha_sede` present, no `updated_at`/`deleted_at` columns
- [x] T028 Smoke test the full close cycle via REST: (1) GET /resumen-previo → verify totals; (2) POST / → verify 201 and correct summary; (3) GET /:id → verify detail matches POST response; (4) GET / with filters → verify list; (5) POST / again for same day → verify 409 CIERRE_YA_EXISTE; (6) POST /admin/entregas for same day/punto → verify 409 CIERRE_DIA_CERRADO

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories; must `npm run build` before proceeding
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US4 (Phase 4)**: Depends on Phase 3 completion (needs `isDiaCerrado` method from the service)
- **US2 (Phase 5)**: Depends on Phase 2 completion (can run in parallel with US4 if needed)
- **US3 (Phase 6)**: Depends on Phase 2 completion (can run in parallel with US2/US4)
- **Polish (Phase 7)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — no story dependencies
- **US4 (P1)**: Starts after US1 — needs `isDiaCerrado` exported from the service
- **US2 (P2)**: Starts after Phase 2 — independent of US1/US4; only needs the repo injections and DTOs
- **US3 (P3)**: Starts after Phase 2 — independent of US1/US2/US4

### Within Each User Story

- Service method before controller handler
- Module wiring (imports/exports) before service injection

### Parallel Opportunities

- T003–T006 (entity + DTOs) can all run in parallel (different files)
- T008–T009 (service and controller skeletons) can run in parallel
- T026–T027 (build + migration checks) can run in parallel
- US2 and US3 can be worked on in parallel after Phase 2 (different service methods, different controller routes)

---

## Parallel Example: Phase 2 (Foundational)

```text
# After T002 (error codes), run in parallel:
T003: cierre-operativo.entity.ts
T004: crear-cierre.dto.ts
T005: query-cierres.dto.ts
T006: query-resumen-previo.dto.ts

# Then in parallel:
T008: cierres-operativos.service.ts skeleton
T009: cierres-operativos.controller.ts skeleton

# Sequential:
T007: migration (needs entity)
T010: module (needs service, controller, entity)
T011: app.module.ts registration
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 4)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — cierre execution
4. Complete Phase 4: US4 — block operations on closed days
5. **STOP and VALIDATE**: day close works, operations are blocked, no circular dep issues
6. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Phase 3 (US1) → Core close operation works → Demo
3. Phase 4 (US4) → Operational guard active → Demo
4. Phase 5 (US2) → Preview endpoint added → Demo
5. Phase 6 (US3) → History queries added → Demo
6. Phase 7 → Polish and smoke tests

---

## Notes

- **Route order is critical**: `@Get('resumen-previo')` MUST be declared before `@Get(':id')` in the controller. NestJS evaluates routes in declaration order — if `:id` is first, `/resumen-previo` will match it as `id = "resumen-previo"`.
- **No circular dependency**: `CierresOperativosModule` uses direct repository access (TypeOrmModule.forFeature) for Pedido/EntregaPedido/VentaSobrante — it does NOT inject EntregasService or VentasSobrantesService. Those services inject CierresOperativosService. Direction is one-way.
- **isDiaCerrado receives tenantId explicitly**: Called from EntregasService and VentasSobrantesService where TenancyService context is already resolved.
- **Immutable entity**: No `updated_at`, no `deleted_at`. Once a cierre is written it cannot be modified or soft-deleted through this module.
