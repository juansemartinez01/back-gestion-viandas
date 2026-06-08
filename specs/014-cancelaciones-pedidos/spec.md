# Feature Specification: Módulo Cancelaciones de Pedidos

**Feature Branch**: `014-cancelaciones-pedidos`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "Módulo cancelaciones-pedidos — consulta, reportes y validación de reglas de cancelación sobre pedidos cancelados. Sin entidad propia."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consultar pedidos cancelados con filtros (Priority: P1)

Un administrador o supervisor del back office necesita revisar los pedidos cancelados de un período determinado para hacer seguimiento operativo. Puede filtrar por fecha de cancelación, sede, quién canceló el pedido y si tiene devolución pendiente.

**Why this priority**: Es la funcionalidad central del módulo. Sin un listado filtrable de cancelaciones, ninguna de las demás funciones tiene utilidad práctica.

**Independent Test**: Se puede probar de forma independiente accediendo al listado de cancelaciones con distintas combinaciones de filtros y verificando que los resultados devueltos corresponden únicamente a pedidos cancelados con los criterios indicados.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado sin filtros aplicados, **When** consulta la lista de cancelaciones, **Then** recibe todos los pedidos cancelados del sistema paginados (orden cronológico descendente por fecha de cancelación).
2. **Given** un supervisor autenticado, **When** filtra por sede y rango de fechas de cancelación, **Then** recibe únicamente los pedidos cancelados de esa sede en ese período.
3. **Given** un usuario con rol operador_caja, **When** intenta acceder al listado de cancelaciones, **Then** recibe un error de acceso denegado.
4. **Given** un administrador autenticado, **When** filtra por `cancelado_por = cliente`, **Then** solo recibe pedidos cancelados desde el portal por el propio cliente.
5. **Given** un administrador autenticado, **When** filtra por `devolucion_pendiente = true`, **Then** solo recibe pedidos cancelados que tienen pago online aprobado y devolución aún no procesada.

---

### User Story 2 — Ver pedidos con devolución pendiente (Priority: P2)

Un administrador necesita identificar rápidamente todos los pedidos que fueron cancelados y tienen un pago online ya aprobado que todavía no fue devuelto manualmente al cliente. Esto permite priorizar gestiones de reembolso sin perderse en el listado general.

**Why this priority**: Impacta directamente la experiencia financiera de los clientes. Un reembolso no procesado es una deuda activa con el cliente.

**Independent Test**: Se puede probar de forma independiente verificando que todos los pedidos devueltos en este endpoint tienen estado cancelado y tienen pago online aprobado, y que no aparecen pedidos sin deuda de devolución.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** consulta el endpoint de devoluciones pendientes, **Then** recibe únicamente pedidos con estado cancelado cuyo pago online fue aprobado y la devolución no ha sido registrada.
2. **Given** un supervisor autenticado, **When** intenta acceder al endpoint de devoluciones pendientes, **Then** recibe un error de acceso denegado (solo `administrador` tiene acceso).
3. **Given** no existen pedidos cancelados con pago online aprobado sin devolución, **When** el administrador consulta el endpoint, **Then** recibe una lista vacía con estructura válida.

---

### User Story 3 — Obtener resumen de cancelaciones del día (Priority: P2)

Un administrador o supervisor necesita un resumen ejecutivo de las cancelaciones de un día específico (o por defecto, el día actual) para una sede dada. El resumen muestra cuántos pedidos fueron cancelados en total, cuántos fueron cancelados por el cliente vs. por el equipo administrativo, y cuántos tienen devolución pendiente.

**Why this priority**: Insumo clave para la operación diaria y el informe de cierre. Permite detectar anomalías (muchas cancelaciones de admin en un día, por ejemplo) sin necesidad de revisar el listado completo.

**Independent Test**: Se puede probar de manera independiente verificando que los totales del resumen coinciden con los resultados del listado filtrado para la misma fecha y sede.

**Acceptance Scenarios**:

1. **Given** un supervisor autenticado, **When** solicita el resumen para una fecha y sede específicas, **Then** recibe: total de cancelaciones, subtotal por cliente, subtotal por administrador/back office, y cantidad con devolución pendiente.
2. **Given** un administrador autenticado sin parámetro `fecha`, **When** solicita el resumen, **Then** el sistema asume la fecha actual y devuelve el resumen del día en curso para la sede indicada.
3. **Given** no hay cancelaciones para la fecha y sede indicadas, **When** se solicita el resumen, **Then** todos los totales son cero y la respuesta es válida.
4. **Given** un usuario con rol `operador_caja`, **When** intenta acceder al resumen, **Then** recibe un error de acceso denegado.

---

### User Story 4 — Validación interna de elegibilidad de cancelación desde el portal (Priority: P1)

Cuando un cliente intenta cancelar un pedido desde el portal público, el sistema debe verificar automáticamente si el pedido puede ser cancelado: si está en un estado permitido y si todavía está dentro del plazo límite de cancelación definido por el menú publicado. Esta validación es interna y es usada por el módulo de pedidos antes de ejecutar cualquier cancelación desde el portal.

**Why this priority**: Sin esta validación, el portal podría permitir cancelaciones inválidas (pedido ya entregado, fuera de plazo) rompiendo invariantes del negocio.

**Independent Test**: Se puede probar de forma independiente pasando distintas combinaciones de estado de pedido y fecha/hora límite de cancelación del menú, y verificando que el resultado indica correctamente si la cancelación es permitida o no, con el motivo correspondiente.

**Acceptance Scenarios**:

1. **Given** un pedido en estado `confirmado` y la hora actual está antes del límite de cancelación del menú, **When** se evalúa la regla, **Then** el resultado indica que la cancelación está permitida.
2. **Given** un pedido en estado `confirmado` y la hora actual supera el límite de cancelación del menú, **When** se evalúa la regla, **Then** el resultado indica que la cancelación no está permitida, con motivo "Plazo de cancelación vencido".
3. **Given** un pedido en estado `cancelado`, **When** se evalúa la regla, **Then** el resultado indica que la cancelación no está permitida, con motivo "El pedido ya está cancelado".
4. **Given** un pedido en estado `entregado`, **When** se evalúa la regla, **Then** el resultado indica que la cancelación no está permitida, con motivo "El pedido ya fue entregado".
5. **Given** un pedido en estado `pago_online_pendiente`, **When** se evalúa la regla, **Then** el resultado indica que la cancelación no está permitida desde el portal (requiere intervención manual), con motivo "Pago en proceso".

---

### Edge Cases

- ¿Qué pasa si se filtra por `sede_id` que no existe o no pertenece al tenant? → Devuelve lista vacía, sin error.
- ¿Qué pasa si el parámetro `fecha` del resumen tiene formato inválido? → Responde con error de validación de parámetros.
- ¿Qué pasa si el menú publicado no tiene `fecha_hora_limite_cancelacion` configurada? → La regla de validación del portal responde con cancelación no permitida (sin plazo definido = sin cancelación online).
- ¿Qué pasa si un pedido cancelado con pago online aprobado ya tuvo su devolución procesada? → No aparece en la lista de devoluciones pendientes.
- ¿Qué pasa si hay muchos pedidos cancelados (miles)? → El listado está paginado; el resumen siempre devuelve conteos agregados.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer un listado de pedidos cancelados del tenant activo, con paginación y los siguientes filtros opcionales: rango de fechas de cancelación, sede, origen de la cancelación (cliente o administrador), y estado de devolución pendiente.
- **FR-002**: El listado de cancelaciones DEBE ser accesible únicamente por usuarios con rol `administrador` o `supervisor`, requiriendo autenticación válida.
- **FR-003**: El sistema DEBE exponer un listado especializado de pedidos cancelados que tienen pago online aprobado y devolución no procesada, accesible solo para usuarios con rol `administrador`.
- **FR-004**: El sistema DEBE exponer un resumen diario de cancelaciones por fecha y sede, que incluya: total de cancelaciones, subtotal por origen (cliente vs. equipo administrativo), y cantidad con devolución pendiente.
- **FR-005**: El resumen diario DEBE ser accesible por usuarios con rol `administrador` o `supervisor`.
- **FR-006**: Cuando no se proporciona fecha en la consulta de resumen, el sistema DEBE asumir la fecha del día en curso.
- **FR-007**: El sistema DEBE proveer una función interna reutilizable que, dado un pedido y el menú publicado al que pertenece, determine si ese pedido puede ser cancelado desde el portal del cliente.
- **FR-008**: La función de validación DEBE verificar: (a) que el pedido esté en un estado que permita cancelación online, y (b) que la hora actual sea anterior al límite de cancelación del menú publicado.
- **FR-009**: La función de validación DEBE retornar un indicador booleano de permiso y, en caso de no estar permitida, un mensaje de motivo legible.
- **FR-010**: Todos los endpoints del módulo MUST estar limitados al scope del tenant activo; ninguna consulta puede devolver datos de otro tenant.
- **FR-011**: El módulo DEBE operar sin entidad de base de datos propia, trabajando exclusivamente sobre los registros de la entidad Pedido ya existente.
- **FR-012**: El módulo NO DEBE registrar auditoría propia; cualquier mutación de estado relevante es auditada por el módulo de Pedidos.

### Key Entities

- **Pedido**: Entidad central. Contiene todos los campos de cancelación (`fecha_cancelacion`, `cancelado_por`, `motivo_cancelacion`, `estado_pedido`). El módulo solo consulta — no modifica — esta entidad.
- **Menú Publicado**: Entidad que contiene el campo `fecha_hora_limite_cancelacion`, utilizado por la validación de reglas del portal.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede obtener la lista de cancelaciones de cualquier período con filtros en menos de 3 segundos, independientemente del volumen de datos.
- **SC-002**: El resumen diario de cancelaciones es preciso: los totales del resumen coinciden al 100% con el recuento del listado filtrado para la misma fecha y sede.
- **SC-003**: La función de validación del portal evalúa correctamente el 100% de los estados de pedido posibles, sin excepciones no manejadas.
- **SC-004**: El módulo no expone datos de cancelaciones de otros tenants bajo ninguna combinación de filtros — cero incidentes de cross-tenant data leak.
- **SC-005**: Los endpoints de cancelaciones están disponibles al mismo tiempo que el módulo de pedidos, sin dependencias en ciclos de despliegue adicionales.
- **SC-006**: El listado de devoluciones pendientes está siempre sincronizado con el estado real de los pedidos — cero falsos positivos (pedidos con devolución ya procesada apareciendo) y cero falsos negativos (pedidos con devolución pendiente no apareciendo).

---

## Assumptions

- Los campos `fecha_cancelacion`, `cancelado_por`, `motivo_cancelacion` ya existen en la entidad Pedido del módulo de pedidos; este módulo no requiere migraciones adicionales.
- El origen de la cancelación (cliente vs. administrador) se determina a partir del campo `cancelado_por` de la entidad Pedido — los valores posibles son `cliente` (portal público) y `admin` (back office).
- El estado de devolución pendiente se determina por la combinación: `estado_pedido = cancelado` y `metodo_pago = online` y `estado_pago = aprobado` y `devolucion_procesada = false` (o campo equivalente en la entidad Pedido).
- Los estados de pedido que prohíben la cancelación desde el portal incluyen al menos: `cancelado`, `entregado`, `no_retirado`, `pago_online_pendiente`. Solo `confirmado` (dentro de plazo) permite cancelación online.
- Si un menú publicado no tiene `fecha_hora_limite_cancelacion` configurada, se asume que no hay ventana de cancelación disponible para ese menú y la cancelación desde el portal no está permitida.
- El módulo es de solo lectura para el back office; la acción de cancelar un pedido queda fuera del alcance de este módulo (reside en el módulo de pedidos).
- La paginación del listado principal usa los mismos parámetros estándar de paginación del proyecto (page, limit).
- La autenticación y el scope de tenant se resuelven mediante los mecanismos estándar del template (JwtAuthGuard + TenancyService), sin lógica personalizada en este módulo.
