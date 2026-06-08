# Tasks: Módulo Cancelaciones de Pedidos

**Input**: Design documents from `specs/014-cancelaciones-pedidos/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: No incluidos (no solicitados en el spec).

**Organization**: Tareas agrupadas por user story para implementación y verificación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: A qué user story pertenece (US1–US4)
- Paths relativos desde la raíz del repositorio

---

## Phase 1: Setup (Estructura del módulo)

**Purpose**: Crear la estructura de directorios y registrar el módulo en AppModule.

- [x] T001 Crear directorio `src/modules/cancelaciones-pedidos/dto/` (estructura vacía lista para los archivos siguientes)
- [x] T002 Registrar `CancelacionesPedidosModule` en el array `imports` de `src/app.module.ts`

---

## Phase 2: Foundational (Infraestructura del módulo — bloquea todas las US)

**Purpose**: Esqueleto del módulo, servicio y controlador con inyección de dependencias lista. Ninguna user story puede avanzar hasta que esta fase esté completa.

**⚠️ CRÍTICO**: Completar antes de iniciar cualquier user story.

- [x] T003 Crear `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.module.ts` — `@Module` con `TypeOrmModule.forFeature([Pedido])`, `TenancyModule`, providers `[CancelacionesPedidosService]`, controllers `[CancelacionesPedidosController]`, exports `[CancelacionesPedidosService]`
- [x] T004 [P] Crear `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.service.ts` — esqueleto de clase con `@Injectable()`, constructor que inyecta `@InjectRepository(Pedido) pedidoRepo: Repository<Pedido>` y `TenancyService`; sin métodos de negocio todavía
- [x] T005 [P] Crear `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.controller.ts` — esqueleto de clase con `@Controller('admin/cancelaciones')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, constructor que inyecta `CancelacionesPedidosService`; sin endpoints todavía

**Checkpoint**: `npm run build` pasa sin errores. El módulo se carga en AppModule.

---

## Phase 3: User Story 1 — Consultar pedidos cancelados con filtros (Priority: P1) 🎯 MVP

**Goal**: Exponer `GET /admin/cancelaciones` con paginación y filtros opcionales (fechas, sede, origen, devolución pendiente). Roles: administrador, supervisor.

**Independent Test**: Llamar `GET /admin/cancelaciones` autenticado como administrador sin filtros → recibir lista paginada de pedidos con `estado_pedido = cancelado`. Aplicar filtro `cancelado_por=cliente` → solo pedidos cancelados por cliente. Llamar con rol `operador_caja` → 403.

### Implementation for User Story 1

- [x] T006 [P] [US1] Crear `src/modules/cancelaciones-pedidos/dto/query-cancelaciones.dto.ts` — clase `QueryCancelacionesDto extends PageQueryDto` con campos: `fecha_desde` `@IsOptional @IsDateString`, `fecha_hasta` `@IsOptional @IsDateString`, `sede_id` `@IsOptional @IsUUID`, `cancelado_por` `@IsOptional @IsEnum(OrigenCancelacion)` (importado de `src/modules/pedidos/pedido.enums.ts`), `devolucion_pendiente` `@IsOptional @IsBoolean @Transform(({ value }) => value === 'true' || value === true)`
- [x] T007 [US1] Implementar método `list(query: QueryCancelacionesDto): Promise<[Pedido[], number]>` en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.service.ts` — QueryBuilder con: `WHERE estado_pedido = 'cancelado' AND tenant_id = :tenantId`; LEFT JOIN sede, puntoRetiro, menuPublicado, cliente; filtros opcionales según campos de `query`; `ORDER BY pedido.fecha_cancelacion DESC`; `.skip().take().getManyAndCount()`
- [x] T008 [US1] Agregar endpoint `GET /` en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.controller.ts` — `@Get() @Roles('administrador', 'supervisor') async list(@Query() query: QueryCancelacionesDto)` → llama `this.service.list(query)` → retorna `page(data, count, query)`

**Checkpoint**: `GET /admin/cancelaciones` responde con `{ ok: true, data: [...], meta: { page, limit, total, totalPages } }`. Filtros funcionan correctamente. Rol `operador_caja` recibe 403.

---

## Phase 4: User Story 4 — Validación interna de elegibilidad de cancelación (Priority: P1)

**Goal**: Proveer `validarReglaCancelacionPortal(pedido, menuPublicado)` como método público exportado del servicio, listo para ser consumido por `PedidosService`. Función pura sin acceso a DB.

**Independent Test**: Llamar el método directamente en unit test o desde `PedidosService` con distintas combinaciones de `estado_pedido` y `fecha_hora_limite_cancelacion` → verificar que cada caso retorna `{ permitido, motivo? }` correctamente según el contrato en `contracts/api-endpoints.md`.

### Implementation for User Story 4

- [x] T009 [US4] Implementar método `validarReglaCancelacionPortal(pedido: Pedido, menuPublicado: MenuPublicado): { permitido: boolean; motivo?: string }` en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.service.ts` — evaluar en orden: `ENTREGADO` → false; `CANCELADO` → false; `NO_RETIRADO` → false; `PENDIENTE_PAGO_ONLINE` → false; `CONFIRMADO_PAGO_ONLINE` → false; `fecha_hora_limite_cancelacion === null` → false; `new Date() > fecha_hora_limite_cancelacion` → false; else → `{ permitido: true }`; usar `EstadoPedido` enum importado de `pedido.enums.ts`; no usar `throw new Error()`

**Checkpoint**: Llamar el método desde cualquier servicio que importe `CancelacionesPedidosService` retorna el resultado esperado para los 7 estados/condiciones documentados en `contracts/api-endpoints.md`.

---

## Phase 5: User Story 2 — Pedidos con devolución pendiente (Priority: P2)

**Goal**: Exponer `GET /admin/cancelaciones/devolucion-pendiente` — lista todos los pedidos cancelados con `devolucion_pendiente = true`. Solo rol administrador.

**Independent Test**: Llamar `GET /admin/cancelaciones/devolucion-pendiente` como administrador → solo devuelve pedidos con `estado_pedido = cancelado AND devolucion_pendiente = true`. Llamar como supervisor → 403.

### Implementation for User Story 2

- [x] T010 [US2] Implementar método `listDevolucionPendiente(): Promise<Pedido[]>` en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.service.ts` — QueryBuilder con: `WHERE estado_pedido = 'cancelado' AND devolucion_pendiente = true AND tenant_id = :tenantId`; LEFT JOIN sede, cliente; `ORDER BY pedido.fecha_cancelacion DESC`; `.getMany()`
- [x] T011 [US2] Agregar endpoint `GET /devolucion-pendiente` en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.controller.ts` — `@Get('devolucion-pendiente') @Roles('administrador') async listDevolucionPendiente()` → llama `this.service.listDevolucionPendiente()` → retorna `ok(data)`

**Checkpoint**: `GET /admin/cancelaciones/devolucion-pendiente` retorna `{ ok: true, data: [...] }` solo con pedidos que tienen devolución pendiente. Supervisor recibe 403.

---

## Phase 6: User Story 3 — Resumen de cancelaciones del día (Priority: P2)

**Goal**: Exponer `GET /admin/cancelaciones/resumen?fecha=:fecha&sede_id=:id` — objeto con totales del día: total, por_cliente, por_administracion, con_devolucion_pendiente. Roles: administrador, supervisor.

**Independent Test**: Llamar `GET /admin/cancelaciones/resumen` sin parámetros → resumen del día actual. Llamar con `fecha` y `sede_id` → totales solo de esa sede y fecha. Verificar que `por_cliente + por_administracion = total_cancelaciones`.

### Implementation for User Story 3

- [x] T012 [P] [US3] Crear `src/modules/cancelaciones-pedidos/dto/resumen-cancelaciones.dto.ts` — clase `ResumenCancelacionesDto` con: `fecha` `@IsOptional @IsDateString`, `sede_id` `@IsOptional @IsUUID`
- [x] T013 [US3] Implementar método `resumenDia(query: ResumenCancelacionesDto): Promise<ResumenCancelacionesResult>` en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.service.ts` — calcular `fecha` (default: hoy en formato YYYY-MM-DD); QueryBuilder con aggregate `SELECT COUNT(*), SUM(CASE WHEN cancelado_por='cliente'), SUM(CASE WHEN cancelado_por='administracion'), SUM(CASE WHEN devolucion_pendiente=true)` sobre pedidos cancelados del tenant del día; filtro opcional por sede_id; `.getRawOne()`; mapear a objeto `{ fecha, sede_id, total_cancelaciones, por_cliente, por_administracion, con_devolucion_pendiente }`
- [x] T014 [US3] Agregar endpoint `GET /resumen` en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.controller.ts` — `@Get('resumen') @Roles('administrador', 'supervisor') async resumen(@Query() query: ResumenCancelacionesDto)` → llama `this.service.resumenDia(query)` → retorna `ok(resumen)`

**Checkpoint**: `GET /admin/cancelaciones/resumen` retorna `{ ok: true, data: { fecha, sede_id, total_cancelaciones, por_cliente, por_administracion, con_devolucion_pendiente } }`. Totales son consistentes con el listado de la misma fecha/sede. Fecha por defecto es hoy cuando no se proporciona.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Ajustes finales y verificación de cumplimiento del contrato.

- [x] T015 [P] Verificar que todos los endpoints de `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.controller.ts` retornan exactamente el shape documentado en `contracts/api-endpoints.md` (incluyendo 403 para roles incorrectos)
- [x] T016 Verificar que `CancelacionesPedidosService` está correctamente exportado en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.module.ts` y puede ser inyectado en `PedidosModule` para usar `validarReglaCancelacionPortal`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar de inmediato
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA todas las US
- **US1 (Phase 3)**: Depende de Phase 2 — implementable en paralelo con US4
- **US4 (Phase 4)**: Depende de Phase 2 — implementable en paralelo con US1
- **US2 (Phase 5)**: Depende de Phase 2 — puede iniciar tras Phase 2, independiente de US1/US4
- **US3 (Phase 6)**: Depende de Phase 2 — puede iniciar tras Phase 2, independiente de US1/US4/US2
- **Polish (Phase 7)**: Depende de todas las US completadas

### User Story Dependencies

- **US1 (P1)**: Puede iniciar tras Phase 2. Sin dependencia en otras US.
- **US4 (P1)**: Puede iniciar tras Phase 2. Sin dependencia en otras US. Función pura — no depende de ningún endpoint.
- **US2 (P2)**: Puede iniciar tras Phase 2. Sin dependencia en US1 o US4.
- **US3 (P2)**: Puede iniciar tras Phase 2. Sin dependencia en US1, US2 o US4.

### Within Each User Story

- DTOs antes que el método de servicio
- Método de servicio antes que el endpoint del controller
- Completar la US antes de pasar a la siguiente

### Parallel Opportunities

- T004 y T005 (Phase 2) en paralelo
- T006 (DTO) en paralelo con cualquier tarea en otro archivo
- T007 y T009 en paralelo (métodos distintos del servicio — solo si se trabajan en ramas separadas del archivo)
- T012 (DTO resumen) en paralelo con T010/T011 (US2)
- US1 y US4 pueden trabajarse simultáneamente por distintos desarrolladores

---

## Parallel Example: Phase 2 + Phase 3

```text
# Phase 2 — launch in parallel:
T004: Crear cancelaciones-pedidos.service.ts (esqueleto)
T005: Crear cancelaciones-pedidos.controller.ts (esqueleto)

# Phase 3 (US1) — sequential within story:
T006: Crear query-cancelaciones.dto.ts
T007: Implementar list() en service (depende de T006)
T008: Agregar GET / en controller (depende de T007)
```

---

## Implementation Strategy

### MVP First (US1 — Listado con filtros)

1. Completar Phase 1: Setup (T001–T002)
2. Completar Phase 2: Foundational (T003–T005) — CRÍTICO
3. Completar Phase 3: US1 (T006–T008)
4. **STOP y VALIDAR**: `GET /admin/cancelaciones` funciona con filtros y paginación
5. Demostrar o desplegar si listo

### Incremental Delivery

1. Phase 1 + Phase 2 → Módulo carga sin errores
2. US1 → Listado de cancelaciones operativo (MVP)
3. US4 → `validarReglaCancelacionPortal` disponible para `PedidosService`
4. US2 → Listado de devoluciones pendientes operativo
5. US3 → Resumen diario operativo
6. Cada story es verificable y entregable de forma independiente

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí
- `[US?]` mapea cada tarea a su user story para trazabilidad
- No crear migraciones — todos los campos necesarios ya existen en la entidad `Pedido`
- Importar `OrigenCancelacion` y `EstadoPedido` desde `src/modules/pedidos/pedido.enums.ts`, no duplicar
- No usar `throw new Error()` — solo `AppError` con código de `ErrorCodes`
- Toda query lleva `tenant_id` scope obligatorio
- El módulo no importa `PedidosModule` — usa `TypeOrmModule.forFeature([Pedido])` directamente
