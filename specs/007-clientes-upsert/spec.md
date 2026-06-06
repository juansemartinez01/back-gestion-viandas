# Feature Specification: Módulo Clientes

**Feature Branch**: `007-clientes-upsert`

**Created**: 2026-06-06

**Status**: Draft

**Input**: Módulo clientes: consulta backoffice, upsert por DNI y bloqueo de clientes para el sistema Rochester Viandas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrador o supervisor consulta y busca clientes (Priority: P1)

El administrador o supervisor puede listar todos los clientes registrados con paginación, buscar por DNI, nombre o apellido, filtrar por estado activo/bloqueado, y ordenar por apellido, nombre o fecha de última operación.

**Why this priority**: La consulta de clientes es la funcionalidad primaria del back office de este módulo. Sin ella, el equipo no puede gestionar ni auditar la base de clientes del tenant.

**Independent Test**: `GET /admin/clientes?q=perez&activo=true` con JWT válido de administrador o supervisor devuelve clientes activos cuyo apellido o nombre contiene "perez" con paginación correcta.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado y múltiples clientes registrados, **When** lista clientes con `q=lopez`, **Then** devuelve solo clientes cuyo DNI, nombre o apellido contenga "lopez".
2. **Given** clientes activos y bloqueados, **When** filtra por `activo=false`, **Then** solo aparecen los clientes bloqueados.
3. **Given** más de 20 clientes, **When** solicita `page=2&limit=10&sort=apellido`, **Then** devuelve la segunda página con hasta 10 resultados ordenados por apellido ascendente.
4. **Given** un supervisor autenticado, **When** lista clientes, **Then** la operación es exitosa con el mismo resultado que para administrador.
5. **Given** un JWT de rol `operador_caja`, **When** intenta acceder a `/admin/clientes`, **Then** recibe error de autorización.

---

### User Story 2 - Consultar detalle de un cliente (Priority: P1)

El administrador o supervisor puede ver el detalle completo de un cliente: datos personales, fechas de primera y última operación, y estado activo/bloqueado.

**Why this priority**: Complementa el listado; sin detalle no se puede tomar ninguna acción informada sobre el cliente.

**Independent Test**: `GET /admin/clientes/:id` con JWT válido devuelve todos los campos del cliente. Consultar un ID inexistente devuelve 404. Consultar un cliente de otro tenant devuelve 404.

**Acceptance Scenarios**:

1. **Given** un cliente existente, **When** el administrador consulta su detalle por ID, **Then** recibe todos los campos: DNI, nombre, apellido, teléfono, email, fecha_primera_operacion, fecha_ultima_operacion, activo.
2. **Given** un ID de cliente que no pertenece al tenant del solicitante, **When** se consulta el detalle, **Then** la respuesta es "no encontrado".
3. **Given** un ID inexistente, **When** se consulta el detalle, **Then** la respuesta es "no encontrado".

---

### User Story 3 - Pedido registrado crea o actualiza cliente automáticamente (Priority: P1)

Cuando el módulo de pedidos registra un nuevo pedido, el sistema crea automáticamente el cliente si no existe, o actualiza sus datos si ya fue registrado anteriormente. Este proceso es interno y no requiere intervención del operador.

**Why this priority**: Es la única vía de ingreso de clientes al sistema en MVP. Sin este mecanismo no existiría ningún registro de cliente.

**Independent Test**: Llamar a `upsertByDni` con un DNI nuevo crea el cliente con `fecha_primera_operacion` = hoy y lo retorna. Llamar con el mismo DNI nuevamente actualiza nombre/apellido/teléfono/email y `fecha_ultima_operacion` pero mantiene `fecha_primera_operacion` sin cambios.

**Acceptance Scenarios**:

1. **Given** no existe cliente con DNI "12345678" en el tenant, **When** se registra un pedido con ese DNI, **Then** se crea el cliente con `fecha_primera_operacion` y `fecha_ultima_operacion` iguales a hoy.
2. **Given** ya existe un cliente con DNI "12345678", **When** se registra un segundo pedido con ese DNI y datos actualizados, **Then** se actualizan nombre/apellido/teléfono/email y `fecha_ultima_operacion`; `fecha_primera_operacion` no cambia.
3. **Given** ya existe cliente con DNI "12345678" y teléfono registrado, **When** el upsert llega sin teléfono (null/undefined), **Then** el teléfono existente no se sobrescribe.
4. **Given** el mismo DNI en dos tenants diferentes, **When** ambos tenants registran pedidos con ese DNI, **Then** se crean dos clientes independientes sin conflicto.

---

### User Story 4 - Administrador bloquea un cliente (Priority: P2)

El administrador puede bloquear un cliente activo para impedir futuros pedidos. La operación queda registrada en el log de auditoría.

**Why this priority**: Control operativo necesario para situaciones de fraude o incumplimiento de pago. Sin bloqueo no hay mecanismo de exclusión.

**Independent Test**: `PATCH /admin/clientes/:id/bloquear` con JWT de administrador desactiva el cliente (`activo=false`) y genera entrada de auditoría. Intentar bloquear un cliente ya bloqueado devuelve error de estado.

**Acceptance Scenarios**:

1. **Given** un cliente activo, **When** el administrador lo bloquea, **Then** `activo` pasa a `false` y se registra la acción en auditoría.
2. **Given** un cliente ya bloqueado, **When** el administrador intenta bloquearlo de nuevo, **Then** la operación falla con error indicando que ya está bloqueado.
3. **Given** un usuario con rol `supervisor`, **When** intenta bloquear un cliente, **Then** recibe error de autorización.

---

### User Story 5 - Administrador desbloquea un cliente (Priority: P2)

El administrador puede desbloquear un cliente bloqueado para rehabilitar su acceso a nuevos pedidos. La operación queda registrada en el log de auditoría.

**Why this priority**: Complemento obligatorio del bloqueo; sin desbloqueo la operación sería irreversible.

**Independent Test**: `PATCH /admin/clientes/:id/desbloquear` con JWT de administrador activa el cliente (`activo=true`) y genera entrada de auditoría. Intentar desbloquear un cliente ya activo devuelve error de estado.

**Acceptance Scenarios**:

1. **Given** un cliente bloqueado, **When** el administrador lo desbloquea, **Then** `activo` pasa a `true` y se registra la acción en auditoría.
2. **Given** un cliente ya activo, **When** el administrador intenta desbloquearlo, **Then** la operación falla con error indicando que ya está activo.
3. **Given** un usuario con rol `supervisor`, **When** intenta desbloquear un cliente, **Then** recibe error de autorización.

---

### Edge Cases

- ¿Qué pasa si se hace upsert con un DNI ya registrado como eliminado lógicamente (si existiera)? → No aplica: los clientes no tienen soft delete operativo; se bloquean, no se eliminan.
- ¿Qué pasa si dos pedidos llegan simultáneamente con el mismo DNI y tenant en el mismo instante? → La creación debe ser idempotente mediante el índice único (tenant_id, dni); el segundo upsert actualiza, no duplica.
- ¿Qué pasa si se consulta un cliente por ID de otro tenant? → Se devuelve "no encontrado" (tenant scope aplicado; nunca se filtra por ID solo).
- ¿Qué pasa si el campo teléfono o email llega como cadena vacía en el upsert? → Se trata como "no informado" y no se sobrescribe el valor existente.
- ¿Qué pasa si un cliente bloqueado aparece en el listado cuando se filtra por `activo=true`? → No aparece; el filtro es estricto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE listar clientes del back office con paginación, búsqueda por DNI/nombre/apellido, filtro por `activo`, y ordenamiento por apellido, nombre o fecha_ultima_operacion.
- **FR-002**: El sistema DEBE devolver el detalle completo de un cliente por ID, aplicando scope de tenant.
- **FR-003**: El sistema DEBE impedir el acceso a los endpoints de back office a usuarios sin JWT válido.
- **FR-004**: Los endpoints de listado y detalle DEBEN estar disponibles para los roles `administrador` y `supervisor`.
- **FR-005**: El sistema DEBE crear automáticamente un nuevo cliente cuando se recibe un upsert con un DNI no registrado en el tenant, asignando `fecha_primera_operacion` y `fecha_ultima_operacion` con la fecha actual.
- **FR-006**: El sistema DEBE actualizar datos (nombre, apellido, teléfono, email) y `fecha_ultima_operacion` de un cliente existente al recibir un upsert con su DNI, sin modificar `fecha_primera_operacion`.
- **FR-007**: El sistema NO DEBE sobrescribir campos opcionales (teléfono, email) con null o cadena vacía durante el upsert; solo actualiza si el valor informado es no nulo y no vacío.
- **FR-008**: El sistema DEBE garantizar unicidad de la combinación (tenant_id, dni) para clientes no eliminados.
- **FR-009**: El sistema DEBE permitir bloquear un cliente activo (poner `activo=false`) solo al rol `administrador`.
- **FR-010**: El sistema DEBE impedir bloquear un cliente que ya está bloqueado, devolviendo error de estado.
- **FR-011**: El sistema DEBE permitir desbloquear un cliente bloqueado (poner `activo=true`) solo al rol `administrador`.
- **FR-012**: El sistema DEBE impedir desbloquear un cliente que ya está activo, devolviendo error de estado.
- **FR-013**: El sistema DEBE registrar una entrada de auditoría para las operaciones de bloqueo y desbloqueo de clientes.
- **FR-014**: El servicio `ClientesService` DEBE ser exportable para su uso por el módulo `pedidos` en Stage 3.
- **FR-015**: El sistema NO DEBE exponer endpoints de creación manual de clientes ni de eliminación.

### Key Entities

- **Cliente**: Persona que realiza encargos en el sistema. Identificado dentro del tenant por su DNI. Atributos clave: DNI (único por tenant), nombre, apellido, teléfono (opcional), email (opcional), fecha de primera operación (inmutable tras creación), fecha de última operación (actualizada en cada pedido), estado activo/bloqueado. Soporta bloqueo pero no eliminación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede localizar a cualquier cliente buscando por DNI, nombre o apellido en menos de 3 operaciones desde el back office.
- **SC-002**: El registro automático de un cliente nuevo en el sistema ocurre de forma transparente en cada pedido, sin intervención manual del operador, el 100% de las veces.
- **SC-003**: El upsert no genera duplicados: intentar registrar el mismo DNI en el mismo tenant dos veces resulta en un único registro actualizado, el 100% de las veces.
- **SC-004**: `fecha_primera_operacion` permanece invariante después de cualquier número de upserts sobre el mismo cliente.
- **SC-005**: Las operaciones de bloqueo y desbloqueo quedan registradas en el log de auditoría sin excepción.
- **SC-006**: Un intento de acceso a endpoints de clientes con rol insuficiente es rechazado el 100% de las veces.

## Assumptions

- Los usuarios del back office ya están autenticados con JWT válido emitido por el sistema de autenticación del template.
- La resolución del tenant se maneja automáticamente por el middleware de tenancy del template; `ClientesService` recibe `tenant_id` ya resuelto.
- En MVP, la validación de que un cliente bloqueado no puede hacer pedidos es informativa — la restricción efectiva se implementa en el módulo `pedidos` (Stage 3).
- No existe portal público para clientes: no se listan ni se exponen datos de clientes a usuarios no autenticados.
- No hay endpoint de creación manual de clientes desde el back office; la única vía de ingreso es el upsert desde pedidos.
- Los clientes no se eliminan del sistema; el ciclo de vida es crear → (actualizar datos) → bloquear → desbloquear.
- Los campos teléfono y email son de contacto informativo; no se valida formato en MVP más allá de longitud máxima.
- No hay límite de clientes por tenant más allá de la capacidad de la base de datos.
- La búsqueda en listado es case-insensitive para nombre, apellido y DNI.
