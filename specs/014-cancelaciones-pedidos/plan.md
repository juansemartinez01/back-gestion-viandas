# Implementation Plan: Módulo Cancelaciones de Pedidos

**Branch**: `014-cancelaciones-pedidos` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-cancelaciones-pedidos/spec.md`

---

## Summary

Implementar el módulo `cancelaciones-pedidos` — un módulo Type C (operativo de consulta) sin entidad propia que expone tres endpoints de back office para reportes de cancelaciones y provee un método interno `validarReglaCancelacionPortal` reutilizable por el módulo de pedidos. Opera exclusivamente sobre la entidad `Pedido` existente filtrando por `estado_pedido = CANCELADO`, con scope de tenant obligatorio en todas las queries.

---

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer

**Storage**: PostgreSQL — sin migraciones (no crea tablas nuevas; usa tabla `pedido` existente)

**Testing**: Jest (unit) + Supertest (e2e) — patrón estándar del template

**Target Platform**: Linux server (Railway), compatible con AWS

**Project Type**: NestJS module dentro de monolito backend

**Performance Goals**: Listado de cancelaciones en < 3 segundos (SC-001 del spec); resumen diario debe ser preciso al 100% (SC-002)

**Constraints**:
- Todas las queries sobre `Pedido` DEBEN llevar `tenant_id` scope
- No usar `throw new Error()` — solo `AppError` con código de `ErrorCodes`
- `validarReglaCancelacionPortal` es función pura sin side effects
- No circular dependencies con `PedidosModule`

**Scale/Scope**: Módulo de consulta de tamaño pequeño — 3 endpoints, 1 servicio, 2 DTOs

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Notas |
|---|---|---|
| I. Template API Contract | ✅ PASS | Respuestas via `ok()` / `page()`. Errores via `AppError`. |
| II. Multi-Tenancy | ✅ PASS | Todas las QB incluyen `WHERE pedido.tenant_id = :tenantId`. `TenancyService.requireTenantId()` inyectado. |
| III. RBAC | ✅ PASS | `JwtAuthGuard` + `@Roles()` en todos los endpoints. Sin rutas públicas. |
| IV. Business Rule Integrity | ✅ PASS | Módulo es solo lectura. `validarReglaCancelacionPortal` refuerza reglas de cancelación. |
| V. Audit Trail | ✅ PASS (N/A) | Módulo no muta estado. Auditoría queda en `PedidosModule`. |
| VI. Module Architecture | ✅ PASS | Type C confirmado. Estructura: dto/, service, controller, module. Sin CRUD base. |
| VII. Implementation Order | ✅ PASS | Stage 3 — cancelaciones va después de pedidos (Stage 3) que ya está completo. |

**Post-design re-check**: Todos los principios se mantienen. Sin violaciones.

---

## Project Structure

### Documentation (this feature)

```text
specs/014-cancelaciones-pedidos/
├── plan.md              ← este archivo
├── research.md          ← decisiones de diseño resueltas
├── data-model.md        ← entidades y campos usados
├── contracts/
│   └── api-endpoints.md ← contratos de los 3 endpoints + validarReglaCancelacionPortal
└── tasks.md             ← generado por /speckit-tasks (pendiente)
```

### Source Code (repository root)

```text
src/modules/cancelaciones-pedidos/
├── dto/
│   ├── query-cancelaciones.dto.ts
│   └── resumen-cancelaciones.dto.ts
├── cancelaciones-pedidos.service.ts
├── cancelaciones-pedidos.controller.ts
└── cancelaciones-pedidos.module.ts
```

**Archivos modificados** (no nuevos):
- `src/app.module.ts` — agregar `CancelacionesPedidosModule` al array de imports

**Sin migraciones** — no se crean nuevas tablas.

**Structure Decision**: Módulo NestJS estándar Type C con carpeta `dto/` para los dos DTOs de query/input. Sin `entity/` ni `entities/` ya que no hay entidad propia.

---

## Implementation Design

### DTOs

#### `QueryCancelacionesDto`
```
extends PageQueryDto (src/common/query/page-query.dto.ts)
  + fecha_desde: string?     @IsOptional @IsDateString
  + fecha_hasta: string?     @IsOptional @IsDateString
  + sede_id: string?         @IsOptional @IsUUID
  + cancelado_por: OrigenCancelacion?  @IsOptional @IsEnum(OrigenCancelacion)
  + devolucion_pendiente: boolean?     @IsOptional @IsBoolean @Transform(toBoolean)
```

#### `ResumenCancelacionesDto`
```
  fecha: string?    @IsOptional @IsDateString  (default: today en el service)
  sede_id: string?  @IsOptional @IsUUID
```

---

### Service: `CancelacionesPedidosService`

**Dependencias inyectadas**:
- `@InjectRepository(Pedido) pedidoRepo: Repository<Pedido>`
- `TenancyService` (para `requireTenantId()`)

#### `list(query: QueryCancelacionesDto): Promise<[Pedido[], number]>`

QueryBuilder sobre `pedido`:
1. `WHERE pedido.tenant_id = :tenantId` (siempre)
2. `WHERE pedido.estado_pedido = 'cancelado'` (siempre)
3. `LEFT JOIN` sede, puntoRetiro, menuPublicado, cliente
4. Filtros opcionales:
   - `fecha_desde` / `fecha_hasta` → `pedido.fecha_cancelacion BETWEEN`
   - `sede_id` → `pedido.sede_id = :sedeId`
   - `cancelado_por` → `pedido.cancelado_por = :canceladoPor`
   - `devolucion_pendiente` → `pedido.devolucion_pendiente = :devolucionPendiente`
5. `ORDER BY pedido.fecha_cancelacion DESC`
6. `.skip(offset).take(limit)` + `.getManyAndCount()`

**Return**: usado por el controller con `page(data, count, query)`.

#### `listDevolucionPendiente(): Promise<Pedido[]>`

QueryBuilder sobre `pedido`:
1. `WHERE pedido.tenant_id = :tenantId`
2. `WHERE pedido.estado_pedido = 'cancelado'`
3. `WHERE pedido.devolucion_pendiente = true`
4. `LEFT JOIN` sede, cliente
5. `ORDER BY pedido.fecha_cancelacion DESC`
6. `.getMany()`

#### `resumenDia(query: ResumenCancelacionesDto): Promise<ResumenCancelaciones>`

QueryBuilder:
1. Calcular `fecha` (si no viene → `new Date()` formateado YYYY-MM-DD)
2. `WHERE pedido.tenant_id = :tenantId`
3. `WHERE pedido.estado_pedido = 'cancelado'`
4. `WHERE DATE(pedido.fecha_cancelacion) = :fecha`
5. Si `sede_id` → agregar filtro por sede
6. Aggregate via `getRawOne()`:
   - `COUNT(*)` → total
   - `SUM(CASE WHEN cancelado_por='cliente' THEN 1 ELSE 0 END)` → por_cliente
   - `SUM(CASE WHEN cancelado_por='administracion' THEN 1 ELSE 0 END)` → por_administracion
   - `SUM(CASE WHEN devolucion_pendiente=true THEN 1 ELSE 0 END)` → con_devolucion_pendiente
7. Mapear resultado raw a objeto tipado `ResumenCancelaciones`

#### `validarReglaCancelacionPortal(pedido: Pedido, menuPublicado: MenuPublicado): { permitido: boolean; motivo?: string }`

Función pura — sin acceso a DB, sin side effects. Evaluada en orden:

```
1. estado === ENTREGADO            → false, 'El pedido ya fue entregado'
2. estado === CANCELADO            → false, 'El pedido ya está cancelado'
3. estado === NO_RETIRADO          → false, 'El pedido ya fue cerrado como no retirado'
4. estado === PENDIENTE_PAGO_ONLINE    → false, 'Pago en proceso, contacte a administración'
5. estado === CONFIRMADO_PAGO_ONLINE   → false, 'Pedido con pago online, contacte a administración'
6. menuPublicado.fecha_hora_limite_cancelacion === null
                                   → false, 'Este menú no permite cancelaciones online'
7. new Date() > menuPublicado.fecha_hora_limite_cancelacion
                                   → false, 'La ventana de cancelación ha expirado'
8. (else)                          → { permitido: true }
```

---

### Controller: `CancelacionesPedidosController`

**Prefijo**: `/admin/cancelaciones`
**Guards**: `JwtAuthGuard`, `RolesGuard` (aplicados a nivel de clase)

| Método | Path | Roles | Service call | Response helper |
|---|---|---|---|---|
| GET | `/` | administrador, supervisor | `list(query)` | `page(data, count, query)` |
| GET | `/devolucion-pendiente` | administrador | `listDevolucionPendiente()` | `ok(data)` |
| GET | `/resumen` | administrador, supervisor | `resumenDia(query)` | `ok(resumen)` |

---

### Module: `CancelacionesPedidosModule`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido]),
    TenancyModule,
  ],
  providers: [CancelacionesPedidosService],
  controllers: [CancelacionesPedidosController],
  exports: [CancelacionesPedidosService],
})
```

**Sin `PedidosModule`** — evita acoplamiento/circular potencial. La entidad `Pedido` se registra directamente.
**Sin `MenusPublicadosModule`** — `validarReglaCancelacionPortal` recibe `menuPublicado` como parámetro.

---

## Complexity Tracking

> No hay violaciones al constitution. Sin entradas requeridas.

---

## Open Questions / Assumptions Confirmed

| Assumption del spec | Verificación | Estado |
|---|---|---|
| `devolucion_pendiente` existe en Pedido | Campo `boolean` default `false` en `pedido.entity.ts` | ✅ Confirmado |
| `OrigenCancelacion` enum existe | En `pedido.enums.ts`, valores `cliente` / `administracion` | ✅ Confirmado |
| `fecha_hora_limite_cancelacion` en MenuPublicado | `Date \| null`, timestamptz, nullable | ✅ Confirmado |
| `PageQueryDto` reutilizable | `src/common/query/page-query.dto.ts` | ✅ Confirmado |
| Sin migraciones | Todos los campos necesarios ya existen | ✅ Confirmado |
