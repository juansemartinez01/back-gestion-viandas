# Tasks: Módulo Producción de Viandas

**Input**: Design documents from `specs/015-produccion-viandas/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: No incluidos (no solicitados en el spec).

**Organization**: Tareas agrupadas por user story para implementación y verificación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: A qué user story pertenece (US1–US4)
- Paths relativos desde la raíz del repositorio

---

## Phase 1: Setup (Estructura del módulo)

**Purpose**: Crear la estructura de directorios, registrar el módulo en AppModule y agregar los error codes necesarios.

- [x] T001 Crear directorios `src/modules/produccion-viandas/entities/` y `src/modules/produccion-viandas/dto/` (estructura vacía lista para los archivos siguientes)
- [x] T002 [P] Agregar tres nuevos códigos de error al enum en `src/common/errors/error-codes.ts`: `ORDEN_PRODUCCION_NOT_FOUND = 'ORDEN_PRODUCCION_NOT_FOUND'`, `ORDEN_PRODUCCION_ESTADO_INVALIDO = 'ORDEN_PRODUCCION_ESTADO_INVALIDO'`, `PRODUCCION_OBSERVACION_REQUERIDA = 'PRODUCCION_OBSERVACION_REQUERIDA'`
- [x] T003 Registrar `ProduccionViandasModule` en el array `imports` de `src/app.module.ts` (junto a los demás módulos del sistema)

---

## Phase 2: Foundational (Entidad, migración, esqueleto — bloquea todas las US)

**Purpose**: Crear la entidad `OrdenProduccionVianda` con su enum, ejecutar la migración, y levantar el esqueleto compilable del módulo (module, service, controller). Ninguna user story puede avanzar hasta que esta fase esté completa.

**⚠️ CRÍTICO**: Completar antes de iniciar cualquier user story.

- [x] T004 Crear `src/modules/produccion-viandas/entities/orden-produccion-vianda.entity.ts` con:
  - Enum `EstadoOrdenProduccion` con valores: `PENDIENTE = 'pendiente'`, `EN_PRODUCCION = 'en_produccion'`, `CONFIRMADA_COMPLETA = 'confirmada_completa'`, `CONFIRMADA_CON_DIFERENCIA = 'confirmada_con_diferencia'`, `CANCELADA = 'cancelada'`
  - Clase `OrdenProduccionVianda extends TenantEntity` decorada con `@Entity('orden_produccion_vianda')`, `@Index(['tenant_id', 'fecha_produccion', 'sede_id'])`, `@Unique(['tenant_id', 'fecha_produccion', 'sede_id', 'punto_retiro_id', 'menu_publicado_id'])`
  - Campos: `fecha_produccion` (date/string), `sede_id` (uuid), `punto_retiro_id` (uuid), `menu_publicado_id` (uuid), `cantidad_pago_online` (int default 0), `cantidad_pago_presencial` (int default 0), `cantidad_cancelaciones_descontadas` (int default 0), `sobreproduccion_configurada` (int default 0), `total_sugerido` (int default 0), `cantidad_real_producida` (int nullable), `diferencia` (int nullable), `estado` (enum `EstadoOrdenProduccion` default PENDIENTE), `usuario_confirmacion_id` (uuid nullable), `fecha_confirmacion` (timestamptz nullable), `observacion` (text nullable)
  - Relaciones `@ManyToOne` lazy-off con JoinColumn para `sede`, `puntoRetiro`, `menuPublicado`

- [x] T005 Generar y verificar la migración ejecutando `npm run db:migration:generate -- migrations/CreateOrdenProduccionVianda` desde la raíz del proyecto — revisar el archivo generado en `database/migrations/` para confirmar que crea: enum PostgreSQL `estado_orden_produccion`, tabla `orden_produccion_vianda` con todos los campos, index sobre `(tenant_id, fecha_produccion, sede_id)`, y unique constraint compuesto; aplicar la migración con `npm run db:migration:run`

- [x] T006 [P] Crear `src/modules/produccion-viandas/produccion-viandas.module.ts` — `@Module` con:
  - `imports: [TypeOrmModule.forFeature([OrdenProduccionVianda, MenuPublicado, Pedido]), TenancyModule, AuditModule, forwardRef(() => StockViandasModule)]`
  - `providers: [ProduccionViandasService]`
  - `controllers: [ProduccionViandasController]`
  - `exports: [ProduccionViandasService]`
  - Nota: si `StockViandasModule` aún no existe, comentar temporalmente el `forwardRef` y agregar un TODO para descomentar cuando se implemente `stock-viandas`

- [x] T007 [P] Crear `src/modules/produccion-viandas/produccion-viandas.service.ts` — esqueleto de clase con:
  - `export class ProduccionViandasService extends BaseCrudTenantService<OrdenProduccionVianda>`
  - Constructor con: `@InjectRepository(OrdenProduccionVianda) repo`, `@InjectRepository(MenuPublicado) menuPublicadoRepo`, `@InjectRepository(Pedido) pedidoRepo`, `TenancyService`, `AuditService`; y opcionalmente `@Inject(forwardRef(() => StockViandasService)) stockViandasService` (comentado si StockViandasModule no existe)
  - Sin métodos de negocio todavía — solo el constructor

- [x] T008 [P] Crear `src/modules/produccion-viandas/produccion-viandas.controller.ts` — esqueleto de clase con:
  - `@Controller('admin/produccion-viandas')`, `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel de clase
  - Constructor que inyecta `ProduccionViandasService`
  - Sin endpoints todavía

**Checkpoint**: `npm run build` pasa sin errores. El módulo se carga en AppModule. La tabla `orden_produccion_vianda` existe en la base de datos.

---

## Phase 3: User Story 1 — Generar Hoja de Producción del Día (Priority: P1) 🎯 MVP

**Goal**: Exponer `POST /admin/produccion-viandas/generar` que calcula y crea/actualiza órdenes de producción para una fecha y sede, a partir de pedidos confirmados y sobreproducción configurada. Idempotente.

**Independent Test**: Llamar `POST /admin/produccion-viandas/generar` con `{ fecha_produccion: "2026-06-08", sede_id: "<uuid>" }` autenticado como supervisor → recibir array de órdenes generadas con `total_sugerido` correcto según pedidos existentes. Llamar de nuevo la misma request → actualizar contadores sin crear duplicados. Llamar con rol `cocina` → 403.

### Implementation for User Story 1

- [x] T009 [US1] Crear `src/modules/produccion-viandas/dto/generar-produccion.dto.ts` — clase `GenerarProduccionDto` con:
  - `fecha_produccion: string` decorado con `@IsNotEmpty()` y `@IsDateString()`
  - `sede_id: string` decorado con `@IsNotEmpty()` y `@IsUUID()`

- [x] T010 [US1] Implementar método `generarProduccion(dto: GenerarProduccionDto, usuarioId: string): Promise<OrdenProduccionVianda[]>` en `src/modules/produccion-viandas/produccion-viandas.service.ts`:
  1. `tenantId = this.getTenantId()` (o `TenancyService.requireTenantId()`)
  2. QB sobre `MenuPublicado`: `WHERE mp.tenant_id = :tenantId AND mp.fecha_publicacion = :fecha AND mp.sede_id = :sedeId AND mp.estado IN ('publicado', 'activo')` — verificar valores exactos del enum `EstadoMenuPublicado`
  3. Para cada `menuPublicado`: hacer tres QB sobre `Pedido` con GROUP BY `punto_retiro_id`:
     - `COUNT(*)` WHERE `estado_pedido = 'confirmado_pago_online'` → mapa `{ puntoRetiroId: count }`
     - `COUNT(*)` WHERE `estado_pedido = 'confirmado_pago_presencial'` → mapa `{ puntoRetiroId: count }`
     - `COUNT(*)` WHERE `estado_pedido = 'cancelado'` → mapa `{ puntoRetiroId: count }`
  4. Reunir todos los `punto_retiro_id` únicos; por cada uno:
     - `online = mapaOnline[id] ?? 0`, `presencial = mapaPresencial[id] ?? 0`, `cancelaciones = mapaCancelaciones[id] ?? 0`
     - `totalPedidos = online + presencial`
     - `sobreproduccion = tipo === 'cantidad_fija' ? Number(mp.valor_sobreproduccion) : Math.ceil(totalPedidos * Number(mp.valor_sobreproduccion) / 100)` (default 0 si `valor_sobreproduccion` es null)
     - `total_sugerido = Math.max(0, online + presencial - cancelaciones + sobreproduccion)`
     - Buscar orden existente por unique key (tenant+fecha+sede+puntoRetiro+menuPublicado)
     - Si no existe → `repo.save(repo.create({ tenant_id: tenantId, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id, cantidad_pago_online, cantidad_pago_presencial, cantidad_cancelaciones_descontadas, sobreproduccion_configurada, total_sugerido, estado: EstadoOrdenProduccion.PENDIENTE }))`
     - Si existe Y `estado IN [PENDIENTE, EN_PRODUCCION]` → actualizar contadores y `repo.save(orden)`
     - Si existe Y `estado` es `confirmada_*` o `cancelada` → skip (no sobreescribir)
  5. `AuditService.write({ action: 'produccion.generada', tenantId, usuarioId, metadata: { fecha: dto.fecha_produccion, sede_id: dto.sede_id, ordenes_generadas: ordenes.length } })`
  6. Retornar array de órdenes creadas/actualizadas

- [x] T011 [US1] Agregar endpoint `POST /generar` en `src/modules/produccion-viandas/produccion-viandas.controller.ts` — **declarar ANTES de cualquier route con `:id`**:
  - `@Post('generar') @Roles('administrador', 'supervisor') async generar(@Body() dto: GenerarProduccionDto, @CurrentUser() user)` → llama `this.service.generarProduccion(dto, user.id)` → retorna `ok(ordenes)`

**Checkpoint**: `POST /admin/produccion-viandas/generar` responde con `{ ok: true, data: [{ id, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id, total_sugerido, estado: 'pendiente', ... }] }`. Segunda llamada idéntica actualiza sin duplicar. Rol `cocina` recibe 403.

---

## Phase 4: User Story 4 — Confirmar Producción Real y Generar Stock (Priority: P1)

**Goal**: Exponer `POST /admin/produccion-viandas/:id/confirmar` que registra la cantidad real producida, determina el estado final (completa o con diferencia), exige observación si hay diferencia, llama a StockViandasService y registra auditoría.

**Independent Test**: Confirmar una orden con `cantidad_real_producida = total_sugerido` → estado `confirmada_completa`, `alerta: null`. Confirmar con diferencia sin observación → 422. Confirmar con diferencia y observación → estado `confirmada_con_diferencia`, `alerta: null` o con texto si real < encargues. Confirmar una orden ya confirmada → 409.

### Implementation for User Story 4

- [x] T012 [US4] Crear `src/modules/produccion-viandas/dto/confirmar-produccion.dto.ts` — clase `ConfirmarProduccionDto` con:
  - `cantidad_real_producida: number` decorado con `@IsNotEmpty()`, `@IsInt()`, `@Min(0)`
  - `observacion?: string` decorado con `@IsOptional()`, `@IsString()`, `@IsNotEmpty()` (valida que si se provee no sea string vacío)

- [x] T013 [US4] Implementar método `confirmarProduccion(id: string, dto: ConfirmarProduccionDto, usuarioId: string): Promise<{ orden: OrdenProduccionVianda; alerta: string | null }>` en `src/modules/produccion-viandas/produccion-viandas.service.ts`:
  1. `tenantId = this.getTenantId()`
  2. `orden = await this.mustFindById(id)` — lanza `ORDEN_PRODUCCION_NOT_FOUND` si no existe
  3. Si `orden.estado NOT IN [PENDIENTE, EN_PRODUCCION]` → `throw new AppError(ErrorCodes.ORDEN_PRODUCCION_ESTADO_INVALIDO, 409, 'La orden ya fue confirmada o cancelada')`
  4. `diferencia = dto.cantidad_real_producida - orden.total_sugerido`
  5. Si `diferencia !== 0` Y `(!dto.observacion || dto.observacion.trim() === '')` → `throw new AppError(ErrorCodes.PRODUCCION_OBSERVACION_REQUERIDA, 422, 'La observación es obligatoria cuando la cantidad producida difiere del total sugerido')`
  6. Mutar la orden: `orden.cantidad_real_producida = dto.cantidad_real_producida`, `orden.diferencia = diferencia`, `orden.observacion = dto.observacion ?? null`, `orden.usuario_confirmacion_id = usuarioId`, `orden.fecha_confirmacion = new Date()`, `orden.estado = diferencia === 0 ? CONFIRMADA_COMPLETA : CONFIRMADA_CON_DIFERENCIA`
  7. `await this.repo.save(orden)`
  8. Calcular alerta: `totalEncargues = orden.cantidad_pago_online + orden.cantidad_pago_presencial - orden.cantidad_cancelaciones_descontadas`; `alerta = dto.cantidad_real_producida < totalEncargues ? 'La producción real es inferior al total de encargues confirmados.' : null`
  9. Si `this.stockViandasService` está disponible (no comentado): `await this.stockViandasService.generarDesdeProduccion(orden)`
  10. `AuditService.write({ action: 'produccion.confirmada', tenantId, usuarioId, metadata: { orden_id: id, cantidad_real: dto.cantidad_real_producida, diferencia, estado: orden.estado } })`
  11. Retornar `{ orden, alerta }`

- [x] T014 [US4] Agregar endpoint `POST /:id/confirmar` en `src/modules/produccion-viandas/produccion-viandas.controller.ts`:
  - `@Post(':id/confirmar') @Roles('administrador', 'supervisor') async confirmar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmarProduccionDto, @CurrentUser() user)` → llama `this.service.confirmarProduccion(id, dto, user.id)` → retorna `ok({ orden, alerta })`

**Checkpoint**: `POST /admin/produccion-viandas/:id/confirmar` con real == sugerido → `{ ok: true, data: { orden: { estado: 'confirmada_completa' }, alerta: null } }`. Con diferencia sin observación → `{ ok: false, error: { code: 'PRODUCCION_OBSERVACION_REQUERIDA' } }`. Con diferencia y observación → `estado: 'confirmada_con_diferencia'`. Llamar dos veces → segunda vez retorna 409.

---

## Phase 5: User Story 2 — Consultar Hoja de Producción (Priority: P2)

**Goal**: Exponer `GET /`, `GET /:id` y `GET /imprimible` para que administrador, supervisor y cocina puedan consultar órdenes de producción con filtros. El rol cocina tiene acceso de solo lectura.

**Independent Test**: Llamar `GET /admin/produccion-viandas` autenticado como cocina → recibir lista paginada. Aplicar filtro `fecha_produccion=2026-06-08` → solo órdenes de ese día. Llamar `GET /admin/produccion-viandas/imprimible` → vista resumida sin paginación. Llamar `GET /admin/produccion-viandas/:id` → detalle completo con relaciones.

### Implementation for User Story 2

- [x] T015 [US2] Crear `src/modules/produccion-viandas/dto/query-produccion.dto.ts` — clase `QueryProduccionDto extends PageQueryDto` con:
  - `fecha_produccion?: string` decorado con `@IsOptional()`, `@IsDateString()`
  - `sede_id?: string` decorado con `@IsOptional()`, `@IsUUID()`
  - `punto_retiro_id?: string` decorado con `@IsOptional()`, `@IsUUID()`
  - `menu_publicado_id?: string` decorado con `@IsOptional()`, `@IsUUID()`
  - `estado?: EstadoOrdenProduccion` decorado con `@IsOptional()`, `@IsEnum(EstadoOrdenProduccion)`

- [x] T016 [US2] Implementar métodos `list(query: QueryProduccionDto)` y `findOne(id: string)` en `src/modules/produccion-viandas/produccion-viandas.service.ts`:
  - **`list`**: QB sobre `orden_produccion_vianda` con tenant scope, `LEFT JOIN` sede, puntoRetiro, menuPublicado (y menuPublicado → menuBase), filtros opcionales (`fecha_produccion`, `sede_id`, `punto_retiro_id`, `menu_publicado_id`, `estado`), `ORDER BY orden.fecha_produccion DESC`, `.skip().take().getManyAndCount()`
  - **`findOne`**: QB con LEFT JOINs completos, `WHERE orden.id = :id AND orden.tenant_id = :tenantId AND orden.deleted_at IS NULL`; si no hay resultado → `throw new AppError(ErrorCodes.ORDEN_PRODUCCION_NOT_FOUND, 404)`

- [x] T017 [US2] Implementar método `getImprimible(query: QueryProduccionDto): Promise<object[]>` en `src/modules/produccion-viandas/produccion-viandas.service.ts`:
  - Misma QB que `list()` pero sin `.skip()/.take()` (sin paginación)
  - Seleccionar solo los campos resumidos para cocina: `orden.fecha_produccion`, `sede.nombre AS sede`, `puntoRetiro.nombre AS punto_retiro`, `menuBase.nombre AS menu`, `orden.total_sugerido`, `orden.estado`
  - Usar `.getRawMany()` y mapear a objetos planos con esos campos

- [x] T018 [US2] Agregar endpoints de consulta en `src/modules/produccion-viandas/produccion-viandas.controller.ts` — **declarar `/imprimible` ANTES de `/:id`**:
  - `@Get() @Roles('administrador', 'supervisor', 'cocina') async list(@Query() query: QueryProduccionDto)` → llama `this.service.list(query)` → retorna `page(data, count, query)`
  - `@Get('imprimible') @Roles('administrador', 'supervisor', 'cocina') async imprimible(@Query() query: QueryProduccionDto)` → llama `this.service.getImprimible(query)` → retorna `ok(data)`
  - `@Get(':id') @Roles('administrador', 'supervisor', 'cocina') async findOne(@Param('id', ParseUUIDPipe) id: string)` → llama `this.service.findOne(id)` → retorna `ok(orden)`

**Checkpoint**: `GET /admin/produccion-viandas` responde con `{ ok: true, data: [...], meta: { page, limit, total, totalPages } }`. `GET /admin/produccion-viandas/imprimible` responde con `{ ok: true, data: [{ fecha_produccion, sede, punto_retiro, menu, total_sugerido, estado }] }` sin paginación. `GET /admin/produccion-viandas/:id-invalido` retorna 404. Rol `cocina` accede a los tres endpoints y recibe 200.

---

## Phase 6: User Story 3 — Marcar Producción en Curso (Priority: P3)

**Goal**: Exponer `PATCH /admin/produccion-viandas/:id/en-produccion` que transiciona una orden de `pendiente` a `en_produccion`. Solo admin y supervisor. Auditable.

**Independent Test**: Llamar `PATCH /admin/produccion-viandas/:id/en-produccion` sobre una orden pendiente → estado cambia a `en_produccion`. Llamar sobre una orden ya en producción o confirmada → 409. Llamar con rol `cocina` → 403.

### Implementation for User Story 3

- [x] T019 [US3] Implementar método `marcarEnProduccion(id: string, usuarioId: string): Promise<OrdenProduccionVianda>` en `src/modules/produccion-viandas/produccion-viandas.service.ts`:
  1. `tenantId = this.getTenantId()`
  2. `orden = await this.mustFindById(id)` — lanza `ORDEN_PRODUCCION_NOT_FOUND` si no existe
  3. Si `orden.estado !== EstadoOrdenProduccion.PENDIENTE` → `throw new AppError(ErrorCodes.ORDEN_PRODUCCION_ESTADO_INVALIDO, 409, 'Solo órdenes en estado pendiente pueden pasar a en_produccion')`
  4. `orden.estado = EstadoOrdenProduccion.EN_PRODUCCION`
  5. `await this.repo.save(orden)`
  6. `AuditService.write({ action: 'produccion.en_produccion', tenantId, usuarioId, metadata: { orden_id: id } })`
  7. Retornar `orden`

- [x] T020 [US3] Agregar endpoint `PATCH /:id/en-produccion` en `src/modules/produccion-viandas/produccion-viandas.controller.ts`:
  - `@Patch(':id/en-produccion') @Roles('administrador', 'supervisor') async enProduccion(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user)` → llama `this.service.marcarEnProduccion(id, user.id)` → retorna `ok(orden)`

**Checkpoint**: `PATCH /admin/produccion-viandas/:id/en-produccion` sobre orden pendiente → `{ ok: true, data: { estado: 'en_produccion' } }`. Misma llamada de nuevo → `{ ok: false, error: { code: 'ORDEN_PRODUCCION_ESTADO_INVALIDO' } }`. Rol `cocina` → 403.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificar el contrato completo, el orden de rutas y la integridad del módulo.

- [x] T021 [P] Verificar el orden de declaración de routes en `src/modules/produccion-viandas/produccion-viandas.controller.ts`: `/imprimible` y `/generar` DEBEN estar declarados ANTES de `/:id` para que NestJS no interprete "imprimible" o "generar" como un UUID param — reordenar si es necesario

- [x] T022 [P] Verificar que los tres eventos auditables se registran correctamente: `produccion.generada` (en generar), `produccion.en_produccion` (en marcar) y `produccion.confirmada` (en confirmar) — confirmar que `AuditService.write()` se llama con los campos correctos en cada método del service

- [x] T023 Verificar que `ProduccionViandasService` está correctamente exportado en `src/modules/produccion-viandas/produccion-viandas.module.ts` y accesible para importación futura por `StockViandasModule` — el servicio debe poder inyectarse en otros módulos que importen `ProduccionViandasModule`

- [x] T024 Ejecutar `npm run build` y `npm run lint` desde la raíz del proyecto — resolver cualquier error de tipo o lint antes de marcar el módulo como completo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar de inmediato; T001, T002, T003 pueden ejecutarse en paralelo
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA todas las US; T006, T007, T008 pueden ejecutarse en paralelo entre sí (dependen de T004)
- **US1 (Phase 3)**: Depende de Phase 2 — implementable en paralelo con US4
- **US4 (Phase 4)**: Depende de Phase 2 — implementable en paralelo con US1
- **US2 (Phase 5)**: Depende de Phase 2 — puede iniciar tras Phase 2; independiente de US1/US4
- **US3 (Phase 6)**: Depende de Phase 2 — puede iniciar tras Phase 2; independiente de US1/US4/US2
- **Polish (Phase 7)**: Depende de todas las US completadas

### User Story Dependencies

- **US1 (P1)**: Puede iniciar tras Phase 2. Sin dependencia en otras US.
- **US4 (P1)**: Puede iniciar tras Phase 2. Sin dependencia en otras US. Depende de que el campo `total_sugerido` esté disponible en la entidad (generado por US1 en runtime, no en schema).
- **US2 (P2)**: Puede iniciar tras Phase 2. Sin dependencia en US1 o US4.
- **US3 (P3)**: Puede iniciar tras Phase 2. Sin dependencia en otras US.

### Within Each User Story

- DTO antes que el método de servicio
- Método de servicio antes que el endpoint del controller
- Completar la US antes de pasar a la siguiente

### Parallel Opportunities

- T001, T002, T003 (Phase 1) en paralelo
- T006, T007, T008 (Phase 2) en paralelo entre sí (después de T004)
- T009 (DTO generar) puede ejecutarse en paralelo con T012 (DTO confirmar) o T015 (DTO query)
- US1 (Phase 3) y US4 (Phase 4) pueden trabajarse simultáneamente por distintos desarrolladores
- US2 (Phase 5) y US3 (Phase 6) pueden trabajarse simultáneamente
- T021 y T022 (Phase 7) en paralelo

---

## Parallel Example: Phase 2 + inicio de US1 y US4

```text
# Phase 2 — después de T004 (entidad), lanzar en paralelo:
T006: Crear produccion-viandas.module.ts (esqueleto)
T007: Crear produccion-viandas.service.ts (esqueleto)
T008: Crear produccion-viandas.controller.ts (esqueleto)

# Una vez Phase 2 completa — US1 y US4 en paralelo:
  Developer A (US1):
    T009: Crear generar-produccion.dto.ts
    T010: Implementar generarProduccion() en service (depende de T009)
    T011: Agregar POST /generar en controller (depende de T010)

  Developer B (US4):
    T012: Crear confirmar-produccion.dto.ts
    T013: Implementar confirmarProduccion() en service (depende de T012)
    T014: Agregar POST /:id/confirmar en controller (depende de T013)
```

---

## Implementation Strategy

### MVP First (US1 — Generar producción)

1. Completar Phase 1: Setup (T001–T003)
2. Completar Phase 2: Foundational (T004–T008) — CRÍTICO
3. Completar Phase 3: US1 (T009–T011)
4. **STOP y VALIDAR**: `POST /admin/produccion-viandas/generar` genera órdenes correctamente e idempotentemente
5. Demostrar o desplegar si listo

### Incremental Delivery

1. Phase 1 + Phase 2 → Módulo carga sin errores, tabla en DB
2. US1 → Generación de producción operativa (MVP)
3. US4 → Confirmación y generación de stock operativa
4. US2 → Consulta y hoja imprimible operativa
5. US3 → Marcado en producción operativo
6. Cada story es verificable y entregable de forma independiente

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí
- `[US?]` mapea cada tarea a su user story para trazabilidad
- Si `StockViandasModule` aún no existe, comentar su importación en el módulo y el `@Inject(forwardRef(...))` en el service — agregar TODO para descomentar cuando se implemente `stock-viandas`
- Importar `EstadoPedido` desde `src/modules/pedidos/pedido.enums.ts` — no duplicar el enum
- Importar `TipoSobreproduccion` desde `src/modules/menus-publicados/entities/menu-publicado.entity.ts`
- No usar `throw new Error()` — solo `AppError` con código de `ErrorCodes`
- Toda query lleva `tenant_id` scope obligatorio
- El unique constraint compuesto en la entidad garantiza idempotencia a nivel de DB como red de seguridad
- El orden de rutas en el controller es crítico: `/imprimible` y `/generar` deben declararse antes de `/:id`
