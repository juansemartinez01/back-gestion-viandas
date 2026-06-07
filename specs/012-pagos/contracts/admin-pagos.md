# API Contract: Admin Pagos

**Feature**: 012-pagos | **Date**: 2026-06-07

## GET /admin/pagos/:pedidoId

Obtiene el registro de pago asociado a un pedido.

### Auth

- `Authorization: Bearer <jwt>`
- `x-tenant-key: <tenant-slug>`
- Roles permitidos: `administrador`, `supervisor`, `operador_caja`

### Path Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| pedidoId | uuid | ✅ | ID del pedido |

### Response 200

```json
{
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "pedido_id": "uuid",
    "medio_pago": "presencial | mercado_pago",
    "estado": "presencial_pendiente | presencial_cobrado | pendiente | aprobado | rechazado | cancelado",
    "importe": "120.50",
    "referencia_externa": "string | null",
    "fecha_generacion": "2026-06-07T10:00:00.000Z",
    "fecha_aprobacion": "2026-06-07T10:05:00.000Z | null",
    "fecha_registro_presencial": "2026-06-07T12:30:00.000Z | null",
    "created_at": "2026-06-07T10:00:00.000Z",
    "updated_at": "2026-06-07T10:05:00.000Z"
  }
}
```

### Response 404

```json
{
  "code": "PAGO_NOT_FOUND",
  "message": "No hay pago registrado para este pedido",
  "status": 404
}
```

### Response 401 / 403

```json
{
  "message": "Unauthorized"
}
```

### Response 400

Cuando `pedidoId` no es un UUID válido — validado automáticamente por el framework.

## Smoke Tests

```
# 1. Happy path — pago presencial pendiente
GET /admin/pagos/:pedidoId
Authorization: Bearer <token-administrador>
x-tenant-key: <tenant>
→ 200, estado=presencial_pendiente

# 2. Pedido sin pago
GET /admin/pagos/00000000-0000-0000-0000-000000000000
→ 404, code=PAGO_NOT_FOUND

# 3. Sin autorización
GET /admin/pagos/:pedidoId
→ 401

# 4. Rol no permitido
GET /admin/pagos/:pedidoId
Authorization: Bearer <token-rol-no-habilitado>
→ 403

# 5. Pago de otro tenant
GET /admin/pagos/:pedidoId-de-otro-tenant
x-tenant-key: <mi-tenant>
→ 404 (scope de tenant aplicado, no encuentra el pago)
```
