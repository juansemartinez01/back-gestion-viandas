# API Endpoints: Stock Operativo de Viandas

**Branch**: `016-stock-viandas` | **Date**: 2026-06-08

Todos los endpoints retornan `{ ok: true, data, meta? }` en éxito y `{ ok: false, error: { code, message } }` en error, según el contrato del template (principio I de la constitución).

Todos requieren header `Authorization: Bearer <jwt>`.

---

## GET /admin/stock-viandas

**Roles**: `administrador`, `supervisor`, `operador_caja`

**Descripción**: Lista registros de stock con filtros opcionales. Retorna paginado.

**Query params**:

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `fecha` | `YYYY-MM-DD` | No | Filtrar por fecha de producción |
| `sede_id` | `uuid` | No | Filtrar por sede |
| `punto_retiro_id` | `uuid` | No | Filtrar por punto de retiro |
| `menu_publicado_id` | `uuid` | No | Filtrar por menú publicado |
| `page` | `int` | No | Página (default: 1) |
| `limit` | `int` | No | Items por página (default: 20) |

**Respuesta exitosa** `200`:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "fecha": "2026-06-08",
      "sede_id": "uuid",
      "sede": { "id": "uuid", "nombre": "Sede Central" },
      "punto_retiro_id": "uuid",
      "puntoRetiro": { "id": "uuid", "nombre": "Punto A" },
      "menu_publicado_id": "uuid",
      "menuPublicado": { "id": "uuid", "menuBase": { "nombre": "Menú del día" } },
      "orden_produccion_id": "uuid",
      "stock_reservado_encargues": 30,
      "stock_disponible_sobrantes": 20,
      "stock_entregado": 15,
      "stock_vendido_sobrante": 5,
      "stock_ajustado": 0,
      "stock_restante": 30,
      "created_at": "2026-06-08T10:00:00Z",
      "updated_at": "2026-06-08T12:30:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

**Errores posibles**:
- `401` `AUTH_INVALID` — token inválido
- `403` `AUTH_FORBIDDEN` — rol insuficiente

---

## GET /admin/stock-viandas/:id

**Roles**: `administrador`, `supervisor`, `operador_caja`

**Descripción**: Detalle de un registro de stock por ID.

**Path params**:
- `id` — UUID del StockVianda

**Respuesta exitosa** `200`:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "fecha": "2026-06-08",
    "sede_id": "uuid",
    "sede": { "id": "uuid", "nombre": "Sede Central" },
    "punto_retiro_id": "uuid",
    "puntoRetiro": { "id": "uuid", "nombre": "Punto A" },
    "menu_publicado_id": "uuid",
    "menuPublicado": { "id": "uuid", "menuBase": { "nombre": "Menú del día" } },
    "orden_produccion_id": "uuid",
    "stock_reservado_encargues": 30,
    "stock_disponible_sobrantes": 20,
    "stock_entregado": 15,
    "stock_vendido_sobrante": 5,
    "stock_ajustado": 0,
    "stock_restante": 30,
    "created_at": "2026-06-08T10:00:00Z",
    "updated_at": "2026-06-08T12:30:00Z"
  }
}
```

**Errores posibles**:
- `401` `AUTH_INVALID`
- `403` `AUTH_FORBIDDEN`
- `404` `STOCK_VIANDA_NOT_FOUND` — ID no existe o no pertenece al tenant

---

## POST /admin/stock-viandas/:id/ajustar

**Roles**: `administrador`, `supervisor`, `operador_caja`

**Descripción**: Aplica un ajuste manual al stock. Registra movimiento y audita `stock.ajuste_manual`.

**Path params**:
- `id` — UUID del StockVianda

**Body**:
```json
{
  "tipo": "positivo",
  "cantidad": 5,
  "observacion": "Reconteo físico — 5 unidades encontradas en depósito"
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|-----------|
| `tipo` | `"positivo" \| "negativo"` | SÍ | `@IsEnum` |
| `cantidad` | `int` | SÍ | `@IsInt`, `@Min(1)` |
| `observacion` | `string` | No | `@IsOptional`, `@IsString` |

**Respuesta exitosa** `200`:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "stock_ajustado": 5,
    "stock_restante": 35,
    "updated_at": "2026-06-08T13:00:00Z"
  }
}
```

**Errores posibles**:
- `401` `AUTH_INVALID`
- `403` `AUTH_FORBIDDEN`
- `404` `STOCK_VIANDA_NOT_FOUND`
- `422` `STOCK_AJUSTE_INVALIDO` — cantidad inválida (ej. 0 o negativa en DTO)

---

## GET /admin/stock-viandas/:id/movimientos

**Roles**: `administrador`, `supervisor`

**Descripción**: Historial completo de movimientos de un registro de stock, ordenados cronológicamente ascendente.

**Path params**:
- `id` — UUID del StockVianda

**Respuesta exitosa** `200`:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "stock_vianda_id": "uuid",
      "tipo_movimiento": "alta_produccion",
      "cantidad": 50,
      "pedido_id": null,
      "venta_sobrante_id": null,
      "usuario_id": null,
      "observacion": null,
      "created_at": "2026-06-08T10:00:00Z"
    },
    {
      "id": "uuid",
      "stock_vianda_id": "uuid",
      "tipo_movimiento": "consumo_entrega",
      "cantidad": -1,
      "pedido_id": "uuid-pedido",
      "venta_sobrante_id": null,
      "usuario_id": null,
      "observacion": null,
      "created_at": "2026-06-08T12:00:00Z"
    },
    {
      "id": "uuid",
      "stock_vianda_id": "uuid",
      "tipo_movimiento": "ajuste_positivo",
      "cantidad": 5,
      "pedido_id": null,
      "venta_sobrante_id": null,
      "usuario_id": "uuid-supervisor",
      "observacion": "Reconteo físico",
      "created_at": "2026-06-08T13:00:00Z"
    }
  ]
}
```

**Errores posibles**:
- `401` `AUTH_INVALID`
- `403` `AUTH_FORBIDDEN`
- `404` `STOCK_VIANDA_NOT_FOUND`

---

## Métodos internos (no son endpoints HTTP)

Estos métodos son llamados desde otros módulos NestJS — no están expuestos por el controlador.

### `generarDesdeProduccion(orden: OrdenProduccionVianda): Promise<StockVianda>`

- Llamado desde: `ProduccionViandasService.confirmarProduccion()`
- Crea o actualiza `StockVianda` para la combinación `(tenant_id, fecha, sede_id, punto_retiro_id, menu_publicado_id)` de la orden.
- Registra movimiento `alta_produccion`.

### `consumirParaEntrega(stockViandaId, cantidad, pedidoId, tenantId): Promise<void>`

- Llamado desde: módulo `entregas` (futuro Stage 6)
- SELECT FOR UPDATE → valida disponibilidad → descuenta → registra movimiento.
- Lanza `STOCK_INSUFICIENTE_ENTREGAS` (409) si no hay stock.

### `consumirParaSobrante(stockViandaId, cantidad, ventaSobranteId, tenantId): Promise<void>`

- Llamado desde: módulo `ventas-sobrantes` (futuro Stage 6)
- SELECT FOR UPDATE → valida sobrantes → descuenta → registra movimiento.
- Lanza `STOCK_INSUFICIENTE_SOBRANTES` (409) si no hay sobrantes.

### `reasignarCancelacion(pedidoId, tenantId): Promise<void>`

- Llamado desde: módulo `pedidos` o `cancelaciones-pedidos` cuando se cancela un pedido en estado CONFIRMADO después de confirmación de producción.
- Busca el stock del día del pedido; si existe, incrementa `stock_disponible_sobrantes` y registra movimiento `reasignacion_cancelacion`.
- Si no existe stock para ese día (producción no confirmada aún), no hace nada.

---

## Códigos de error nuevos a agregar en ErrorCodes

```typescript
// stock-viandas
STOCK_VIANDA_NOT_FOUND: 'STOCK_VIANDA_NOT_FOUND',              // 404
STOCK_INSUFICIENTE_ENTREGAS: 'STOCK_INSUFICIENTE_ENTREGAS',    // 409
STOCK_INSUFICIENTE_SOBRANTES: 'STOCK_INSUFICIENTE_SOBRANTES',  // 409
STOCK_AJUSTE_INVALIDO: 'STOCK_AJUSTE_INVALIDO',                // 422
```
