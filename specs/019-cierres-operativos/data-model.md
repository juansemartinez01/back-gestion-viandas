# Data Model: Cierres Operativos

## Entity: CierreOperativo

**Table**: `cierres_operativos`

### Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, generated | |
| `tenant_id` | `uuid` | NOT NULL, indexed | Multi-tenancy |
| `fecha_operativa` | `date` | NOT NULL | Fecha del día que se cierra |
| `sede_id` | `uuid` | NOT NULL | FK implícita a `sedes` |
| `punto_retiro_id` | `uuid` | NOT NULL | FK implícita a `puntos_retiro` |
| `usuario_id` | `uuid` | NOT NULL | Usuario que ejecutó el cierre |
| `fecha_cierre` | `timestamptz` | NOT NULL | Momento exacto del cierre |
| `cantidad_pedidos_entregados` | `int` | NOT NULL, default 0 | Pedidos con estado `entregado` al momento del cierre |
| `cantidad_pedidos_no_retirados` | `int` | NOT NULL, default 0 | Pedidos marcados `no_retirado` en este cierre |
| `cantidad_ventas_sobrantes` | `int` | NOT NULL, default 0 | Ventas de sobrantes del día |
| `recaudacion_presencial` | `decimal(10,2)` | NOT NULL, default 0 | Suma de efectivo cobrado (entregas + sobrantes) |
| `observacion` | `text` | nullable | Nota del operador al cerrar |
| `created_at` | `timestamptz` | NOT NULL, auto | |

### Constraints

```sql
UNIQUE (tenant_id, fecha_operativa, sede_id, punto_retiro_id)
INDEX  (tenant_id, fecha_operativa, sede_id)
INDEX  (tenant_id)  -- default por @Index() en tenant_id
```

### Notes

- **Sin `updated_at` ni `deleted_at`**: El cierre operativo es inmutable una vez creado. No existe lógica de actualización ni eliminación lógica.
- La unicidad compuesta garantiza que no pueda existir más de un cierre por día/sede/punto_retiro por tenant.
- El índice `(tenant_id, fecha_operativa, sede_id)` optimiza la consulta de `isDiaCerrado` que se ejecuta en el hot path de entregas y ventas de sobrantes.

---

## Entities Referenced (read-only during close)

### Pedido (src/modules/pedidos/entities/pedido.entity.ts)

Campos relevantes para el cierre:

| Campo | Tipo | Uso en cierre |
|-------|------|---------------|
| `tenant_id` | uuid | Filtro de tenant |
| `fecha_retiro` | date | Filtro por fecha operativa |
| `sede_id` | uuid | Filtro por sede |
| `punto_retiro_id` | uuid | Filtro por punto de retiro |
| `estado_pedido` | enum | Filtro: `confirmado_pago_online` \| `confirmado_pago_presencial` → marcar `no_retirado` |
| `deleted_at` | timestamptz | Solo pedidos no eliminados |

**Estados marcados como no_retirado**: `CONFIRMADO_PAGO_ONLINE`, `CONFIRMADO_PAGO_PRESENCIAL`

**Estados excluidos**: `PENDIENTE_PAGO_ONLINE`, `CANCELADO`, `ENTREGADO`, `NO_RETIRADO`

### EntregaPedido (src/modules/entregas/entities/entrega-pedido.entity.ts)

| Campo | Tipo | Uso en cierre |
|-------|------|---------------|
| `tenant_id` | uuid | Filtro |
| `fecha_entrega` | timestamptz | Filtro por fecha (`::date`) |
| `sede_id` | uuid | Filtro |
| `punto_retiro_id` | uuid | Filtro |
| `importe_cobrado_caja` | decimal(10,2) | `SUM` para recaudación presencial |

### VentaSobrante (src/modules/ventas-sobrantes/entities/venta-sobrante.entity.ts)

| Campo | Tipo | Uso en cierre |
|-------|------|---------------|
| `tenant_id` | uuid | Filtro |
| `fecha` | date | Filtro por fecha |
| `sede_id` | uuid | Filtro |
| `punto_retiro_id` | uuid | Filtro |
| `importe_total` | decimal(10,2) | `SUM` para recaudación presencial |

---

## State Transitions

### Pedido durante el cierre

```
CONFIRMADO_PAGO_ONLINE    ──[cierre]──► NO_RETIRADO
CONFIRMADO_PAGO_PRESENCIAL ──[cierre]──► NO_RETIRADO

PENDIENTE_PAGO_ONLINE  ──[no afectado]──► (sin cambio)
CANCELADO              ──[no afectado]──► (sin cambio)
ENTREGADO              ──[no afectado]──► (sin cambio)
```

---

## Resumen Previo (no persiste)

El endpoint `GET /resumen-previo` calcula y retorna la siguiente estructura sin modificar datos:

```typescript
{
  fecha: string;                         // YYYY-MM-DD
  sede_id: string;
  punto_retiro_id: string;
  cantidad_pedidos_entregados: number;
  cantidad_pedidos_a_no_retirar: number; // confirmados no entregados
  cantidad_pedidos_cancelados: number;
  cantidad_ventas_sobrantes: number;
  recaudacion_presencial_estimada: number;
  dia_ya_cerrado: boolean;               // true si ya existe cierre
}
```
