# Feature Specification: Pedidos (Gestión de Pedidos de Viandas)

**Feature Branch**: `011-pedidos`

**Created**: 2026-06-07

**Status**: Draft

**Input**: Módulo transaccional central del sistema Rochester — gestión de pedidos de viandas desde portal público y back office, con ciclo de vida de estados, reglas de pago, y cancelaciones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear Pedido Presencial desde Portal (Priority: P1)

Un cliente visita el portal público, elige un menú publicado activo, ingresa su DNI y datos personales, selecciona un punto de retiro y confirma su pedido con pago presencial. El sistema registra el pedido inmediatamente sin necesidad de login, upsertea el cliente, y devuelve un código público (VIA-YYYY-NNNNNN) al cliente.

**Why this priority**: Es el flujo principal del MVP — sin este flujo no hay ningún valor de negocio entregable. El pago presencial es el único medio disponible en Stage 3.

**Independent Test**: Puede probarse de forma autónoma enviando un POST a `/public/pedidos` con datos válidos, verificando que se crea un pedido con estado `confirmado_pago_presencial`, `estado_pago = presencial_pendiente`, y que el cliente fue upsertado.

**Acceptance Scenarios**:

1. **Given** un menú publicado activo con punto de retiro habilitado, **When** un cliente envía sus datos y selecciona pago presencial, **Then** el sistema crea el pedido con código VIA-YYYY-NNNNNN, estado `confirmado_pago_presencial`, y retorna los datos del pedido creado.
2. **Given** un menú con `limite_maximo_viandas` definido y la capacidad ya alcanzada, **When** el cliente intenta crear un pedido, **Then** el sistema rechaza la solicitud con error de capacidad agotada.
3. **Given** un punto de retiro que no pertenece al menú publicado seleccionado, **When** el cliente intenta crear el pedido, **Then** el sistema rechaza la solicitud con error de punto de retiro inválido.
4. **Given** un menú publicado en estado distinto a ACTIVO, **When** el cliente intenta crear un pedido, **Then** el sistema rechaza la solicitud indicando que el menú no está disponible.
5. **Given** datos válidos, **When** el pedido se crea exitosamente, **Then** el precio_unitario en el pedido coincide con el precio del menú publicado al momento de la creación y no puede ser modificado posteriormente.

---

### User Story 2 - Consultar Pedidos por DNI desde Portal (Priority: P2)

Un cliente ingresa su DNI en el portal para consultar sus pedidos activos y recientes. El sistema devuelve la lista de pedidos asociados a ese DNI para el tenant, con su estado actual y código público.

**Why this priority**: Permite al cliente hacer seguimiento de sus encargos sin necesidad de login. Es funcionalidad complementaria esencial para el portal público.

**Independent Test**: Puede probarse con un GET a `/public/pedidos/consultar?dni=XXXXXXXX` verificando que devuelve los pedidos del cliente identificado por ese DNI para el tenant activo.

**Acceptance Scenarios**:

1. **Given** un cliente con pedidos previos, **When** consulta por su DNI en el portal, **Then** el sistema devuelve la lista de sus pedidos con estado y código público.
2. **Given** un DNI sin pedidos registrados, **When** el cliente consulta, **Then** el sistema retorna una lista vacía sin error.
3. **Given** pedidos de múltiples clientes, **When** un cliente consulta por su DNI, **Then** solo se devuelven sus propios pedidos (tenant-scoped).

---

### User Story 3 - Cancelar Pedido desde Portal (Priority: P3)

Un cliente puede cancelar su propio pedido desde el portal siempre que la fecha/hora límite de cancelación del menú publicado no haya pasado, y el pedido no esté ya entregado o cancelado.

**Why this priority**: Funcionalidad necesaria para el portal público. Tiene reglas de negocio propias distintas a la cancelación desde admin.

**Independent Test**: Puede probarse con un POST a `/public/pedidos/:id/cancelar` verificando que el pedido pasa a estado `cancelado`, `cancelado_por = cliente`, y que se rechaza correctamente si la ventana de cancelación expiró.

**Acceptance Scenarios**:

1. **Given** un pedido confirmado cuya `fecha_hora_limite_cancelacion` del menú publicado no ha pasado, **When** el cliente cancela desde el portal, **Then** el pedido pasa a estado `cancelado`, `cancelado_por = cliente`, se registra `fecha_cancelacion`.
2. **Given** un pedido cuya ventana de cancelación expiró, **When** el cliente intenta cancelar, **Then** el sistema rechaza la solicitud con error de plazo vencido.
3. **Given** un pedido ya entregado o ya cancelado, **When** el cliente intenta cancelar, **Then** el sistema rechaza la solicitud.
4. **Given** un pedido con pago online aprobado que se cancela, **When** el cliente cancela, **Then** el sistema registra nota de devolución manual pendiente.

---

### User Story 4 - Gestión de Pedidos desde Back Office (Priority: P4)

Administradores, supervisores y operadores de caja pueden listar, filtrar y ver el detalle de pedidos desde el back office. Administradores y supervisores pueden crear pedidos manuales (pago presencial). Administradores pueden editar pedidos confirmados. Todos los roles habilitados pueden cancelar pedidos desde admin.

**Why this priority**: Operaciones administrativas esenciales para la operación diaria del negocio. Requieren el núcleo de pedidos (US1) para ser útiles.

**Independent Test**: Puede probarse autenticando con rol `administrador` y usando los endpoints `/admin/pedidos` y `/admin/pedidos/manual`.

**Acceptance Scenarios**:

1. **Given** usuario autenticado con rol `administrador`, `supervisor`, o `operador_caja`, **When** accede a `GET /admin/pedidos`, **Then** obtiene lista paginada de pedidos con filtros aplicados.
2. **Given** usuario con rol `administrador` o `supervisor`, **When** crea un pedido manual con pago presencial, **Then** el pedido se crea, se audita el evento, y el cliente es upsertado.
3. **Given** usuario con rol `administrador`, **When** edita un pedido confirmado, **Then** los cambios se persisten y se audita el evento.
4. **Given** usuario habilitado, **When** cancela un pedido desde admin que no está entregado ni cancelado, **Then** el pedido pasa a `cancelado`, `cancelado_por = administracion`, y se audita el evento.
5. **Given** usuario con rol `operador_caja` intenta crear un pedido manual, **When** accede a `POST /admin/pedidos/manual`, **Then** el sistema responde con error de autorización.

---

### Edge Cases

- ¿Qué ocurre si dos clientes intentan crear el último lugar disponible en un menú con `limite_maximo_viandas` simultáneamente? → El sistema debe garantizar que no se supera el límite (control de concurrencia).
- ¿Qué ocurre con un pedido en estado `pendiente_pago_online` si los 15 minutos de reserva expiran? → El pedido se cancela automáticamente por un job y la disponibilidad se libera.
- ¿Qué ocurre si el menú publicado no tiene `fecha_hora_limite_cancelacion`? → La cancelación desde portal está permitida sin restricción de horario.
- ¿Qué ocurre si el pedido a cancelar desde portal tiene `estado_pedido = pendiente_pago_online` y ya expiró? → Se rechaza con error, el job de limpieza es el responsable de cancelarlo.
- ¿Qué ocurre con la secuencia del código VIA-YYYY-NNNNNN si se cancela un pedido? → El número se consume y no se reutiliza.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir crear pedidos desde el portal público sin autenticación, identificando al cliente por DNI.
- **FR-002**: El sistema DEBE validar que el menú publicado esté en estado ACTIVO antes de aceptar cualquier pedido.
- **FR-003**: El sistema DEBE validar que el punto de retiro seleccionado pertenezca a la lista de puntos habilitados del menú publicado.
- **FR-004**: El sistema DEBE validar que la cantidad solicitada más los pedidos confirmados y pendientes online del día no supere `limite_maximo_viandas` del menú publicado (si está definido).
- **FR-005**: El sistema DEBE copiar el `precio_unitario` del menú publicado al momento de crear el pedido; este valor NO puede modificarse posteriormente.
- **FR-006**: El sistema DEBE calcular y almacenar `importe_total` como `precio_unitario × cantidad`.
- **FR-007**: El sistema DEBE generar automáticamente un `codigo_publico` con formato `VIA-{AÑO}-{NNNNNN}` (secuencia de 6 dígitos con padding por año y tenant).
- **FR-008**: Para pago presencial, el sistema DEBE asignar `estado_pedido = confirmado_pago_presencial` y `estado_pago = presencial_pendiente`.
- **FR-009**: Para pago online (Mercado Pago), el sistema DEBE asignar `estado_pedido = pendiente_pago_online` y `estado_pago = pendiente`, con una reserva de disponibilidad de 15 minutos.
- **FR-010**: El sistema DEBE llamar a `ClientesService.upsertByDni()` al crear cualquier pedido (público o manual) con los datos informados.
- **FR-011**: El sistema DEBE permitir consultar pedidos por DNI desde el portal público sin autenticación.
- **FR-012**: El sistema DEBE permitir cancelar pedidos desde el portal público, validando que la `fecha_hora_limite_cancelacion` del menú publicado no haya pasado (si está definida).
- **FR-013**: El sistema NO DEBE permitir cancelar un pedido con estado `entregado` ni uno ya `cancelado`.
- **FR-014**: El sistema NO DEBE permitir cancelar desde portal un pedido con `estado_pedido = pendiente_pago_online` si ya expiró la reserva.
- **FR-015**: El sistema DEBE registrar en el pedido cancelado: `fecha_cancelacion`, `cancelado_por`, `motivo_cancelacion` (opcional), y si fue desde admin: `usuario_cancelacion_id`.
- **FR-016**: Al cancelar desde portal un pedido con pago online aprobado, el sistema DEBE marcar la necesidad de devolución manual.
- **FR-017**: El sistema DEBE permitir a administradores y supervisores crear pedidos manuales (solo pago presencial) desde el back office, con auditoría.
- **FR-018**: El sistema DEBE permitir a administradores editar pedidos confirmados desde el back office, con auditoría.
- **FR-019**: El sistema DEBE permitir cancelar pedidos desde back office sin restricción de horario (mientras no esté entregado o cancelado), con auditoría.
- **FR-020**: El sistema DEBE exponer una lista paginada de pedidos en el back office con filtros por fecha_retiro, sede_id, punto_retiro_id, estado_pedido, estado_pago, menu_publicado_id y dni.
- **FR-021**: Los pedidos con reserva online expirada DEBEN ser cancelados automáticamente (por job), liberando la disponibilidad reservada.

### Key Entities *(include if feature involves data)*

- **Pedido**: Encargo de un cliente para un menú publicado específico. Atributos clave: código público, datos del cliente informados al momento del pedido (DNI, nombre, apellido, teléfono, email), fecha del pedido, fecha de retiro, cantidad, precio unitario copiado, importe total, medio de pago, estado del pedido, estado del pago, timestamps de confirmación/cancelación, datos de cancelación.
- **EstadoPedido**: Máquina de estados con 6 valores — `pendiente_pago_online`, `confirmado_pago_online`, `confirmado_pago_presencial`, `entregado`, `no_retirado`, `cancelado`.
- **EstadoPagoPedido**: Estado del cobro — `pendiente`, `aprobado`, `rechazado`, `cancelado`, `presencial_pendiente`, `presencial_cobrado`.
- **MedioPagoPedido**: `mercado_pago` o `presencial`.
- **OrigenCancelacion**: Quién originó la cancelación — `cliente` o `administracion`.
- **Cliente** (existente): Se upsertea por DNI en cada pedido.
- **MenuPublicado** (existente): Fuente de precio, disponibilidad, puntos de retiro, y reglas de cancelación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cliente puede completar la creación de un pedido presencial desde el portal en menos de 2 minutos, desde el ingreso de datos hasta recibir el código de confirmación.
- **SC-002**: El sistema rechaza el 100% de los intentos de pedido sobre menús inactivos, puntos de retiro no habilitados, o cuando se supera el límite de capacidad.
- **SC-003**: El precio capturado en cada pedido es invariable — ningún flujo posterior puede modificarlo.
- **SC-004**: El código público `VIA-YYYY-NNNNNN` es único por año y tenant; ningún pedido comparte código con otro del mismo tenant y año.
- **SC-005**: La cancelación desde portal respeta la ventana de cancelación del menú — 0% de cancelaciones exitosas fuera de la ventana permitida.
- **SC-006**: Todos los pedidos manuales creados desde back office y todas las cancelaciones desde admin generan un registro de auditoría verificable.
- **SC-007**: Las reservas de disponibilidad para pagos online expiran automáticamente dentro de los 15 minutos acordados, liberando la capacidad correctamente.

## Assumptions

- La integración de pago online con Mercado Pago se completa en Stage 4; en Stage 3 el módulo de pedidos soporta la estructura de datos de pago online pero el flujo de confirmación automática no está implementado.
- El job de limpieza de reservas expiradas es parte de este módulo (o puede implementarse como cron dentro del mismo módulo) — Stage 3 offline.
- El campo `expires_at` en el pedido es el mecanismo de reserva; el job consulta pedidos en `pendiente_pago_online` con `expires_at` pasado.
- Las consultas por DNI desde el portal muestran los pedidos del cliente para el tenant activo (resuelto por `x-tenant-key`), sin restricción de fecha en MVP.
- La edición de pedidos confirmados desde admin está limitada a campos no críticos para la integridad financiera (ej: notas, corrección de datos de contacto) — el precio nunca se modifica.
- `SedesModule` y `PuntosRetiroModule` ya están implementados en Stage 1 y sus entidades están disponibles para las FK del pedido.
- `ClientesModule` y `MenusPublicadosModule` ya están implementados y exportan sus servicios.
- La secuencia del `codigo_publico` es por año y tenant (no global); se genera con una consulta de MAX + 1 sobre pedidos existentes del mismo tenant y año, con manejo de concurrencia.
