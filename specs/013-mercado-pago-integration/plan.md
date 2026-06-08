# Implementation Plan: Integración Mercado Pago

**Branch**: `013-mercado-pago-integration` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-mercado-pago-integration/spec.md`

**Note**: This file is the output of the `/speckit-plan` command.

## Summary

Módulo operativo (Type C) que integra Mercado Pago al sistema de Gestión de Viandas Rochester. Cubre dos responsabilidades: (1) generar preferencias de pago (checkout) invocado internamente por PedidosService al crear pedidos online, y (2) recibir, validar y procesar webhooks de Mercado Pago para confirmar o rechazar pagos, actualizando automáticamente el estado del pago y del pedido. Todos los eventos de webhook quedan registrados en `MercadoPagoWebhookLog` para trazabilidad operativa. El webhook siempre responde HTTP 200 para evitar reintentos.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 18+

**Primary Dependencies**: NestJS, TypeORM, PostgreSQL, fetch nativo Node 18 (sin @nestjs/axios), `crypto` nativo (HMAC)

**Storage**: PostgreSQL — nueva tabla `mercado_pago_webhook_logs`

**Testing**: Jest (unitario), supertest (e2e)

**Target Platform**: Railway (Linux server); arquitectura AWS-compatible

**Project Type**: Web service — módulo NestJS (Type C operativo)

**Performance Goals**: Procesamiento de webhook < 5 s; generación de preferencia < 3 s

**Constraints**:
- Webhook SIEMPRE responde HTTP 200, incluso si el procesamiento interno falla
- Todo procesamiento dentro de try/catch; errores no se propagan al respondedor HTTP
- Sin `throw new Error()` — usar `AppError` con `ErrorCodes`
- `pedido_id` en webhook log: referencial sólo, nullable, sin FK hard constraint
- Dependencia circular PedidosModule ↔ MercadoPagoModule resuelta con `forwardRef()`

**Scale/Scope**: Decenas a cientos de webhooks por día en MVP

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | ✅ PASS | Endpoints admin usan `ok()` / `page()`. Webhook responde `{ ok: true, data: { received: true } }` manualmente — justificado: MP requiere HTTP 200 incondicional sin importar el body. |
| II. Multi-Tenancy | ✅ PASS | `MercadoPagoWebhookLog` tiene `tenant_id`. Todas las queries filtran por tenant. Webhook sin auth recibe tenant via header `x-tenant-key`. |
| III. RBAC | ✅ PASS | `/webhooks/mercado-pago` anotado explícitamente como excepción pública. `/admin/mercado-pago/logs*` requieren `@Roles('administrador')` + `RolesGuard`. |
| IV. Business Rules | ✅ PASS | Regla #3: pedido `pendiente_pago_online` no puede entregarse hasta confirmación. Este módulo procesa la confirmación automática. Regla #7: expiración 15 min ya implementada en PedidosModule — este módulo no la reimplementa. |
| V. Audit Trail | ✅ PASS | Cambio de credenciales MP es evento auditable (Principio V). Actualizaciones de estado de pago/pedido usan métodos existentes de PagosService/PedidosService que ya auditan. |
| VI. Module Architecture | ✅ PASS | Type C operativo. Estructura correcta con `entities/`, `dto/`, services, controllers, module. Registrado en AppModule. Exports: MercadoPagoService. |
| VII. Implementation Order | ✅ PASS | Stage 4 — todos los módulos de Stage 1-3 están completos. |

## Project Structure

### Documentation (this feature)

```text
specs/013-mercado-pago-integration/
├── plan.md              ← este archivo
├── research.md          ← decisiones técnicas (Phase 0)
├── data-model.md        ← entidad y schema (Phase 1)
├── contracts/
│   ├── webhook-endpoint.md    ← contrato del endpoint público
│   └── admin-logs-api.md      ← contrato de los endpoints admin
└── tasks.md             ← generado por /speckit-tasks
```

### Source Code

```text
src/modules/mercado-pago/
├── entities/
│   └── mercado-pago-webhook-log.entity.ts
├── dto/
│   └── query-webhook-log.dto.ts
├── mercado-pago.service.ts            ← generarPreferencia()
├── mercado-pago-webhook.service.ts    ← procesarWebhook(), procesarPago*()
├── mercado-pago.controller.ts         ← GET /admin/mercado-pago/logs[/:id]
├── mercado-pago-webhook.controller.ts ← POST /webhooks/mercado-pago
└── mercado-pago.module.ts

src/config/
├── configuration.ts       ← añadir sección mercadoPago{}
└── env.validation.ts      ← añadir MP_* vars (todas opcionales)

src/common/errors/
└── error-codes.ts         ← añadir 3 nuevos códigos MP

src/modules/pedidos/
├── pedidos.service.ts     ← añadir confirmarPagoOnline(pedidoId, tenantId)
└── pedidos.module.ts      ← añadir forwardRef(() => MercadoPagoModule)

src/app.module.ts          ← registrar MercadoPagoModule

migrations/
└── TIMESTAMP-CreateMercadoPagoWebhookLogs.ts
```

**Structure Decision**: Módulo único `src/modules/mercado-pago/` con dos services y dos controllers separados por responsabilidad (webhook público vs. admin). Sin frontend.

## Implementation Notes

### Circular Dependency Resolution

```
PedidosModule → MercadoPagoModule   (para llamar generarPreferencia al crear pedido online)
MercadoPagoModule → PedidosModule   (para llamar confirmarPagoOnline desde webhook)
```

Ambos módulos usan `forwardRef()` en el import mutuo:

```typescript
// mercado-pago.module.ts
imports: [forwardRef(() => PedidosModule), PagosModule, ...]
// pedidos.module.ts
imports: [..., forwardRef(() => MercadoPagoModule)]
```

Los services que inyectan el otro service usan `@Inject(forwardRef(() => XyzService))`.

### HTTP Client

Node 18+ incluye `fetch` nativo. Se usa directamente en `MercadoPagoService` sin agregar `@nestjs/axios`, manteniendo las dependencias mínimas.

### Tenant Resolution en Webhook

El endpoint público resuelve `tenant_id` desde el header `x-tenant-key` (misma convención que el portal público del sistema). Si el header no viene, el log queda registrado pero sin tenant asociado. Mercado Pago permite configurar la URL de notificación con el tenant embebido como query param: `POST /webhooks/mercado-pago?tenant=<key>` — ambas estrategias son válidas y la resolución se delega al `TenancyService`.

### Nuevo Método en PedidosService

PedidosService no tiene actualmente un método para transicionar a `CONFIRMADO_PAGO_ONLINE`. Se debe añadir:

```typescript
async confirmarPagoOnline(pedidoId: string, tenantId: string): Promise<void>
// Transiciona PENDIENTE_PAGO_ONLINE → CONFIRMADO_PAGO_ONLINE
// Si el pedido ya está en CONFIRMADO_PAGO_ONLINE: idempotente (no lanza error)
// Si el pedido está en otro estado incompatible: lanza AppError
```

### Flujo de Procesamiento de Webhook

```
POST /webhooks/mercado-pago
  ↓
MercadoPagoWebhookController → procesarWebhook(body, headers, tenantId)
  1. validarFirmaHmac(rawBody, headers['x-signature'])  → si falla: log(procesado_error), return
  2. repo.save({ tipo_evento, payload, resultado: 'pendiente_revision', fecha_recepcion })  → logId
  3. try {
       if (tipo_evento === 'payment') {
         paymentData = await fetchPaymentFromMP(payload.data.id)
         if (status === 'approved') → procesarPagoAprobado(paymentId, tenantId, logId)
         if (status === 'rejected') → procesarPagoRechazado(paymentId, tenantId, logId)
       }
       // otros tipos: quedan en pendiente_revision sin actualizar
     } catch (e) {
       repo.update(logId, { resultado: 'procesado_error', mensaje_error: e.message })
     }
  4. return { ok: true }   ← siempre
  ↓
Controller responde HTTP 200 con ok({ received: true })
```

### Error Codes a Agregar

```typescript
// en src/common/errors/error-codes.ts
MERCADO_PAGO_ERROR_PREFERENCIA: 'MERCADO_PAGO_ERROR_PREFERENCIA',     // HTTP 502
MERCADO_PAGO_FIRMA_INVALIDA: 'MERCADO_PAGO_FIRMA_INVALIDA',           // HTTP 401
MERCADO_PAGO_WEBHOOK_LOG_NOT_FOUND: 'MERCADO_PAGO_WEBHOOK_LOG_NOT_FOUND', // HTTP 404
```

### Variables de Entorno

| Variable | Requerido | Descripción |
|----------|-----------|-------------|
| `MP_ACCESS_TOKEN` | Sí (si MP activo) | Token de acceso a la API de MP |
| `MP_WEBHOOK_SECRET` | No | Clave para validar firma HMAC |
| `MP_SUCCESS_URL` | Sí | URL de retorno pago exitoso |
| `MP_FAILURE_URL` | Sí | URL de retorno pago fallido |
| `MP_PENDING_URL` | Sí | URL de retorno pago pendiente |

Todas opcionales en `env.validation.ts` para no romper entornos sin MP configurado. En `configuration.ts` se agrega sección `mercadoPago: { accessToken, webhookSecret, successUrl, failureUrl, pendingUrl }`.
