# Implementation Plan: Módulo Producción de Viandas

**Branch**: `015-produccion-viandas` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-produccion-viandas/spec.md`

---

## Summary

Implementar el módulo `produccion-viandas` — un módulo Type B (CRUD + lógica de negocio) que genera y gestiona órdenes de producción de viandas por fecha/sede/punto_retiro/menu_publicado. Calcula totales sugeridos a partir de pedidos confirmados más sobreproducción configurada, gestiona el ciclo de estados de producción y, al confirmar, delega la generación de stock operativo a `StockViandasService` (via forwardRef). Requiere una nueva tabla `orden_produccion_vianda` con unique constraint compuesto y enum PostgreSQL.

---

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer

**Storage**: PostgreSQL — nueva tabla `orden_produccion_vianda` + enum `estado_orden_produccion`

**Testing**: Jest (unit) + Supertest (e2e) — patrón estándar del template

**Target Platform**: Linux server (Railway), compatible con AWS

**Project Type**: NestJS module dentro de monolito backend

**Performance Goals**: Generación de producción para una fecha/sede en < 30 segundos; precisión 100% en conteo de pedidos confirmados

**Constraints**:
- Todas las queries DEBEN llevar `tenant_id` scope
- `generarProduccion` debe ser idempotente (upsert por unique key)
- `confirmarProduccion` llama a `StockViandasService` via `forwardRef` para evitar circular dep
- No usar `throw new Error()` — solo `AppError` con código de `ErrorCodes`
- Rol `cocina` solo puede leer — no puede llamar generar/confirmar/en-produccion

**Scale/Scope**: Módulo mediano — 6 endpoints, 1 servicio, 3 DTOs, 1 entidad con migración

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Notas |
|---|---|---|
| I. Template API Contract | ✅ PASS | Respuestas via `ok()` / `page()`. Errores via `AppError`. Nuevos códigos agregados a `ErrorCodes`. |
| II. Multi-Tenancy | ✅ PASS | `OrdenProduccionVianda` lleva `tenant_id`. `BaseCrudTenantService` scopa todas las queries. |
| III. RBAC | ✅ PASS | `JwtAuthGuard` + `@Roles()` en todos los endpoints. Rol `cocina` solo en endpoints GET. |
| IV. Business Rule Integrity | ✅ PASS | Reglas de transición de estado en el service. Observación obligatoria con diferencia. Alerta informativa si real < pedidos. |
| V. Audit Trail | ✅ PASS | Auditoría en generar, marcar en producción y confirmar — vía `AuditService.write()`. |
| VI. Module Architecture | ✅ PASS | Type B confirmado: `BaseCrudTenantService` + endpoints de acción custom. Estructura correcta con `entities/` y `dto/`. |
| VII. Implementation Order | ✅ PASS | Stage 5 — produccion-viandas va después de Stage 3 (pedidos) y Stage 4 (mercado-pago), ambos completos. |

**Post-design re-check**: Todos los principios se mantienen. Sin violaciones.

---

## Project Structure

### Documentation (this feature)

```text
specs/015-produccion-viandas/
├── plan.md              ← este archivo
├── research.md          ← decisiones de diseño resueltas
├── data-model.md        ← entidad y campos
├── contracts/
│   └── api-endpoints.md ← contratos de los 6 endpoints
└── tasks.md             ← generado por /speckit-tasks (pendiente)
```

### Source Code (repository root)

```text
src/modules/produccion-viandas/
├── entities/
│   └── orden-produccion-vianda.entity.ts
├── dto/
│   ├── generar-produccion.dto.ts
│   ├── confirmar-produccion.dto.ts
│   └── query-produccion.dto.ts
├── produccion-viandas.service.ts
├── produccion-viandas.controller.ts
└── produccion-viandas.module.ts
```

**Archivos modificados** (no nuevos):
- `src/common/errors/error-codes.ts` — agregar 3 nuevos códigos
- `src/app.module.ts` — agregar `ProduccionViandasModule` al array de imports
- `database/migrations/` — nueva migración `CreateOrdenProduccionVianda`

**Structure Decision**: Módulo NestJS Type B con `entities/` para la entidad propia y `dto/` para los tres DTOs. Sigue el patrón de `pedidos` y `menus-publicados`.

---

## Implementation Design

### Enum: `EstadoOrdenProduccion`

```typescript
export enum EstadoOrdenProduccion {
  PENDIENTE = 'pendiente',
  EN_PRODUCCION = 'en_produccion',
  CONFIRMADA_COMPLETA = 'confirmada_completa',
  CONFIRMADA_CON_DIFERENCIA = 'confirmada_con_diferencia',
  CANCELADA = 'cancelada',
}
```

Transiciones de estado permitidas:
- `pendiente` → `en_produccion` (vía PATCH /:id/en-produccion)
- `pendiente` | `en_produccion` → `confirmada_completa` | `confirmada_con_diferencia` (vía POST /:id/confirmar)

---

### Entidad: `OrdenProduccionVianda`

```typescript
@Entity('orden_produccion_vianda')
@Index(['tenant_id', 'fecha_produccion', 'sede_id'])
@Unique(['tenant_id', 'fecha_produccion', 'sede_id', 'punto_retiro_id', 'menu_publicado_id'])
export class OrdenProduccionVianda extends TenantEntity {
  @Column({ type: 'date' })
  fecha_produccion: string;

  @Column({ type: 'uuid' })
  sede_id: string;

  @Column({ type: 'uuid' })
  punto_retiro_id: string;

  @Column({ type: 'uuid' })
  menu_publicado_id: string;

  @Column({ type: 'int', default: 0 })
  cantidad_pago_online: number;

  @Column({ type: 'int', default: 0 })
  cantidad_pago_presencial: number;

  @Column({ type: 'int', default: 0 })
  cantidad_cancelaciones_descontadas: number;

  @Column({ type: 'int', default: 0 })
  sobreproduccion_configurada: number;

  @Column({ type: 'int', default: 0 })
  total_sugerido: number;

  @Column({ type: 'int', nullable: true })
  cantidad_real_producida: number | null;

  @Column({ type: 'int', nullable: true })
  diferencia: number | null;

  @Column({ type: 'enum', enum: EstadoOrdenProduccion, default: EstadoOrdenProduccion.PENDIENTE })
  estado: EstadoOrdenProduccion;

  @Column({ type: 'uuid', nullable: true })
  usuario_confirmacion_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_confirmacion: Date | null;

  @Column({ type: 'text', nullable: true })
  observacion: string | null;

  @ManyToOne(() => Sede, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sede_id' })
  sede?: Sede;

  @ManyToOne(() => PuntoRetiro, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'punto_retiro_id' })
  puntoRetiro?: PuntoRetiro;

  @ManyToOne(() => MenuPublicado, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'menu_publicado_id' })
  menuPublicado?: MenuPublicado;
}
```

---

### DTOs

#### `GenerarProduccionDto`

```
fecha_produccion: string   @IsDateString() @IsNotEmpty()
sede_id: string            @IsUUID() @IsNotEmpty()
```

#### `ConfirmarProduccionDto`

```
cantidad_real_producida: number  @IsInt() @Min(0) @IsNotEmpty()
observacion: string?             @IsOptional() @IsString() @IsNotEmpty()
```

#### `QueryProduccionDto extends PageQueryDto`

```
fecha_produccion: string?          @IsOptional() @IsDateString()
sede_id: string?                   @IsOptional() @IsUUID()
punto_retiro_id: string?           @IsOptional() @IsUUID()
menu_publicado_id: string?         @IsOptional() @IsUUID()
estado: EstadoOrdenProduccion?     @IsOptional() @IsEnum(EstadoOrdenProduccion)
```

---

### Service: `ProduccionViandasService extends BaseCrudTenantService<OrdenProduccionVianda>`

**Dependencias inyectadas**:
- `@InjectRepository(OrdenProduccionVianda) repo`
- `@InjectRepository(MenuPublicado) menuPublicadoRepo`
- `@InjectRepository(Pedido) pedidoRepo`
- `TenancyService`
- `AuditService`
- `@Inject(forwardRef(() => StockViandasService)) stockViandasService`

#### `generarProduccion(dto, usuarioId)`

```
1. Obtener menús publicados activos para dto.fecha_produccion y dto.sede_id
   (WHERE estado IN ['publicado', 'activo'] — verificar enum durante impl)

2. Para cada menuPublicado, por cada punto_retiro_id con pedidos:
   a. COUNT pedidos estado=confirmado_pago_online GROUP BY punto_retiro_id
   b. COUNT pedidos estado=confirmado_pago_presencial GROUP BY punto_retiro_id
   c. COUNT pedidos estado=cancelado GROUP BY punto_retiro_id (cancelaciones descontadas)
   d. sobreproduccion = CANTIDAD_FIJA ? valor : Math.ceil(totalPedidos * valor / 100)
   e. total_sugerido = online + presencial - cancelaciones + sobreproduccion

3. Upsert por (tenant_id, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id):
   - IF not exists → INSERT (estado = pendiente)
   - IF exists AND estado in [pendiente, en_produccion] → UPDATE contadores
   - IF exists AND estado in [confirmada_*, cancelada] → SKIP

4. AuditService.write({ action: 'produccion.generada', ... })
5. Retornar órdenes generadas/actualizadas
```

#### `marcarEnProduccion(id, usuarioId)`

```
orden = mustFindById(id)
IF orden.estado !== PENDIENTE → throw AppError(ORDEN_PRODUCCION_ESTADO_INVALIDO, 409)
orden.estado = EN_PRODUCCION
await repo.save(orden)
AuditService.write({ action: 'produccion.en_produccion', ... })
return orden
```

#### `confirmarProduccion(id, dto, usuarioId)`

```
orden = mustFindById(id)
IF orden.estado NOT IN [PENDIENTE, EN_PRODUCCION] → throw AppError(ORDEN_PRODUCCION_ESTADO_INVALIDO, 409)
diferencia = dto.cantidad_real_producida - orden.total_sugerido
IF diferencia !== 0 AND !dto.observacion → throw AppError(PRODUCCION_OBSERVACION_REQUERIDA, 422)
orden.cantidad_real_producida = dto.cantidad_real_producida
orden.diferencia = diferencia
orden.observacion = dto.observacion ?? null
orden.usuario_confirmacion_id = usuarioId
orden.fecha_confirmacion = new Date()
orden.estado = diferencia === 0 ? CONFIRMADA_COMPLETA : CONFIRMADA_CON_DIFERENCIA
await repo.save(orden)
alerta = dto.cantidad_real_producida < (orden.cantidad_pago_online + orden.cantidad_pago_presencial
  - orden.cantidad_cancelaciones_descontadas)
  ? 'La producción real es inferior al total de encargues confirmados.'
  : null
await this.stockViandasService.generarDesdeProduccion(orden)
AuditService.write({ action: 'produccion.confirmada', ... })
return { orden, alerta }
```

#### `list(query)` / `findOne(id)` / `getImprimible(query)`

```
list: QB con LEFT JOINs (sede, puntoRetiro, menuPublicado → menuBase), filtros opcionales,
      ORDER BY fecha_produccion DESC, .getManyAndCount()

findOne: QB con LEFT JOINs completos, WHERE id AND tenant_id, throws NOT_FOUND si nulo

getImprimible: misma lógica que list() sin paginación, campos resumidos para hoja de cocina
```

---

### Controller: `ProduccionViandasController`

**Prefijo**: `/admin/produccion-viandas` | Guards: `JwtAuthGuard`, `RolesGuard` (clase)

| Método | Path | Roles | Service call | Response |
|---|---|---|---|---|
| GET | `/` | administrador, supervisor, cocina | `list(query)` | `page(data, count, query)` |
| GET | `/imprimible` | administrador, supervisor, cocina | `getImprimible(query)` | `ok(data)` |
| GET | `/:id` | administrador, supervisor, cocina | `findOne(id)` | `ok(orden)` |
| POST | `/generar` | administrador, supervisor | `generarProduccion(dto, userId)` | `ok(ordenes)` |
| PATCH | `/:id/en-produccion` | administrador, supervisor | `marcarEnProduccion(id, userId)` | `ok(orden)` |
| POST | `/:id/confirmar` | administrador, supervisor | `confirmarProduccion(id, dto, userId)` | `ok({ orden, alerta })` |

**Nota**: `/imprimible` y `/generar` DEBEN declararse antes de `/:id` en el controller.

---

### Module: `ProduccionViandasModule`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([OrdenProduccionVianda, MenuPublicado, Pedido]),
    TenancyModule,
    AuditModule,
    forwardRef(() => StockViandasModule),
  ],
  providers: [ProduccionViandasService],
  controllers: [ProduccionViandasController],
  exports: [ProduccionViandasService],
})
```

---

### Error Codes (agregar a `src/common/errors/error-codes.ts`)

```typescript
ORDEN_PRODUCCION_NOT_FOUND = 'ORDEN_PRODUCCION_NOT_FOUND',
ORDEN_PRODUCCION_ESTADO_INVALIDO = 'ORDEN_PRODUCCION_ESTADO_INVALIDO',
PRODUCCION_OBSERVACION_REQUERIDA = 'PRODUCCION_OBSERVACION_REQUERIDA',
```

---

## Complexity Tracking

> No hay violaciones al constitution. Sin entradas requeridas.

---

## Open Questions / Assumptions Confirmed

| Assumption del spec | Verificación | Estado |
|---|---|---|
| `EstadoPedido` enum tiene `confirmado_pago_online` y `confirmado_pago_presencial` | Confirmado en `pedido.enums.ts` | ✅ Confirmado |
| `MenuPublicado` tiene `tipo_sobreproduccion` (enum) y `valor_sobreproduccion` (decimal) | Confirmado en `menu-publicado.entity.ts` | ✅ Confirmado |
| `TipoSobreproduccion`: `CANTIDAD_FIJA` / `PORCENTAJE` | Confirmado en `menu-publicado.entity.ts` | ✅ Confirmado |
| `forwardRef` soportado para circular dep | Patrón ya usado en `PedidosModule` ↔ `MercadoPagoModule` | ✅ Confirmado |
| `BaseCrudTenantService<T>` provee `mustFindById`, CRUD base con tenant scope | Confirmado en `src/common/crud/base-crud.service.ts` | ✅ Confirmado |
| `PageQueryDto` reutilizable | `src/common/query/page-query.dto.ts` | ✅ Confirmado |
| `StockViandasModule` aún no existe — módulo posterior | `generarDesdeProduccion` se implementa cuando llegue Stage 5 stock-viandas | ⚠️ Pendiente — compilará solo cuando StockViandasModule exista |
| Estado de `MenuPublicado` para filtrar activos del día | Verificar `EstadoMenuPublicado` durante implementación | ⚠️ Verificar |
