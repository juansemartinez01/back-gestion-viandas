# Tasks: Stock Operativo de Viandas

**Input**: Design documents from `specs/016-stock-viandas/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-endpoints.md ✅, quickstart.md ✅

**Tests**: No se incluyeron tareas de testing (no solicitadas en la spec).

**Organization**: Tareas agrupadas por historia de usuario para implementación y validación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias en tareas incompletas)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1–US6)

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Preparar la estructura del módulo y los prerrequisitos globales antes de tocar lógica de negocio.

- [x] T001 Agregar 4 códigos de error en `src/common/errors/error-codes.ts`: `STOCK_VIANDA_NOT_FOUND`, `STOCK_INSUFICIENTE_ENTREGAS`, `STOCK_INSUFICIENTE_SOBRANTES`, `STOCK_AJUSTE_INVALIDO`
- [x] T002 Crear directorio `src/modules/stock-viandas/` con subdirectorios `entities/` y `dto/`

**Checkpoint**: Errores registrados y estructura de carpetas lista.

---

## Phase 2: Foundational (Bloqueantes — deben completarse antes de cualquier historia)

**Purpose**: Entidades, enum, migración y módulo NestJS. Ninguna historia puede avanzar sin esto.

**⚠️ CRÍTICO**: Todas las historias dependen de esta fase.

- [x] T003 Crear enum `TipoMovimientoStockVianda` en `src/modules/stock-viandas/stock-vianda.enums.ts` con valores: `alta_produccion`, `consumo_entrega`, `consumo_sobrante`, `ajuste_positivo`, `ajuste_negativo`, `reasignacion_cancelacion`
- [x] T004 [P] Crear entidad `StockVianda` en `src/modules/stock-viandas/entities/stock-vianda.entity.ts` extendiendo `BaseEntity`; incluir todos los campos del data-model, el `@Unique('uq_sv_combinacion', ['tenant_id', 'fecha', 'sede_id', 'punto_retiro_id', 'menu_publicado_id'])`, el `@Index('idx_sv_tenant_fecha_sede', ['tenant_id', 'fecha', 'sede_id'])`, y las relaciones ManyToOne a Sede, PuntoRetiro, MenuPublicado, OrdenProduccionVianda (eager: false, onDelete: RESTRICT)
- [x] T005 [P] Crear entidad `MovimientoStockVianda` en `src/modules/stock-viandas/entities/movimiento-stock-vianda.entity.ts` SIN extender BaseEntity (declarar columnas manualmente: id PrimaryGeneratedColumn uuid, tenant_id, stock_vianda_id, tipo_movimiento enum, cantidad, pedido_id nullable, venta_sobrante_id nullable, usuario_id nullable, observacion nullable, created_at CreateDateColumn); incluir relación ManyToOne a StockVianda
- [x] T006 Crear esqueleto de `StockViandasService` en `src/modules/stock-viandas/stock-viandas.service.ts` inyectando `DataSource`, `Repository<StockVianda>`, `Repository<MovimientoStockVianda>`, `Repository<Pedido>`, `TenancyService`, `AuditService`; agregar método privado `calcularRestante(stock: StockVianda): number` con la fórmula `stock_reservado_encargues - stock_entregado + stock_disponible_sobrantes - stock_vendido_sobrante + stock_ajustado`
- [x] T007 Crear `StockViandasModule` en `src/modules/stock-viandas/stock-viandas.module.ts` con `TypeOrmModule.forFeature([StockVianda, MovimientoStockVianda, Pedido])`, imports `[TenancyModule, AuditModule, forwardRef(() => ProduccionViandasModule)]`, providers `[StockViandasService]`, exports `[StockViandasService]`
- [x] T008 Generar migración ejecutando `npm run db:migration:generate -- migrations/CreateStockViandas`; revisar el archivo generado para verificar que contiene las dos tablas con el constraint UNIQUE y los índices descritos en `data-model.md`; ajustar si la generación automática produce diferencias
- [x] T009 Ejecutar migración con `npm run db:migration:run` y verificar que las tablas `stock_viandas` y `movimientos_stock_viandas` se crean correctamente en la base de datos

**Checkpoint**: Entidades, módulo y tablas disponibles. El proyecto debe compilar (`npm run build`) sin errores en este punto.

---

## Phase 3: US1 — Generación de Stock al Confirmar Producción (Priority: P1) 🎯 MVP

**Goal**: Al confirmar una orden de producción, el sistema genera automáticamente el registro de stock con los contadores correctos y registra el movimiento `alta_produccion`.

**Independent Test**: Confirmar una producción existente en base de datos y verificar que existe un `StockVianda` con `stock_reservado_encargues = cantidad_pago_online + cantidad_pago_presencial`, `stock_disponible_sobrantes = max(0, cantidad_real_producida - encargues)`, y un movimiento `alta_produccion` asociado. Verificar idempotencia ejecutando la confirmación dos veces — solo debe existir un registro.

- [x] T010 [US1] Implementar `generarDesdeProduccion(orden: OrdenProduccionVianda): Promise<StockVianda>` en `src/modules/stock-viandas/stock-viandas.service.ts`: buscar StockVianda existente por (tenant_id, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id) del orden; si no existe crear nuevo con `stock_reservado_encargues = orden.cantidad_pago_online + orden.cantidad_pago_presencial`, `stock_disponible_sobrantes = Math.max(0, orden.cantidad_real_producida - (online + presencial))`; si existe actualizar esos mismos campos; en ambos casos recalcular `stock_restante` con `calcularRestante()`; crear `MovimientoStockVianda` con tipo `alta_produccion` y `cantidad = orden.cantidad_real_producida`; guardar con `repo.save()`
- [x] T011 [US1] En `src/modules/produccion-viandas/produccion-viandas.module.ts`: descomentar el import de `forwardRef` y `StockViandasModule`, agregar `forwardRef(() => StockViandasModule)` al array de imports
- [x] T012 [US1] En `src/modules/produccion-viandas/produccion-viandas.service.ts`: descomentar el import de `StockViandasService` y el parámetro en el constructor con `@Inject(forwardRef(() => StockViandasService))`; descomentar la llamada `await this.stockViandasService.generarDesdeProduccion(ordenGuardada)` dentro de `confirmarProduccion()`
- [x] T013 [US1] Verificar compilación con `npm run build` y que `AppModule` ya incluye `ProduccionViandasModule` (el stock se invoca desde ahí, no directamente desde AppModule en este punto)

**Checkpoint**: US1 funcional — confirmar una producción genera el stock automáticamente. Verificable con Postman: `POST /admin/produccion-viandas/:id/confirmar` → aparece registro en `stock_viandas`.

---

## Phase 4: US2 — Consumo de Stock para Entrega de Encargues (Priority: P1)

**Goal**: El módulo de entregas puede descontar unidades del stock de encargues con garantía de integridad bajo concurrencia — dos solicitudes simultáneas no pueden consumir más stock del disponible.

**Independent Test**: Con un `StockVianda` en BD con `stock_reservado_encargues=1` y `stock_entregado=0`, llamar a `consumirParaEntrega()` dos veces en paralelo con `cantidad=1`; verificar que exactamente una llamada tiene éxito y la otra lanza `STOCK_INSUFICIENTE_ENTREGAS`; verificar que `stock_entregado=1` y existe un movimiento `consumo_entrega`.

- [x] T014 [US2] Implementar `consumirParaEntrega(stockViandaId: string, cantidad: number, pedidoId: string, tenantId: string): Promise<void>` en `src/modules/stock-viandas/stock-viandas.service.ts` usando `this.dataSource.transaction(async (em) => { ... })`: dentro de la transacción hacer `em.getRepository(StockVianda).createQueryBuilder('sv').setLock('pessimistic_write').where('sv.id = :id AND sv.tenant_id = :tenantId').getOne()`; si no existe lanzar `AppError STOCK_VIANDA_NOT_FOUND 404`; validar `stock_reservado_encargues - stock_entregado >= cantidad` — si no lanzar `AppError STOCK_INSUFICIENTE_ENTREGAS 409`; incrementar `stock.stock_entregado += cantidad`; recalcular `stock.stock_restante`; crear y guardar `MovimientoStockVianda` tipo `consumo_entrega` con `cantidad = -cantidad` y `pedido_id`; guardar stock con `em.getRepository(StockVianda).save(stock)`

**Checkpoint**: US2 funcional — el módulo de entregas (Stage 6) podrá llamar a `consumirParaEntrega()` con garantía de no overselling. Verificable invocando el método directamente desde un test de integración o desde Postman si ya existe el módulo de entregas.

---

## Phase 5: US3 — Consumo de Stock para Venta de Sobrantes (Priority: P2)

**Goal**: El módulo de ventas-sobrantes puede descontar unidades del pool de sobrantes con la misma garantía de concurrencia que las entregas.

**Independent Test**: Con un `StockVianda` con `stock_disponible_sobrantes=1` y `stock_vendido_sobrante=0`, llamar `consumirParaSobrante()` con cantidad=1 — éxito; llamar nuevamente — lanza `STOCK_INSUFICIENTE_SOBRANTES`; verificar movimiento `consumo_sobrante` registrado.

- [x] T015 [US3] Implementar `consumirParaSobrante(stockViandaId: string, cantidad: number, ventaSobranteId: string, tenantId: string): Promise<void>` en `src/modules/stock-viandas/stock-viandas.service.ts` con el mismo patrón de transacción + SELECT FOR UPDATE que `consumirParaEntrega`; validar `stock_disponible_sobrantes - stock_vendido_sobrante >= cantidad` — si no lanzar `AppError STOCK_INSUFICIENTE_SOBRANTES 409`; incrementar `stock.stock_vendido_sobrante += cantidad`; recalcular `stock.stock_restante`; crear `MovimientoStockVianda` tipo `consumo_sobrante` con `cantidad = -cantidad` y `venta_sobrante_id`; guardar en transacción

**Checkpoint**: US3 funcional — el módulo de ventas-sobrantes (Stage 6) podrá llamar a `consumirParaSobrante()`.

---

## Phase 6: US4 — Reasignación de Stock por Cancelación Post-Producción (Priority: P2)

**Goal**: Cuando un pedido confirmado se cancela después de la confirmación de producción, su unidad se mueve automáticamente al pool de sobrantes disponibles para venta presencial — sin pérdida de inventario.

**Independent Test**: Con una producción confirmada y un pedido en estado CONFIRMADO, cancelar el pedido y verificar que `stock_disponible_sobrantes` del StockVianda del día aumenta en 1 y existe un movimiento `reasignacion_cancelacion` con el `pedido_id`.

- [x] T016 [US4] Implementar `reasignarCancelacion(pedidoId: string, tenantId: string): Promise<void>` en `src/modules/stock-viandas/stock-viandas.service.ts`: buscar el pedido por id scoped a tenant usando `this.pedidoRepo`; si no existe retornar silenciosamente (no error — la cancelación puede ser pre-producción); buscar `StockVianda` por `(tenantId, pedido.fecha_pedido, pedido.sede_id, pedido.punto_retiro_id, pedido.menu_publicado_id)`; si no existe (producción no confirmada aún) retornar silenciosamente; incrementar `stock.stock_disponible_sobrantes += 1`; recalcular `stock.stock_restante`; crear `MovimientoStockVianda` tipo `reasignacion_cancelacion` con `cantidad = 1` y `pedido_id`; guardar
- [x] T017 [US4] En el módulo o servicio de cancelaciones-pedidos que ejecute la cancelación: inyectar `StockViandasService` (importar `StockViandasModule` si no está ya) y llamar a `this.stockViandasService.reasignarCancelacion(pedido.id, tenantId)` después de marcar el pedido como cancelado — verificar el punto de integración en `src/modules/cancelaciones-pedidos/cancelaciones-pedidos.service.ts` o en `src/modules/pedidos/pedidos.service.ts` según donde se procese la cancelación

**Checkpoint**: US4 funcional — cancelar un pedido post-producción incrementa el stock de sobrantes automáticamente.

---

## Phase 7: US5 — Ajuste Manual de Stock con Trazabilidad (Priority: P2)

**Goal**: Supervisores y administradores pueden corregir el stock manualmente; cada ajuste queda auditado con usuario, fecha y observación.

**Independent Test**: Con rol `supervisor` y un StockVianda existente, `POST /admin/stock-viandas/:id/ajustar` con `{ tipo: "positivo", cantidad: 5, observacion: "reconteo" }` → `stock_ajustado` aumenta en 5, `stock_restante` aumenta en 5, existe movimiento `ajuste_positivo` con `usuario_id` y `observacion`. Con rol `operador_caja` → 403. Con cantidad 0 → 422.

- [x] T018 [US5] Crear `AjustarStockDto` en `src/modules/stock-viandas/dto/ajustar-stock.dto.ts` con campos: `tipo` (`@IsEnum(['positivo', 'negativo'])`), `cantidad` (`@IsInt()`, `@Min(1)`), `observacion` (`@IsOptional()`, `@IsString()`)
- [x] T019 [US5] Implementar `ajustarStock(id: string, dto: AjustarStockDto, usuarioId: string): Promise<StockVianda>` en `src/modules/stock-viandas/stock-viandas.service.ts`: obtener tenantId con `this.tenancyService.requireTenantId()`; buscar StockVianda por id + tenantId — si no existe lanzar `AppError STOCK_VIANDA_NOT_FOUND 404`; según `dto.tipo`: positivo → `stock.stock_ajustado += dto.cantidad`, tipo movimiento `ajuste_positivo`; negativo → `stock.stock_ajustado -= dto.cantidad`, tipo movimiento `ajuste_negativo`; recalcular `stock.stock_restante`; crear `MovimientoStockVianda` con usuario_id y observacion; guardar stock; llamar a `this.auditService.write(auditLogPayload({ event: 'stock.ajuste_manual', ... }))` dentro de la misma operación
- [x] T020 [US5] Crear `QueryStockDto` en `src/modules/stock-viandas/dto/query-stock.dto.ts` con campos: `fecha` (`@IsOptional()`, `@IsDateString()`), `sede_id` (`@IsOptional()`, `@IsUUID()`), `punto_retiro_id` (`@IsOptional()`, `@IsUUID()`), `menu_publicado_id` (`@IsOptional()`, `@IsUUID()`), `page` (`@IsOptional()`, `@IsInt()`, `@Min(1)`), `limit` (`@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Max(100)`)

**Checkpoint**: US5 funcional — `POST /admin/stock-viandas/:id/ajustar` aplica el ajuste, registra el movimiento y audita.

---

## Phase 8: US6 — Consulta de Stock e Historial desde Back Office (Priority: P3)

**Goal**: Personal administrativo puede consultar el estado actual del stock y el historial de movimientos desde endpoints de back office, con filtros por fecha/sede/punto/menú.

**Independent Test**: Con datos en BD, `GET /admin/stock-viandas?fecha=2026-06-08` retorna solo los stocks de esa fecha con todos los contadores. `GET /admin/stock-viandas/:id/movimientos` retorna todos los movimientos del stock en orden cronológico ascendente.

- [x] T021 [US6] Implementar `list(query: QueryStockDto): Promise<{ items, total, page, limit }>` en `src/modules/stock-viandas/stock-viandas.service.ts`: obtener tenantId; usar QueryBuilder sobre `StockVianda` con `LEFT JOIN` a sede, puntoRetiro, menuPublicado, menuBase; aplicar filtros condicionales por fecha, sede_id, punto_retiro_id, menu_publicado_id; ordenar por fecha DESC, sede ASC, puntoRetiro ASC; paginar con skip/take; retornar `{ items, total, page, limit }`
- [x] T022 [US6] Implementar `findOne(id: string): Promise<StockVianda>` en `src/modules/stock-viandas/stock-viandas.service.ts`: obtener tenantId; buscar por id + tenantId con LEFT JOIN a sede, puntoRetiro, menuPublicado; si no existe lanzar `AppError STOCK_VIANDA_NOT_FOUND 404`
- [x] T023 [US6] Implementar `listMovimientos(stockViandaId: string): Promise<MovimientoStockVianda[]>` en `src/modules/stock-viandas/stock-viandas.service.ts`: obtener tenantId; verificar que el StockVianda existe y pertenece al tenant (reutilizar `findOne`); buscar movimientos por `stock_vianda_id` + tenantId ordenados por `created_at ASC`
- [x] T024 [US6] Crear `StockViandasController` en `src/modules/stock-viandas/stock-viandas.controller.ts` con `@Controller('admin/stock-viandas')`, `@UseGuards(JwtAuthGuard, RolesGuard)`: endpoint `GET /` con `@Roles('administrador','supervisor','operador_caja')` que llama a `service.list(query)` y retorna `page(items, page, limit, total)`; endpoint `GET /:id` con `@Roles('administrador','supervisor','operador_caja')` que llama a `service.findOne(id)` y retorna `ok(stock)`; endpoint `POST /:id/ajustar` con `@Roles('administrador','supervisor','operador_caja')` que llama a `service.ajustarStock(id, dto, req.user.sub)` y retorna `ok(result)`; endpoint `GET /:id/movimientos` con `@Roles('administrador','supervisor')` que llama a `service.listMovimientos(id)` y retorna `ok(movimientos)`
- [x] T025 [US6] Registrar `StockViandasModule` en `src/app.module.ts` en el array de imports

**Checkpoint**: US6 funcional — los cuatro endpoints de back office responden correctamente con autenticación y autorización.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final del módulo completo, compilación y preparación para Stage 6.

- [x] T026 [P] Ejecutar `npm run build` y resolver cualquier error de compilación TypeScript restante
- [x] T027 Verificar con `npm run start:dev` que el servidor arranca sin errores y que los cuatro endpoints responden (requiere JWT válido y tenant configurado)
- [x] T028 [P] Revisar que todos los `AppError` usan códigos de `ErrorCodes` y nunca `throw new Error()`
- [x] T029 Documentar en el archivo `specs/016-stock-viandas/research.md` el punto de integración donde `cancelaciones-pedidos` llama a `reasignarCancelacion` (actualizar si hubo ajustes respecto al diseño inicial)
- [x] T030 Verificar el flujo completo end-to-end: generar producción → confirmar → ver stock generado → simular ajuste manual → verificar movimientos en historial

**Checkpoint**: Módulo completo y listo para que Stage 6 (entregas y ventas-sobrantes) lo consuma.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — empezar inmediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA todas las historias de usuario
- **US1 (Phase 3)**: Depende de Phase 2 — puede empezar en paralelo con US2 una vez Phase 2 completa
- **US2 (Phase 4)**: Depende de Phase 2 — puede empezar en paralelo con US1
- **US3 (Phase 5)**: Depende de Phase 2 — puede empezar en paralelo con US1/US2
- **US4 (Phase 6)**: Depende de Phase 2 y tiene integración con cancelaciones-pedidos
- **US5 (Phase 7)**: Depende de Phase 2 (necesita T020 QueryStockDto) — puede empezar en paralelo con US1/US2/US3
- **US6 (Phase 8)**: Depende de US5 (T020 QueryStockDto requerido para el controlador) y Phase 2
- **Polish (Phase 9)**: Depende de todas las fases anteriores

### User Story Dependencies

- **US1 (P1)**: Independiente — base de todo el flujo operativo
- **US2 (P1)**: Independiente de US1 (solo necesita Phase 2) — puede implementarse en paralelo
- **US3 (P2)**: Independiente de US1/US2 — solo necesita Phase 2
- **US4 (P2)**: Independiente, pero requiere coordinar punto de integración con cancelaciones-pedidos
- **US5 (P2)**: Independiente — solo necesita Phase 2
- **US6 (P3)**: Depende de T020 (QueryStockDto de US5) — implementar US5 primero o extraer T020 antes

### Within Each Phase

- Entidades (T004, T005) se pueden crear en paralelo entre sí
- `generarDesdeProduccion` (T010) debe estar antes de activar el forwardRef en producción (T011, T012)
- Controller (T024) debe implementarse después de todos los métodos del service

### Parallel Opportunities

- T004 y T005 (entidades) pueden crearse en paralelo
- T014 (US2), T015 (US3) pueden implementarse en paralelo después de T006 (servicio base)
- T018, T019, T020 de US5 pueden ejecutarse en paralelo entre sí
- T021, T022, T023 de US6 pueden ejecutarse en paralelo entre sí
- T026, T028 de Polish pueden ejecutarse en paralelo

---

## Parallel Example: Foundational Phase (Phase 2)

```
# Crear entidades en paralelo:
Task T004: "Crear entidad StockVianda en src/modules/stock-viandas/entities/stock-vianda.entity.ts"
Task T005: "Crear entidad MovimientoStockVianda en src/modules/stock-viandas/entities/movimiento-stock-vianda.entity.ts"

# Luego (bloque 2 — dependen de T004/T005):
Task T006: "Crear esqueleto de StockViandasService"
Task T007: "Crear StockViandasModule"
```

## Parallel Example: Phase 7 (US5 - Ajuste Manual)

```
# Estas tareas no dependen entre sí:
Task T018: "Crear AjustarStockDto en src/modules/stock-viandas/dto/ajustar-stock.dto.ts"
Task T020: "Crear QueryStockDto en src/modules/stock-viandas/dto/query-stock.dto.ts"

# T019 depende de T018:
Task T019: "Implementar ajustarStock() en stock-viandas.service.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Completar Phase 1: Setup (T001–T002)
2. Completar Phase 2: Foundational (T003–T009) — **CRÍTICO, bloquea todo**
3. Completar Phase 3: US1 — generarDesdeProduccion (T010–T013)
4. Completar Phase 4: US2 — consumirParaEntrega (T014)
5. **STOP y VALIDAR**: confirmar una producción y verificar que el stock se genera; simular consumo de entrega
6. El módulo de entregas (Stage 6) ya puede integrar con `StockViandasService`

### Incremental Delivery

1. Setup + Foundational → estructura lista
2. US1 → stock se genera al confirmar producción (MVP del módulo)
3. US2 → entregas pueden consumir stock de encargues con concurrencia
4. US3 → ventas-sobrantes pueden consumir stock con concurrencia
5. US4 → cancelaciones post-producción reasignan stock automáticamente
6. US5 → ajuste manual auditado disponible en back office
7. US6 → consulta completa desde back office con historial de movimientos

### Notas de implementación críticas

- **SELECT FOR UPDATE**: Ver fragmento de código en `quickstart.md` — usar `setLock('pessimistic_write')` dentro de `dataSource.transaction()`
- **Inmutabilidad**: `MovimientoStockVianda` nunca se actualiza ni elimina — solo inserción
- **stock_restante**: Siempre recalcular explícitamente con `calcularRestante()` — no confiar en valores residuales
- **AppError**: Nunca usar `throw new Error()` — siempre `throw new AppError({ code: ErrorCodes.X, message: '...', status: N })`
- **Auditoría**: El ajuste manual (T019) debe auditar dentro de la misma operación para garantizar atomicidad

---

## Notes

- [P] = archivos distintos, sin dependencias cruzadas en ese momento
- [Story] mapea cada tarea a su historia de usuario para trazabilidad
- Cada historia de usuario es independientemente verificable al finalizar su fase
- Hacer commit después de cada fase completa
- Si los TODO en produccion-viandas (T011, T012) generan errores circulares, usar `forwardRef(() => StockViandasService)` en el inject y verificar que ambos módulos se exportan correctamente
