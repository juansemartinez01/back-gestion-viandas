# API Contracts: Cierres Operativos

All endpoints require `JwtAuthGuard` + `RolesGuard`. Tenant resolved from JWT context.

---

## POST /admin/cierres-operativos

**Roles**: `administrador`, `operador_caja`
**Audit**: `cierre.operativo.registrado`

### Request Body

```json
{
  "fecha_operativa": "2026-06-08",
  "sede_id": "uuid",
  "punto_retiro_id": "uuid",
  "observacion": "string | null (optional)"
}
```

### Responses

**201 Created** — Cierre ejecutado exitosamente:

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "fecha_operativa": "2026-06-08",
    "sede_id": "uuid",
    "punto_retiro_id": "uuid",
    "usuario_id": "uuid",
    "fecha_cierre": "2026-06-08T23:45:00Z",
    "cantidad_pedidos_entregados": 42,
    "cantidad_pedidos_no_retirados": 3,
    "cantidad_ventas_sobrantes": 5,
    "recaudacion_presencial": "1250.00",
    "observacion": null,
    "created_at": "2026-06-08T23:45:00Z"
  }
}
```

**409 Conflict** — Cierre ya existe:

```json
{
  "ok": false,
  "requestId": "uuid",
  "statusCode": 409,
  "error": {
    "code": "CIERRE_YA_EXISTE",
    "message": "Ya existe un cierre operativo para esta fecha, sede y punto de retiro"
  },
  "timestamp": "...",
  "path": "/admin/cierres-operativos"
}
```

---

## GET /admin/cierres-operativos/resumen-previo

**IMPORTANT**: This route MUST be declared before `GET /:id` in the controller.

**Roles**: `administrador`, `operador_caja`

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fecha` | `string (date)` | Yes | Fecha operativa (YYYY-MM-DD) |
| `sede_id` | `uuid` | Yes | ID de la sede |
| `punto_retiro_id` | `uuid` | Yes | ID del punto de retiro |

### Response 200

```json
{
  "ok": true,
  "data": {
    "fecha": "2026-06-08",
    "sede_id": "uuid",
    "punto_retiro_id": "uuid",
    "cantidad_pedidos_entregados": 42,
    "cantidad_pedidos_a_no_retirar": 3,
    "cantidad_pedidos_cancelados": 1,
    "cantidad_ventas_sobrantes": 5,
    "recaudacion_presencial_estimada": "1250.00",
    "dia_ya_cerrado": false
  }
}
```

---

## GET /admin/cierres-operativos

**Roles**: `administrador`, `supervisor`, `operador_caja`

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fecha_desde` | `string (date)` | No | Filtro desde fecha (inclusive) |
| `fecha_hasta` | `string (date)` | No | Filtro hasta fecha (inclusive) |
| `sede_id` | `uuid` | No | Filtrar por sede |
| `punto_retiro_id` | `uuid` | No | Filtrar por punto de retiro |
| `page` | `number` | No | Página (default 1) |
| `limit` | `number` | No | Tamaño de página (default 20) |

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "fecha_operativa": "2026-06-08",
      "sede_id": "uuid",
      "punto_retiro_id": "uuid",
      "usuario_id": "uuid",
      "fecha_cierre": "2026-06-08T23:45:00Z",
      "cantidad_pedidos_entregados": 42,
      "cantidad_pedidos_no_retirados": 3,
      "cantidad_ventas_sobrantes": 5,
      "recaudacion_presencial": "1250.00",
      "observacion": null,
      "created_at": "2026-06-08T23:45:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20
  }
}
```

---

## GET /admin/cierres-operativos/:id

**Roles**: `administrador`, `supervisor`, `operador_caja`

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | ID del cierre operativo |

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "fecha_operativa": "2026-06-08",
    "sede_id": "uuid",
    "punto_retiro_id": "uuid",
    "usuario_id": "uuid",
    "fecha_cierre": "2026-06-08T23:45:00Z",
    "cantidad_pedidos_entregados": 42,
    "cantidad_pedidos_no_retirados": 3,
    "cantidad_ventas_sobrantes": 5,
    "recaudacion_presencial": "1250.00",
    "observacion": null,
    "created_at": "2026-06-08T23:45:00Z"
  }
}
```

**404 Not Found**:

```json
{
  "ok": false,
  "requestId": "uuid",
  "statusCode": 404,
  "error": {
    "code": "CIERRE_OPERATIVO_NOT_FOUND",
    "message": "Cierre operativo no encontrado"
  },
  "timestamp": "...",
  "path": "/admin/cierres-operativos/:id"
}
```

---

## Error Codes (new in this module)

| Code | HTTP | Description |
|------|------|-------------|
| `CIERRE_OPERATIVO_NOT_FOUND` | 404 | Cierre no encontrado para el id dado |
| `CIERRE_YA_EXISTE` | 409 | Ya existe un cierre para esa fecha/sede/punto |
| `CIERRE_DIA_CERRADO` | 409 | Operación rechazada porque el día operativo ya fue cerrado (usado por EntregasService y VentasSobrantesService) |

---

## Exported Service Interface

```typescript
// Método exportado para EntregasService y VentasSobrantesService
isDiaCerrado(
  fecha: string,          // 'YYYY-MM-DD'
  sedeId: string,
  puntoRetiroId: string,
  tenantId: string,
): Promise<boolean>
```

Callers should throw `AppError({ code: ErrorCodes.CIERRE_DIA_CERRADO, status: 409 })` if `isDiaCerrado` returns `true`.
