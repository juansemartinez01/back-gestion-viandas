# Feature Specification: Stock Operativo de Viandas

**Feature Branch**: `016-stock-viandas`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "Módulo stock-viandas — gestión del stock operativo de viandas producidas para el día, con control de concurrencia, ajustes manuales auditados y trazabilidad de movimientos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generación de Stock al Confirmar Producción (Priority: P1)

Cuando el responsable de producción confirma una orden de producción de viandas, el sistema registra automáticamente el stock disponible para ese día, sede, punto de retiro y menú. El stock se divide en dos partes: las unidades reservadas para los pedidos confirmados (encargues) y las unidades sobrantes disponibles para venta presencial. El operador no necesita hacer ninguna acción extra — el stock nace automáticamente al confirmar producción.

**Why this priority**: Sin este paso no existe stock, y sin stock no se pueden procesar entregas ni ventas de sobrantes. Es el origen de todo el flujo operativo posterior.

**Independent Test**: Confirmar una producción con N unidades reales y M pedidos confirmados; verificar que existe un registro de stock con `stock_reservado_encargues = M` y `stock_disponible_sobrantes = max(0, N - M)`, y que se registró un movimiento `alta_produccion`.

**Acceptance Scenarios**:

1. **Given** una orden de producción confirmada con 50 unidades reales y 30 pedidos confirmados, **When** el sistema genera el stock, **Then** el stock muestra 30 unidades reservadas para encargues y 20 unidades disponibles para sobrantes, y existe un movimiento de tipo `alta_produccion` registrado.
2. **Given** una orden de producción donde los pedidos confirmados superan las unidades reales (ej. 50 pedidos, 40 unidades), **When** el sistema genera el stock, **Then** `stock_reservado_encargues = 40`, `stock_disponible_sobrantes = 0`, y no hay valores negativos.
3. **Given** una re-confirmación de producción para la misma fecha/sede/punto/menú ya existente, **When** el sistema genera el stock, **Then** el registro existente se actualiza con los nuevos valores en lugar de crear uno duplicado.

---

### User Story 2 - Consumo de Stock para Entrega de Encargues (Priority: P1)

Cuando el operador de caja registra la entrega de un pedido confirmado, el sistema descuenta automáticamente la unidad del stock de encargues. Si en ese momento otro operador intenta entregar otro pedido simultáneamente, el sistema garantiza que ambas operaciones se procesan de forma ordenada sin duplicar descuentos ni permitir entregas de stock inexistente.

**Why this priority**: Controla la integridad del inventario durante las horas pico de retiro, cuando múltiples operadores pueden actuar simultáneamente sobre el mismo stock.

**Independent Test**: Simular dos entregas simultáneas sobre un stock con 1 unidad disponible; verificar que solo una entrega se aprueba y la otra recibe error de stock insuficiente.

**Acceptance Scenarios**:

1. **Given** un stock con 5 unidades reservadas para encargues y 0 entregadas, **When** se registra la entrega del pedido P-001, **Then** `stock_entregado` aumenta en 1, `stock_restante` disminuye en 1, y se registra un movimiento `consumo_entrega` asociado al pedido.
2. **Given** un stock con 1 unidad reservada y ya entregada, **When** se intenta registrar otra entrega, **Then** el sistema rechaza la operación con un error claro de stock insuficiente, sin modificar ningún contador.
3. **Given** dos solicitudes de entrega simultáneas sobre el mismo stock con 1 unidad disponible, **When** ambas se procesan concurrentemente, **Then** exactamente una entrega se aprueba y la otra recibe error de stock insuficiente.

---

### User Story 3 - Consumo de Stock para Venta de Sobrantes (Priority: P2)

Cuando el operador de caja vende una vianda sobrante de forma presencial, el sistema descuenta la unidad del stock de sobrantes disponible. La operación respeta el mismo control de concurrencia para evitar vender más unidades de las producidas.

**Why this priority**: Depende del stock de sobrantes generado en P1; es parte del flujo operativo de monetización de excedentes.

**Independent Test**: Registrar una venta de sobrante y verificar que `stock_vendido_sobrante` aumenta y `stock_restante` disminuye, con movimiento `consumo_sobrante` registrado.

**Acceptance Scenarios**:

1. **Given** un stock con 10 unidades disponibles para sobrantes y 0 vendidas, **When** se registra la venta sobrante V-001, **Then** `stock_vendido_sobrante` aumenta en 1, se registra un movimiento `consumo_sobrante` vinculado a la venta.
2. **Given** un stock con 0 unidades sobrantes disponibles, **When** se intenta registrar una venta sobrante, **Then** el sistema rechaza la operación con error de stock insuficiente.

---

### User Story 4 - Reasignación de Stock por Cancelación Post-Producción (Priority: P2)

Cuando un cliente cancela un pedido confirmado después de que la producción ya fue confirmada, el sistema mueve automáticamente esa unidad del pool de encargues al pool de sobrantes disponibles para venta presencial. De esta forma, la vianda ya producida no se desperdicia y puede comercializarse en el día.

**Why this priority**: Garantiza el invariante de negocio (constitución, regla 8): cancelaciones post-producción aumentan el stock sobrante en lugar de descartar la unidad.

**Independent Test**: Cancelar un pedido después de confirmar producción y verificar que `stock_disponible_sobrantes` aumenta en 1 y se registra un movimiento `reasignacion_cancelacion`.

**Acceptance Scenarios**:

1. **Given** una producción confirmada y un pedido cancelado post-producción, **When** el sistema procesa la cancelación, **Then** `stock_disponible_sobrantes` del stock del día correspondiente aumenta en 1, y se registra un movimiento `reasignacion_cancelacion` vinculado al pedido cancelado.
2. **Given** un pedido cancelado para una fecha sin producción confirmada, **When** el sistema procesa la cancelación, **Then** no se modifica ningún stock de viandas (la cancelación se resuelve por el módulo de cancelaciones sin afectar stock).

---

### User Story 5 - Ajuste Manual de Stock con Trazabilidad (Priority: P2)

El supervisor o administrador puede ajustar manualmente el stock de un día en casos excepcionales (error de conteo, roturas, devoluciones). Cada ajuste queda registrado con el usuario que lo hizo, la razón y la cantidad, formando una pista de auditoría completa.

**Why this priority**: Cubre la gestión de excepciones operativas y cumple el requisito de auditoría de la constitución (principio V).

**Independent Test**: Realizar un ajuste positivo de 5 unidades con observación; verificar que `stock_ajustado` acumula +5, `stock_restante` aumenta en 5, y existe un movimiento `ajuste_positivo` con usuario_id y observación.

**Acceptance Scenarios**:

1. **Given** un stock existente, **When** un supervisor aplica un ajuste positivo de 5 unidades con la observación "reconteo físico", **Then** `stock_ajustado` acumula +5, `stock_restante` aumenta en 5, y se registra un movimiento `ajuste_positivo` con el id del supervisor y la observación.
2. **Given** un stock existente, **When** un administrador aplica un ajuste negativo de 2 unidades, **Then** `stock_ajustado` acumula -2, `stock_restante` disminuye en 2, y se registra un movimiento `ajuste_negativo`.
3. **Given** un usuario con rol `operador_caja`, **When** intenta realizar un ajuste de stock, **Then** el sistema deniega la operación con error de autorización.

---

### User Story 6 - Consulta de Stock e Historial desde Back Office (Priority: P3)

El personal administrativo puede consultar el estado actual del stock de cualquier día, filtrado por fecha, sede, punto de retiro o menú. También puede revisar el historial completo de movimientos de un stock para auditar qué ocurrió durante el día.

**Why this priority**: Es lectura; no bloquea operaciones pero es necesaria para supervisión y auditoría.

**Independent Test**: Consultar el listado de stocks filtrando por fecha; verificar que retorna los registros correctos con todos los contadores.

**Acceptance Scenarios**:

1. **Given** stocks registrados para múltiples fechas y sedes, **When** un supervisor consulta el listado filtrando por una fecha específica, **Then** recibe solo los stocks de esa fecha con todos los contadores actualizados.
2. **Given** un stock con 10 movimientos registrados, **When** un administrador consulta el historial de movimientos de ese stock, **Then** recibe los 10 movimientos ordenados cronológicamente con tipo, cantidad, y referencias asociadas (pedido, venta, usuario).

---

### Edge Cases

- ¿Qué pasa si se intenta ajustar un stock de una fecha pasada cerrada? El sistema permite el ajuste pero queda auditado con fecha de operación real.
- ¿Qué pasa si la producción se confirma dos veces para la misma combinación fecha/sede/punto/menú? El stock existente se actualiza (upsert), no se duplica.
- ¿Qué pasa si `stock_restante` quedaría negativo por un ajuste manual negativo? El ajuste se permite (ajuste manual es una corrección excepcional), pero el valor negativo queda reflejado y visible en back office.
- ¿Qué pasa si el pedido asociado a una entrega ya fue entregado antes? El servicio de entregas valida idempotencia antes de llamar a consumirParaEntrega; si llega igual, el sistema rechaza indicando stock ya consumido para ese pedido.
- ¿Qué pasa si se solicita el historial de un stock inexistente? El sistema retorna 404 con error estructurado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE generar automáticamente un registro de stock cuando se confirma una orden de producción, sin intervención manual del operador.
- **FR-002**: El sistema DEBE separar el stock en dos contadores independientes: unidades reservadas para encargues confirmados y unidades disponibles para venta presencial de sobrantes.
- **FR-003**: El cálculo `stock_disponible_sobrantes` DEBE ser `max(0, unidades_reales - pedidos_confirmados)` — nunca un valor negativo.
- **FR-004**: El sistema DEBE garantizar que dos operaciones simultáneas de consumo no puedan resultar en la entrega o venta de más unidades de las disponibles (control de concurrencia obligatorio).
- **FR-005**: Toda operación de consumo DEBE verificar disponibilidad antes de descontar; si no hay stock suficiente, DEBE rechazar con error explícito.
- **FR-006**: El sistema DEBE registrar un movimiento de stock por cada operación que modifique los contadores: alta por producción, consumo por entrega, consumo por sobrante, ajuste positivo, ajuste negativo, reasignación por cancelación.
- **FR-007**: Cuando se cancela un pedido después de confirmada la producción, el sistema DEBE incrementar `stock_disponible_sobrantes` en 1 y registrar un movimiento `reasignacion_cancelacion`.
- **FR-008**: Los ajustes manuales de stock DEBEN requerir autenticación y autorización (roles: administrador o supervisor), y DEBEN registrar el usuario que realizó el ajuste y una observación opcional.
- **FR-009**: Cada ajuste manual DEBE generar una entrada de auditoría en el log de auditoría del sistema (evento `stock.ajuste_manual`).
- **FR-010**: El sistema DEBE exponer la consulta de stock con filtros por fecha, sede, punto de retiro y menú publicado, accesible para roles administrador, supervisor y operador_caja.
- **FR-011**: El sistema DEBE exponer el historial de movimientos de un stock, accesible para roles administrador y supervisor.
- **FR-012**: El `stock_restante` DEBE recalcularse después de cada operación que modifique los contadores, reflejando siempre el estado actual.
- **FR-013**: No puede existir más de un registro de stock por combinación de tenant, fecha, sede, punto de retiro y menú publicado.
- **FR-014**: El módulo DEBE exportar los métodos de consumo y reasignación para ser utilizados por los módulos de entregas y ventas-sobrantes.

### Key Entities *(include if feature involves data)*

- **StockVianda**: Registro maestro del stock de un menú para una fecha, sede y punto de retiro específicos. Contiene los contadores de unidades reservadas, disponibles, entregadas, vendidas, ajustadas y la cantidad restante calculada. Única por combinación de tenant + fecha + sede + punto de retiro + menú publicado.
- **MovimientoStockVianda**: Registro de auditoría de cada cambio en un StockVianda. Captura el tipo de movimiento, la cantidad (positiva o negativa), las referencias al pedido o venta asociada, el usuario responsable en caso de ajuste manual, y una observación textual opcional. Inmutable una vez creado.
- **TipoMovimientoStockVianda** (enumeración): Clasifica cada movimiento en: `alta_produccion` (stock inicial al confirmar producción), `consumo_entrega` (descontado por entrega de encargue), `consumo_sobrante` (descontado por venta presencial), `ajuste_positivo` (corrección manual que suma unidades), `ajuste_negativo` (corrección manual que resta unidades), `reasignacion_cancelacion` (unidad movida de encargues a sobrantes por cancelación post-producción).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El stock se genera automáticamente en menos de 2 segundos desde la confirmación de producción, sin pasos manuales adicionales por parte del operador.
- **SC-002**: En escenarios de alta concurrencia con hasta 20 operaciones simultáneas de consumo sobre el mismo stock, el sistema garantiza que el total de unidades consumidas nunca supera el stock disponible (0% de overselling).
- **SC-003**: El 100% de los ajustes manuales de stock quedan registrados con usuario, fecha, hora y observación — ningún ajuste puede ocurrir sin dejar trazabilidad completa.
- **SC-004**: Las consultas de stock desde back office retornan resultados con los contadores actualizados en tiempo real; un supervisor puede verificar el estado del día en cualquier momento durante la operación.
- **SC-005**: El historial de movimientos de cualquier stock muestra la secuencia completa de eventos desde su creación, permitiendo reconstruir el estado de los contadores en cualquier punto del tiempo.
- **SC-006**: La cancelación de un encargue post-producción se refleja automáticamente como unidad sobrante disponible para venta sin intervención manual del operador.

## Assumptions

- Se asume que la confirmación de producción siempre provee el número de pedidos confirmados para ese día/sede/punto/menú al momento de llamar a `generarDesdeProduccion`; si ese dato no está disponible, el valor por defecto es 0 encargues confirmados.
- Se asume que el módulo de cancelaciones-pedidos es responsable de determinar si una cancelación ocurre post-producción y de llamar a `reasignarCancelacion` en este módulo; stock-viandas no detecta el momento de la cancelación por sí mismo.
- Se asume que los ajustes manuales sobre stocks de fechas pasadas son permitidos operacionalmente (correcciones de cierre); no existe restricción de fecha en la especificación, solo restricción de rol.
- Se asume que el módulo de entregas llama a `consumirParaEntrega` una vez por pedido entregado; la idempotencia de entregas ya repetidas es responsabilidad del módulo de entregas, no de stock-viandas.
- Se asume que `stock_restante` puede tomar valor negativo en caso de ajustes manuales negativos excepcionales; esto es aceptable y visible en back office como señal de alerta operativa.
- La constitución clasifica `stock-viandas` como Type B (CRUD + business logic). El usuario describió el módulo como "Type C operativo", pero se sigue la constitución como documento rector. Los endpoints de consulta y ajuste se implementarán sobre la base CRUD, y la lógica de concurrencia se añade sobre esa base.
- Se asume multi-tenancy obligatorio en todos los accesos a datos, según el principio II de la constitución.
- El módulo depende de `ProduccionViandasModule` (con `forwardRef` para evitar dependencia circular) y de `PedidosModule` para resolver pedidos en la reasignación por cancelación.
