# Tasks: Pedidos (Gestión de Pedidos de Viandas)

**Input**: Design documents from `specs/011-pedidos/`

**Prerequisites**: [plan.md](plan.md) ✅ | [spec.md](spec.md) ✅ | [research.md](research.md) ✅ | [data-model.md](data-model.md) ✅ | [contracts/](contracts/) ✅ | [quickstart.md](quickstart.md) ✅

**Tests**: No incluidos — no solicitados en la spec.

**Organization**: Tareas agrupadas por User Story para implementación y testing independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: A qué User Story pertenece la tarea (US1–US4)

---

## Phase 1: Setup (Estructura del Módulo)

**Purpose**: Crear el esqueleto de archivos vacíos para que las importaciones no fallen durante el desarrollo incremental.

- [x] T001 Create empty module skeleton `src/modules/pedidos/pedidos.module.ts` with `@Module({})` placeholder
- [x] T002 [P] Create empty service file `src/modules/pedidos/pedidos.service.ts` with `@Injectable()` class stub
- [x] T003 [P] Create empty controller file `src/modules/pedidos/pedidos.controller.ts` with `@Controller('admin/pedidos')` stub
- [x] T004 [P] Create empty public controller file `src/modules/pedidos/public-pedidos.controller.ts` with `@Controller('public/pedidos')` stub
- [x] T005 [P] Create empty job file `src/modules/pedidos/pedidos-expiracion.job.ts` with `@Injectable()` stub

**Checkpoint**: ✅ Estructura de carpetas lista.

---

## Phase 2: Foundational (Prerequisitos bloqueantes)

**Purpose**: Infraestructura compartida que DEBE completarse antes de cualquier User Story.

**⚠️ CRÍTICO**: Ningún US puede implementarse hasta completar esta fase.

- [x] T006 Add 8 pedidos error codes to `src/common/errors/error-codes.ts`: `PEDIDO_NOT_FOUND`, `PEDIDO_MENU_NO_DISPONIBLE`, `PEDIDO_PUNTO_RETIRO_NO_HABILITADO`, `PEDIDO_CAPACIDAD_AGOTADA`, `PEDIDO_NO_CANCELABLE`, `PEDIDO_FUERA_DE_VENTANA_CANCELACION`, `PEDIDO_RESERVA_EXPIRADA`, `PEDIDO_SOLO_PAGO_PRESENCIAL_MANUAL`
- [x] T007 Create `src/modules/pedidos/pedido.enums.ts` with enums `EstadoPedido` (6 valores), `EstadoPagoPedido` (6 valores), `MedioPagoPedido` (2 valores), `OrigenCancelacion` (2 valores) — see data-model.md for exact values
- [x] T008 Create `src/modules/pedidos/entities/pedido.entity.ts` extending `BaseEntity` with all columns, enums, indexes (`@Index` for tenant+dni, tenant+mp+estado, tenant+expires_at), `@Unique` on `codigo_publico`, 4 `@ManyToOne` relations (MenuPublicado, Sede, PuntoRetiro, Cliente), soft delete enabled — see data-model.md for full field list
- [x] T009 [P] Create `src/modules/pedidos/dto/create-pedido-publico.dto.ts` with fields: `menu_publicado_id` (@IsUUID), `punto_retiro_id` (@IsUUID), `dni` (@IsString, @IsNotEmpty, @MaxLength(20)), `nombre` (@IsString, @MaxLength(100)), `apellido` (@IsString, @MaxLength(100)), `telefono` (@IsOptional, @IsString, @MaxLength(50)), `email` (@IsOptional, @IsEmail, @MaxLength(200)), `cantidad` (@IsInt, @Min(1)), `medio_pago` (@IsEnum(MedioPagoPedido))
- [x] T010 [P] Create `src/modules/pedidos/dto/create-pedido-manual.dto.ts` as a copy of `CreatePedidoPublicoDto` (same fields, service validates medio_pago === presencial at runtime)
- [x] T011 [P] Create `src/modules/pedidos/dto/update-pedido.dto.ts` with ONLY: `telefono_informado` (@IsOptional, @IsString), `email_informado` (@IsOptional, @IsEmail), `motivo` (@IsOptional, @IsString) — NEVER include precio_unitario or importe_total
- [x] T012 [P] Create `src/modules/pedidos/dto/query-pedido.dto.ts` extending `PageQueryDto`, adding: `fecha_retiro` (@IsOptional, @IsDateString), `sede_id` (@IsOptional, @IsUUID), `punto_retiro_id` (@IsOptional, @IsUUID), `estado_pedido` (@IsOptional, @IsEnum(EstadoPedido)), `estado_pago` (@IsOptional, @IsEnum(EstadoPagoPedido)), `menu_publicado_id` (@IsOptional, @IsUUID), `dni` (@IsOptional, @IsString)
- [x] T013 [P] Create `src/modules/pedidos/dto/cancelar-pedido.dto.ts` with single field: `motivo` (@IsOptional, @IsString)
- [x] T014 Wire full `src/modules/pedidos/pedidos.module.ts`: `TypeOrmModule.forFeature([Pedido])`, imports `[ClientesModule, MenusPublicadosModule, SedesModule, PuntosRetiroModule, AuditModule]`, providers `[PedidosService, PedidosExpiracionJob]`, controllers `[PedidosController, PublicPedidosController]`, exports `[PedidosService]`
- [x] T015 Register `PedidosModule` in `src/app.module.ts` imports array (after `BannersPromocionesModule`)
- [x] T016 Generate database migration: run `npm run db:migration:generate -- migrations/CreatePedidos`, verify generated file has correct PostgreSQL enums, 3 composite indexes, unique constraint on `codigo_publico`, and correct nullable columns

**Checkpoint**: ✅ Módulo registrado y migración lista — implementación de User Stories puede comenzar.

---

## Phase 3: User Story 1 — Crear Pedido desde Portal (Priority: P1) 🎯 MVP

**Goal**: Un cliente puede crear un pedido presencial desde el portal público sin autenticación. El sistema valida el menú, punto de retiro, capacidad, upsertea el cliente, genera el código público VIA-YYYY-NNNNNN y retorna el pedido creado.

**Independent Test**: `POST /public/pedidos` con header `x-tenant-key` y body válido → responde 201 con `estado_pedido: confirmado_pago_presencial`, `estado_pago: presencial_pendiente`, `codigo_publico` en formato `VIA-2026-NNNNNN`. Verificar en DB que el cliente fue upsertado.

### Implementación US1

- [x] T017 [US1] Implement `PedidosService` constructor in `src/modules/pedidos/pedidos.service.ts`: extend `BaseCrudTenantService<Pedido>`, inject `@InjectRepository(Pedido) private repo`, inject `DataSource`, inject `MenusPublicadosService`, inject `ClientesService`
- [x] T018 [US1] Implement private `generarCodigoPublico(tenantId: string, year: number, qr: QueryRunner): Promise<string>` in `src/modules/pedidos/pedidos.service.ts`: `SELECT MAX(codigo_publico) FROM pedidos WHERE tenant_id = :tid AND codigo_publico LIKE 'VIA-{year}-%' FOR UPDATE` → extraer número → incrementar → `VIA-${year}-${String(seq).padStart(6, '0')}`
- [x] T019 [US1] Implement `crearPedidoPublico(dto: CreatePedidoPublicoDto): Promise<Pedido>` in `src/modules/pedidos/pedidos.service.ts` using `DataSource.createQueryRunner()` transaction: (1) findOne menuPublicado + validar estado ACTIVO → `PEDIDO_MENU_NO_DISPONIBLE`, (2) validar punto_retiro_id en `mp.puntosRetiro` → `PEDIDO_PUNTO_RETIRO_NO_HABILITADO`, (3) si `limite_maximo_viandas` → COUNT con FOR UPDATE → `PEDIDO_CAPACIDAD_AGOTADA`, (4) calcular precio_unitario/importe_total, (5) `ClientesService.upsertByDni()`, (6) `generarCodigoPublico()`, (7) asignar estado según medio_pago (presencial→confirmado_pago_presencial/presencial_pendiente/expires_at null; mercado_pago→pendiente_pago_online/pendiente/expires_at now+15min), (8) `qr.manager.save(Pedido, data)`, (9) commit
- [x] T020 [US1] Implement `crearPedidoManual(dto: CreatePedidoManualDto, usuarioId: string): Promise<Pedido>` in `src/modules/pedidos/pedidos.service.ts`: validar `dto.medio_pago === presencial` → `PEDIDO_SOLO_PAGO_PRESENCIAL_MANUAL`, luego reutilizar lógica de `crearPedidoPublico` (extraer método privado compartido si aplica)
- [x] T021 [US1] Implement `POST /` in `src/modules/pedidos/public-pedidos.controller.ts`: `@Controller('public/pedidos')` (sin JwtAuthGuard), `@Post() @HttpCode(201) async crear(@Body() dto: CreatePedidoPublicoDto)` → `ok(pedido)` con status 201
- [x] T022 [US1] Implement `POST /manual` in `src/modules/pedidos/pedidos.controller.ts`: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles('administrador','supervisor')`, `@Post('manual') @HttpCode(201)`, call `svc.crearPedidoManual(dto, req.user.sub)`, then write audit `pedido.manual.created` via `AuditService.write('admin', {...})` + `auditLogPayload()`

**Checkpoint**: ✅ `POST /public/pedidos` y `POST /admin/pedidos/manual` funcionales.

---

## Phase 4: User Story 2 — Consultar Pedidos por DNI desde Portal (Priority: P2)

**Goal**: Un cliente puede consultar sus pedidos ingresando su DNI en el portal, sin autenticación. El sistema retorna los pedidos del tenant activo asociados a ese DNI (últimos 50, sin paginación).

**Independent Test**: `GET /public/pedidos/consultar?dni=12345678` con header `x-tenant-key` → lista de pedidos del cliente (puede ser vacía). Verificar que NO retorna pedidos de otros DNI ni de otros tenants.

### Implementación US2

- [x] T023 [US2] Implement `consultarPorDni(dni: string): Promise<Pedido[]>` in `src/modules/pedidos/pedidos.service.ts`: QB scoped por `tenant_id`, `WHERE p.dni_informado ILIKE :dni`, `ORDER BY p.created_at DESC`, `.take(50)`, sin paginación
- [x] T024 [US2] Implement `GET /consultar` in `src/modules/pedidos/public-pedidos.controller.ts`: `@Get('consultar') async consultar(@Query('dni') dni: string)` → `ok(pedidos)`. El dni viene como query param string simple (no DTO complejo necesario)

**Checkpoint**: ✅ `GET /public/pedidos/consultar?dni=...` funcional.

---

## Phase 5: User Story 3 — Cancelar Pedido desde Portal (Priority: P3)

**Goal**: Un cliente puede cancelar su propio pedido desde el portal si la ventana de cancelación del menú publicado no expiró y el pedido no está entregado ni cancelado.

**Independent Test**: `POST /public/pedidos/:id/cancelar` con un pedido `confirmado_pago_presencial` cuyo menú tiene `fecha_hora_limite_cancelacion` en el futuro → 200 con `estado_pedido: cancelado`, `cancelado_por: cliente`. Verificar rechazo cuando el pedido está `entregado` (409 PEDIDO_NO_CANCELABLE) y cuando expiró la ventana (409 PEDIDO_FUERA_DE_VENTANA_CANCELACION).

### Implementación US3

- [x] T025 [US3] Implement `findOne(id: string): Promise<Pedido>` in `src/modules/pedidos/pedidos.service.ts`: QB scoped por `tenant_id`, LEFT JOINs a `menuPublicado`, `sede`, `puntoRetiro`, throw `PEDIDO_NOT_FOUND` si no existe
- [x] T026 [US3] Implement `cancelarDesdePortal(id: string, dto?: CancelarPedidoDto): Promise<Pedido>` in `src/modules/pedidos/pedidos.service.ts`: (1) `findOne(id)`, (2) validar estado ≠ entregado/cancelado → `PEDIDO_NO_CANCELABLE`, (3) si `pendiente_pago_online` y `expires_at < now()` → `PEDIDO_RESERVA_EXPIRADA`, (4) si `mp.fecha_hora_limite_cancelacion` existe y ya pasó → `PEDIDO_FUERA_DE_VENTANA_CANCELACION`, (5) si `estado_pago === aprobado` → `devolucion_pendiente = true`, (6) setear `estado_pedido = cancelado`, `cancelado_por = cliente`, `fecha_cancelacion = now()`, `estado_pago = cancelado`, `motivo_cancelacion = dto?.motivo`, (7) `repo.save(pedido)`
- [x] T027 [US3] Implement `POST /:id/cancelar` in `src/modules/pedidos/public-pedidos.controller.ts`: `@Post(':id/cancelar') async cancelar(@Param('id') id: string, @Body() dto?: CancelarPedidoDto)` → `ok(pedido)`

**Checkpoint**: ✅ `POST /public/pedidos/:id/cancelar` funcional con todas las validaciones de negocio.

---

## Phase 6: User Story 4 — Gestión Back Office (Priority: P4)

**Goal**: Administradores, supervisores y operadores de caja pueden listar, filtrar y ver detalle de pedidos. Administradores pueden editar campos no críticos. Todos los roles habilitados pueden cancelar desde admin (sin restricción horaria, con auditoría).

**Independent Test**: Con JWT de `administrador`: `GET /admin/pedidos` retorna lista paginada; `GET /admin/pedidos/:id` retorna detalle con relaciones; `PATCH /admin/pedidos/:id` actualiza `telefono_informado` sin modificar precio; `POST /admin/pedidos/:id/cancelar` cancela con `cancelado_por: administracion` y genera registro de auditoría. Con JWT de `operador_caja`: `POST /admin/pedidos/manual` responde 403.

### Implementación US4

- [x] T028 [US4] Implement `list(query: QueryPedidoDto)` in `src/modules/pedidos/pedidos.service.ts`: QB scoped por tenant, filtros opcionales `fecha_retiro`, `sede_id`, `punto_retiro_id`, `estado_pedido`, `estado_pago`, `menu_publicado_id`, `dni` (ILIKE en `dni_informado`), paginación con `page`/`limit`, retornar `{ items, total, page, limit }`
- [x] T029 [US4] Implement `updatePedido(id: string, dto: UpdatePedidoDto): Promise<Pedido>` in `src/modules/pedidos/pedidos.service.ts`: `findOne(id)`, asignar solo `telefono_informado`, `email_informado`, `motivo_cancelacion` (o campo observaciones si existe) del dto, `repo.save(pedido)`, retornar `findOne(id)`
- [x] T030 [US4] Implement `cancelarDesdeAdmin(id: string, dto: CancelarPedidoDto, usuarioId: string): Promise<Pedido>` in `src/modules/pedidos/pedidos.service.ts`: (1) `findOne(id)`, (2) validar estado ≠ entregado/cancelado → `PEDIDO_NO_CANCELABLE`, (3) guardar `estadoPagoAnterior`, (4) setear `estado_pedido = cancelado`, `cancelado_por = administracion`, `usuario_cancelacion_id = usuarioId`, `fecha_cancelacion = now()`, `motivo_cancelacion = dto.motivo`, `estado_pago = cancelado`, (5) si `estadoPagoAnterior === aprobado` → `devolucion_pendiente = true`, (6) `repo.save(pedido)`
- [x] T031 [US4] Implement `GET /` in `src/modules/pedidos/pedidos.controller.ts`: `@Roles('administrador','supervisor','operador_caja')`, `@Get() async list(@Query() query: QueryPedidoDto)` → `page(result.items, result.page, result.limit, result.total)`
- [x] T032 [US4] Implement `GET /:id` in `src/modules/pedidos/pedidos.controller.ts`: `@Roles('administrador','supervisor','operador_caja')`, `@Get(':id') async findOne(@Param('id') id: string)` → `ok(pedido)`
- [x] T033 [US4] Implement `PATCH /:id` in `src/modules/pedidos/pedidos.controller.ts`: `@Roles('administrador')`, `@Patch(':id') async update(@Req() req, @Param('id') id: string, @Body() dto: UpdatePedidoDto)`, call `svc.updatePedido(id, dto)`, write audit `pedido.updated` via `AuditService.write('admin', {...})` + `auditLogPayload()` with `extra: { pedidoId: id, fields: Object.keys(dto) }`
- [x] T034 [US4] Implement `POST /:id/cancelar` in `src/modules/pedidos/pedidos.controller.ts`: `@Roles('administrador','supervisor','operador_caja')`, `@Post(':id/cancelar') async cancelar(@Req() req, @Param('id') id: string, @Body() dto: CancelarPedidoDto)`, call `svc.cancelarDesdeAdmin(id, dto, req.user.sub)`, write audit `pedido.cancelado.admin` via `AuditService.write('admin', {...})` + `auditLogPayload()` with `extra: { pedidoId: id, canceladoPor: 'administracion' }`

**Checkpoint**: ✅ Todos los endpoints `/admin/pedidos` funcionales con roles y auditoría correctos.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Job de expiración de reservas y validación final de la migración.

- [x] T035 Implement `PedidosExpiracionJob` in `src/modules/pedidos/pedidos-expiracion.job.ts`: `@Injectable()`, inject `@InjectRepository(Pedido) private repo`, `@Cron('*/5 * * * *') async expirarReservas()` → query sin tenant scope: `WHERE estado_pedido = pendiente_pago_online AND expires_at < NOW() AND deleted_at IS NULL` → para cada pedido: `estado_pedido = cancelado`, `estado_pago = cancelado`, `cancelado_por = administracion`, `motivo_cancelacion = 'Reserva expirada automáticamente'`, `fecha_cancelacion = new Date()` → `repo.save(todos)` en batch
- [x] T036 Verify migration file generated in T016: confirm PostgreSQL enum types (`estado_pedido_enum`, `estado_pago_pedido_enum`, `medio_pago_pedido_enum`, `origen_cancelacion_enum`), 3 composite indexes, unique constraint on `codigo_publico`, all nullable columns match data-model.md
- [ ] T037 [P] Manual smoke test — public portal flow: create presencial order via `POST /public/pedidos`, query by DNI via `GET /public/pedidos/consultar?dni=...`, cancel via `POST /public/pedidos/:id/cancelar` — verify all business rules
- [ ] T038 [P] Manual smoke test — admin flow: list orders `GET /admin/pedidos`, get detail `GET /admin/pedidos/:id`, create manual `POST /admin/pedidos/manual`, update `PATCH /admin/pedidos/:id`, cancel `POST /admin/pedidos/:id/cancelar` — verify audit records created in DB

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar de inmediato. T002–T005 son paralelos.
- **Foundational (Phase 2)**: Requiere Phase 1 completa. BLOQUEA todos los US. T009–T013 son paralelos entre sí (archivos distintos). T014 requiere T006–T013. T015 requiere T014. T016 requiere T015.
- **US1 (Phase 3)**: Requiere Phase 2 completa. T018–T022 son secuenciales entre sí.
- **US2 (Phase 4)**: Requiere Phase 2. T023 y T024 son secuenciales.
- **US3 (Phase 5)**: Requiere Phase 2. T025 es prerequisito de T026, T026 de T027.
- **US4 (Phase 6)**: Requiere Phase 2. T025 (findOne de US3) es prerequisito — si US3 no se implementó antes, T025 puede moverse aquí. T028–T034 son independientes entre sí pero necesitan service methods previos.
- **Polish (Phase 7)**: T035 requiere Phase 2. T036 valida T016. T037 requiere Phase 3+4+5. T038 requiere Phase 3+6.

### User Story Dependencies

- **US1 (P1)**: Solo requiere Foundational. No depende de otros US.
- **US2 (P2)**: Solo requiere Foundational. Independiente de US1 (aunque en práctica se usa después de crear pedidos).
- **US3 (P3)**: Solo requiere Foundational. `findOne` (T025) puede reutilizarse desde US4 — implementar primero en US3.
- **US4 (P4)**: Solo requiere Foundational + `findOne` (T025 de US3). Independiente de US1–US3.

### Within Each User Story

- Entity/DTOs antes que Service methods
- Service methods antes que Controller endpoints
- Cada US entrega un incremento funcional completo y testeable

### Parallel Opportunities

- T002–T005 (Phase 1): todos paralelos
- T009–T013 (Phase 2, DTOs): todos paralelos entre sí
- T037 y T038 (Phase 7): paralelos

---

## Parallel Example: Phase 2 (DTOs)

```
Iniciar en paralelo (archivos distintos, sin dependencias):
  T009: create-pedido-publico.dto.ts
  T010: create-pedido-manual.dto.ts
  T011: update-pedido.dto.ts
  T012: query-pedido.dto.ts
  T013: cancelar-pedido.dto.ts

Luego secuencial (depende de todos los DTOs):
  T014: pedidos.module.ts (wiring completo)
  T015: app.module.ts (registro)
  T016: db:migration:generate
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001–T005)
2. Completar Phase 2: Foundational (T006–T016) — CRÍTICO
3. Completar Phase 3: US1 (T017–T022)
4. **STOP y VALIDAR**: `POST /public/pedidos` funcional, código público generado, cliente upsertado
5. Demo/deploy si el MVP es suficiente

### Incremental Delivery

1. Setup + Foundational → módulo registrado y migración aplicada
2. US1 → portal puede recibir pedidos presenciales (MVP)
3. US2 → portal puede consultar pedidos por DNI
4. US3 → portal puede cancelar pedidos
5. US4 → back office completo con auditoría
6. Polish → job de expiración + smoke tests

### Notas de Implementación

- `crearPedidoPublico` y `crearPedidoManual` comparten lógica — considerar extraer método privado `_crearPedidoCore()` para no duplicar la transacción
- `findOne` (T025) es compartido por US3 y US4 — implementarlo una sola vez en la fase que lo necesite primero (US3)
- El `PedidosExpiracionJob` usa `@InjectRepository(Pedido)` directamente (sin BaseCrudTenantService) porque corre fuera de contexto de request
- `ScheduleModule.forRoot()` ya está registrado en `AuditModule` — NO agregarlo en `PedidosModule` ni en `AppModule`
- `[P]` en este módulo indica archivos distintos sin dependencia entre sí, no implementación multi-thread

---

## Notes

- `[P]` = archivos distintos, sin dependencias incompletas — pueden delegarse a agentes paralelos
- `[USN]` mapea la tarea al User Story para trazabilidad
- Cada checkpoint define un estado funcional y testeable de forma independiente
- Precio inmutable: `UpdatePedidoDto` no tiene `precio_unitario` ni `importe_total` — TypeScript lo garantiza en compilación
- `throw new Error()` prohibido — usar siempre `throw new AppError({ code: ErrorCodes.X, ... })`
- Todas las queries del service llevan `tenant_id` scope — usar `this.getTenantId({ strictTenant: true })`
