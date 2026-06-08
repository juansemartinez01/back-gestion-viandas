# API Endpoints: Módulo Producción de Viandas

**Feature**: 015-produccion-viandas | **Date**: 2026-06-08
**Base path**: `/admin/produccion-viandas`
**Auth**: Todos requieren `JwtAuthGuard` + `RolesGuard`

---

## GET /admin/produccion-viandas

Lista órdenes de producción con filtros y paginación.

**Roles**: `administrador`, `supervisor`, `cocina`

**Query params**:

| Param | Tipo | Requerido | Descripción |
|---|---|---|---|
| `fecha_produccion` | string (YYYY-MM-DD) | No | Filtrar por fecha |
| `sede_id` | uuid | No | Filtrar por sede |
| `punto_retiro_id` | uuid | No | Filtrar por punto de retiro |
| `menu_publicado_id` | uuid | No | Filtrar por menú publicado |
| `estado` | `EstadoOrdenProduccion` | No | Filtrar por estado |
| `page` | number | No | Página (default: 1) |
| `limit` | number | No | Elementos por página (default: 20) |

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "fecha_produccion": "2026-06-08",
      "sede_id": "uuid",
      "sede": { "id": "uuid", "nombre": "Sede Central" },
      "punto_retiro_id": "uuid",
      "puntoRetiro": { "id": "uuid", "nombre": "Ventanilla A" },
      "menu_publicado_id": "uuid",
      "menuPublicado": {
        "id": "uuid",
        "menuBase": { "id": "uuid", "nombre": "Menú Ejecutivo" }
      },
      "cantidad_pago_online": 12,
      "cantidad_pago_presencial": 8,
      "cantidad_cancelaciones_descontadas": 1,
      "sobreproduccion_configurada": 3,
      "total_sugerido": 22,
      "cantidad_real_producida": null,
      "diferencia": null,
      "estado": "pendiente",
      "observacion": null,
      "usuario_confirmacion_id": null,
      "fecha_confirmacion": null,
      "created_at": "2026-06-08T09:00:00Z",
      "updated_at": "2026-06-08T09:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## GET /admin/produccion-viandas/imprimible

Vista resumida de la hoja de producción para cocina. Mismos filtros que el listado, sin paginación.

**Roles**: `administrador`, `supervisor`, `cocina`

**Query params**: igual que `GET /` (excepto `page` y `limit` — ignorados)

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "fecha_produccion": "2026-06-08",
      "sede": "Sede Central",
      "punto_retiro": "Ventanilla A",
      "menu": "Menú Ejecutivo",
      "total_sugerido": 22,
      "estado": "pendiente"
    }
  ]
}
```

---

## GET /admin/produccion-viandas/:id

Detalle completo de una orden de producción.

**Roles**: `administrador`, `supervisor`, `cocina`

**Path params**:

| Param | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID de la orden de producción |

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "fecha_produccion": "2026-06-08",
    "sede": { "id": "uuid", "nombre": "Sede Central" },
    "puntoRetiro": { "id": "uuid", "nombre": "Ventanilla A" },
    "menuPublicado": {
      "id": "uuid",
      "menuBase": { "id": "uuid", "nombre": "Menú Ejecutivo" },
      "tipo_sobreproduccion": "porcentaje",
      "valor_sobreproduccion": "10.00"
    },
    "cantidad_pago_online": 12,
    "cantidad_pago_presencial": 8,
    "cantidad_cancelaciones_descontadas": 1,
    "sobreproduccion_configurada": 3,
    "total_sugerido": 22,
    "cantidad_real_producida": null,
    "diferencia": null,
    "estado": "pendiente",
    "observacion": null,
    "usuario_confirmacion_id": null,
    "fecha_confirmacion": null,
    "created_at": "2026-06-08T09:00:00Z",
    "updated_at": "2026-06-08T09:00:00Z"
  }
}
```

**Response 404**:
```json
{
  "ok": false,
  "error": { "code": "ORDEN_PRODUCCION_NOT_FOUND", "message": "Orden de producción no encontrada" }
}
```

---

## POST /admin/produccion-viandas/generar

Genera órdenes de producción para una fecha y sede, calculando totales desde pedidos confirmados. Idempotente: re-ejecutar actualiza contadores sin duplicar.

**Roles**: `administrador`, `supervisor`
**Auditable**: ✅ `produccion.generada`

**Request body**:
```json
{
  "fecha_produccion": "2026-06-08",
  "sede_id": "uuid"
}
```

**Validaciones**:
- `fecha_produccion`: requerido, formato YYYY-MM-DD
- `sede_id`: requerido, UUID válido

**Response 200** (órdenes creadas o actualizadas):
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "fecha_produccion": "2026-06-08",
      "sede_id": "uuid",
      "punto_retiro_id": "uuid",
      "menu_publicado_id": "uuid",
      "cantidad_pago_online": 12,
      "cantidad_pago_presencial": 8,
      "cantidad_cancelaciones_descontadas": 1,
      "sobreproduccion_configurada": 3,
      "total_sugerido": 22,
      "estado": "pendiente",
      "created_at": "2026-06-08T09:00:00Z"
    }
  ]
}
```

**Response 400** (validación):
```json
{
  "ok": false,
  "error": { "code": "VALIDATION_ERROR", "message": "fecha_produccion es requerido" }
}
```

---

## PATCH /admin/produccion-viandas/:id/en-produccion

Cambia el estado de una orden a `en_produccion`. Solo puede aplicarse sobre órdenes en estado `pendiente`.

**Roles**: `administrador`, `supervisor`
**Auditable**: ✅ `produccion.en_produccion`

**Path params**:

| Param | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID de la orden de producción |

**Request body**: vacío

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "estado": "en_produccion",
    "updated_at": "2026-06-08T10:00:00Z"
  }
}
```

**Response 404**:
```json
{
  "ok": false,
  "error": { "code": "ORDEN_PRODUCCION_NOT_FOUND", "message": "Orden de producción no encontrada" }
}
```

**Response 409** (transición inválida):
```json
{
  "ok": false,
  "error": {
    "code": "ORDEN_PRODUCCION_ESTADO_INVALIDO",
    "message": "La orden no puede pasar a en_produccion desde su estado actual"
  }
}
```

---

## POST /admin/produccion-viandas/:id/confirmar

Confirma la producción real. Genera stock operativo vía StockViandasService. Si la cantidad real difiere del sugerido, la observación es obligatoria. Incluye alerta informativa si real < encargues confirmados.

**Roles**: `administrador`, `supervisor`
**Auditable**: ✅ `produccion.confirmada`

**Path params**:

| Param | Tipo | Descripción |
|---|---|---|
| `id` | uuid | ID de la orden de producción |

**Request body**:
```json
{
  "cantidad_real_producida": 20,
  "observacion": "Faltaron insumos para 2 unidades"
}
```

**Validaciones**:
- `cantidad_real_producida`: requerido, entero ≥ 0
- `observacion`: requerido si `cantidad_real_producida ≠ total_sugerido`, opcional en caso contrario

**Response 200** (confirmación exitosa):
```json
{
  "ok": true,
  "data": {
    "orden": {
      "id": "uuid",
      "estado": "confirmada_con_diferencia",
      "cantidad_real_producida": 20,
      "diferencia": -2,
      "observacion": "Faltaron insumos para 2 unidades",
      "usuario_confirmacion_id": "uuid",
      "fecha_confirmacion": "2026-06-08T11:30:00Z",
      "updated_at": "2026-06-08T11:30:00Z"
    },
    "alerta": "La producción real es inferior al total de encargues confirmados."
  }
}
```

**Response 200** (sin alerta — real ≥ encargues):
```json
{
  "ok": true,
  "data": {
    "orden": {
      "id": "uuid",
      "estado": "confirmada_completa",
      "cantidad_real_producida": 22,
      "diferencia": 0,
      "observacion": null,
      "usuario_confirmacion_id": "uuid",
      "fecha_confirmacion": "2026-06-08T11:30:00Z"
    },
    "alerta": null
  }
}
```

**Response 422** (observación requerida):
```json
{
  "ok": false,
  "error": {
    "code": "PRODUCCION_OBSERVACION_REQUERIDA",
    "message": "La observación es obligatoria cuando la cantidad producida difiere del total sugerido"
  }
}
```

**Response 404**:
```json
{
  "ok": false,
  "error": { "code": "ORDEN_PRODUCCION_NOT_FOUND", "message": "Orden de producción no encontrada" }
}
```

**Response 409** (ya confirmada):
```json
{
  "ok": false,
  "error": {
    "code": "ORDEN_PRODUCCION_ESTADO_INVALIDO",
    "message": "La orden ya fue confirmada o cancelada y no puede modificarse"
  }
}
```
