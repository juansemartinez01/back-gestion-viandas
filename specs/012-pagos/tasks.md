# Tasks: Pagos (Registro y Gestión de Pagos de Pedidos)

**Input**: Design documents from `specs/012-pagos/`

**Prerequisites**: [plan.md](plan.md) ✅ | [spec.md](spec.md) ✅ | [research.md](research.md) ✅ | [data-model.md](data-model.md) ✅ | [contracts/admin-pagos.md](contracts/admin-pagos.md) ✅ | [quickstart.md](quickstart.md) ✅

**Organization**: Tasks grouped by user story — US1 is the MVP (fully independently testable endpoint).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- No test tasks — validation is manual via Postman as specified in contracts/admin-pagos.md

---

## Phase 1: Setup (Tenant Pattern Research)

**Purpose**: Identify the correct tenant resolution pattern for services that do NOT extend `BaseCrudTenantService`. This is required before implementing `PagosService.findByPedidoId` and `PagosService.registrarCobroPresencial` which run in HTTP request context without the base class helper.

- [x] T001 Read src/modules/tenancy/ to identify requireTenantId() or equivalent tenant helper for non-BaseCrudTenantService services — note the exact import path and usage pattern; this pattern will be used in T005, T019, T020

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data layer that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Add PAGO_NOT_FOUND (404), PAGO_YA_COBRADO (409), PAGO_YA_EXISTE (409) to ErrorCodes enum in src/common/errors/error-codes.ts
- [x] T003 [P] Create pago.enums.ts with EstadoPago (pendiente, aprobado, rechazado, cancelado, presencial_pendiente, presencial_cobrado) and MedioPago (mercado_pago, presencial) in src/modules/pagos/pago.enums.ts
- [x] T004 Create Pago entity (NO BaseEntity — direct columns: id uuid PK, tenant_id uuid, pedido_id uuid @Unique FK to Pedido, medio_pago enum, estado enum, importe decimal(10,2), referencia_externa varchar(200) nullable, fecha_generacion timestamptz, fecha_aprobacion timestamptz nullable, fecha_registro_presencial timestamptz nullable, @CreateDateColumn created_at, @UpdateDateColumn updated_at; @Index(['tenant_id','pedido_id']); NO deleted_at) in src/modules/pagos/entities/pago.entity.ts

**Checkpoint**: Data layer ready — entity, enums, error codes all defined. User story implementation can begin.

---

## Phase 3: User Story 1 — Consultar Pago desde Back Office (Priority: P1) 🎯 MVP

**Goal**: Endpoint `GET /admin/pagos/:pedidoId` funcional para que el back office consulte el estado de pago de cualquier pedido del tenant.

**Independent Test**: `GET /admin/pagos/:pedidoId` con JWT válido (rol administrador, supervisor u operador_caja) y `x-tenant-key` → 200 con el registro de pago. Sin pago → 404 con code=PAGO_NOT_FOUND. Ver [contracts/admin-pagos.md](contracts/admin-pagos.md) para todos los smoke tests.

### Implementation for User Story 1

- [x] T005 [US1] Create PagosService with findByPedidoId(pedidoId) method — use tenancy pattern from T001 to get tenantId from HTTP context, query WHERE pedido_id=:pedidoId AND tenant_id=:tenantId, return Pago or throw AppError(PAGO_NOT_FOUND, 404) in src/modules/pagos/pagos.service.ts
- [x] T006 [US1] Create PagosController with prefix /admin/pagos, @UseGuards(JwtAuthGuard, RolesGuard), single GET /:pedidoId endpoint (@Roles('administrador','supervisor','operador_caja'), calls findByPedidoId(pedidoId), returns ok(pago)) in src/modules/pagos/pagos.controller.ts
- [x] T007 [US1] Create PagosModule (@Module imports TypeOrmModule.forFeature([Pago]), providers [PagosService], controllers [PagosController], exports [PagosService]) in src/modules/pagos/pagos.module.ts
- [x] T008 [US1] Register PagosModule in AppModule imports array (add after BannersPromocionesModule or PedidosModule) in src/app.module.ts
- [x] T009 [US1] Generate migration — run: npm run db:migration:generate -- migrations/CreatePagos — from repo root
- [x] T010 [US1] Review generated migration file at migrations/*CreatePagos.ts: verify UNIQUE constraint on pedido_id, FK pedido_id → pedidos(id) ON DELETE RESTRICT, PostgreSQL enum types for estado_pago and medio_pago, @Index on (tenant_id, pedido_id), NO deleted_at column; fix any issues manually

**Checkpoint**: US1 complete — `GET /admin/pagos/:pedidoId` should return 200/404 correctly.

---

## Phase 4: User Story 2 — Registro Automático de Pago al Crear Pedido (Priority: P2)

**Goal**: Al crear cualquier pedido (presencial u online), se registra automáticamente un pago dentro de la misma transacción atómica del pedido.

**Independent Test**: Crear un pedido presencial vía `POST /public/pedidos` o `POST /admin/pedidos/manual` → consultar `GET /admin/pagos/:pedidoId` → debe retornar pago con estado presencial_pendiente e importe=importe_total del pedido. Crear pedido online → pago con estado pendiente.

### Implementation for User Story 2

- [x] T011 [US2] Add crearPagoPresencial(pedidoId: string, importe: number, tenantId: string, qr: QueryRunner): Promise<Pago> to PagosService — creates Pago with estado=PRESENCIAL_PENDIENTE, medio_pago=PRESENCIAL, fecha_generacion=now(), uses qr.manager.create and qr.manager.save (NOT this.pagoRepo) in src/modules/pagos/pagos.service.ts
- [x] T012 [US2] Add crearPagoOnline(pedidoId: string, importe: number, tenantId: string, qr: QueryRunner): Promise<Pago> to PagosService — creates Pago with estado=PENDIENTE, medio_pago=MERCADO_PAGO, fecha_generacion=now(), uses qr.manager.create and qr.manager.save in src/modules/pagos/pagos.service.ts
- [x] T013 [US2] Add PagosModule to imports array in PedidosModule (no other changes; PedidosModule already has TypeOrmModule, etc.) in src/modules/pedidos/pedidos.module.ts
- [x] T014 [US2] Inject PagosService into PedidosService constructor — add private readonly pagosService: PagosService as constructor parameter; existing super(pedidoRepo) call unchanged in src/modules/pedidos/pedidos.service.ts
- [x] T015 [US2] In _crearPedidoCore, after const saved = await qr.manager.save(Pedido, pedido) and before await qr.commitTransaction(): add conditional call — if dto.medio_pago === MedioPagoPedido.PRESENCIAL call this.pagosService.crearPagoPresencial(saved.id, saved.importe_total, tenantId, qr) else call crearPagoOnline — in src/modules/pedidos/pedidos.service.ts

**Checkpoint**: US2 complete — crear pedido → pago creado automáticamente. US1 smoke test still passes.

---

## Phase 5: User Story 3 — Cancelación de Pago al Cancelar Pedido (Priority: P3)

**Goal**: Al cancelar un pedido (desde portal o admin), el pago asociado queda con estado cancelado.

**Independent Test**: Cancelar pedido presencial existente → `GET /admin/pagos/:pedidoId` → estado=cancelado.

### Implementation for User Story 3

- [x] T016 [US3] Add cancelarPago(pedidoId: string, tenantId: string): Promise<void> to PagosService — query WHERE pedido_id=:pedidoId AND tenant_id=:tenantId; if pago not found return void (tolerant — no AppError); if found set estado=CANCELADO, save in src/modules/pagos/pagos.service.ts
- [x] T017 [US3] In cancelarDesdePortal, after pedidoRepo.save(pedido) call: add await this.pagosService.cancelarPago(pedido.id, tenantId) where tenantId = this.getTenantId({ strictTenant: true }) as string in src/modules/pedidos/pedidos.service.ts
- [x] T018 [US3] In cancelarDesdeAdmin, after pedidoRepo.save(pedido) call: add await this.pagosService.cancelarPago(pedido.id, tenantId) where tenantId = this.getTenantId({ strictTenant: true }) as string in src/modules/pedidos/pedidos.service.ts

**Checkpoint**: US3 complete — cancelar pedido → pago=cancelado. US1 and US2 still work.

---

## Phase 6: User Story 4 — Registro de Cobro Presencial (Priority: P4)

**Goal**: `registrarCobroPresencial` disponible para ser llamado por EntregasService en Stage 5.

**Independent Test**: Llamar `pagosService.registrarCobroPresencial(pedidoId)` directamente con un pago en estado presencial_pendiente → estado pasa a presencial_cobrado y fecha_registro_presencial seteada. Llamar de nuevo → AppError PAGO_YA_COBRADO.

### Implementation for User Story 4

- [x] T019 [US4] Add registrarCobroPresencial(pedidoId: string): Promise<Pago> to PagosService — use tenant helper from T001 to get tenantId from HTTP context, call findByPedidoId (throws PAGO_NOT_FOUND if null), validate pago.estado === EstadoPago.PRESENCIAL_PENDIENTE (else throw AppError PAGO_YA_COBRADO 409), set estado=PRESENCIAL_COBRADO, fecha_registro_presencial=new Date(), save and return in src/modules/pagos/pagos.service.ts

**Checkpoint**: US4 complete — cobro presencial registrable. No endpoint expuesto aún (Stage 5).

---

## Phase 7: User Story 5 — Actualización de Estado por Confirmación Online (Priority: P5)

**Goal**: `actualizarEstadoOnline` disponible para ser llamado por MercadoPagoService en Stage 4.

**Independent Test**: Llamar `pagosService.actualizarEstadoOnline(pedidoId, EstadoPago.APROBADO, 'REF-123')` con pago en estado pendiente → estado=aprobado, referencia_externa='REF-123', fecha_aprobacion seteada. Llamar dos veces con la misma referencia → segunda llamada actualiza sin error (idempotente).

### Implementation for User Story 5

- [x] T020 [US5] Add actualizarEstadoOnline(pedidoId: string, nuevoEstado: EstadoPago, referenciaExterna?: string): Promise<Pago> to PagosService — use tenant helper from T001 to get tenantId, call findByPedidoId (throws PAGO_NOT_FOUND if null), set pago.estado=nuevoEstado, if referenciaExterna set pago.referencia_externa, if nuevoEstado===EstadoPago.APROBADO set pago.fecha_aprobacion=new Date(), save and return (idempotent — no duplicate check) in src/modules/pagos/pagos.service.ts

**Checkpoint**: US5 complete — todos los métodos de PagosService implementados.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Type safety validation and smoke test confirmation.

- [x] T021 [P] Run npx tsc --noEmit from repo root — fix all TypeScript compilation errors before proceeding
- [ ] T022 [P] Manual smoke test — POST pedido presencial → GET /admin/pagos/:pedidoId → verify 200 with estado=presencial_pendiente and correct importe (per contracts/admin-pagos.md smoke test #1)
- [ ] T023 [P] Manual smoke test — GET /admin/pagos/00000000-0000-0000-0000-000000000000 → verify 404 code=PAGO_NOT_FOUND (per contracts/admin-pagos.md smoke test #2)
- [ ] T024 Manual smoke test — cancelar pedido → GET /admin/pagos/:pedidoId → verify estado=cancelado (per spec US3 acceptance scenario)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001 pattern identified) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP; complete before Phase 4
- **US2 (Phase 4)**: Depends on US1 (PagosModule and PagosService must exist)
- **US3 (Phase 5)**: Depends on US2 (PagosService injected into PedidosService)
- **US4 (Phase 6)**: Depends on Foundational only — can start after Phase 2 if US1–3 complete
- **US5 (Phase 7)**: Depends on Foundational only — can start after Phase 2 if US4 complete
- **Polish (Phase 8)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Foundational → then US1. No dep on other stories. **Start here.**
- **US2 (P2)**: US1 must be complete (PagosModule and PagosService must exist to be imported)
- **US3 (P3)**: US2 must be complete (PagosService must be injected in PedidosService)
- **US4 (P4)**: Foundational complete only — but implement after US1–3 for coherent service file
- **US5 (P5)**: Foundational complete only — implement last for same reason

### Within Each User Story

- Enums/entity before service methods
- Service before controller
- Module before AppModule registration
- AppModule registration before migration

### Parallel Opportunities

- T002 [P] and T003 [P] can run simultaneously (different files, no dependencies)
- T021 [P], T022 [P], T023 [P] smoke tests can run simultaneously after Polish phase starts

---

## Parallel Example: Foundational Phase

```bash
# Run T002 and T003 together (different files):
Task: "Add error codes to src/common/errors/error-codes.ts"          # T002
Task: "Create pago.enums.ts in src/modules/pagos/pago.enums.ts"     # T003
# Then T004 sequentially (depends on T003 for enums)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: US1 (T005–T010)
4. **STOP and VALIDATE**: `GET /admin/pagos/:pedidoId` → 200/404 working
5. Continue with US2–US5 to complete the payment lifecycle

### Incremental Delivery

1. Setup + Foundational → Data layer ready
2. US1 → Admin query endpoint working (MVP!) → Validate with Postman
3. US2 → Auto-payment creation on order → Validate end-to-end
4. US3 → Cancellation sync → Validate cancel flow
5. US4 → In-person payment registration → Ready for Stage 5 (EntregasService)
6. US5 → Online status update → Ready for Stage 4 (MercadoPagoService)

---

## Notes

- [P] tasks = different files, no runtime dependencies
- `PagosService` does NOT extend `BaseCrudTenantService` — tenancy resolved via helper found in T001
- `Pago` entity does NOT have soft delete — no `deleted_at` column
- `crearPago*` methods receive `QueryRunner` parameter for atomicity with pedido creation
- `cancelarPago` is tolerant — returns void if pago not found (prevents pedido cancellation from failing)
- `actualizarEstadoOnline` is idempotent — no duplicate-reference guard needed
- US4 and US5 add methods to PagosService only — no endpoint exposure until Stage 4/5
