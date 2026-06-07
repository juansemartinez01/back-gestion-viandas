# API Contract: Portal Público — Pedidos

**Prefix**: `/public/pedidos`
**Auth**: Sin `JwtAuthGuard`. Tenant resuelto desde header `x-tenant-key`.
**Response envelope**: `{ ok: true, data: ... }` / `{ ok: false, error: { code, message } }`

---

## POST /public/pedidos

Crea un pedido desde el portal público.

**Request Body**:
```json
{
  "menu_publicado_id": "uuid",
  "punto_retiro_id": "uuid",
  "dni": "12345678",
  "nombre": "Juan",
  "apellido": "Pérez",
  "telefono": "3512345678",
  "email": "juan@email.com",
  "cantidad": 2,
  "medio_pago": "presencial"
}
```

**Responses**:
| Status | Código error | Cuándo |
|--------|-------------|--------|
| 201 | — | Pedido creado exitosamente |
| 409 | `PEDIDO_MENU_NO_DISPONIBLE` | Menú publicado no está en estado ACTIVO |
| 422 | `PEDIDO_PUNTO_RETIRO_NO_HABILITADO` | Punto de retiro no pertenece al menú publicado |
| 409 | `PEDIDO_CAPACIDAD_AGOTADA` | `limite_maximo_viandas` superado |

**Response 201**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "codigo_publico": "VIA-2026-000001",
    "estado_pedido": "confirmado_pago_presencial",
    "estado_pago": "presencial_pendiente",
    "fecha_retiro": "2026-06-10",
    "cantidad": 2,
    "precio_unitario": "1500.00",
    "importe_total": "3000.00",
    "medio_pago": "presencial",
    "expires_at": null
  }
}
```

---

## GET /public/pedidos/consultar

Consulta pedidos del cliente por DNI.

**Query Params**:
| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `dni` | string | SÍ | DNI del cliente (búsqueda exacta case-insensitive) |

**Responses**:
| Status | Cuándo |
|--------|--------|
| 200 | Lista de pedidos (puede ser vacía) |

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "codigo_publico": "VIA-2026-000001",
      "estado_pedido": "confirmado_pago_presencial",
      "estado_pago": "presencial_pendiente",
      "fecha_retiro": "2026-06-10",
      "cantidad": 2,
      "importe_total": "3000.00",
      "medio_pago": "presencial",
      "created_at": "2026-06-07T10:00:00Z"
    }
  ]
}
```

---

## POST /public/pedidos/:id/cancelar

Cancela un pedido desde el portal público.

**URL Params**: `id` — UUID del pedido

**Request Body** (opcional):
```json
{
  "motivo": "Ya no puedo retirarlo"
}
```

**Responses**:
| Status | Código error | Cuándo |
|--------|-------------|--------|
| 200 | — | Cancelado exitosamente |
| 404 | `PEDIDO_NOT_FOUND` | Pedido no encontrado para el tenant |
| 409 | `PEDIDO_NO_CANCELABLE` | Estado `entregado` o `cancelado` |
| 409 | `PEDIDO_RESERVA_EXPIRADA` | `pendiente_pago_online` con `expires_at` ya pasado |
| 409 | `PEDIDO_FUERA_DE_VENTANA_CANCELACION` | `fecha_hora_limite_cancelacion` del menú ya pasó |

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "estado_pedido": "cancelado",
    "cancelado_por": "cliente",
    "fecha_cancelacion": "2026-06-07T11:00:00Z",
    "devolucion_pendiente": false
  }
}
```
