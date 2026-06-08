# Feature Specification: Entregas de Viandas

**Feature Branch**: `017-entregas`

**Created**: 2026-06-08

**Status**: Draft

**Input**: Módulo operativo transaccional para el registro de entregas de viandas encargadas por clientes en el sistema Gestión de Viandas Rochester.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Registrar entrega con pago presencial (Priority: P1)

El operador de caja busca un pedido por DNI del cliente, verifica el detalle de la vianda encargada y registra la entrega cobrando el importe en efectivo o por otros medios presenciales al mismo tiempo.

**Why this priority**: Es el flujo principal del módulo. Sin esta capacidad, el sistema no puede registrar que una vianda fue retirada ni cobrar al cliente en el punto de retiro.

**Independent Test**: Se puede probar completamente creando un pedido confirmado con pago presencial pendiente, ejecutando la entrega y verificando que el pedido queda marcado como entregado, el cobro queda registrado y el stock reservado se descuenta.

**Acceptance Scenarios**:

1. **Given** un pedido en estado `confirmado_pago_presencial` para el cliente con DNI 12345678 en la sede y punto de retiro del día, **When** el operador registra la entrega, **Then** el pedido pasa a estado `entregado`, se registra el cobro por el importe total del pedido, se descuenta el stock reservado para encargues y se crea el registro de entrega con fecha, sede, punto de retiro y operador.
2. **Given** un pedido en estado `confirmado_pago_presencial`, **When** el operador intenta registrar la entrega dos veces, **Then** el segundo intento es rechazado con un error claro indicando que el pedido ya fue entregado.
3. **Given** un pedido en estado `cancelado`, **When** el operador intenta registrar la entrega, **Then** el sistema rechaza la operación con un error indicando que el pedido está cancelado.

---

### User Story 2 — Registrar entrega con pago online aprobado (Priority: P1)

El operador de caja busca un pedido por DNI, confirma que el pago online ya fue aprobado y registra la entrega sin necesidad de cobrar ningún importe adicional.

**Why this priority**: Igual de crítico que el caso presencial. Los pedidos con pago online representan una porción importante de los encargues y deben poder entregarse sin fricción.

**Independent Test**: Se puede probar con un pedido confirmado en estado `confirmado_pago_online`, ejecutando la entrega y verificando que se registra con importe cobrado en caja igual a $0.

**Acceptance Scenarios**:

1. **Given** un pedido en estado `confirmado_pago_online`, **When** el operador registra la entrega, **Then** el pedido pasa a estado `entregado`, el importe cobrado en caja queda en $0, se descuenta el stock reservado para encargues y se crea el registro de entrega.
2. **Given** un pedido con pago online aún pendiente de confirmación (no aprobado), **When** el operador intenta registrar la entrega, **Then** el sistema rechaza la operación indicando que el pago online no fue confirmado.

---

### User Story 3 — Buscar pedidos por DNI para la pantalla de caja (Priority: P1)

El operador de caja ingresa el DNI del cliente en la pantalla de caja y el sistema le muestra los pedidos disponibles para entrega ese día en esa sede y punto de retiro.

**Why this priority**: Sin esta búsqueda, el operador no puede identificar rápidamente qué pedido le corresponde al cliente que se presenta a retirar. Es el punto de entrada al flujo de entrega.

**Independent Test**: Se puede probar consultando por un DNI con pedidos confirmados para el día y verificando que la respuesta incluye solo los pedidos elegibles (confirmado_pago_online o confirmado_pago_presencial) para la sede y punto de retiro indicados.

**Acceptance Scenarios**:

1. **Given** un cliente con DNI 12345678 que tiene un pedido confirmado para hoy en la sede y punto de retiro indicados, **When** el operador consulta por ese DNI, **Then** el sistema devuelve el pedido con su detalle (menú, cantidad, estado de pago, importe total).
2. **Given** un cliente con DNI 12345678 cuyo único pedido del día ya fue entregado, **When** el operador consulta por ese DNI, **Then** el sistema devuelve una lista vacía (sin pedidos disponibles para entrega).
3. **Given** un cliente con DNI inexistente en el sistema, **When** el operador consulta por ese DNI, **Then** el sistema devuelve una lista vacía sin error.
4. **Given** un cliente con un pedido cancelado para ese día, **When** el operador consulta por ese DNI, **Then** el pedido cancelado no aparece en los resultados.

---

### User Story 4 — Consultar historial de entregas (Priority: P2)

El administrador o supervisor consulta el historial de entregas del día (o de un rango de fechas) filtrando por sede, punto de retiro u operador que realizó la entrega.

**Why this priority**: Necesario para supervisión operativa, cuadre de caja y auditoría, pero no bloquea la operación diaria.

**Independent Test**: Se puede probar listando entregas registradas y verificando que los filtros de fecha, sede, punto de retiro y operador funcionan correctamente.

**Acceptance Scenarios**:

1. **Given** varias entregas registradas en diferentes sedes y fechas, **When** el supervisor filtra por sede y fecha, **Then** el sistema devuelve solo las entregas que coinciden con ambos filtros, paginadas.
2. **Given** entregas registradas por diferentes operadores, **When** el supervisor filtra por usuario_id, **Then** el sistema devuelve solo las entregas realizadas por ese operador.

---

### User Story 5 — Ver detalle de una entrega (Priority: P3)

El administrador o supervisor consulta el detalle completo de una entrega específica: pedido asociado, importe cobrado, operador, sede, punto de retiro y observación.

**Why this priority**: Útil para auditoría y resolución de disputas, pero no es un flujo operativo crítico.

**Independent Test**: Se puede probar recuperando el detalle de una entrega registrada y verificando que todos sus campos están correctos.

**Acceptance Scenarios**:

1. **Given** una entrega registrada, **When** el administrador consulta su detalle por ID, **Then** el sistema devuelve todos los campos de la entrega incluyendo datos del pedido asociado.
2. **Given** un ID de entrega inexistente, **When** se consulta su detalle, **Then** el sistema responde con un error de recurso no encontrado.

---

### Edge Cases

- ¿Qué ocurre si el stock reservado para encargues ya fue consumido por otro proceso concurrente al momento de la entrega? → La entrega debe fallar con un error de stock insuficiente; no debe entregarse sin descontar stock.
- ¿Qué ocurre si el pedido incluye más de una unidad de vianda? → Se entrega completo en una sola operación; no se admiten entregas parciales.
- ¿Qué ocurre si se intenta registrar una entrega para un pedido de otra sede o tenant? → La operación se rechaza con error de acceso no autorizado.
- ¿Qué ocurre si la búsqueda por DNI no especifica sede o punto de retiro? → Se requieren ambos parámetros para contextualizar la búsqueda a la pantalla de caja actual; sin ellos se retorna error de parámetros faltantes.
- ¿Qué ocurre si el pago presencial falla al registrarse dentro de la transacción? → Toda la transacción revierte, incluyendo el descuento de stock y la creación de la entrega.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir registrar la entrega de un pedido confirmado, validando estado, stock e idempotencia antes de persistir.
- **FR-002**: El sistema DEBE aceptar como elegibles para entrega únicamente pedidos en estado `confirmado_pago_online` o `confirmado_pago_presencial`.
- **FR-003**: El sistema DEBE rechazar la entrega de pedidos en estado `cancelado`, `pendiente_pago_online`, `entregado` o cualquier otro estado no confirmado.
- **FR-004**: El sistema DEBE garantizar idempotencia: si ya existe una entrega para un pedido, el intento de registrar una segunda entrega para el mismo pedido debe ser rechazado con error.
- **FR-005**: El sistema DEBE descontar una unidad (o la cantidad del pedido) del stock reservado para encargues al completar la entrega, utilizando control de concurrencia para evitar sobreentregas.
- **FR-006**: Cuando el pedido tiene pago presencial pendiente, el sistema DEBE registrar el cobro por el importe total del pedido como parte de la misma operación atómica de entrega.
- **FR-007**: Cuando el pedido tiene pago online aprobado, el sistema DEBE registrar la entrega con importe cobrado en caja igual a $0.
- **FR-008**: El sistema DEBE actualizar el estado del pedido a `entregado` y registrar la fecha de confirmación dentro de la misma transacción de entrega.
- **FR-009**: El sistema DEBE crear un registro de auditoría (`entrega.registrada`) por cada entrega completada exitosamente, dentro de la misma transacción.
- **FR-010**: El sistema DEBE permitir buscar pedidos disponibles para entrega por DNI del cliente, filtrando por fecha, sede y punto de retiro, devolviendo solo pedidos elegibles (confirmados, no entregados).
- **FR-011**: El sistema DEBE permitir listar entregas con filtros por fecha, sede, punto de retiro y operador, con paginación.
- **FR-012**: El sistema DEBE permitir consultar el detalle de una entrega por su identificador único.
- **FR-013**: El sistema DEBE aislar todas las operaciones al tenant activo; ninguna operación puede afectar o exponer datos de otros tenants.
- **FR-014**: El sistema DEBE aplicar control de roles: solo `administrador` y `operador_caja` pueden registrar entregas; `supervisor` puede consultar pero no registrar.

### Key Entities

- **EntregaPedido**: Registro inmutable de que un pedido fue retirado. Vincula el pedido con la sede, el punto de retiro, el operador, el importe efectivamente cobrado en caja y la fecha/hora de la entrega. Existe exactamente una por pedido entregado.
- **Pedido**: Encargue previo del cliente. La entrega cambia su estado a `entregado`. Es la entidad central que la entrega referencia.
- **StockVianda**: Control del inventario del día para un menú/sede/punto. La entrega consume una unidad del contador de stock reservado para encargues.
- **Pago**: Registro del cobro. En entregas presenciales, se crea un pago con método presencial dentro de la misma transacción.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El operador de caja puede completar el registro de una entrega (desde la búsqueda por DNI hasta la confirmación) en menos de 60 segundos.
- **SC-002**: El 100% de los intentos de entrega de un pedido ya entregado son rechazados sin modificar ningún dato del sistema.
- **SC-003**: El 100% de las entregas con pago presencial tienen un cobro asociado por el importe exacto del pedido; no existe ninguna entrega presencial con importe $0 salvo las excepciones documentadas.
- **SC-004**: En ningún caso el sistema registra una entrega sin descontar el stock reservado correspondiente; los contadores de stock y entregas son consistentes al final de cada jornada.
- **SC-005**: La búsqueda por DNI devuelve resultados en menos de 2 segundos para cualquier combinación válida de parámetros bajo carga operacional normal.
- **SC-006**: El 100% de las entregas completadas generan un registro de auditoría asociado; no existe entrega sin traza de auditoría.

## Assumptions

- El módulo opera exclusivamente a través del back office; no hay endpoints públicos sin autenticación para este módulo.
- Un pedido siempre tiene exactamente un menú asociado (o varias unidades del mismo menú); la entrega se procesa como una unidad atómica completa, sin entregas parciales.
- El stock reservado para encargues ya fue asignado en el momento del pedido (módulo pedidos); la entrega solo lo consume, no lo reserva.
- La búsqueda por DNI requiere los cuatro parámetros (dni, fecha, sede_id, punto_retiro_id) para ser funcional en el contexto de la pantalla de caja; no se contempla búsqueda global por DNI sin contexto de sede/punto.
- El campo `observacion` en la entrega es opcional y de uso interno del operador; no afecta ninguna lógica de negocio.
- El operador que registra la entrega se obtiene del token de autenticación (usuario autenticado); no es un campo que el cliente de la API envíe.
- El módulo `cierres-operativos` (Stage 6) consumirá `EntregasService` para calcular totales del cierre del día; esta es la única dependencia externa hacia afuera del módulo.
- Los pedidos con estado `no_retirado` (asignado por cierre operativo) no son elegibles para entrega; el módulo de entregas no gestiona ese estado, pero lo respeta como estado no entregable.
