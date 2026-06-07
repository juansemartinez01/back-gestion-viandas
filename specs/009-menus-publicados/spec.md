# Feature Specification: Menús Publicados

**Feature Branch**: `009-menus-publicados`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "Módulo menus-publicados — gestión y publicación de menús disponibles para clientes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un menú publicado (Priority: P1)

Un administrador o supervisor necesita publicar la disponibilidad de un menú base para una fecha concreta, indicando sede, puntos de retiro, precio y fechas límite de encargo. Esta acción es el punto de entrada para que los clientes puedan realizar encargos.

**Why this priority**: Sin menús publicados no existe oferta visible para el cliente ni flujo de encargos. Es el núcleo del módulo y prerequisito de todo lo demás.

**Independent Test**: Se puede probar creando un menú publicado completo y verificando que aparece correctamente en el listado del back office con todos sus datos.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado con un menú base activo, una sede activa y al menos un punto de retiro activo perteneciente a esa sede, **When** completa el formulario de creación con fecha de venta futura, precio mayor a cero y fecha límite de encargo anterior o igual a la fecha de venta, **Then** el menú publicado queda registrado en estado "activo" y aparece en el listado del back office.
2. **Given** un administrador intenta crear un menú publicado sin puntos de retiro, **When** envía el formulario, **Then** el sistema rechaza la operación con un mensaje claro indicando que se requiere al menos un punto de retiro.
3. **Given** un administrador intenta crear un menú publicado con fecha límite de encargo posterior a la fecha de venta, **When** envía el formulario, **Then** el sistema rechaza la operación con un mensaje de validación.
4. **Given** un administrador intenta crear un menú publicado con precio de encargo igual a cero o negativo, **When** envía el formulario, **Then** el sistema rechaza la operación con un mensaje de validación.
5. **Given** un administrador intenta asociar un punto de retiro de una sede diferente a la indicada, **When** envía el formulario, **Then** el sistema rechaza la operación indicando que los puntos de retiro no corresponden a la sede seleccionada.
6. **Given** un supervisor autenticado, **When** crea un menú publicado válido, **Then** la operación es exitosa y queda registrada en el historial de auditoría.

---

### User Story 2 - Consultar menús disponibles desde el portal público (Priority: P2)

Un cliente visita el portal público para ver qué menús están disponibles para encargar. El portal muestra únicamente menús activos para el día actual o fechas próximas, con toda la información del menú base incorporada.

**Why this priority**: Es la cara visible del sistema para el cliente final. Si el portal no muestra los menús correctamente, el negocio no puede recibir encargos.

**Independent Test**: Se puede probar consultando el portal con una sede válida y verificando que únicamente aparecen menús activos con fechas presentes o futuras, con información completa del menú base.

**Acceptance Scenarios**:

1. **Given** un cliente accede al portal con el identificador de tenant y una sede válida, **When** consulta los menús disponibles, **Then** recibe la lista de menús publicados activos para hoy y fechas futuras próximas, incluyendo nombre, imagen, categorías, etiquetas, alérgenos e información nutricional del menú base.
2. **Given** un cliente filtra por punto de retiro específico, **When** realiza la consulta, **Then** el portal devuelve únicamente los menús disponibles en ese punto de retiro.
3. **Given** un menú publicado está en estado "pausado", "cerrado", "agotado" o "cancelado", **When** un cliente consulta el portal, **Then** ese menú NO aparece en los resultados.
4. **Given** un cliente accede sin un identificador de tenant válido, **When** realiza la consulta, **Then** el sistema rechaza la solicitud con un error de acceso.
5. **Given** no hay menús activos para la sede consultada, **When** el cliente consulta el portal, **Then** recibe una respuesta vacía sin error.

---

### User Story 3 - Gestionar el ciclo de vida del menú publicado (Priority: P3)

Un administrador o supervisor necesita cambiar el estado de un menú publicado durante su ciclo de vida: pausarlo temporalmente, cerrarlo al encargo, marcarlo como agotado, cancelarlo o reactivarlo desde pausa.

**Why this priority**: El control del estado es fundamental para la operación diaria. Un menú puede agotarse, necesitar pausarse por imprevistos o cerrarse antes de tiempo.

**Independent Test**: Se puede probar ejecutando cada transición de estado válida en secuencia y verificando que las transiciones inválidas son rechazadas.

**Acceptance Scenarios**:

1. **Given** un menú publicado en estado "activo", **When** un supervisor lo pausa, **Then** el estado cambia a "pausado", deja de aparecer en el portal público y la acción queda en auditoría.
2. **Given** un menú publicado en estado "pausado", **When** un supervisor lo reactiva, **Then** el estado vuelve a "activo" y vuelve a aparecer en el portal público.
3. **Given** un menú publicado en estado "activo", **When** un supervisor lo cierra, **Then** el estado cambia a "cerrado" y no acepta nuevos encargos.
4. **Given** un menú publicado en estado "activo", **When** un supervisor lo marca como agotado, **Then** el estado cambia a "agotado" y no acepta nuevos encargos.
5. **Given** un menú publicado en estado "cerrado" o "agotado", **When** un administrador lo cancela, **Then** el estado cambia a "cancelado".
6. **Given** un menú publicado en estado "cancelado", **When** cualquier usuario intenta cambiar su estado, **Then** el sistema rechaza la operación indicando que no hay transiciones posibles desde "cancelado".
7. **Given** un supervisor intenta cancelar un menú en estado "cerrado" o "agotado", **When** envía la solicitud, **Then** el sistema rechaza la operación (solo administrador puede realizar esa transición).

---

### User Story 4 - Listar y filtrar menús publicados en el back office (Priority: P4)

Un administrador o supervisor necesita consultar el listado de menús publicados con paginación y filtros para gestionar la operación diaria.

**Why this priority**: La visibilidad operacional del equipo depende de poder encontrar y revisar rápidamente los menús publicados.

**Independent Test**: Se puede probar consultando el listado con distintas combinaciones de filtros y verificando que los resultados son los esperados.

**Acceptance Scenarios**:

1. **Given** un administrador accede al listado de menús publicados, **When** aplica filtro por fecha de venta, **Then** solo aparecen los menús publicados para esa fecha.
2. **Given** un administrador aplica filtro por sede, **When** consulta el listado, **Then** solo aparecen los menús de esa sede.
3. **Given** un administrador aplica filtro por estado, **When** consulta el listado, **Then** solo aparecen los menús con ese estado.
4. **Given** un administrador aplica filtro por menú base, **When** consulta el listado, **Then** solo aparecen los menús publicados de ese menú base.
5. **Given** hay más de una página de resultados, **When** el usuario navega por páginas, **Then** los resultados están correctamente paginados sin duplicados.

---

### User Story 5 - Editar un menú publicado (Priority: P5)

Un administrador necesita modificar los datos de un menú publicado existente: cambiar precios, fechas límite, puntos de retiro, imagen u observaciones.

**Why this priority**: Los datos operativos pueden cambiar (precio, puntos de retiro habilitados, imagen) y el administrador necesita poder corregirlos.

**Independent Test**: Se puede probar editando uno o varios campos de un menú publicado existente y verificando que los cambios se reflejan correctamente.

**Acceptance Scenarios**:

1. **Given** un administrador edita los puntos de retiro de un menú publicado, **When** guarda los cambios con al menos un punto válido, **Then** los nuevos puntos de retiro quedan asociados correctamente.
2. **Given** un administrador intenta actualizar los puntos de retiro dejando la lista vacía, **When** guarda, **Then** el sistema rechaza la operación.
3. **Given** un supervisor intenta editar los datos de un menú publicado, **When** envía la solicitud, **Then** el sistema rechaza la operación (edición restringida a administrador).
4. **Given** un administrador edita el precio de encargo, **When** guarda el valor actualizado mayor a cero, **Then** el cambio queda registrado y la auditoría refleja la modificación.

---

### User Story 6 - Eliminar (soft delete) un menú publicado cancelado (Priority: P6)

Un administrador necesita eliminar de la vista operativa un menú publicado que ya fue cancelado.

**Why this priority**: La limpieza de registros cancelados mejora la legibilidad del listado, aunque es una operación de baja urgencia frente al ciclo de vida del menú.

**Independent Test**: Se puede probar ejecutando el soft delete sobre un menú cancelado y verificando que desaparece del listado operativo pero sigue recuperable para auditoría.

**Acceptance Scenarios**:

1. **Given** un menú publicado en estado "cancelado", **When** un administrador lo elimina, **Then** el registro queda marcado como eliminado y deja de aparecer en listados normales.
2. **Given** un menú publicado en cualquier estado distinto de "cancelado", **When** un administrador intenta eliminarlo, **Then** el sistema rechaza la operación indicando que solo los menús cancelados pueden eliminarse.
3. **Given** un supervisor intenta eliminar un menú cancelado, **When** envía la solicitud, **Then** el sistema rechaza la operación (solo administrador puede eliminar).

---

### Edge Cases

- ¿Qué pasa si el menú base asociado es desactivado después de que el menú publicado ya está activo? El menú publicado permanece en su estado actual; la validación del menú base activo aplica solo al momento de crear.
- ¿Qué pasa si un punto de retiro es desactivado y estaba asociado a un menú publicado activo? El menú publicado permanece asociado; la validación aplica al momento de crear o editar.
- ¿Qué pasa si se intenta publicar el mismo menú base para la misma fecha y sede dos veces? El sistema lo permite (puede haber motivos operativos); no hay restricción de unicidad compuesta explícita.
- ¿Qué pasa si `tipo_sobreproduccion` se especifica pero `valor_sobreproduccion` no, o viceversa? El sistema exige que ambos campos estén presentes cuando se usa sobreproducción, o que ambos sean omitidos.
- ¿Qué pasa si la consulta pública se realiza sin el header de tenant? El sistema devuelve un error de acceso claro sin exponer datos de ningún tenant.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a administradores y supervisores crear menús publicados asociando un menú base activo, una sede activa, fecha de venta, precio de encargo y al menos un punto de retiro activo perteneciente a esa sede.
- **FR-002**: El sistema DEBE validar que el precio de encargo sea mayor a cero al crear o editar un menú publicado.
- **FR-003**: El sistema DEBE validar que la fecha/hora límite de encargo sea anterior o igual a la fecha de venta.
- **FR-004**: El sistema DEBE validar que todos los puntos de retiro asociados pertenezcan a la sede indicada en el menú publicado y estén activos al momento de crear o editar.
- **FR-005**: El sistema DEBE validar que el menú base y la sede estén activos en el momento de crear el menú publicado.
- **FR-006**: El sistema DEBE asignar estado "activo" por defecto al crear un nuevo menú publicado.
- **FR-007**: El sistema DEBE permitir a administradores y supervisores listar menús publicados con paginación y filtros por fecha de venta, sede, estado y menú base.
- **FR-008**: El sistema DEBE permitir a administradores y supervisores consultar el detalle completo de un menú publicado, incluyendo sus puntos de retiro y datos del menú base.
- **FR-009**: El sistema DEBE permitir únicamente a administradores editar los campos y puntos de retiro de un menú publicado.
- **FR-010**: El sistema DEBE aplicar las siguientes transiciones de estado válidas:
  - activo → pausado, cerrado, agotado, cancelado (administrador y supervisor)
  - pausado → activo (reactivar), cerrado, cancelado (administrador y supervisor)
  - cerrado → cancelado (solo administrador)
  - agotado → cancelado (solo administrador)
  - cancelado → sin transición posible
- **FR-011**: El sistema DEBE rechazar cualquier transición de estado no definida en FR-010 con un mensaje de error claro.
- **FR-012**: El sistema DEBE permitir únicamente a administradores realizar el soft delete de un menú publicado, y solo cuando su estado sea "cancelado".
- **FR-013**: El portal público DEBE exponer únicamente menús publicados en estado "activo" para la fecha actual o fechas futuras próximas, filtrados por sede y opcionalmente por punto de retiro.
- **FR-014**: La respuesta del portal público DEBE incluir los datos del menú base embebidos: nombre, imagen, categorías, etiquetas, alérgenos e información nutricional.
- **FR-015**: El portal público DEBE resolver el tenant a partir del header `x-tenant-key` antes de cualquier acceso a datos; las solicitudes sin tenant válido DEBEN ser rechazadas.
- **FR-016**: Cada una de las siguientes acciones DEBE generar un registro de auditoría: crear, editar, pausar, cerrar, agotar, cancelar, reactivar y eliminar un menú publicado.
- **FR-017**: Cuando se especifica sobreproducción, el tipo y el valor DEBEN estar ambos presentes o ambos ausentes.

### Key Entities

- **MenuPublicado**: Representa la disponibilidad concreta de un menú base para una fecha, sede y conjunto de puntos de retiro específicos, con precio y condiciones comerciales propias. Tiene su propio ciclo de vida (activo, pausado, cerrado, agotado, cancelado).
- **PuntoRetiro**: Lugar físico donde el cliente puede retirar su encargo. Un menú publicado puede estar disponible en varios puntos de retiro de la misma sede (relación muchos a muchos).
- **MenuBase**: Plantilla del menú que define nombre, descripción, imagen, categorías, etiquetas, alérgenos e información nutricional. El menú publicado lo referencia sin duplicar sus datos.
- **Sede**: Unidad organizacional (sucursal) a la que pertenecen tanto el menú publicado como sus puntos de retiro. Todos los puntos de retiro de un menú publicado deben pertenecer a su misma sede.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador o supervisor puede crear un menú publicado completo (con puntos de retiro, precio y fechas) en menos de 3 minutos.
- **SC-002**: Los cambios de estado se reflejan en el portal público en menos de 5 segundos tras ser registrados.
- **SC-003**: El portal público nunca expone menús en estado pausado, cerrado, agotado o cancelado — tasa de filtrado incorrecto: 0%.
- **SC-004**: El 100% de las acciones auditables generan un registro de auditoría sin excepción, incluso cuando la operación principal falla y se revierte.
- **SC-005**: El listado del back office con hasta 200 menús publicados y filtros activos responde en menos de 2 segundos.
- **SC-006**: Las consultas del portal público no exponen datos de ningún tenant distinto al solicitante — tasa de fuga de datos entre tenants: 0%.
- **SC-007**: El 100% de las transiciones de estado inválidas son rechazadas con un mensaje de error comprensible para el usuario.

## Assumptions

- El menú base, la sede y los puntos de retiro son entidades ya existentes en el sistema; este módulo los consume pero no los gestiona.
- La validación del menú base y sede activos aplica únicamente al momento de creación del menú publicado; cambios posteriores en su estado no invalidan automáticamente menús ya publicados.
- Un mismo menú base puede publicarse múltiples veces para la misma fecha y sede (sin restricción de unicidad compuesta), ya que puede haber razones operativas legítimas para ello.
- El campo `imagen_public_id` / `imagen_url` del menú publicado, si se especifica, reemplaza visualmente la imagen del menú base en el portal; si se omite, se usa la imagen del menú base.
- "Fechas futuras próximas" en el portal público se interpreta como hasta 7 días calendario desde la fecha actual, como valor predeterminado de horizonte de visibilidad.
- Los permisos de acceso al back office (administrador y supervisor) ya están implementados en el sistema de autenticación existente.
- El sistema de auditoría (`AuditService`) ya existe y está disponible para ser invocado desde este módulo.
- La información nutricional del menú base se incorpora en la respuesta del portal como parte de los datos del menú base, sin transformación adicional.
- El módulo exporta su servicio principal para ser consumido por los módulos de pedidos y producción en etapas posteriores (Stage 3+), pero esas integraciones están fuera del alcance de esta especificación.
