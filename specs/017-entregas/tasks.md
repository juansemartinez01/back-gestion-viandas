# Tasks: Entregas de Viandas

**Input**: Design documents from `specs/017-entregas/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api-endpoints.md ✅ | quickstart.md ✅

**Tests**: No solicitados — no se generan tareas de test.

**Organization**: Tareas agrupadas por user story para implementación y verificación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede ejecutar en paralelo con otras tareas marcadas [P] del mismo bloque
- **[Story]**: User story a la que pertenece la tarea
- Rutas relativas al root del repositorio

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Crear estructura de archivos y registrar errores antes de cualquier implementación.

- [x] T001 Crear estructura de directorios `src/modules/entregas/entities/` y `src/modules/entregas/dto/`
- [x] T002 Agregar 3 nuevos ErrorCodes en `src/common/errors/error-codes.ts` bajo sección `// entregas`: `ENTREGA_PEDIDO_NO_ENTREGABLE` (409), `ENTREGA_YA_REGISTRADA` (409), `ENTREGA_NOT_FOUND` (404)

---

## Phase 2: Foundational (Prerrequisitos bloqueantes)

**Purpose**: Entidad, DTOs, migración y módulo — deben completarse antes de cualquier user story.

**⚠️ CRÍTICO**: Ninguna user story puede implementarse hasta que esta fase esté completa y la migración aplicada.

- [x] T003 Crear entidad `EntregaPedido` en `src/modules/entregas/entities/entrega-pedido.entity.ts` — campos: `id` (uuid PK), `tenant_id` (uuid), `pedido_id` (uuid, `@Unique`), `sede_id` (uuid), `punto_retiro_id` (uuid), `usuario_id` (uuid), `importe_cobrado_caja` (decimal 10,2, default 0), `fecha_entrega` (timestamptz), `observacion` (text, nullable), `created_at` (timestamptz) — SIN `updated_at`, SIN `deleted_at` — decoradores: `@Unique(['pedido_id'])`, `@Index(['tenant_id', 'fecha_entrega', 'sede_id'])`
- [x] T004 [P] Crear `CrearEntregaDto` en `src/modules/entregas/dto/crear-entrega.dto.ts` — campos: `pedido_id` (`@IsUUID`, `@IsNotEmpty`), `punto_retiro_id` (`@IsUUID`, `@IsNotEmpty`), `observacion` (`@IsOptional`, `@IsString`)
- [x] T005 [P] Crear `QueryEntregasDto` en `src/modules/entregas/dto/query-entregas.dto.ts` — campos opcionales: `fecha_desde` (`@IsOptional`, `@IsDateString`), `fecha_hasta` (`@IsOptional`, `@IsDateString`), `sede_id` (`@IsOptional`, `@IsUUID`), `punto_retiro_id` (`@IsOptional`, `@IsUUID`), `usuario_id` (`@IsOptional`, `@IsUUID`), `page` (`@IsOptional`, `@IsInt`, `@Min(1)`), `limit` (`@IsOptional`, `@IsInt`, `@Min(1)`)
- [x] T006 [P] Crear `BuscarPorDniDto` en `src/modules/entregas/dto/buscar-por-dni.dto.ts` — campos: `dni` (`@IsString`, `@IsNotEmpty`), `fecha` (`@IsDateString`, `@IsNotEmpty`), `sede_id` (`@IsUUID`, `@IsNotEmpty`), `punto_retiro_id` (`@IsOptional`, `@IsUUID`)
- [x] T007 Generar migración: `npm run db:migration:generate -- migrations/CreateEntregas` — verificar que el archivo generado incluya: tabla `entrega_pedidos`, constraint `UNIQUE` en `pedido_id`, índice compuesto `(tenant_id, fecha_entrega, sede_id)`, SIN columna `deleted_at`, SIN columna `updated_at`
- [x] T008 Aplicar migración: `npm run db:migration:run` — verificar que la tabla existe en la base de datos
- [x] T009 Crear `EntregasModule` en `src/modules/entregas/entregas.module.ts` — `TypeOrmModule.forFeature([EntregaPedido, Pedido, StockVianda, Pago])`, imports: `PedidosModule`, `PagosModule`, `StockViandasModule`, `AuditModule`, `TenancyModule` — exports: `EntregasService`
- [x] T010 Registrar `EntregasModule` en `src/app.module.ts`

**Checkpoint**: Migración aplicada, módulo registrado, compilación sin errores (`npm run build`). User story implementation puede comenzar.

---

## Phase 3: US1 + US2 — Registrar Entrega (Priority: P1) 🎯 MVP

**User Stories**: US1 (pago presencial) + US2 (pago online aprobado) — mismo endpoint, dos ramas del flujo.

**Goal**: El operador de caja puede registrar la entrega de un pedido confirmado. El sistema valida estado, idempotencia y stock, registra el cobro si es presencial (o $0 si es online), actualiza el pedido a `entregado` y crea el `EntregaPedido` — todo en una transacción QueryRunner.

**Independent Test**: `POST /admin/entregas` con un pedido `confirmado_pago_presencial` → responde 201 con `entrega` creada, pedido en estado `entregado`, `Pago` en estado `presencial_cobrado`, stock decrementado. Segundo intento con el mismo `pedido_id` → 409 `ENTREGA_YA_REGISTRADA`.

### Implementación US1 + US2

- [x] T011 [US1] Crear `EntregasService` vacío en `src/modules/entregas/entregas.service.ts` — inyectar: `DataSource`, `TenancyService`, `AuditService`, `StockViandasService`, `@InjectRepository(EntregaPedido)`, `@InjectRepository(Pedido)`, `@InjectRepository(StockVianda)`, `@InjectRepository(Pago)`
- [x] T012 [US1] Implementar `EntregasService.registrarEntrega(dto: CrearEntregaDto, usuarioId: string)` en `src/modules/entregas/entregas.service.ts` siguiendo el patrón QueryRunner de `quickstart.md`:
  - Paso 1: `requireTenantId()`, crear QR, conectar, iniciar transacción
  - Paso 2: SELECT FOR UPDATE sobre `Pedido` por `(id, tenant_id)` — lanzar `PEDIDO_NOT_FOUND` (404) si no existe
  - Paso 3: Validar `estado_pedido IN [CONFIRMADO_PAGO_ONLINE, CONFIRMADO_PAGO_PRESENCIAL]` — lanzar `ENTREGA_PEDIDO_NO_ENTREGABLE` (409) si no
  - Paso 4: Verificar no existe `EntregaPedido` con `pedido_id` — lanzar `ENTREGA_YA_REGISTRADA` (409) si existe
  - Paso 5: Buscar `StockVianda` por `(tenant_id, fecha=pedido.fecha_retiro, sede_id, punto_retiro_id, menu_publicado_id)` — lanzar `STOCK_VIANDA_NOT_FOUND` (404) si no existe
  - Paso 6: Llamar `this.stockViandasService.consumirParaEntrega(stock.id, pedido.cantidad, pedido.id, tenantId)`
  - Paso 7: Si `pedido.medio_pago === MedioPagoPedido.PRESENCIAL` → buscar `Pago` via `qr.manager`, validar estado `PRESENCIAL_PENDIENTE`, actualizar a `PRESENCIAL_COBRADO` con `fecha_registro_presencial = new Date()`, guardar; `importeCobradoCaja = Number(pedido.importe_total)`. Si `MERCADO_PAGO` → `importeCobradoCaja = 0`
  - Paso 8: Actualizar pedido: `estado_pedido = ENTREGADO`, `fecha_confirmacion = new Date()`, guardar via `qr.manager`
  - Paso 9: Crear `EntregaPedido` via `qr.manager` con todos los campos (`tenant_id`, `pedido_id`, `sede_id = pedido.sede_id`, `punto_retiro_id = dto.punto_retiro_id`, `usuario_id`, `importe_cobrado_caja`, `fecha_entrega = new Date()`, `observacion`)
  - Paso 10: `this.auditService.write('admin', { actor_user_id: usuarioId, action: 'entrega.registrada', entity: 'entrega_pedido', payload: auditLogPayload(...) })`
  - Paso 11: `qr.commitTransaction()` — en catch: `qr.rollbackTransaction(); throw err` — en finally: `qr.release()`
  - Retornar `savedEntrega` con `pedido` asignado
- [x] T013 [US1] Crear `EntregasController` en `src/modules/entregas/entregas.controller.ts` con `@Controller('admin/entregas')`, `@UseGuards(JwtAuthGuard, RolesGuard)`. Implementar handler `@Post('/')` con `@Roles('administrador', 'operador_caja')` — extraer `usuarioId` del JWT (`req.user['sub']` o equivalente), llamar `entregasService.registrarEntrega(dto, usuarioId)`, retornar `ok(result)` con status 201

**Checkpoint**: `POST /admin/entregas` funcional. Probar ambas ramas (presencial y online). Verificar idempotencia con segundo intento → 409. Verificar que pedido queda `entregado` y stock decrementado.

---

## Phase 4: US3 — Buscar Pedidos por DNI (Priority: P1)

**Goal**: El operador puede buscar pedidos disponibles para entrega ingresando el DNI del cliente en la pantalla de caja.

**Independent Test**: `GET /admin/entregas/buscar-por-dni?dni=12345678&fecha=2026-06-08&sede_id=<uuid>` → lista pedidos en estado `confirmado_pago_online` o `confirmado_pago_presencial` para esa sede y fecha. DNI sin pedidos → lista vacía. Pedido ya entregado → no aparece en resultados.

### Implementación US3

- [x] T014 [US3] Implementar `EntregasService.buscarPorDni(query: BuscarPorDniDto)` en `src/modules/entregas/entregas.service.ts` — QB sobre `Pedido` con `LEFT JOIN menuPublicado` y `LEFT JOIN menuBase`, filtros: `tenant_id`, `dni_informado ILIKE :dni`, `estado_pedido IN [CONFIRMADO_PAGO_ONLINE, CONFIRMADO_PAGO_PRESENCIAL]`, `fecha_retiro = query.fecha`, `sede_id = query.sede_id`, `deleted_at IS NULL`, `punto_retiro_id` (si viene), `ORDER BY apellido_informado ASC`
- [x] T015 [US3] Agregar handler `@Get('buscar-por-dni')` en `src/modules/entregas/entregas.controller.ts` con `@Roles('administrador', 'operador_caja')` — **IMPORTANTE: declarar ANTES del handler `@Get(':id')` para evitar conflicto de rutas** — usar `@Query()` con `BuscarPorDniDto`, retornar `ok(result)`

**Checkpoint**: `GET /admin/entregas/buscar-por-dni` retorna pedidos disponibles por DNI. Lista vacía cuando no hay coincidencias. Pedidos entregados no aparecen.

---

## Phase 5: US4 — Historial de Entregas (Priority: P2)

**Goal**: Administrador y supervisor pueden listar las entregas del día con filtros por fecha, sede, punto de retiro y operador.

**Independent Test**: `GET /admin/entregas?fecha_desde=2026-06-08&fecha_hasta=2026-06-08&sede_id=<uuid>` → lista paginada de entregas con datos del pedido asociado. Filtros combinados funcionan correctamente.

### Implementación US4

- [x] T016 [US4] Implementar `EntregasService.list(query: QueryEntregasDto)` en `src/modules/entregas/entregas.service.ts` — QB sobre `EntregaPedido` con `LEFT JOIN pedido` (campos: `codigo_publico`, `dni_informado`, `nombre_informado`, `apellido_informado`, `medio_pago`, `importe_total`), filtros por `tenant_id`, `fecha_entrega >= fecha_desde` (si viene), `fecha_entrega <= fecha_hasta` (si viene), `sede_id` (si viene), `punto_retiro_id` (si viene), `usuario_id` (si viene), paginación con `page`/`limit` (default 1/20), retornar `{ items, total, page, limit }`
- [x] T017 [US4] Agregar handler `@Get('/')` en `src/modules/entregas/entregas.controller.ts` con `@Roles('administrador', 'supervisor', 'operador_caja')` — usar `@Query()` con `QueryEntregasDto`, retornar `page(items, { total, page, limit })`

**Checkpoint**: `GET /admin/entregas` retorna lista paginada. Filtros de fecha, sede y operador funcionan. `supervisor` puede acceder; `operador_caja` puede acceder.

---

## Phase 6: US5 — Detalle de Entrega (Priority: P3)

**Goal**: Administrador y supervisor pueden ver el detalle completo de una entrega específica.

**Independent Test**: `GET /admin/entregas/<uuid>` → devuelve todos los campos de la entrega con datos del pedido asociado. ID inexistente → 404 `ENTREGA_NOT_FOUND`.

### Implementación US5

- [x] T018 [US5] Implementar `EntregasService.findOne(id: string)` en `src/modules/entregas/entregas.service.ts` — QB sobre `EntregaPedido` con `LEFT JOIN pedido`, filtros `id` y `tenant_id`; lanzar `AppError({ code: ErrorCodes.ENTREGA_NOT_FOUND, status: 404 })` si no existe
- [x] T019 [US5] Agregar handler `@Get(':id')` en `src/modules/entregas/entregas.controller.ts` con `@Roles('administrador', 'supervisor', 'operador_caja')` — **IMPORTANTE: declarar DESPUÉS de `@Get('buscar-por-dni')`** — retornar `ok(result)`

**Checkpoint**: `GET /admin/entregas/<uuid-válido>` → 200 con detalle. `GET /admin/entregas/<uuid-inexistente>` → 404. `GET /admin/entregas/buscar-por-dni` sigue funcionando (no colisiona con `/:id`).

---

## Phase 7: Polish & Verificación Final

**Purpose**: Validación end-to-end y limpieza.

- [x] T020 Verificar orden de handlers en `src/modules/entregas/entregas.controller.ts`: `@Post('/')` → `@Get('/')` → `@Get('buscar-por-dni')` → `@Get(':id')` (en ese orden exacto)
- [x] T021 [P] Verificar compilación completa: `npm run build` sin errores de TypeScript
- [x] T022 Ejecutar flujo completo del quickstart.md: buscar por DNI → registrar entrega presencial → verificar pedido `entregado` → verificar stock decrementado → intentar segunda entrega → 409 `ENTREGA_YA_REGISTRADA`
- [x] T023 [P] Verificar que `EntregasService` está exportado en `EntregasModule` y que puede ser importado por módulos externos (prerrequisito para `cierres-operativos`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA todas las user stories
- **US1+US2 (Phase 3)**: Depende de Phase 2 — el más crítico, implementar primero
- **US3 (Phase 4)**: Depende de Phase 2 — puede trabajarse en paralelo con Phase 3 si hay capacidad
- **US4 (Phase 5)**: Depende de Phase 2 — independiente de US1/US2/US3
- **US5 (Phase 6)**: Depende de Phase 2 — independiente de las demás
- **Polish (Phase 7)**: Depende de todas las phases anteriores

### User Story Dependencies

- **US1+US2 (P1)**: Sin dependencias entre user stories — requiere solo Phase 2 completa
- **US3 (P1)**: Sin dependencias entre user stories — requiere solo Phase 2 completa
- **US4 (P2)**: Sin dependencias entre user stories — requiere solo Phase 2 completa
- **US5 (P3)**: Sin dependencias entre user stories — requiere solo Phase 2 completa

### Within Each User Story

- Servicio antes que controller (T011 → T012 → T013, T014 → T015, etc.)
- Migración (T007→T008) antes que cualquier ejecución en runtime

### Parallel Opportunities

- T004, T005, T006 (DTOs) pueden ejecutarse en paralelo entre sí — archivos distintos
- Phase 3, 4, 5, 6 pueden trabajarse en paralelo por distintos desarrolladores una vez que Phase 2 está completa
- T021 y T023 (verificación) pueden ejecutarse en paralelo

---

## Parallel Example: Foundational (Phase 2)

```
# DTOs pueden generarse en paralelo:
Task T004: "Crear CrearEntregaDto en src/modules/entregas/dto/crear-entrega.dto.ts"
Task T005: "Crear QueryEntregasDto en src/modules/entregas/dto/query-entregas.dto.ts"
Task T006: "Crear BuscarPorDniDto en src/modules/entregas/dto/buscar-por-dni.dto.ts"
```

## Parallel Example: User Stories (post-Phase 2)

```
# Con dos desarrolladores, después de Phase 2 completa:
Dev A → Phase 3 (registrarEntrega - flujo principal)
Dev B → Phase 4 (buscarPorDni - pantalla de caja)
# Luego:
Dev A → Phase 5 (list)
Dev B → Phase 6 (findOne)
```

---

## Implementation Strategy

### MVP First (US1+US2+US3 — operación diaria completa)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (migración aplicada, módulo registrado)
3. Completar Phase 3: registrarEntrega (el flujo transaccional crítico)
4. Completar Phase 4: buscarPorDni (la pantalla de caja no funciona sin esto)
5. **STOP y VALIDAR**: El operador puede buscar pedidos y registrar entregas — MVP operativo
6. Continuar con Phase 5+6 para consulta y auditoría

### Incremental Delivery

1. Setup + Foundational → base lista
2. Phase 3 (registrarEntrega) → operación diaria de entregas funcional
3. Phase 4 (buscarPorDni) → pantalla de caja completa
4. Phase 5 (list) → supervisión y reporte
5. Phase 6 (findOne) → auditoría por entrega individual
6. Phase 7 (polish) → validación completa lista para `cierres-operativos`

---

## Notes

- [P] = archivos distintos, sin dependencias entre sí — seguro ejecutar en paralelo
- La tarea T012 (registrarEntrega) es la más compleja — leer `quickstart.md` antes de implementar
- No llamar a `PagosService.registrarCobroPresencial()` desde dentro de la transacción — hacerlo inline via `qr.manager` (ver research.md Decision 2)
- `GET /buscar-por-dni` DEBE declararse antes de `GET /:id` en el controller — verificar en T019 y T020
- `EntregasService` debe estar en `exports` del módulo — lo necesitará `cierres-operativos` (Stage 6)
- No usar `throw new Error()` — siempre `throw new AppError({ code: ErrorCodes.X, status: NNN })`
