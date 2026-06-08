# Data Model: Módulo Cancelaciones de Pedidos

## Entidades utilizadas (sin entidad propia)

Este módulo no crea tablas nuevas. Opera exclusivamente sobre entidades ya existentes.

---

## Pedido (entidad fuente principal)

**Ubicación**: `src/modules/pedidos/entities/pedido.entity.ts`

Campos relevantes para este módulo:

| Campo | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | uuid | No | PK |
| `tenant_id` | uuid | No | Scope de tenant (obligatorio en toda query) |
| `codigo_publico` | string | No | Código VIA-YYYY-NNNNNN |
| `estado_pedido` | `EstadoPedido` | No | Estado actual del pedido |
| `fecha_cancelacion` | timestamptz | Sí | Cuándo fue cancelado |
| `cancelado_por` | `OrigenCancelacion` | Sí | `cliente` o `administracion` |
| `usuario_cancelacion_id` | uuid | Sí | Quién ejecutó la cancelación (admin) |
| `motivo_cancelacion` | text | Sí | Motivo libre |
| `devolucion_pendiente` | boolean | No | Default: false. True si hay reembolso pendiente |
| `sede_id` | uuid | No | FK a Sede |
| `menu_publicado_id` | uuid | No | FK a MenuPublicado |
| `punto_retiro_id` | uuid | Sí | FK a PuntoRetiro |
| `cliente_id` | uuid | No | FK a Cliente |

**Relaciones disponibles** (LEFT JOIN en queries del módulo):
- `sede` → `Sede` (nombre, dirección)
- `puntoRetiro` → `PuntoRetiro` (descripción)
- `menuPublicado` → `MenuPublicado` (fecha_menu, fecha_hora_limite_cancelacion)
- `cliente` → `Cliente` (nombre, apellido, dni)

---

## EstadoPedido enum

**Ubicación**: `src/modules/pedidos/pedido.enums.ts`

```
PENDIENTE_PAGO_ONLINE     → 'pendiente_pago_online'
CONFIRMADO_PAGO_ONLINE    → 'confirmado_pago_online'
CONFIRMADO_PAGO_PRESENCIAL → 'confirmado_pago_presencial'
ENTREGADO                  → 'entregado'
NO_RETIRADO                → 'no_retirado'
CANCELADO                  → 'cancelado'
```

**Estados que implican cancelación**: solo `CANCELADO`.

**Estados válidos para cancelación portal**: solo `CONFIRMADO_PAGO_PRESENCIAL` (dentro del plazo límite del menú).

---

## OrigenCancelacion enum

**Ubicación**: `src/modules/pedidos/pedido.enums.ts`

```
CLIENTE         → 'cliente'
ADMINISTRACION  → 'administracion'
```

---

## MenuPublicado (entidad auxiliar para validación)

**Ubicación**: `src/modules/menus-publicados/entities/menu-publicado.entity.ts`

Campo relevante para este módulo:

| Campo | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | uuid | No | PK |
| `fecha_hora_limite_cancelacion` | timestamptz | Sí | Hasta cuándo se puede cancelar. `null` = sin ventana disponible. |

---

## Estructura de respuesta — Resumen diario

No es una entidad persistida. Es un objeto calculado en tiempo de ejecución:

```typescript
{
  fecha: string;               // YYYY-MM-DD
  sede_id: string | null;      // UUID o null si es global
  total_cancelaciones: number;
  por_cliente: number;         // cancelado_por = CLIENTE
  por_administracion: number;  // cancelado_por = ADMINISTRACION
  con_devolucion_pendiente: number;
}
```

---

## Diagrama de relaciones (solo lectura)

```
CancelacionesPedidosService
  └── reads → Pedido
                ├── JOIN → Sede
                ├── JOIN → PuntoRetiro
                ├── JOIN → MenuPublicado (para fecha_hora_limite_cancelacion)
                └── JOIN → Cliente

validarReglaCancelacionPortal(pedido, menuPublicado)
  → Pure function: no DB access, no side effects
  → Returns { permitido: boolean, motivo?: string }
```
