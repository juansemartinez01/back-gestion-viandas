# API Contract: Back Office — Pedidos

**Prefix**: `/admin/pedidos`
**Auth**: `JwtAuthGuard` + `RolesGuard` en todos los endpoints.
**Response envelope**: `{ ok: true, data: ... }` / `{ ok: false, error: { code, message } }`

---

## GET /admin/pedidos

Lista paginada de pedidos con filtros.

**Roles**: `administrador`, `supervisor`, `operador_caja`

**Query Params**:
| Param | Tipo | Descripción |
|-------|------|-------------|
| `page` | number | Página (default: 1) |
| `limit` | number | Items por página (default: 20) |
| `fecha_retiro` | date string | Filtrar por fecha de retiro |
| `sede_id` | uuid | Filtrar por sede |
| `punto_retiro_id` | uuid | Filtrar por punto de retiro |
| `estado_pedido` | enum | `pendiente_pago_online` \| `confirmado_pago_presencial` \| … |
| `estado_pago` | enum | `pendiente` \| `aprobado` \| `presencial_pendiente` \| … |
| `menu_publicado_id` | uuid | Filtrar por menú publicado |
| `dni` | string | Búsqueda ILIKE en `dni_informado` |

**Response 200**:
```json
{
  "ok": true,
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

---

## GET /admin/pedidos/:id

Detalle de un pedido con JOINs a menuPublicado, sede, puntoRetiro.

**Roles**: `administrador`, `supervisor`, `operador_caja`

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "codigo_publico": "VIA-2026-000001",
    "estado_pedido": "confirmado_pago_presencial",
    "estado_pago": "presencial_pendiente",
    "dni_informado": "12345678",
    "nombre_informado": "Juan",
    "apellido_informado": "Pérez",
    "fecha_retiro": "2026-06-10",
    "cantidad": 2,
    "precio_unitario": "1500.00",
    "importe_total": "3000.00",
    "medio_pago": "presencial",
    "menuPublicado": { "id": "...", "fecha_venta": "...", "precio_encargo": "1500.00" },
    "sede": { "id": "...", "nombre": "..." },
    "puntoRetiro": { "id": "...", "nombre": "..." }
  }
}
```

| Status | Código error | Cuándo |
|--------|-------------|--------|
| 404 | `PEDIDO_NOT_FOUND` | No encontrado |

---

## POST /admin/pedidos/manual

Crea un pedido manual desde el back office (solo pago presencial).

**Roles**: `administrador`, `supervisor`

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
  "cantidad": 1,
  "medio_pago": "presencial"
}
```

**Audit event**: `pedido.manual.created`

**Responses**:
| Status | Código error | Cuándo |
|--------|-------------|--------|
| 201 | — | Creado exitosamente |
| 422 | `PEDIDO_SOLO_PAGO_PRESENCIAL_MANUAL` | `medio_pago != presencial` |
| 409 | `PEDIDO_MENU_NO_DISPONIBLE` | Menú no activo |
| 422 | `PEDIDO_PUNTO_RETIRO_NO_HABILITADO` | Punto no en el menú |
| 409 | `PEDIDO_CAPACIDAD_AGOTADA` | Límite superado |

---

## PATCH /admin/pedidos/:id

Edita campos no críticos de un pedido confirmado.

**Roles**: `administrador`

**Request Body** (todos opcionales):
```json
{
  "telefono_informado": "3519999999",
  "email_informado": "nuevo@email.com",
  "motivo": "Corrección de datos de contacto"
}
```

**Audit event**: `pedido.updated`

**Restricción**: `precio_unitario` e `importe_total` NUNCA se modifican.

**Responses**:
| Status | Código error | Cuándo |
|--------|-------------|--------|
| 200 | — | Actualizado |
| 404 | `PEDIDO_NOT_FOUND` | No encontrado |

---

## POST /admin/pedidos/:id/cancelar

Cancela un pedido desde el back office (sin restricción de ventana horaria).

**Roles**: `administrador`, `supervisor`, `operador_caja`

**Request Body** (opcional):
```json
{
  "motivo": "Cliente solicitó cancelación por teléfono"
}
```

**Audit event**: `pedido.cancelado.admin`

**Responses**:
| Status | Código error | Cuándo |
|--------|-------------|--------|
| 200 | — | Cancelado exitosamente |
| 404 | `PEDIDO_NOT_FOUND` | No encontrado |
| 409 | `PEDIDO_NO_CANCELABLE` | Estado `entregado` o `cancelado` |
