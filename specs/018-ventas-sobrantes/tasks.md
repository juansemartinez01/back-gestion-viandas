# Tasks: Ventas de Sobrantes

**Input**: Design documents from `specs/018-ventas-sobrantes/`

**Prerequisites**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/ventas-sobrantes.api.md](./contracts/ventas-sobrantes.api.md)

**Tests**: No incluidos (no solicitados en la spec).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Crear la estructura base del módulo y registrar los nuevos error codes antes de escribir cualquier lógica de negocio.

- [x] T001 Crear directorios del módulo: `src/modules/ventas-sobrantes/entities/` y `src/modules/ventas-sobrantes/dto/`
- [x] T002 Agregar los dos nuevos error codes a `src/common/errors/error-codes.ts`: `VENTA_SOBRANTE_NOT_FOUND` y `SOBRANTE_PRODUCCION_NO_CONFIRMADA`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entidad y módulo base que todas las user stories requieren. DEBEN completarse antes de cualquier implementación de negocio.

**⚠️ CRÍTICO**: Ninguna user story puede comenzar hasta que esta fase esté completa.

- [x] T003 Crear la entidad `VentaSobrante` en `src/modules/ventas-sobrantes/entities/venta-sobrante.entity.ts` — sin extender `BaseEntity` (igual que `EntregaPedido`): campos `id`, `tenant_id`, `fecha` (date), `sede_id`, `punto_retiro_id`, `menu_publicado_id`, `cantidad`, `precio_unitario` decimal(10,2), `importe_total` decimal(10,2), `usuario_id`, `observacion` (text nullable), `created_at`; `@Index('idx_vs_tenant_fecha_sede', ['tenant_id', 'fecha', 'sede_id'])`; relaciones `@ManyToOne` a `Sede`, `PuntoRetiro`, `MenuPublicado` con `@JoinColumn`; tabla `ventas_sobrantes`
- [x] T004 Crear el módulo `src/modules/ventas-sobrantes/ventas-sobrantes.module.ts` con `TypeOrmModule.forFeature([VentaSobrante, StockVianda, MovimientoStockVianda, MenuPublicado, OrdenProduccionVianda])`; imports: `StockViandasModule`, `MenusPublicadosModule`, `ProduccionViandasModule`, `AuditModule`, `TenancyModule`; providers: `[VentasSobrantesService]`; controllers: `[VentasSobrantesController]`; exports: `[VentasSobrantesService]`
- [x] T005 Registrar `VentasSobrantesModule` en `src/app.module.ts`
- [x] T006 Generar la migración ejecutando `npm run db:migration:generate -- migrations/CreateVentasSobrantes` y verificar que el SQL generado crea la tabla `ventas_sobrantes` con todas las columnas (sin `updated_at` ni `deleted_at`) y el índice `idx_vs_tenant_fecha_sede`

**Checkpoint**: Entidad creada, módulo registrado en AppModule, migración lista. Las user stories pueden comenzar.

---

## Phase 3: User Story 1 - Registrar Venta de Sobrante (Priority: P1) 🎯 MVP

**Goal**: El operador_caja puede registrar una venta de sobrante. El sistema valida producción confirmada, verifica stock disponible con SELECT FOR UPDATE, descuenta el stock dentro de la misma transacción, crea el MovimientoStockVianda y audita la acción.

**Independent Test**: Con una instancia del backend levantada y una BD con OrdenProduccion confirmada y StockVianda con sobrantes disponibles, `POST /admin/ventas-sobrantes` con credenciales de `operador_caja` debe retornar 201 con `ok: true`, el stock decrementado debe reflejarse en `GET /admin/stock-viandas/:id`, y el log de auditoría debe tener una entrada `venta_sobrante.registrada`.

### Implementation for User Story 1

- [x] T007 [US1] Crear `src/modules/ventas-sobrantes/dto/crear-venta-sobrante.dto.ts` con: `fecha` (`@IsDateString()`, `@IsNotEmpty()`), `sede_id` (`@IsUUID()`, `@IsNotEmpty()`), `punto_retiro_id` (`@IsUUID()`, `@IsNotEmpty()`), `menu_publicado_id` (`@IsUUID()`, `@IsNotEmpty()`), `cantidad` (`@IsInt()`, `@Min(1)`, `@IsNotEmpty()`), `observacion` (`@IsOptional()`, `@IsString()`)
- [x] T008 [US1] Implementar `VentasSobrantesService` en `src/modules/ventas-sobrantes/ventas-sobrantes.service.ts` con el método `registrarVenta(dto: CrearVentaSobranteDto, usuarioId: string): Promise<VentaSobrante>` siguiendo el flujo transaccional del plan: (1) `tenancyService.requireTenantId()`, (2) `createQueryRunner()` + `connect()` + `startTransaction()`, (3) dentro del try: buscar `MenuPublicado` por `(id, tenant_id)` → `AppError(MENU_PUBLICADO_NOT_FOUND, 404)` si no existe; (4) buscar `OrdenProduccionVianda` por `(tenant_id, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id)` → `AppError(SOBRANTE_PRODUCCION_NO_CONFIRMADA, 409)` si no existe o estado no es `CONFIRMADA_COMPLETA` ni `CONFIRMADA_CON_DIFERENCIA`; (5) SELECT FOR UPDATE en `StockVianda` por `(tenant_id, fecha, sede_id, punto_retiro_id, menu_publicado_id)` usando `createQueryBuilder().setLock('pessimistic_write')` → `AppError(STOCK_VIANDA_NOT_FOUND, 404)` si no existe; (6) validar `stock_disponible_sobrantes - stock_vendido_sobrante >= dto.cantidad` → `AppError(STOCK_INSUFICIENTE_SOBRANTES, 409)`; (7) `precioUnitario = mp.precio_sobrante ?? mp.precio_encargo`; `importeTotal = precioUnitario * dto.cantidad`; (8) `stock.stock_vendido_sobrante += dto.cantidad`; recalcular `stock_restante`; `qr.manager.save(StockVianda, stock)`; (9) crear y guardar `MovimientoStockVianda` con `tipo_movimiento: CONSUMO_SOBRANTE`, `cantidad: -dto.cantidad`, `venta_sobrante_id: savedVenta.id`, `pedido_id: null`; (10) crear y guardar `VentaSobrante` con todos los campos; (11) `auditService.write()` con `auditLogPayload` para `venta_sobrante.registrada`; (12) `commitTransaction()`; catch: `rollbackTransaction()` + rethrow; finally: `release()`
- [x] T009 [US1] Crear `VentasSobrantesController` en `src/modules/ventas-sobrantes/ventas-sobrantes.controller.ts` con `@Controller('admin/ventas-sobrantes')`, `@UseGuards(JwtAuthGuard, RolesGuard)`: agregar endpoint `@Post() @Roles('administrador', 'operador_caja') create(@Body() dto: CrearVentaSobranteDto, @CurrentUser() user)` que llama a `service.registrarVenta(dto, user.id)` y retorna `ok(result)`

**Checkpoint**: `POST /admin/ventas-sobrantes` funcional. Stock decrementado atómicamente. Auditoría escrita. Concurrencia garantizada por SELECT FOR UPDATE.

---

## Phase 4: User Story 2 - Consultar Sobrantes Disponibles (Priority: P2)

**Goal**: El operador_caja puede consultar qué menús tienen sobrantes disponibles (> 0) para una fecha, sede y opcionalmente punto de retiro. Retorna lista con cantidad disponible calculada.

**Independent Test**: Con StockVianda con stock_disponible_sobrantes=3, stock_vendido_sobrante=1, `GET /admin/ventas-sobrantes/disponibles?fecha=2026-06-08&sede_id=<uuid>` debe retornar ese menú con `cantidad_disponible: 2`. Un menú con disponible=0 no debe aparecer en la lista.

### Implementation for User Story 2

- [x] T010 [P] [US2] Crear `src/modules/ventas-sobrantes/dto/query-disponibles.dto.ts` con: `fecha` (`@IsDateString()`, `@IsNotEmpty()`), `sede_id` (`@IsUUID()`, `@IsNotEmpty()`), `punto_retiro_id` (`@IsOptional()`, `@IsUUID()`)
- [x] T011 [US2] Agregar método `listDisponibles(query: QueryDisponiblesDto): Promise<any[]>` a `VentasSobrantesService`: `tenancyService.requireTenantId()` → QB sobre `StockVianda` con `leftJoinAndSelect('sv.menuPublicado', 'mp').leftJoinAndSelect('mp.menuBase', 'mb')` → filtros `tenant_id`, `fecha`, `sede_id`, si viene `punto_retiro_id` agregarlo → `WHERE (sv.stock_disponible_sobrantes - sv.stock_vendido_sobrante) > 0` → mapear resultados a `{ stock_id, menu_publicado_id, nombre_menu: mb.nombre, precio_sobrante: mp.precio_sobrante, precio_encargo: mp.precio_encargo, cantidad_disponible: stock_disponible_sobrantes - stock_vendido_sobrante }`
- [x] T012 [US2] Agregar endpoint `GET /disponibles` al `VentasSobrantesController` **ANTES** del endpoint `GET /:id`: `@Get('disponibles') @Roles('administrador', 'operador_caja') listDisponibles(@Query() query: QueryDisponiblesDto)` → retorna `ok(result)`. Verificar que el método está declarado antes de cualquier `@Get(':id')` en el controller.

**Checkpoint**: `GET /admin/ventas-sobrantes/disponibles?fecha=&sede_id=` retorna solo menús con stock > 0. La ruta no conflictúa con `GET /:id`.

---

## Phase 5: User Story 3 - Historial de Ventas de Sobrantes (Priority: P3)

**Goal**: Administradores y supervisores pueden consultar el historial completo de ventas con filtros, y obtener el detalle de una venta individual.

**Independent Test**: Luego de registrar al menos una venta (US1), `GET /admin/ventas-sobrantes?fecha=2026-06-08&sede_id=<uuid>` debe retornar `{ ok: true, data: { items: [...], total: N, page: 1, limit: 20 } }`. `GET /admin/ventas-sobrantes/<id-de-venta>` debe retornar el detalle completo. Un ID inexistente debe retornar 404 con `VENTA_SOBRANTE_NOT_FOUND`.

### Implementation for User Story 3

- [x] T013 [P] [US3] Crear `src/modules/ventas-sobrantes/dto/query-ventas-sobrantes.dto.ts` con campos opcionales: `fecha` (`@IsOptional()`, `@IsDateString()`), `sede_id` (`@IsOptional()`, `@IsUUID()`), `punto_retiro_id` (`@IsOptional()`, `@IsUUID()`), `menu_publicado_id` (`@IsOptional()`, `@IsUUID()`), `page` (`@IsOptional()`, `@IsInt()`, `@Min(1)`), `limit` (`@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Max(100)`)
- [x] T014 [US3] Agregar método `list(query: QueryVentasSobrantesDto)` a `VentasSobrantesService`: QB sobre `VentaSobrante` con `leftJoinAndSelect('vs.menuPublicado', 'mp').leftJoinAndSelect('mp.menuBase', 'mb')` → filtrar por `tenant_id`; si `query.fecha` agregar `WHERE vs.fecha = :fecha`; si `query.sede_id` agregar `WHERE vs.sede_id = :sedeId`; si `query.punto_retiro_id` agregar correspondiente; si `query.menu_publicado_id` agregar correspondiente → `orderBy('vs.created_at', 'DESC')` → `skip/take` con paginación → `getManyAndCount()` → retornar `{ items, total, page, limit }`
- [x] T015 [US3] Agregar método `findOne(id: string)` a `VentasSobrantesService`: QB sobre `VentaSobrante` con `leftJoinAndSelect('vs.menuPublicado', 'mp').leftJoinAndSelect('mp.menuBase', 'mb')` → filtros `id` y `tenant_id` → `getOne()` → si null: `throw new AppError({ code: ErrorCodes.VENTA_SOBRANTE_NOT_FOUND, message: 'Venta de sobrante no encontrada', status: 404 })`
- [x] T016 [US3] Agregar endpoints al `VentasSobrantesController`: `@Get() @Roles('administrador', 'supervisor', 'operador_caja') list(@Query() query: QueryVentasSobrantesDto)` → `page(result.items, result.total, result.page, result.limit)`; `@Get(':id') @Roles('administrador', 'supervisor', 'operador_caja') findOne(@Param('id', ParseUUIDPipe) id: string)` → `ok(result)`

**Checkpoint**: Historial y detalle funcionan. Filtros respetan el tenant. 404 semántico con `VENTA_SOBRANTE_NOT_FOUND`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificaciones finales de integridad del módulo antes de declararlo completo.

- [x] T017 Verificar que `VentasSobrantesModule` exporta `VentasSobrantesService` (requerido por `cierres-operativos`)
- [x] T018 Verificar el orden de decoradores en `VentasSobrantesController`: `@Get('disponibles')` debe estar declarado **antes** de `@Get(':id')` — si no es así, NestJS interpreta "disponibles" como UUID y retorna 404
- [x] T019 Ejecutar la migración con `npm run db:migration:run` en entorno de desarrollo y verificar que la tabla `ventas_sobrantes` se crea correctamente (sin `updated_at` ni `deleted_at`)
- [x] T020 Verificar que todos los métodos del servicio llaman a `tenancyService.requireTenantId()` antes de cualquier operación de base de datos
- [x] T021 [P] Verificar que el módulo compila sin errores de dependencias circulares (`npm run build`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Setup — BLOQUEA todas las user stories
- **US1 (Phase 3)**: Depende de Foundational — es el MVP
- **US2 (Phase 4)**: Depende de Foundational — puede correr en paralelo con US1 (archivos distintos: dto + método del service + endpoint)
- **US3 (Phase 5)**: Depende de Foundational — puede correr en paralelo con US1 y US2
- **Polish (Phase 6)**: Depende de US1 + US2 + US3 completas

### User Story Dependencies

- **US1 (P1)**: Puede iniciar después de Foundational. No depende de US2 ni US3.
- **US2 (P2)**: Puede iniciar después de Foundational. Solo comparte el archivo de service con US1 — coordinar ediciones.
- **US3 (P3)**: Puede iniciar después de Foundational. Comparte el service — coordinar ediciones.

### Within Each User Story

- DTO → Service method → Controller endpoint (en ese orden)
- El service debe estar inyectado y el módulo debe compilar antes de probar endpoints

### Parallel Opportunities

- T001 y T002 (Setup) pueden ejecutarse en paralelo
- T003, T004, T005, T006 (Foundational) son secuenciales
- Una vez completo Foundational: T007→T008→T009 (US1) puede iniciarse mientras T010 (US2 DTO) y T013 (US3 DTO) se crean en paralelo
- T010 (US2 DTO) y T013 (US3 DTO) son paralelos entre sí

---

## Parallel Example: Foundational → User Stories

```
# Después de completar Phase 2 (Foundational), pueden iniciarse en paralelo:

Tarea A (US1):
  T007 → CrearVentaSobranteDto
  T008 → registrarVenta() en service
  T009 → POST / en controller

Tarea B (US2, en paralelo con A):
  T010 → QueryDisponiblesDto
  T011 → listDisponibles() en service (esperar a que T008 cree el service)
  T012 → GET /disponibles en controller

Tarea C (US3, en paralelo con A y B):
  T013 → QueryVentasSobrantesDto
  T014 → list() en service (esperar a que T008 cree el service)
  T015 → findOne() en service
  T016 → GET / y GET /:id en controller
```

---

## Implementation Strategy

### MVP First (User Story 1 — Registrar Venta)

1. Completar Phase 1: Setup (T001, T002)
2. Completar Phase 2: Foundational (T003–T006)
3. Completar Phase 3: US1 (T007–T009)
4. **STOP y VALIDAR**: `POST /admin/ventas-sobrantes` funciona, stock decrementado, auditoría escrita
5. Probar concurrencia manualmente si se desea

### Incremental Delivery

1. Setup + Foundational → módulo compilable con entidad y migración
2. US1 → operadores pueden registrar ventas (MVP operativo)
3. US2 → operadores pueden consultar disponibilidad antes de vender
4. US3 → supervisores y administradores tienen historial completo

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí — pueden ejecutarse simultáneamente
- Cada User Story es independientemente testeable una vez que Foundational está completo
- La restricción más importante: `GET /disponibles` DEBE declararse antes de `GET /:id` en el controller (T012 y T016 deben verificarlo explícitamente)
- `VentaSobrante` NO extiende `BaseEntity` — definir todas las columnas manualmente igual que `EntregaPedido`
- NO llamar a `StockViandasService.consumirParaSobrante()` desde el service — actualizar el stock directamente en `qr.manager` para garantizar atomicidad (ver research.md, Decisión 2)
- Nunca usar `throw new Error()` — siempre `throw new AppError({ code: ErrorCodes.X, message: '...', status: N })`
