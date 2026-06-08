# Contract: Webhook Endpoint

**Endpoint**: `POST /webhooks/mercado-pago`
**Auth**: Ninguna (endpoint público — excepción explícita a Principio III)
**Rate limiting**: Aplicado por la infraestructura (Railway/Nginx)

## Request

### Headers

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `x-tenant-key` | Sí | Identificador del tenant (convención estándar del sistema) |
| `x-signature` | Condicional | Firma HMAC-SHA256 del body (presente cuando MP_WEBHOOK_SECRET configurado) |
| `content-type` | Sí | `application/json` |

### Body (enviado por Mercado Pago)

```json
{
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "date_created": "2015-03-25T10:04:58.396-04:00",
  "user_id": 44444,
  "api_version": "v1",
  "action": "payment.updated",
  "data": {
    "id": "999"
  }
}
```

El body completo se persiste tal cual en la columna `payload` (jsonb) del log.

## Response

El endpoint SIEMPRE responde HTTP 200, independientemente del resultado del procesamiento:

```json
HTTP 200 OK
{
  "ok": true,
  "data": { "received": true }
}
```

**Razón**: Mercado Pago reintenta el webhook si recibe un status distinto de 200. Cualquier error de procesamiento interno se loguea en `MercadoPagoWebhookLog` pero no se expone al respondedor HTTP.

## Flujo de Procesamiento

1. Extraer `tenant_id` del header `x-tenant-key`
2. Si `MP_WEBHOOK_SECRET` configurado: validar firma HMAC del raw body contra `x-signature`
   - Si firma inválida: loguear con `resultado=procesado_error`, responder 200
3. Crear log con `resultado=pendiente_revision`
4. Si `type === 'payment'`: consultar estado del pago en API de MP usando `data.id`
   - Si `status === 'approved'`: actualizar pago → confirmar pedido → log `procesado_ok`
   - Si `status === 'rejected'`: actualizar pago a rechazado → log `procesado_ok`
5. Si `type` desconocido: mantener log en `pendiente_revision`
6. Cualquier excepción en pasos 4-5: actualizar log a `procesado_error` con mensaje
7. Responder 200 siempre
