# Feature Specification: Cierres Operativos

**Feature Branch**: `019-cierres-operativos`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "Módulo cierres-operativos — cierre del día operativo para sede/punto de retiro con detección automática de pedidos no retirados y resumen de recaudación."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ejecutar cierre del día operativo (Priority: P1)

Un operador de caja o administrador cierra el día para una sede y punto de retiro específicos. Al hacerlo, el sistema detecta automáticamente todos los pedidos confirmados que no fueron entregados, los marca como "no retirado", y genera un registro de cierre con el resumen del día: cantidad de entregas, ventas de sobrantes, recaudación presencial y pedidos no retirados.

**Why this priority**: Es la función central del módulo. Sin ella, el resto de las funcionalidades no tienen sentido. Permite cerrar el ciclo operativo diario y habilitar la restricción de operaciones sobre fechas ya cerradas.

**Independent Test**: Se puede probar de forma aislada ejecutando el endpoint de cierre para una fecha/sede/punto con pedidos confirmados pendientes, y verificando que el cierre es creado, los pedidos son marcados como `no_retirado`, y el resumen es correcto.

**Acceptance Scenarios**:

1. **Given** existen pedidos confirmados (presencial u online) para el día/sede/punto que no fueron entregados ni cancelados, **When** un operador_caja ejecuta el cierre, **Then** el sistema los marca como `no_retirado`, crea el registro de cierre con los totales correctos, y audita el evento `cierre.operativo.registrado`.
2. **Given** ya existe un cierre para esa combinación (tenant, fecha, sede, punto_retiro), **When** se intenta ejecutar un segundo cierre, **Then** el sistema rechaza la operación con el error `CIERRE_YA_EXISTE`.
3. **Given** existen pedidos cancelados o en estado `pendiente_pago_online` para el día, **When** se ejecuta el cierre, **Then** esos pedidos NO son marcados como `no_retirado` — solo se marcan los confirmados no entregados.
4. **Given** no hay pedidos pendientes de entrega para el día/sede/punto, **When** se ejecuta el cierre, **Then** el cierre se crea igualmente con cantidades en cero y la operación es exitosa.

---

### User Story 2 — Consultar resumen previo antes de cerrar (Priority: P2)

Antes de ejecutar el cierre definitivo, un operador o administrador puede previsualizar el resumen del día: cuántos pedidos están pendientes de marcarse como no retirados, cuántas entregas se realizaron, cuántas ventas de sobrantes hubo, y cuánto se recaudó en efectivo.

**Why this priority**: Permite al operador verificar que los números son correctos antes de confirmar el cierre, evitando errores operativos difíciles de revertir.

**Independent Test**: Se puede probar ejecutando el endpoint de resumen previo y verificando que los totales calculados coinciden con el estado real de pedidos y entregas del día, sin que ningún dato sea modificado.

**Acceptance Scenarios**:

1. **Given** existen pedidos y entregas para el día/sede/punto, **When** se solicita el resumen previo, **Then** el sistema retorna los totales calculados (pedidos a marcar como no retirado, entregados, ventas sobrantes, recaudación) sin modificar ningún dato.
2. **Given** ya existe un cierre para ese día/sede/punto, **When** se solicita el resumen previo, **Then** el sistema indica que el día ya está cerrado.

---

### User Story 3 — Consultar historial de cierres (Priority: P3)

Un administrador o supervisor puede listar los cierres operativos históricos filtrando por fecha, sede y/o punto de retiro, y ver el detalle de un cierre específico.

**Why this priority**: Provee visibilidad operativa y permite auditar los cierres pasados. Necesario para reportes y resolución de disputas.

**Independent Test**: Se puede probar listando cierres con distintas combinaciones de filtros y verificando que solo se retornan los registros correspondientes al tenant y filtros aplicados.

**Acceptance Scenarios**:

1. **Given** existen múltiples cierres en el sistema, **When** se lista con filtro por sede_id, **Then** solo se retornan los cierres de esa sede para el tenant autenticado.
2. **Given** existe un cierre con id conocido, **When** se consulta el detalle, **Then** se retornan todos los campos del cierre incluyendo observación, totales y fecha de cierre.
3. **Given** no existen cierres para los filtros aplicados, **When** se lista, **Then** se retorna una lista vacía sin error.

---

### User Story 4 — Bloqueo de operaciones en días ya cerrados (Priority: P1)

Cuando un día operativo está cerrado para una sede/punto, el sistema rechaza cualquier intento de registrar entregas o ventas de sobrantes para ese día y punto.

**Why this priority**: Es una regla de integridad crítica. Sin este bloqueo, se podrían registrar operaciones sobre fechas ya cerradas, corrompiendo los resúmenes y la auditoría.

**Independent Test**: Se puede probar intentando registrar una entrega para un día/sede/punto cuyo cierre ya existe, y verificando que la operación es rechazada con un error apropiado.

**Acceptance Scenarios**:

1. **Given** existe un cierre para el día/sede/punto, **When** se intenta registrar una entrega para ese día/punto, **Then** el sistema rechaza la operación con el error `DIA_OPERATIVO_CERRADO`.
2. **Given** existe un cierre para el día/sede/punto, **When** se intenta registrar una venta de sobrante para ese día/punto, **Then** el sistema rechaza la operación con el error `DIA_OPERATIVO_CERRADO`.

---

### Edge Cases

- ¿Qué pasa si se ejecuta el cierre para un día futuro? — El sistema debe rechazarlo o al menos advertir; por defecto se asume que el cierre aplica a la fecha operativa indicada (validación a nivel de negocio, no técnico).
- ¿Qué pasa si hay pedidos en estado `confirmado` que jamás tuvieron movimiento de entrega? — Se marcan como `no_retirado` correctamente.
- ¿Qué sucede si la suma de recaudación incluye ventas de sobrantes en efectivo y entregas en efectivo simultáneamente? — Ambas se suman en `recaudacion_presencial`.
- ¿Qué pasa si se ejecutan dos cierres concurrentes para el mismo día/sede/punto? — La restricción de unicidad (`UNIQUE` en BD) garantiza que solo uno prospere; el otro falla con `CIERRE_YA_EXISTE`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir ejecutar el cierre operativo del día para una combinación específica de tenant, fecha operativa, sede y punto de retiro.
- **FR-002**: Al ejecutar el cierre, el sistema DEBE detectar todos los pedidos con estado `confirmado` de esa fecha/sede/punto que no hayan sido entregados ni cancelados, y cambiar su estado a `no_retirado` de forma atómica con la creación del registro de cierre.
- **FR-003**: Los pedidos con estado `cancelado` o `pendiente_pago_online` NO DEBEN ser afectados por el cierre.
- **FR-004**: El sistema DEBE calcular y registrar en el cierre: cantidad de pedidos entregados, cantidad de pedidos no retirados, cantidad de ventas de sobrantes y recaudación presencial del día para ese punto.
- **FR-005**: El sistema DEBE rechazar la ejecución de un cierre si ya existe uno registrado para la misma combinación (tenant, fecha, sede, punto_retiro), retornando el error `CIERRE_YA_EXISTE`.
- **FR-006**: El sistema DEBE registrar una entrada de auditoría con evento `cierre.operativo.registrado` al completar exitosamente un cierre.
- **FR-007**: El sistema DEBE exponer un endpoint de previsualización (resumen previo) que calcule los mismos totales del cierre sin modificar ningún dato, para que el operador pueda revisar antes de confirmar.
- **FR-008**: El sistema DEBE listar el historial de cierres operativos con capacidad de filtrado por fecha, sede_id y punto_retiro_id, restringido al tenant autenticado.
- **FR-009**: El sistema DEBE exponer el detalle de un cierre operativo por su identificador único.
- **FR-010**: El sistema DEBE exportar una función de verificación (`isClosed`) que otros módulos puedan usar para validar si un día/sede/punto está cerrado antes de permitir operaciones.
- **FR-011**: Entregas y ventas de sobrantes DEBEN ser rechazadas si el día operativo correspondiente ya tiene un cierre registrado, usando el servicio exportado por este módulo.
- **FR-012**: Todos los endpoints de back office DEBEN requerir autenticación y respetar los roles asignados: `administrador` y `operador_caja` para ejecutar y previsualizar; `administrador`, `supervisor` y `operador_caja` para consultar.

### Key Entities *(include if feature involves data)*

- **CierreOperativo**: Registro del cierre de un día operativo para un punto de retiro específico. Contiene la fecha operativa, referencia a sede y punto de retiro, quién lo realizó, el timestamp exacto del cierre, y los totales del día (pedidos entregados, no retirados, ventas de sobrantes, recaudación presencial). Es único por combinación de tenant + fecha + sede + punto_retiro.
- **Pedido** (afectado): Entidad existente cuyos registros con estado `confirmado` y sin entrega son actualizados a `no_retirado` durante el cierre. Solo los pedidos confirmados (online completado o presencial) son elegibles para este cambio de estado.
- **Entrega** (referenciada): Fuente de datos para contar pedidos entregados del día y sumar recaudación en efectivo de entregas presenciales.
- **VentaSobrante** (referenciada): Fuente de datos para contar ventas de sobrantes del día y sumar recaudación de esas ventas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El operador completa el cierre del día en menos de 10 segundos desde que envía la solicitud hasta recibir confirmación con el resumen.
- **SC-002**: El 100% de los pedidos confirmados no entregados del día/sede/punto son marcados como `no_retirado` en la misma operación de cierre, sin excepción.
- **SC-003**: No existe ningún caso en que un segundo cierre para la misma combinación día/sede/punto sea creado exitosamente — la unicidad es garantizada al 100%.
- **SC-004**: El resumen previo refleja con exactitud los mismos valores que termina registrando el cierre definitivo cuando no hay cambios de estado entre ambas consultas.
- **SC-005**: Las operaciones de entrega y venta de sobrantes rechazadas por día cerrado retornan un error descriptivo en menos de 1 segundo, sin afectar el estado del sistema.
- **SC-006**: El historial de cierres es consultable con tiempo de respuesta aceptable para rangos de hasta 90 días de historial por sede.

## Assumptions

- La fecha operativa es un concepto de negocio distinto a la fecha del servidor; el llamador es responsable de indicar la fecha correcta. No se aplica ninguna validación de "fecha futura" en este módulo — esa regla corresponde al flujo de negocio del operador.
- La recaudación presencial se calcula sumando: (a) entregas del día para ese punto cuyo pago fue cobrado en efectivo, y (b) ventas de sobrantes del día para ese punto. No incluye pagos online.
- El módulo no gestiona reapertura de cierres — un cierre es definitivo. Si se necesita reapertura, se tramitará fuera del alcance de este módulo y requerirá una acción administrativa explícita.
- El resumen previo usa exactamente la misma lógica de cálculo que el cierre definitivo, por lo que su resultado es representativo siempre que no haya cambios entre la previsualización y la ejecución.
- Los pedidos online con pago pendiente (`pendiente_pago_online`) no se marcan como no retirados porque su reserva ya venció o se canceló automáticamente; no representan compromisos reales de retiro al momento del cierre.
- La exportación del servicio `CierresOperativosService` hacia `EntregasModule` y `VentasSobrantesModule` es la única interfaz de integración entre este módulo y los demás; no se usa ningún patrón de eventos para esta validación.
- El tenant se resuelve del contexto de autenticación JWT en todos los endpoints de back office; no existe un endpoint público para este módulo.
