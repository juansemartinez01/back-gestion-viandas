# Feature Specification: Gestión de Puntos de Retiro

**Feature Branch**: `002-puntos-retiro`

**Created**: 2026-06-06

**Status**: Draft

**Input**: Módulo puntos-retiro — Gestión de Viandas Rochester

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Administrador gestiona el catálogo de puntos de retiro (Priority: P1)

El administrador de Rochester necesita crear y mantener los puntos de retiro de cada sede: crear nuevos puntos, editarlos, consultarlos individualmente y listarlos con filtros. Este catálogo es el dato maestro que habilita la selección de punto de retiro en los pedidos, por lo que debe existir y ser correcto antes de abrir operaciones.

**Why this priority**: Sin puntos de retiro configurados no es posible registrar pedidos ni entregas. Es el bloque de partida de toda la operación diaria.

**Independent Test**: Con acceso de administrador, crear un punto de retiro en una sede activa, verificar que aparece en el listado, consultar su detalle y editarlo. La aplicación entrega valor completo para gestión del catálogo sin necesidad de los demás módulos.

**Acceptance Scenarios**:

1. **Given** una sede activa en el sistema, **When** el administrador crea un punto de retiro con nombre y sede válidos, **Then** el punto queda registrado con `activo = true` y aparece en el listado del back office.
2. **Given** un punto de retiro existente, **When** el administrador edita su nombre o descripción, **Then** los cambios quedan reflejados inmediatamente en el detalle y el listado.
3. **Given** ya existe un punto de retiro con nombre "Ventanilla A" en la sede X, **When** el administrador intenta crear otro punto llamado "Ventanilla A" en la misma sede, **Then** el sistema rechaza la operación informando nombre duplicado.
4. **Given** una sede inactiva, **When** el administrador intenta crear un punto de retiro en esa sede, **Then** el sistema rechaza la operación informando que la sede está inactiva.
5. **Given** el listado tiene puntos de retiro de múltiples sedes, **When** el administrador filtra por sede_id, **Then** solo aparecen los puntos de esa sede. Cuando busca por nombre parcial, solo aparecen los que coinciden.

---

### User Story 2 — Cliente selecciona punto de retiro en el portal público (Priority: P2)

Al completar un encargo en el portal web, el cliente debe poder elegir en qué punto físico de la sede seleccionada va a retirar su vianda. El portal muestra solo los puntos de retiro activos de esa sede, en el orden de visualización configurado por el administrador.

**Why this priority**: Es el segundo dato que necesita el portal para armar un pedido completo (primero sede, luego punto de retiro). Sin este listado público el flujo de pedido online está incompleto.

**Independent Test**: Consultando el endpoint público con un `sede_id` válido y el header de tenant, el sistema devuelve solo los puntos activos de esa sede ordenados correctamente. Puntos inactivos no aparecen.

**Acceptance Scenarios**:

1. **Given** una sede con dos puntos activos y uno inactivo, **When** el portal consulta los puntos de retiro de esa sede, **Then** solo se devuelven los dos activos, ordenados por `orden_visualizacion` ASC (nulos al final) y desempate por nombre.
2. **Given** el portal consulta puntos de retiro sin incluir el identificador de tenant en el encabezado, **Then** el sistema rechaza la solicitud con un error informando que falta identificar el tenant.
3. **Given** el portal consulta puntos de retiro con un `sede_id` de otra organización, **Then** el sistema devuelve una lista vacía (no datos de otro tenant).

---

### User Story 3 — Administrador activa o inactiva un punto de retiro (Priority: P3)

El administrador puede habilitar o deshabilitar puntos de retiro individualmente. Un punto inactivo deja de aparecer en el portal público y no puede recibir nuevos pedidos. La inactivación es reversible y no elimina el historial.

**Why this priority**: El ciclo de vida activo/inactivo es necesario para gestionar temporadas, refacciones o reorganizaciones de la sede sin perder trazabilidad.

**Independent Test**: Crear un punto activo, inactivarlo, verificar que desaparece del listado público, y volver a activarlo para que reaparezca.

**Acceptance Scenarios**:

1. **Given** un punto de retiro activo, **When** el administrador lo inactiva, **Then** `activo` cambia a `false`, el registro queda en el sistema y el punto ya no aparece en el portal público.
2. **Given** un punto de retiro inactivo, **When** el administrador lo activa, **Then** `activo` cambia a `true` y el punto vuelve a aparecer en el portal público.
3. **Given** un punto de retiro activo, **When** el administrador intenta activarlo nuevamente, **Then** el sistema rechaza la operación con un mensaje indicando que ya está activo.
4. **Given** un punto de retiro inactivo, **When** el administrador intenta inactivarlo nuevamente, **Then** el sistema rechaza la operación con un mensaje indicando que ya está inactivo.

---

### User Story 4 — Administrador elimina un punto de retiro fuera de uso (Priority: P4)

El administrador puede eliminar (de forma lógica) un punto de retiro que ya no existe físicamente y que fue previamente inactivado. El registro se conserva para trazabilidad histórica pero no aparece en ningún listado operativo.

**Why this priority**: Completar el ciclo de vida del catálogo. Menos crítico que las otras historias porque la inactivación ya cubre el caso operativo.

**Independent Test**: Inactivar un punto, eliminarlo, verificar que no aparece en listados del back office ni en el portal público.

**Acceptance Scenarios**:

1. **Given** un punto de retiro inactivo, **When** el administrador lo elimina, **Then** el punto desaparece de todos los listados (back office y portal público) aunque su registro histórico queda preservado.
2. **Given** un punto de retiro activo, **When** el administrador intenta eliminarlo, **Then** el sistema rechaza la operación informando que debe inactivarse primero.

---

### Edge Cases

- ¿Qué sucede si se intenta crear un punto de retiro en una sede que pertenece a otro tenant? → El sistema rechaza la operación: la sede no existe en el contexto del tenant actual.
- ¿Qué ocurre si se inactiva una sede y luego se intenta activar uno de sus puntos de retiro? → Los puntos de una sede inactiva pueden activarse/inactivarse individualmente; la inactivación de la sede no bloquea la gestión de sus puntos.
- ¿Qué pasa si el `sede_id` enviado al endpoint público no existe o no tiene puntos activos? → Se devuelve una lista vacía sin error.
- ¿Puede haber dos puntos con el mismo nombre en sedes distintas? → Sí. La unicidad es `(tenant_id, sede_id, nombre)`, no solo `nombre`.
- ¿Qué ocurre si se edita el nombre de un punto de retiro a uno ya existente en la misma sede? → El sistema rechaza la operación con error de nombre duplicado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a usuarios con rol `administrador` o `supervisor` listar todos los puntos de retiro del tenant con paginación, búsqueda por nombre (coincidencia parcial, insensible a mayúsculas), filtro por `sede_id` y filtro por estado `activo`. El listado DEBE ordenarse por `nombre` o `orden_visualizacion` según el parámetro recibido.
- **FR-002**: El sistema DEBE permitir a usuarios con rol `administrador` o `supervisor` consultar el detalle de un punto de retiro por su identificador, scoped al tenant.
- **FR-003**: El sistema DEBE permitir a usuarios con rol `administrador` crear un punto de retiro especificando al menos `sede_id` y `nombre`. Antes de crear, DEBE verificar que la sede exista en el tenant y esté activa.
- **FR-004**: El sistema DEBE rechazar la creación si ya existe un punto de retiro con el mismo nombre en la misma sede y tenant (unicidad compuesta), informando el motivo con un error claro.
- **FR-005**: El sistema DEBE permitir a usuarios con rol `administrador` editar un punto de retiro. Al cambiar el nombre, DEBE aplicar la misma validación de unicidad excluyendo el propio registro.
- **FR-006**: El sistema DEBE permitir a usuarios con rol `administrador` activar un punto de retiro inactivo. Si ya está activo, DEBE rechazar la operación con un error informativo.
- **FR-007**: El sistema DEBE permitir a usuarios con rol `administrador` inactivar un punto de retiro activo. Si ya está inactivo, DEBE rechazar la operación con un error informativo. En el MVP, la verificación de pedidos pendientes asociados al punto es informativa y no bloquea la operación.
- **FR-008**: El sistema DEBE permitir a usuarios con rol `administrador` eliminar (lógicamente) un punto de retiro, SOLO si está inactivo. Si está activo, DEBE rechazar la operación.
- **FR-009**: El portal público DEBE exponer un listado de puntos de retiro activos filtrados por `sede_id`, resolviendo el tenant desde el encabezado de identificación de tenant. La respuesta DEBE incluir solo puntos activos, ordenados por `orden_visualizacion` ASC (nulos al final) y, como desempate, por `nombre` ASC.
- **FR-010**: El portal público NO DEBE requerir autenticación pero SÍ DEBE requerir identificación de tenant en el encabezado. Sin ese encabezado, el sistema DEBE responder con error.
- **FR-011**: El sistema DEBE registrar un evento de auditoría para cada acción sensible: crear, editar, activar, inactivar y eliminar puntos de retiro.
- **FR-012**: El sistema DEBE garantizar que un punto de retiro solo sea visible (en cualquier listado) para el tenant al que pertenece.
- **FR-013**: Los campos `descripcion` y `observaciones` son opcionales. El campo `orden_visualizacion` es opcional y acepta enteros positivos.

### Key Entities

- **PuntoRetiro**: Lugar físico dentro de una sede donde se retiran viandas o se realizan ventas presenciales. Atributos clave: identificador único, sede a la que pertenece, nombre (único por sede y tenant), descripción breve, estado activo/inactivo, orden de visualización en portal, observaciones internas, timestamps de creación/modificación/eliminación lógica, identificador de tenant.
- **Sede** (dependencia): Entidad del módulo `sedes`. Un punto de retiro referencia obligatoriamente a una sede activa del mismo tenant. La integridad referencial debe verificarse al crear o reasignar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede crear, editar, activar/inactivar y eliminar un punto de retiro en menos de 30 segundos por operación, incluyendo la validación de unicidad.
- **SC-002**: El listado del back office responde en menos de 2 segundos con hasta 500 puntos de retiro por tenant, incluyendo filtros y paginación.
- **SC-003**: El portal público devuelve la lista de puntos de retiro activos de una sede en menos de 1 segundo para el 95% de las solicitudes.
- **SC-004**: El 100% de los intentos de acceso cruzado entre tenants resultan en una respuesta vacía o de error, sin exponer datos ajenos.
- **SC-005**: Todas las operaciones sensibles (crear, editar, activar, inactivar, eliminar) quedan registradas en el historial de auditoría sin excepción.
- **SC-006**: La unicidad de nombre por sede y tenant se garantiza al 100%: no puede existir más de un punto de retiro activo con el mismo nombre en la misma sede y tenant.

## Assumptions

- Se asume que el módulo `sedes` está completamente implementado y operativo antes de comenzar este módulo (dependencia de Stage 1 según la constitución).
- Se asume que la validación de pedidos pendientes al inactivar un punto de retiro es informativa en el MVP; la verificación cruzada con el módulo de pedidos se implementará en Stage 3.
- Se asume que el endpoint público de puntos de retiro acepta `sede_id` como query parameter obligatorio; una consulta sin `sede_id` devuelve lista vacía o error de parámetro requerido.
- Se asume que la eliminación lógica conserva el registro en la base de datos con `deleted_at` poblado; no se elimina físicamente ningún dato.
- Se asume que los roles `administrador` y `supervisor` tienen acceso de lectura, pero solo `administrador` puede escribir, activar/inactivar o eliminar.
- Se asume que el orden de visualización es un entero positivo libre; la administración de colisiones de orden (ej. dos puntos con `orden_visualizacion = 1`) es responsabilidad del administrador — el sistema los ordena sin error.
- Se asume que la inactivación de una sede no propaga automáticamente la inactivación a sus puntos de retiro; cada punto se gestiona por separado.
