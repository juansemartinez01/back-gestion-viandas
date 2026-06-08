# Feature Specification: Producción de Viandas

**Feature Branch**: `015-produccion-viandas`

**Created**: 2026-06-08

**Status**: Draft

**Input**: Módulo de planificación y confirmación de producción diaria de viandas, con generación de stock operativo al confirmar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar Hoja de Producción del Día (Priority: P1)

Un administrador o supervisor selecciona una fecha y sede para generar las órdenes de producción. El sistema calcula automáticamente cuántas viandas preparar por menú y punto de retiro, sumando pedidos confirmados online, presenciales y sobreproducción configurada, descontando cancelaciones.

**Why this priority**: Es la función central del módulo. Sin la hoja de producción generada, cocina no tiene información para preparar las viandas del día.

**Independent Test**: Se puede probar generando órdenes para una fecha con pedidos confirmados existentes y verificando que los totales calculados coincidan con los pedidos reales más la sobreproducción configurada.

**Acceptance Scenarios**:

1. **Given** que existen pedidos confirmados (online y presencial) para una fecha y sede, **When** el supervisor ejecuta "Generar producción" para esa fecha y sede, **Then** el sistema crea una orden de producción por cada combinación única de menú publicado y punto de retiro, con los totales correctamente calculados.
2. **Given** que ya existen órdenes de producción para una combinación fecha+sede+punto_retiro+menu_publicado, **When** se vuelve a generar producción para esa misma fecha y sede, **Then** el sistema actualiza los contadores existentes en lugar de crear registros duplicados.
3. **Given** que no existen pedidos para una fecha, **When** se genera producción, **Then** las órdenes se crean con cantidades en cero más la sobreproducción configurada.
4. **Given** que la sobreproducción está configurada como porcentaje, **When** se genera producción, **Then** el sistema calcula la sobreproducción como ese porcentaje sobre el total de pedidos confirmados.

---

### User Story 2 - Consultar Hoja de Producción (Priority: P2)

El rol cocina (y también administrador/supervisor) puede consultar la hoja de producción filtrada por fecha, sede, punto de retiro, menú o estado. El rol cocina solo tiene acceso de lectura — no puede modificar estados.

**Why this priority**: Cocina necesita acceder a la hoja de producción para preparar el servicio del día. Sin esta consulta, el módulo no tiene valor operativo.

**Independent Test**: Se puede probar iniciando sesión con el rol cocina y verificando que puede listar y ver el detalle de órdenes de producción sin acceder a ninguna acción de escritura.

**Acceptance Scenarios**:

1. **Given** que el usuario tiene rol cocina, **When** consulta las órdenes de producción del día con filtros, **Then** ve la lista completa con totales sugeridos y estados.
2. **Given** que el usuario tiene rol cocina, **When** intenta confirmar producción o cambiar estado, **Then** el sistema rechaza la acción con un error de autorización.
3. **Given** que el administrador filtra por fecha y estado "pendiente", **When** se ejecuta la consulta, **Then** solo se muestran órdenes de esa fecha en estado pendiente.
4. **Given** que se accede al endpoint imprimible, **When** se aplican los mismos filtros que en el listado general, **Then** se devuelve una vista resumida optimizada para impresión/visualización en cocina.

---

### User Story 3 - Marcar Producción en Curso (Priority: P3)

El administrador o supervisor marca una orden de producción como "en producción" para indicar que cocina ha comenzado a preparar esas viandas. Esta acción queda registrada en la auditoría.

**Why this priority**: Permite a la operación rastrear el estado en tiempo real de cada orden antes de la confirmación final.

**Independent Test**: Se puede probar cambiando el estado de una orden pendiente a en_produccion y verificando el registro de auditoría correspondiente.

**Acceptance Scenarios**:

1. **Given** que una orden está en estado "pendiente", **When** el supervisor la marca como "en producción", **Then** el estado cambia a "en_produccion" y se registra la acción en auditoría.
2. **Given** que una orden ya está confirmada o cancelada, **When** se intenta marcarla como "en producción", **Then** el sistema rechaza la transición con un mensaje descriptivo.

---

### User Story 4 - Confirmar Producción Real y Generar Stock (Priority: P1)

El supervisor ingresa la cantidad real producida para una orden. Si coincide con el total sugerido, la producción queda como "completa". Si difiere, debe ingresar una observación justificando la diferencia. Al confirmar, el sistema genera el stock operativo disponible para entregas y venta de sobrantes.

**Why this priority**: Es la acción que cierra el ciclo de producción y habilita las operaciones del día (entregas, venta de sobrantes). Sin confirmación, el stock no existe y las operaciones no pueden continuar.

**Independent Test**: Se puede probar confirmando una orden con cantidad real diferente al sugerido, verificar que se exige observación, y que el stock operativo queda generado correctamente.

**Acceptance Scenarios**:

1. **Given** que una orden tiene total_sugerido = 50 y se confirma con cantidad_real_producida = 50, **When** se confirma, **Then** el estado pasa a "confirmada_completa" y el stock operativo se genera con stock_reservado_encargues = pedidos confirmados y stock_disponible_sobrantes = 0.
2. **Given** que una orden tiene total_sugerido = 50 y se confirma con cantidad_real_producida = 45, **When** se confirma sin observación, **Then** el sistema rechaza la confirmación exigiendo una observación obligatoria.
3. **Given** que se confirma con cantidad_real_producida = 45 y observación válida, **Then** el estado pasa a "confirmada_con_diferencia" y se genera el stock correspondiente.
4. **Given** que cantidad_real_producida (40) es menor que los pedidos confirmados (45), **When** se confirma, **Then** el sistema completa la confirmación pero incluye una alerta informativa (no bloqueante) indicando que la producción no cubre todos los encargues.
5. **Given** que se confirma con cantidad_real_producida = 60 y total sugerido = 50, **When** se confirma, **Then** stock_disponible_sobrantes = 60 - pedidos_confirmados (positivo), y la confirmación es exitosa.

---

### Edge Cases

- ¿Qué ocurre si se intenta generar producción para una fecha pasada? El sistema permite la generación (útil para correcciones retroactivas) sin bloquear, aunque queda registro de quién lo hizo.
- ¿Qué ocurre si un menú publicado se desactiva después de generar la orden? La orden de producción ya generada mantiene la referencia y no se elimina automáticamente.
- ¿Qué ocurre si se intenta confirmar una orden ya confirmada? El sistema rechaza con un error explicativo — la confirmación es idempotente solo si los valores son idénticos.
- ¿Qué ocurre si cantidad_real_producida es 0? Se admite; representa una producción nula (cancelación de hecho). Requiere observación obligatoria ya que difiere del sugerido (excepto cuando el sugerido también es 0).
- ¿Qué ocurre si no hay pedidos activos para la fecha/sede seleccionada? El sistema puede generar órdenes con cantidad 0 si hay sobreproducción configurada, o devolver una lista vacía si no hay menús publicados activos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir generar órdenes de producción para una fecha y sede determinadas, creando una orden por cada combinación única de menú publicado activo y punto de retiro con pedidos confirmados ese día.
- **FR-002**: El sistema DEBE calcular el total sugerido de producción como: pedidos confirmados online + pedidos confirmados presenciales − cancelaciones descontadas + sobreproducción configurada.
- **FR-003**: El sistema DEBE soportar dos tipos de sobreproducción: cantidad fija (número de unidades adicionales) y porcentaje (calculado sobre el total de pedidos confirmados).
- **FR-004**: El sistema DEBE actualizar los contadores de una orden existente si se vuelve a generar producción para la misma combinación fecha+sede+punto_retiro+menu_publicado, en lugar de crear un duplicado.
- **FR-005**: Los usuarios con roles administrador, supervisor y cocina DEBEN poder listar y consultar órdenes de producción, con filtros por fecha, sede, punto de retiro, menú publicado y estado.
- **FR-006**: El sistema DEBE ofrecer una vista imprimible (hoja de producción resumida) con los mismos filtros que el listado general, accesible para administrador, supervisor y cocina.
- **FR-007**: Solo los usuarios con roles administrador o supervisor DEBEN poder cambiar el estado de una orden a "en producción".
- **FR-008**: Solo los usuarios con roles administrador o supervisor DEBEN poder confirmar la producción real de una orden.
- **FR-009**: Al confirmar producción, si la cantidad real difiere del total sugerido, el campo observación DEBE ser obligatorio.
- **FR-010**: Al confirmar producción, si la cantidad real es menor que los pedidos confirmados, el sistema DEBE incluir una alerta informativa en la respuesta — esta alerta no bloquea la confirmación.
- **FR-011**: Al confirmar producción, el sistema DEBE generar o actualizar el stock operativo del día con: stock_reservado_encargues = total de pedidos confirmados, stock_disponible_sobrantes = MAX(0, cantidad_real_producida − pedidos_confirmados).
- **FR-012**: Las acciones de generar producción, marcar en producción y confirmar producción DEBEN quedar registradas en el log de auditoría incluyendo el usuario ejecutor.
- **FR-013**: El rol cocina NO DEBE tener acceso a ningún endpoint de escritura o cambio de estado — solo lectura.
- **FR-014**: Cada orden de producción DEBE pertenecer a un tenant y nunca ser accesible desde otro tenant.

### Key Entities

- **OrdenProduccionVianda**: Representa la planificación de producción para un menú publicado en un punto de retiro para una fecha dada. Contiene los contadores de pedidos (online, presencial, cancelaciones), la sobreproducción configurada, el total sugerido calculado, la cantidad real producida al confirmar y el estado del ciclo de producción.
- **EstadoOrdenProduccion** (enum): Ciclo de vida de la orden — `pendiente` (generada, sin iniciar), `en_produccion` (cocina en preparación), `confirmada_completa` (real = sugerido), `confirmada_con_diferencia` (real ≠ sugerido, con observación), `cancelada` (producción no ejecutada).
- **SobreproduccionConfig**: Configuración asociada al menú publicado que determina cuántas unidades adicionales preparar (tipo: cantidad_fija o porcentaje).
- **StockViandas**: Entidad de stock operativo generada/actualizada al confirmar producción, con contadores separados para encargues reservados y sobrantes disponibles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador o supervisor puede generar la hoja de producción completa para una fecha y sede en menos de 30 segundos, independientemente del número de menús y puntos de retiro activos.
- **SC-002**: La hoja de producción refleja con exactitud los pedidos confirmados del día — 0% de discrepancia entre los totales calculados y los pedidos efectivamente registrados.
- **SC-003**: Al confirmar producción, el stock operativo queda disponible para entregas y venta de sobrantes de manera inmediata — el mismo flujo de trabajo continúa sin pasos adicionales manuales.
- **SC-004**: El 100% de las acciones de escritura (generar, marcar en producción, confirmar) queda registrado en auditoría con usuario, timestamp y datos relevantes.
- **SC-005**: El rol cocina puede consultar la hoja de producción sin que ningún endpoint de escritura sea accesible para ese rol — 0% de operaciones de escritura disponibles para cocina.
- **SC-006**: No se generan órdenes duplicadas — re-ejecutar la generación de producción para una misma fecha/sede actualiza los registros existentes sin crear duplicados.

## Assumptions

- La sobreproducción configurada está definida a nivel de menú publicado (no por orden de producción individualmente); el módulo lee esta configuración de `MenuPublicado`.
- Un "pedido confirmado" incluye tanto los estados `confirmado_pago_online` como `confirmado_pago_presencial` — cualquier otro estado no se contabiliza en producción.
- Las cancelaciones descontadas corresponden a pedidos que fueron cancelados después de haber sido contabilizados como confirmados para esa fecha.
- El stock operativo (`StockViandas`) es gestionado por el módulo `stock-viandas`; `produccion-viandas` solo invoca su servicio para crear o actualizar el registro al confirmar.
- La vista imprimible no requiere autenticación especial más allá de `JwtAuthGuard` con los roles permitidos — no es un endpoint público.
- El módulo no gestiona la configuración de sobreproducción; asume que esa configuración ya existe en `MenuPublicado` con campos `sobreproduccion_tipo` y `sobreproduccion_valor`.
- El sistema no bloquea la generación de producción para fechas pasadas; esto puede ser necesario para correcciones operativas.
- La alerta de "producción real < pedidos confirmados" es puramente informativa y se incluye en el cuerpo de la respuesta de confirmación; no bloquea ni revierte la operación.
