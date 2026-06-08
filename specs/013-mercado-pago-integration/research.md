# Research: Integración Mercado Pago

**Feature**: 013-mercado-pago-integration | **Date**: 2026-06-07

## Decisión 1: HTTP Client para la API de Mercado Pago

**Decision**: Usar `fetch` nativo de Node.js 18+, sin agregar `@nestjs/axios`.

**Rationale**: `@nestjs/axios` no está instalado en el proyecto. Node 18 ya incluye `fetch` estable. Para las pocas llamadas necesarias (crear preferencia, consultar payment), `fetch` nativo es suficiente sin agregar una dependencia extra.

**Alternatives considered**:
- `@nestjs/axios`: Descartado — no instalado, coste de dependencia innecesario para 2 endpoints.
- SDK oficial de MP (`mercadopago` npm): Descartado para MVP — añade ~2 MB de dependencia; la API de preferencias y payments son calls REST simples.

---

## Decisión 2: Dependencia Circular PedidosModule ↔ MercadoPagoModule

**Decision**: Usar `forwardRef()` en ambos módulos para el import mutuo.

**Rationale**: NestJS soporta `forwardRef()` exactamente para este caso. Es el patrón oficial para dependencias circulares necesarias.

**Alternatives considered**:
- Inyectar directamente el repositorio de Pedidos en MercadoPagoWebhookService (sin importar el módulo completo): Descartado — rompería encapsulamiento y duplicaría lógica de negocio de PedidosService.
- Usar un EventEmitter/bus para desacoplar: Descartado — over-engineering para MVP; añade complejidad innecesaria.

---

## Decisión 3: Resolución de Tenant en Webhook Público

**Decision**: Resolver tenant desde el header `x-tenant-key` en el endpoint de webhook.

**Rationale**: Es la misma convención que el portal público del sistema (Principio II de la constitución). Mercado Pago permite configurar la URL de webhook por credencial de cuenta, por lo que cada tenant puede tener su propia URL de webhook.

**Alternatives considered**:
- Extraer tenant_id del pedido identificado por `external_reference`: No aplica cuando el webhook es inválido o el pedido no se identifica — el log quedaría sin tenant.
- Tenant embebido en la URL como path param (`/webhooks/mercado-pago/:tenantKey`): Viable pero más complejo de configurar en el panel de MP. Descartado en favor de header estándar.

---

## Decisión 4: Método confirmarPagoOnline en PedidosService

**Decision**: Añadir `confirmarPagoOnline(pedidoId, tenantId): Promise<void>` a PedidosService.

**Rationale**: PedidosService es el único responsable de transicionar el estado del pedido. MercadoPagoWebhookService invocará este método; la lógica de validación del estado previo y la transición son responsabilidad del módulo de pedidos.

**Idempotencia**: Si el pedido ya está en `CONFIRMADO_PAGO_ONLINE` (webhook duplicado de MP), el método retorna sin error en lugar de lanzar excepción, para no corromper el log de webhook.

---

## Decisión 5: Validación de Firma HMAC

**Decision**: Usar `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` y comparar con el header `x-signature` de Mercado Pago.

**Rationale**: Mercado Pago firma los webhooks con HMAC-SHA256 usando el `MP_WEBHOOK_SECRET`. `crypto` es un módulo nativo de Node.js.

**Nota**: La validación es opcional (condicional a que `MP_WEBHOOK_SECRET` esté configurado) para facilitar el desarrollo local y testing sin credenciales reales.

---

## Decisión 6: Tipo de la columna payload

**Decision**: Columna `payload` de tipo `jsonb` en PostgreSQL.

**Rationale**: `jsonb` permite queries sobre el contenido del JSON si en el futuro se necesitan búsquedas por campos internos del payload. TypeORM soporta `jsonb` con `type: 'jsonb'`.

---

## Decisión 7: Sin FK hard a tabla pedidos

**Decision**: `pedido_id` es UUID nullable sin foreign key constraint a la tabla `pedidos`.

**Rationale**: Los webhooks pueden llegar con referencias externas no reconocidas (pedidos de otra integración, pruebas de MP, etc.). Una FK hard haría fallar el INSERT si el pedido no existe. La referencia es informativa para trazabilidad.
