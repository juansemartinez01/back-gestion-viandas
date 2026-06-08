# Data Model: Módulo Producción de Viandas

**Feature**: 015-produccion-viandas | **Date**: 2026-06-08

---

## Nueva Entidad: `OrdenProduccionVianda`

**Tabla**: `orden_produccion_vianda`
**Módulo**: `src/modules/produccion-viandas/entities/orden-produccion-vianda.entity.ts`
**Base class**: `TenantEntity` (hereda: `id` uuid PK, `tenant_id` uuid, `created_at`, `updated_at`, `deleted_at`)

### Campos propios

| Campo | Tipo DB | TypeORM | Nullable | Default | Descripción |
|---|---|---|---|---|---|
| `fecha_produccion` | `date` | `string` | No | — | Fecha del día de producción (YYYY-MM-DD) |
| `sede_id` | `uuid` | `string` | No | — | FK a `sede.id` |
| `punto_retiro_id` | `uuid` | `string` | No | — | FK a `punto_retiro.id` |
| `menu_publicado_id` | `uuid` | `string` | No | — | FK a `menu_publicado.id` |
| `cantidad_pago_online` | `integer` | `number` | No | 0 | Pedidos confirmados con pago online |
| `cantidad_pago_presencial` | `integer` | `number` | No | 0 | Pedidos confirmados con pago presencial |
| `cantidad_cancelaciones_descontadas` | `integer` | `number` | No | 0 | Cancelaciones descontadas del total |
| `sobreproduccion_configurada` | `integer` | `number` | No | 0 | Unidades adicionales a preparar (calculadas al generar) |
| `total_sugerido` | `integer` | `number` | No | 0 | online + presencial − cancelaciones + sobreproduccion |
| `cantidad_real_producida` | `integer` | `number \| null` | Sí | null | Ingresada al confirmar producción |
| `diferencia` | `integer` | `number \| null` | Sí | null | real_producida − total_sugerido |
| `estado` | `enum` | `EstadoOrdenProduccion` | No | `pendiente` | Estado del ciclo de producción |
| `usuario_confirmacion_id` | `uuid` | `string \| null` | Sí | null | Usuario que confirmó la producción |
| `fecha_confirmacion` | `timestamptz` | `Date \| null` | Sí | null | Timestamp de confirmación |
| `observacion` | `text` | `string \| null` | Sí | null | Obligatoria si hay diferencia |

### Relaciones

| Relación | Tipo | FK | Lazy/Eager |
|---|---|---|---|
| `sede` | ManyToOne → `Sede` | `sede_id` | Eager off — LEFT JOIN en QB |
| `puntoRetiro` | ManyToOne → `PuntoRetiro` | `punto_retiro_id` | Eager off — LEFT JOIN en QB |
| `menuPublicado` | ManyToOne → `MenuPublicado` | `menu_publicado_id` | Eager off — LEFT JOIN en QB |

### Índices y constraints

| Tipo | Nombre | Campos |
|---|---|---|
| Index | `IDX_orden_produccion_tenant_fecha_sede` | `(tenant_id, fecha_produccion, sede_id)` |
| Unique | `UQ_orden_produccion_combinacion` | `(tenant_id, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id)` |
| Soft delete | heredado de `TenantEntity` | `deleted_at IS NULL` en todas las queries |

---

## Enum: `EstadoOrdenProduccion`

**Archivo**: `orden-produccion-vianda.entity.ts` (o `orden-produccion-vianda.enums.ts`)
**Tipo DB**: `enum` PostgreSQL (`estado_orden_produccion`)

| Valor TypeScript | Valor DB | Descripción |
|---|---|---|
| `PENDIENTE` | `'pendiente'` | Orden generada, cocina aún no comenzó |
| `EN_PRODUCCION` | `'en_produccion'` | Cocina comenzó la preparación |
| `CONFIRMADA_COMPLETA` | `'confirmada_completa'` | Real producida = total sugerido |
| `CONFIRMADA_CON_DIFERENCIA` | `'confirmada_con_diferencia'` | Real producida ≠ total sugerido (con observación) |
| `CANCELADA` | `'cancelada'` | Producción no ejecutada |

### Máquina de estados

```
pendiente ──────────────→ en_produccion
    │                          │
    └──────────────────────────┘
              ↓
    ┌─────────────────────┐
    │ POST /:id/confirmar │
    └─────────────────────┘
         ↓           ↓
confirmada_completa  confirmada_con_diferencia
```

---

## Entidades dependientes (sin modificaciones de schema)

### `Pedido` (existente — solo lectura)

Campos usados para calcular producción:

| Campo | Tipo | Uso |
|---|---|---|
| `tenant_id` | uuid | Scope obligatorio |
| `menu_publicado_id` | uuid | Agrupación por menú |
| `punto_retiro_id` | uuid | Agrupación por punto de retiro |
| `estado_pedido` | `EstadoPedido` enum | Filtro: `confirmado_pago_online`, `confirmado_pago_presencial`, `cancelado` |
| `deleted_at` | timestamptz | Excluir soft-deleted |

### `MenuPublicado` (existente — solo lectura)

Campos usados para filtrar y calcular sobreproducción:

| Campo | Tipo | Uso |
|---|---|---|
| `id` | uuid | JOIN con pedidos |
| `sede_id` | uuid | Filtro por sede |
| `fecha_publicacion` | date | Filtro por fecha de producción |
| `estado` | `EstadoMenuPublicado` enum | Filtro: solo activos/publicados |
| `tipo_sobreproduccion` | `TipoSobreproduccion` enum | `CANTIDAD_FIJA` o `PORCENTAJE` |
| `valor_sobreproduccion` | decimal(8,2) nullable | Valor numérico para el cálculo |

---

## Migración

**Comando**:
```bash
npm run db:migration:generate -- migrations/CreateOrdenProduccionVianda
```

**Operaciones que genera la migración**:
1. Crear enum PostgreSQL `estado_orden_produccion`
2. Crear tabla `orden_produccion_vianda` con todos los campos
3. Crear index `IDX_orden_produccion_tenant_fecha_sede`
4. Crear unique constraint `UQ_orden_produccion_combinacion`

**Sin rollback destructivo**: la entidad es nueva, sin dependencias en otras migraciones previas.
