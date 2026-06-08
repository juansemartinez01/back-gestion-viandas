# Feature Specification: Ventas de Sobrantes

**Feature Branch**: `018-ventas-sobrantes`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "Módulo ventas-sobrantes — registro de ventas presenciales de viandas extras no asociadas a pedidos previos, con control de stock, concurrencia y validación de producción confirmada."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar Venta de Sobrante (Priority: P1)

Un operador de caja, al final de la preparación del día, ve que quedan viandas disponibles para venta directa. Selecciona el menú, la cantidad y registra la venta. El sistema valida que la producción esté confirmada, verifica stock disponible, y descuenta la unidad del stock de sobrantes. La venta queda registrada con precio tomado automáticamente del menú publicado.

**Why this priority**: Es la operación central del módulo. Sin ella no existe ninguna funcionalidad.

**Independent Test**: Puede probarse registrando una venta contra un menú publicado con producción confirmada y stock de sobrantes disponible. La venta debe crearse, el stock disminuir y el evento de auditoría quedar registrado.

**Acceptance Scenarios**:

1. **Given** producción del día confirmada y stock de sobrantes >= 1, **When** el operador_caja registra una venta de 1 unidad del menú, **Then** la venta se crea con precio_unitario = precio_sobrante del menú, importe_total calculado, y stock_vendido_sobrante incrementado en 1.
2. **Given** producción del día NO confirmada, **When** el operador_caja intenta registrar una venta, **Then** el sistema rechaza la operación con error PRODUCCION_NO_CONFIRMADA.
3. **Given** stock de sobrantes disponible = 0, **When** el operador_caja intenta registrar una venta, **Then** el sistema rechaza con error SOBRANTE_STOCK_INSUFICIENTE.
4. **Given** el menú publicado no tiene precio_sobrante, **When** se registra la venta, **Then** el sistema usa precio_encargo como precio_unitario.
5. **Given** dos operadores intentan vender la última unidad simultáneamente, **When** ambas solicitudes llegan al mismo tiempo, **Then** solo una venta se registra exitosamente; la otra recibe SOBRANTE_STOCK_INSUFICIENTE.

---

### User Story 2 - Consultar Sobrantes Disponibles (Priority: P2)

Antes de atender a un cliente, el operador de caja necesita saber qué menús tienen sobrantes disponibles para esa sede y punto de retiro en el día. Consulta la lista filtrada de menús con stock > 0.

**Why this priority**: Es la operación de lectura que habilita la venta. Sin ella el operador no sabe qué puede vender.

**Independent Test**: Puede probarse consultando disponibles con una fecha/sede/punto_retiro válidos. Debe retornar solo menús cuyo stock_disponible_sobrantes - stock_vendido_sobrante > 0.

**Acceptance Scenarios**:

1. **Given** dos menús en el día, uno con stock disponible > 0 y otro con 0, **When** se consulta disponibles para esa sede y punto de retiro, **Then** solo aparece el menú con stock > 0.
2. **Given** ningún menú con sobrantes disponibles, **When** se consulta, **Then** retorna lista vacía (no error).

---

### User Story 3 - Historial de Ventas de Sobrantes (Priority: P3)

El administrador o supervisor necesita revisar el historial de ventas de sobrantes para reportes o auditoría. Puede filtrar por fecha, sede, punto de retiro o menú publicado.

**Why this priority**: Soporte a operaciones y reportes; no bloquea el flujo de caja pero es necesario para el cierre operativo.

**Independent Test**: Puede probarse listando ventas después de haber registrado al menos una. Debe respetar los filtros de fecha y sede.

**Acceptance Scenarios**:

1. **Given** ventas registradas en varias fechas y sedes, **When** se filtra por fecha y sede_id, **Then** retorna solo las ventas que coinciden con ambos filtros.
2. **Given** un id de venta válido, **When** se solicita el detalle, **Then** retorna todos los campos de la venta incluyendo precio_unitario e importe_total.

---

### Edge Cases

- ¿Qué ocurre si se intenta vender sobrante de un menú no publicado para esa fecha/sede? → El registro de StockVianda no existe y la venta se rechaza.
- ¿Qué pasa si cantidad = 0 o negativa? → El sistema rechaza con error de validación antes de cualquier consulta de stock.
- ¿Qué sucede si el StockVianda no existe aún para ese día? → Se rechaza la operación (no se crea stock implícitamente).
- ¿Concurrencia alta (N operadores simultáneos)? → Solo el primero en adquirir el bloqueo puede completar la venta si el stock es suficiente.
- ¿Menú publicado sin ningún precio (ni sobrante ni encargo)? → La venta se rechaza por falta de precio_unitario aplicable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir registrar una venta de sobrante solo cuando la producción del día esté en estado confirmada_completa o confirmada_con_diferencia para esa sede y punto de retiro.
- **FR-002**: El sistema DEBE verificar que el stock disponible para sobrantes (stock_disponible_sobrantes − stock_vendido_sobrante) sea mayor o igual a la cantidad solicitada antes de confirmar la venta.
- **FR-003**: El sistema DEBE usar el precio_sobrante del menú publicado como precio_unitario; si ese campo es nulo, DEBE usar precio_encargo.
- **FR-004**: El sistema DEBE calcular importe_total = precio_unitario × cantidad y persistirlo en la venta.
- **FR-005**: El sistema DEBE decrementar el stock de sobrantes vendidos en la misma transacción en que se crea la venta, sin afectar el stock reservado para encargues.
- **FR-006**: El sistema DEBE garantizar que dos operaciones concurrentes no puedan vender la misma unidad de stock: solo una de las dos solicitudes simultáneas puede completarse si el stock es exactamente 1.
- **FR-007**: El sistema DEBE registrar un evento de auditoría `venta_sobrante.registrada` dentro de la misma transacción de la venta.
- **FR-008**: El sistema DEBE exponer un listado de menús con sobrantes disponibles (stock > 0) filtrable por fecha, sede y punto de retiro.
- **FR-009**: El sistema DEBE exponer un historial de ventas de sobrantes filtrable por fecha, sede_id, punto_retiro_id y menu_publicado_id.
- **FR-010**: El sistema DEBE exponer el detalle de una venta de sobrante por su identificador único.
- **FR-011**: Solo los roles administrador y operador_caja PUEDEN registrar ventas de sobrantes.
- **FR-012**: Los roles administrador, supervisor y operador_caja PUEDEN consultar el historial y detalle de ventas de sobrantes.
- **FR-013**: Toda operación DEBE estar scoped al tenant del usuario autenticado.

### Key Entities

- **VentaSobrante**: Representa una venta presencial de viandas sobrantes. Atributos clave: fecha, sede, punto de retiro, menú publicado, cantidad, precio unitario, importe total, usuario que registró, observación opcional y tenant. No tiene actualización ni baja lógica — es un registro inmutable de una transacción.
- **StockVianda** (dependencia): Lleva los contadores de stock del día por sede/punto_retiro/menú. Se actualiza (stock_vendido_sobrante) durante la venta pero no es gestionado por este módulo.
- **OrdenProduccion** (dependencia): Determina si la producción está confirmada. Solo se lee; no se modifica.
- **MenuPublicado** (dependencia): Provee precio_sobrante y precio_encargo. Solo se lee.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El registro de una venta de sobrante, desde la solicitud hasta la confirmación con stock actualizado y auditoría escrita, se completa en menos de 2 segundos en condiciones normales de carga.
- **SC-002**: Bajo concurrencia de 10 operadores registrando ventas del mismo menú simultáneamente, el sistema garantiza que el total de unidades vendidas nunca supera el stock disponible (cero overselling).
- **SC-003**: El 100% de las ventas registradas exitosamente genera un evento de auditoría recuperable en el historial del sistema.
- **SC-004**: La consulta de menús disponibles para sobrantes retorna resultados correctos (sin falsos positivos ni falsos negativos respecto al stock real) en el 100% de los casos.
- **SC-005**: Un operador de caja puede completar el flujo completo — consultar disponibles → seleccionar menú → registrar venta — en menos de 1 minuto.

## Assumptions

- Se asume que la entidad StockVianda y su campo stock_vendido_sobrante existen y son gestionados por el módulo stock-viandas; este módulo solo los consume a través de StockViandasService.consumirParaSobrante().
- Se asume que OrdenProduccion tiene un campo `estado` consultable con valores confirmada_completa y confirmada_con_diferencia.
- Se asume que no hay cancelación ni reversión de ventas de sobrantes en el alcance de este módulo (si en el futuro se necesita, requerirá un módulo separado).
- Se asume que un menú publicado sin precio_sobrante Y sin precio_encargo es una condición de error — no se puede registrar la venta.
- Se asume que el sistema de auditoría (AuditService) está disponible y es invocable dentro de una transacción existente.
- La venta de sobrantes aplica únicamente a ventas del día actual; no se permiten ventas con fecha futura ni retroactiva (asumido por convención operativa del sistema).
- El módulo exporta VentasSobrantesService para ser consumido por el módulo cierres-operativos en el cierre del día.
