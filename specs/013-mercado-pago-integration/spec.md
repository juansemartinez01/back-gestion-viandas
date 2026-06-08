# Feature Specification: Integración Mercado Pago

**Feature Branch**: `013-mercado-pago-integration`

**Created**: 2026-06-07

**Status**: Draft

**Input**: Módulo de integración con Mercado Pago para el sistema de Gestión de Viandas Rochester.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generación de preferencia de pago online (Priority: P1)

Cuando un cliente elige pagar un pedido de forma online, el sistema debe crear una sesión de pago en Mercado Pago y entregar al cliente una URL donde completar el pago. El sistema resuelve esto internamente al confirmar el pedido con método de pago online, sin que el cliente deba interactuar directamente con esta integración.

**Why this priority**: Es el punto de entrada al flujo de pago online. Sin esta capacidad, los pedidos online no pueden procesarse y el módulo no tiene utilidad.

**Independent Test**: Puede verificarse creando un pedido online y comprobando que se recibe una URL de checkout válida de Mercado Pago, con la cual un cliente puede acceder a la pantalla de pago.

**Acceptance Scenarios**:

1. **Given** un pedido pendiente de pago online con importe y descripción válidos, **When** el sistema solicita generar la preferencia de pago, **Then** se obtiene una URL de checkout (`init_point`) y un identificador de preferencia (`preference_id`) de Mercado Pago.
2. **Given** una preferencia generada exitosamente, **When** el cliente accede a la URL de checkout, **Then** Mercado Pago muestra la pantalla de pago con el importe correcto y URLs de retorno configuradas (éxito, fallo, pendiente).
3. **Given** que la configuración de Mercado Pago es inválida o el servicio externo no responde, **When** el sistema intenta generar la preferencia, **Then** el error se propaga al llamador (PedidosService) para que gestione el fallo del pedido apropiadamente.

---

### User Story 2 - Recepción y procesamiento de webhook de pago (Priority: P1)

Cuando Mercado Pago notifica al sistema que un pago fue aprobado o rechazado, el sistema debe identificar el pedido correspondiente, actualizar automáticamente el estado del pago y del pedido, y registrar el evento para trazabilidad. El sistema debe responder siempre con confirmación a Mercado Pago para evitar reintentos innecesarios.

**Why this priority**: Es el mecanismo central por el cual el sistema se entera de que un pago fue completado. Sin esto, los pedidos online quedan permanentemente en estado pendiente.

**Independent Test**: Puede verificarse enviando manualmente una notificación de pago aprobado al endpoint de webhook y comprobando que el pedido correspondiente actualiza su estado a "confirmado con pago online" y se genera un log del evento.

**Acceptance Scenarios**:

1. **Given** una notificación de pago aprobado de Mercado Pago para un pedido existente, **When** el sistema recibe el webhook con firma válida (o sin validación de firma si no está configurada), **Then** el estado del pago se actualiza a "aprobado", el estado del pedido cambia a "confirmado con pago online", y se registra el evento con resultado "procesado_ok".
2. **Given** una notificación de pago rechazado para un pedido existente, **When** el sistema recibe el webhook, **Then** el estado del pago se actualiza a "rechazado", el pedido permanece en estado "pendiente pago online", y se registra el evento con resultado "procesado_ok".
3. **Given** un webhook con firma HMAC inválida cuando `MP_WEBHOOK_SECRET` está configurado, **When** el sistema recibe la notificación, **Then** el evento se registra con resultado "procesado_error" y se responde con HTTP 200 a Mercado Pago (sin procesar el pago).
4. **Given** un error interno durante el procesamiento del webhook (pedido no encontrado, fallo de base de datos), **When** ocurre la excepción, **Then** el error se captura internamente, se registra en el log del webhook con resultado "procesado_error" y mensaje de error, y Mercado Pago recibe HTTP 200.
5. **Given** un webhook de tipo desconocido (distinto de `payment`), **When** el sistema lo recibe, **Then** se registra con estado "pendiente_revision" y se responde HTTP 200.

---

### User Story 3 - Consulta de logs de webhooks por administrador (Priority: P2)

El administrador del sistema necesita poder consultar el historial de notificaciones recibidas de Mercado Pago para diagnosticar problemas de pago, auditar transacciones y verificar que los eventos se procesaron correctamente.

**Why this priority**: Herramienta de soporte operativo crítica para resolver incidencias de pago, pero no bloquea el flujo principal de cobro.

**Independent Test**: Puede verificarse autenticado como administrador, llamando al listado de logs y verificando que retorna los registros con paginación y que el filtro por resultado funciona correctamente.

**Acceptance Scenarios**:

1. **Given** el administrador autenticado con rol `administrador`, **When** solicita el listado de logs de webhooks, **Then** recibe una lista paginada con todos los logs del tenant, mostrando tipo de evento, referencia externa, resultado y fecha de recepción.
2. **Given** el listado de logs con múltiples entradas, **When** el administrador filtra por `pedido_id` o por `resultado`, **Then** solo se muestran los registros que coinciden con los filtros aplicados.
3. **Given** un log específico, **When** el administrador solicita su detalle por ID, **Then** recibe el registro completo incluyendo el payload original recibido de Mercado Pago y el mensaje de error si aplica.
4. **Given** un usuario sin rol `administrador`, **When** intenta acceder a los endpoints de logs, **Then** recibe un error de acceso denegado.

---

### Edge Cases

- ¿Qué ocurre si Mercado Pago envía el mismo evento de pago dos veces (reintento)? El sistema debe idempotentemente procesar o ignorar el duplicado sin generar inconsistencias de estado.
- ¿Qué ocurre si el `pedido_id` en la referencia externa no corresponde a ningún pedido del tenant? El webhook se registra con `pedido_id` nulo y resultado "procesado_error".
- ¿Qué ocurre si el servicio de Mercado Pago no está disponible al generar la preferencia? El error se propaga al módulo de pedidos para que el pedido no quede en estado incorrecto.
- ¿Qué ocurre si el webhook llega sin firma cuando `MP_WEBHOOK_SECRET` está configurado? Se trata como firma inválida y se registra como "procesado_error".
- ¿Qué ocurre si el pago es rechazado y el pedido ya expiró (más de 15 minutos)? El sistema actualiza el estado del pago a "rechazado"; la reserva de disponibilidad ya debería estar liberada por el job de expiración.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE generar una preferencia de pago en Mercado Pago al ser invocado por el módulo de pedidos, retornando la URL de checkout y el identificador de preferencia.
- **FR-002**: La preferencia de pago DEBE incluir las URLs de retorno para los estados de éxito, fallo y pendiente, obtenidas desde la configuración del sistema.
- **FR-003**: El sistema DEBE exponer un endpoint público (sin autenticación) para recibir notificaciones webhook de Mercado Pago.
- **FR-004**: El sistema DEBE validar la firma HMAC del webhook cuando `MP_WEBHOOK_SECRET` está configurado, antes de procesar el evento.
- **FR-005**: El sistema DEBE registrar cada webhook recibido en el log de eventos, incluyendo el payload completo, el tipo de evento, la referencia externa y la fecha de recepción.
- **FR-006**: El sistema DEBE responder siempre HTTP 200 a Mercado Pago, independientemente del resultado del procesamiento interno.
- **FR-007**: Para webhooks de tipo `payment` con pago aprobado, el sistema DEBE actualizar el estado del pago a "aprobado" y el estado del pedido a "confirmado con pago online".
- **FR-008**: Para webhooks de tipo `payment` con pago rechazado, el sistema DEBE actualizar el estado del pago a "rechazado".
- **FR-009**: Toda excepción durante el procesamiento del webhook DEBE ser capturada internamente, registrada en el log del evento y no propagada al respondedor HTTP.
- **FR-010**: El sistema DEBE actualizar el registro de log con el resultado final del procesamiento (`procesado_ok`, `procesado_error`, o `pendiente_revision`).
- **FR-011**: El sistema DEBE exponer endpoints de administración para listar y consultar logs de webhooks, accesibles únicamente para usuarios con rol `administrador`.
- **FR-012**: El listado de logs DEBE soportar paginación y filtrado por `pedido_id` y por `resultado_procesamiento`.
- **FR-013**: Todos los registros de log DEBE pertenecer al tenant del sistema que los recibe; los logs son datos multi-tenant.

### Key Entities *(include if feature involves data)*

- **MercadoPagoWebhookLog**: Registro persistente de cada notificación recibida de Mercado Pago. Almacena el payload completo, el tipo de evento, la referencia externa (ID de pago de MP), el pedido asociado (si pudo identificarse), el resultado del procesamiento y cualquier mensaje de error. Es de solo lectura para el administrador; solo el sistema lo escribe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los webhooks recibidos de Mercado Pago quedan registrados en el log, incluso cuando el procesamiento interno falla.
- **SC-002**: El sistema responde HTTP 200 a Mercado Pago en el 100% de los casos, eliminando reintentos por timeout o errores HTTP.
- **SC-003**: Los pedidos con pago aprobado actualizan su estado a "confirmado con pago online" en menos de 5 segundos desde la recepción del webhook.
- **SC-004**: Los administradores pueden consultar cualquier log de webhook en menos de 2 segundos, incluso con miles de registros acumulados.
- **SC-005**: El 0% de webhooks con firma inválida resultan en mutaciones de estado de pedidos o pagos.
- **SC-006**: La generación de preferencia de pago completa en menos de 3 segundos en condiciones normales de conectividad.

## Assumptions

- El módulo de pedidos (`PedidosModule`) expone un método para actualizar el estado del pedido a "confirmado con pago online" o mantenerlo en "pendiente pago online" según el resultado del pago.
- El módulo de pagos (`PagosModule`) expone un método para actualizar el estado del pago a "aprobado" o "rechazado" dado un pedido.
- La referencia externa que Mercado Pago incluye en el webhook (`external_reference`) fue configurada al crear la preferencia como el UUID del pedido, permitiendo la identificación.
- El módulo opera bajo el mismo modelo multi-tenant que el resto del sistema; el tenant se resuelve desde el contexto de la solicitud o desde el pedido relacionado.
- Mercado Pago envía notificaciones de tipo `payment` como evento principal para confirmaciones de pago; otros tipos de evento (`merchant_order`, etc.) se registran pero no disparan lógica de negocio en el MVP.
- La validación de firma HMAC es opcional: si `MP_WEBHOOK_SECRET` no está configurado, el webhook se procesa sin validación de firma (útil para entornos de desarrollo/testing).
- El manejo de idempotencia para webhooks duplicados se delega al estado actual del pedido: si ya está confirmado, el segundo webhook queda registrado sin producir un segundo cambio de estado.
- Los logs de webhook no tienen expiración automática en el MVP; la retención sigue las políticas estándar de la plataforma.
