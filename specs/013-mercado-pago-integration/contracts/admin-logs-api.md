# Contract: Admin Logs API

**Auth**: `JwtAuthGuard` + `@Roles('administrador')`
**Base path**: `/admin/mercado-pago`

---

## GET /admin/mercado-pago/logs

Lista paginada de logs de webhook, filtrada por tenant del usuario autenticado.

### Query Parameters

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `pedido_id` | UUID | No | Filtrar logs por pedido |
| `resultado` | string enum | No | `procesado_ok` \| `procesado_error` \| `pendiente_revision` |
| `page` | number | No | Número de página (default: 1) |
| `limit` | number | No | Items por página (default: 20, max: 100) |

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "pedido_id": "uuid | null",
      "tipo_evento": "payment",
      "referencia_externa": "123456789",
      "resultado_procesamiento": "procesado_ok",
      "mensaje_error": null,
      "fecha_recepcion": "2026-06-07T14:30:00.000Z",
      "created_at": "2026-06-07T14:30:01.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Nota**: El campo `payload` (jsonb completo) NO se incluye en el listado para mantener la respuesta ligera. Solo aparece en el endpoint de detalle.

### Response 403

```json
{ "ok": false, "error": { "code": "AUTH_FORBIDDEN", "message": "Acceso denegado" } }
```

---

## GET /admin/mercado-pago/logs/:id

Detalle completo de un log de webhook, incluyendo el payload original de Mercado Pago.

### Path Parameters

| Param | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID del log |

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "pedido_id": "uuid | null",
    "tipo_evento": "payment",
    "referencia_externa": "123456789",
    "payload": {
      "id": 123456789,
      "live_mode": true,
      "type": "payment",
      "data": { "id": "999" }
    },
    "resultado_procesamiento": "procesado_error",
    "mensaje_error": "Pedido no encontrado para external_reference: xyz",
    "fecha_recepcion": "2026-06-07T14:30:00.000Z",
    "created_at": "2026-06-07T14:30:01.000Z"
  }
}
```

### Response 404

```json
{
  "ok": false,
  "error": {
    "code": "MERCADO_PAGO_WEBHOOK_LOG_NOT_FOUND",
    "message": "Log de webhook no encontrado"
  }
}
```

---

## Método Interno: generarPreferencia

**No es un endpoint HTTP** — es un método de servicio llamado internamente por PedidosService.

```typescript
// MercadoPagoService
async generarPreferencia(
  pedidoId: string,
  importe: number,
  descripcion: string,
  tenantId: string
): Promise<{ preference_id: string; init_point: string }>
```

**En caso de error** (API de MP no disponible, token inválido): lanza `AppError` con código `MERCADO_PAGO_ERROR_PREFERENCIA` (HTTP 502). PedidosService captura este error y lo maneja apropiadamente (no crea el pedido).
