# API Contracts: Cancelaciones de Pedidos

Todos los endpoints requieren:
- Header: `Authorization: Bearer <jwt_token>`
- Header: `x-tenant-key: <tenant_key>` (resuelto automáticamente por el guard)

---

## GET /admin/cancelaciones

**Roles**: `administrador`, `supervisor`

### Query Parameters

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | integer (≥1) | No | Página (default: 1) |
| `limit` | integer (1–200) | No | Resultados por página (default: 20) |
| `fecha_desde` | ISO date string | No | Inicio rango fecha_cancelacion |
| `fecha_hasta` | ISO date string | No | Fin rango fecha_cancelacion |
| `sede_id` | UUID | No | Filtrar por sede |
| `cancelado_por` | `cliente` \| `administracion` | No | Origen de la cancelación |
| `devolucion_pendiente` | boolean | No | Filtrar pedidos con devolución pendiente |

### Response — 200 OK

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "codigo_publico": "VIA-2026-000042",
      "fecha_cancelacion": "2026-06-08T14:30:00.000Z",
      "cancelado_por": "cliente",
      "motivo_cancelacion": "Me equivoqué de menú",
      "devolucion_pendiente": true,
      "sede": { "id": "uuid", "nombre": "Sede Centro" },
      "puntoRetiro": { "id": "uuid", "descripcion": "Ventanilla A" },
      "menuPublicado": { "id": "uuid", "fecha_menu": "2026-06-09" },
      "cliente": { "id": "uuid", "nombre": "Juan", "apellido": "García", "dni": "12345678" }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 85,
    "totalPages": 5
  }
}
```

### Response — 403 Forbidden

```json
{
  "ok": false,
  "statusCode": 403,
  "error": { "code": "FORBIDDEN", "message": "No tienes permisos para realizar esta acción" }
}
```

---

## GET /admin/cancelaciones/devolucion-pendiente

**Roles**: `administrador` (exclusivo)

### Query Parameters

Ninguno (devuelve todos los registros pendientes sin paginación).

### Response — 200 OK

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "codigo_publico": "VIA-2026-000038",
      "fecha_cancelacion": "2026-06-07T10:15:00.000Z",
      "cancelado_por": "cliente",
      "motivo_cancelacion": null,
      "devolucion_pendiente": true,
      "sede": { "id": "uuid", "nombre": "Sede Norte" },
      "cliente": { "id": "uuid", "nombre": "María", "apellido": "López", "dni": "87654321" }
    }
  ]
}
```

---

## GET /admin/cancelaciones/resumen

**Roles**: `administrador`, `supervisor`

### Query Parameters

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `fecha` | ISO date string (YYYY-MM-DD) | No | Fecha a resumir (default: hoy) |
| `sede_id` | UUID | No | Filtrar por sede específica |

### Response — 200 OK

```json
{
  "ok": true,
  "data": {
    "fecha": "2026-06-08",
    "sede_id": "uuid-or-null",
    "total_cancelaciones": 7,
    "por_cliente": 5,
    "por_administracion": 2,
    "con_devolucion_pendiente": 3
  }
}
```

### Response — 400 Bad Request (fecha inválida)

```json
{
  "ok": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos",
    "details": [{ "field": "fecha", "message": "fecha must be a valid ISO 8601 date string" }]
  }
}
```

---

## Método interno: validarReglaCancelacionPortal

No es un endpoint HTTP. Es un método del servicio consumido internamente por `PedidosService` antes de ejecutar una cancelación desde el portal.

### Firma

```typescript
validarReglaCancelacionPortal(
  pedido: Pedido,
  menuPublicado: MenuPublicado
): { permitido: boolean; motivo?: string }
```

### Lógica de validación (en orden)

| Condición | Resultado |
|---|---|
| `pedido.estado_pedido === ENTREGADO` | `{ permitido: false, motivo: 'El pedido ya fue entregado' }` |
| `pedido.estado_pedido === CANCELADO` | `{ permitido: false, motivo: 'El pedido ya está cancelado' }` |
| `pedido.estado_pedido === NO_RETIRADO` | `{ permitido: false, motivo: 'El pedido ya fue cerrado como no retirado' }` |
| `pedido.estado_pedido === PENDIENTE_PAGO_ONLINE` | `{ permitido: false, motivo: 'Pago en proceso, contacte a administración' }` |
| `pedido.estado_pedido === CONFIRMADO_PAGO_ONLINE` | `{ permitido: false, motivo: 'Pedido con pago online, contacte a administración' }` |
| `menuPublicado.fecha_hora_limite_cancelacion === null` | `{ permitido: false, motivo: 'Este menú no permite cancelaciones online' }` |
| `new Date() > menuPublicado.fecha_hora_limite_cancelacion` | `{ permitido: false, motivo: 'La ventana de cancelación ha expirado' }` |
| (ninguna condición anterior) | `{ permitido: true }` |
