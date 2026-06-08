# Data Model: Entregas de Viandas

**Feature**: 017-entregas | **Date**: 2026-06-08

## Entidad: EntregaPedido

**Tabla**: `entrega_pedidos`

**Propósito**: Registro inmutable de que un pedido fue retirado por el cliente. Se crea exactamente una vez por pedido entregado. No tiene soft delete — las entregas no se eliminan.

### Campos

| Campo | Tipo DB | TypeORM | Nullable | Descripción |
|-------|---------|---------|----------|-------------|
| `id` | `uuid` | `@PrimaryGeneratedColumn('uuid')` | NO | PK, heredado de BaseEntity parcial |
| `tenant_id` | `uuid` | `@Column` | NO | Multi-tenancy obligatorio |
| `pedido_id` | `uuid` | `@Column` + `@Unique` | NO | FK a Pedido; unicidad garantiza 1 entrega por pedido |
| `sede_id` | `uuid` | `@Column` | NO | Sede donde ocurrió la entrega |
| `punto_retiro_id` | `uuid` | `@Column` | NO | Punto de retiro donde se entregó |
| `usuario_id` | `uuid` | `@Column` | NO | Operador que registró la entrega |
| `importe_cobrado_caja` | `decimal(10,2)` | `@Column` | NO | $0 si pago online; importe_total si presencial |
| `fecha_entrega` | `timestamptz` | `@Column` | NO | Fecha/hora exacta del retiro |
| `observacion` | `text` | `@Column` | SÍ | Nota opcional del operador |
| `created_at` | `timestamptz` | heredado | NO | Timestamp de creación |

### Índices

| Nombre | Columnas | Tipo | Justificación |
|--------|----------|------|---------------|
| `entrega_pedidos_pedido_id_key` | `pedido_id` | UNIQUE | Idempotencia: 1 entrega por pedido |
| `idx_entrega_tenant_fecha_sede` | `tenant_id, fecha_entrega, sede_id` | Compuesto | Filtros de listado por fecha y sede |

### Decoradores TypeORM

```typescript
@Entity('entrega_pedidos')
@Unique(['pedido_id'])
@Index(['tenant_id', 'fecha_entrega', 'sede_id'])
```

### NO incluye

- `updated_at` — inmutable
- `deleted_at` — sin soft delete

---

## Entidades referenciadas (existentes, no modificadas)

### Pedido (`pedidos`)

Campos consumidos por EntregasService:

| Campo | Tipo | Uso en Entregas |
|-------|------|-----------------|
| `id` | uuid | PK para lookup y FK en EntregaPedido |
| `tenant_id` | uuid | Scope de tenancia |
| `estado_pedido` | enum EstadoPedido | Validación elegibilidad |
| `medio_pago` | enum MedioPagoPedido | Ramifica flujo cobro vs $0 |
| `importe_total` | decimal(10,2) | Valor a registrar en importe_cobrado_caja |
| `cantidad` | int | Unidades a consumir del stock |
| `fecha_retiro` | date | Clave para lookup de StockVianda |
| `sede_id` | uuid | Para lookup de StockVianda y EntregaPedido |
| `punto_retiro_id` | uuid | Para lookup de StockVianda y EntregaPedido |
| `menu_publicado_id` | uuid | Para lookup de StockVianda |
| `fecha_confirmacion` | timestamptz (nullable) | Se actualiza a `now()` en la entrega |

**Mutación en entrega**: `estado_pedido = EntregaPedido.ENTREGADO`, `fecha_confirmacion = now()`

### Pago (`pagos`)

Campos consumidos inline en la transacción de entrega (solo para pedidos presenciales):

| Campo | Tipo | Uso en Entregas |
|-------|------|-----------------|
| `pedido_id` | uuid | Clave de búsqueda |
| `tenant_id` | uuid | Scope de tenancia |
| `estado` | enum EstadoPago | Validar PRESENCIAL_PENDIENTE antes de cobrar |
| `importe` | decimal(10,2) | Fuente del importe_cobrado_caja |

**Mutación en entrega (pago presencial)**: `estado = EstadoPago.PRESENCIAL_COBRADO`, `fecha_registro_presencial = now()`

### StockVianda (`stock_viandas`)

Consumida via `StockViandasService.consumirParaEntrega()`. No hay mutaciones directas a esta entidad desde EntregasService.

---

## Diagrama de relaciones

```text
Pedido (1) ──── (1) EntregaPedido
                     │
                     ├── sede_id ────────→ Sede
                     ├── punto_retiro_id ─→ PuntoRetiro
                     └── usuario_id ─────→ Usuario (externo al scope del módulo)

EntregaPedido depende de:
  Pedido.estado_pedido IN (confirmado_pago_online, confirmado_pago_presencial)
  StockVianda.stock_reservado_encargues - stock_entregado >= pedido.cantidad
  Pago.estado = presencial_pendiente (solo si medio_pago = presencial)
```

---

## Transiciones de estado gatilladas por la entrega

### Pedido

```
confirmado_pago_online    ──→  entregado
confirmado_pago_presencial ──→ entregado
```

### Pago (solo presencial)

```
presencial_pendiente ──→ presencial_cobrado
```

### StockVianda

```
stock_entregado += pedido.cantidad
stock_restante  = (recalculado)
```

---

## Nuevos ErrorCodes

Agregar en `src/common/errors/error-codes.ts` bajo la sección `// entregas`:

| Código | HTTP | Descripción |
|--------|------|-------------|
| `ENTREGA_PEDIDO_NO_ENTREGABLE` | 409 | Estado del pedido no permite entrega |
| `ENTREGA_YA_REGISTRADA` | 409 | Ya existe EntregaPedido para este pedido |
| `ENTREGA_NOT_FOUND` | 404 | Entrega no encontrada por id |

**No agregar** `ENTREGA_STOCK_NO_DISPONIBLE` — el error `STOCK_INSUFICIENTE_ENTREGAS` ya existe y es lanzado por `consumirParaEntrega` con HTTP 409.
