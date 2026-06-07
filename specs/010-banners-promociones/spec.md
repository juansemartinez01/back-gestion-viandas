# Feature Specification: Banners y Promociones

**Feature Branch**: `010-banners-promociones`

**Created**: 2026-06-07

**Status**: Draft

**Input**: Módulo banners-promociones — gestión de banners y promociones informativos para la landing del portal público (Gestión de Viandas Rochester).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrador gestiona banners desde el back office (Priority: P1)

El administrador del sistema necesita crear, editar, activar, inactivar y eliminar banners que se mostrarán en la landing del portal público. Puede controlar cuándo se muestran los banners mediante fechas de inicio y fin, y en qué orden aparecen mediante un campo de posición.

**Why this priority**: Es el flujo principal del módulo — sin la capacidad de gestionar banners, no hay contenido que mostrar en el portal. Todo lo demás depende de que los banners existan y estén bien configurados.

**Independent Test**: Se puede probar completamente creando un banner con título, descripción e imagen, verificando que aparece en el listado del back office con su estado activo, y que puede ser editado e inactivado.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** crea un banner con título, descripción y fechas opcionales, **Then** el banner queda guardado con estado activo y aparece en el listado del back office.
2. **Given** un banner existente, **When** el administrador lo edita (cambia título, descripción o fechas), **Then** los cambios quedan persistidos y se registra una entrada de auditoría.
3. **Given** un banner activo, **When** el administrador lo inactiva, **Then** el banner deja de aparecer en el portal público y se registra auditoría.
4. **Given** un banner inactivo, **When** el administrador lo activa, **Then** el banner vuelve a ser visible en el portal público (según sus fechas) y se registra auditoría.
5. **Given** un banner inactivo, **When** el administrador lo elimina, **Then** el banner queda eliminado (soft delete) y se registra auditoría.
6. **Given** un banner activo, **When** el administrador intenta eliminarlo, **Then** el sistema rechaza la operación con un mensaje de error claro.

---

### User Story 2 - Visitante del portal ve banners activos en la landing (Priority: P1)

Un visitante del portal público (cliente o potencial cliente) accede a la landing del tenant y ve los banners informativos activos, mostrados en el orden configurado por el administrador.

**Why this priority**: Es la razón de ser del módulo — el valor del negocio está en que los clientes vean la comunicación de la administración en la landing.

**Independent Test**: Se puede probar accediendo al endpoint público con el header `x-tenant-key` del tenant y verificando que solo se muestran banners activos y dentro de rango de fechas, ordenados correctamente.

**Acceptance Scenarios**:

1. **Given** un tenant con banners activos, **When** un visitante consulta los banners públicos del portal, **Then** recibe la lista de banners activos ordenados por posición (ascendente), con desempate por fecha de creación (más reciente primero).
2. **Given** un banner activo con fecha_inicio futura, **When** un visitante consulta los banners públicos, **Then** ese banner no aparece en la respuesta.
3. **Given** un banner activo con fecha_fin pasada, **When** un visitante consulta los banners públicos, **Then** ese banner no aparece en la respuesta.
4. **Given** un banner activo sin fechas definidas, **When** un visitante consulta los banners públicos, **Then** ese banner siempre aparece en la respuesta mientras esté activo.
5. **Given** un banner inactivo, **When** un visitante consulta los banners públicos, **Then** ese banner no aparece en la respuesta, independientemente de sus fechas.

---

### User Story 3 - Supervisor consulta banners desde el back office (Priority: P2)

Un supervisor puede consultar el listado de banners y el detalle de cada uno para tener visibilidad del contenido comunicacional activo, pero no puede crear, editar ni eliminar.

**Why this priority**: El supervisor necesita visibilidad operativa del contenido del portal, pero sin acceso de modificación.

**Independent Test**: Se puede probar autenticando como supervisor y verificando que el listado y el detalle son accesibles, pero los endpoints de creación, edición y eliminación devuelven error de permisos.

**Acceptance Scenarios**:

1. **Given** un supervisor autenticado, **When** consulta el listado de banners con filtros (activo/inactivo, paginación), **Then** obtiene la lista correcta con los datos de cada banner.
2. **Given** un supervisor autenticado, **When** consulta el detalle de un banner por ID, **Then** obtiene todos los datos del banner.
3. **Given** un supervisor autenticado, **When** intenta crear, editar o eliminar un banner, **Then** el sistema rechaza la operación con error de permisos insuficientes.

---

### Edge Cases

- ¿Qué ocurre cuando fecha_inicio es igual a fecha_fin? El banner es visible solo ese día (rango inclusive en ambos extremos).
- ¿Qué ocurre si se envía un banner sin `x-tenant-key` en el portal público? El sistema rechaza la solicitud con error de tenant no resuelto.
- ¿Qué ocurre si un tenant no tiene banners activos? El portal devuelve lista vacía (no error).
- ¿Qué pasa si fecha_inicio es posterior a fecha_fin? El sistema debe rechazar la creación/edición con validación de coherencia de fechas.
- ¿Qué ocurre al intentar eliminar un banner ya eliminado (soft deleted)? El sistema devuelve "no encontrado".
- ¿Qué pasa si orden_visualizacion tiene duplicados? Múltiples banners pueden tener el mismo orden; el desempate es por fecha de creación descendente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir al administrador crear banners con título (obligatorio), descripción, imagen, URL de destino, orden de visualización, y fechas de vigencia opcionales.
- **FR-002**: El sistema DEBE permitir al administrador editar cualquier campo de un banner existente.
- **FR-003**: El sistema DEBE permitir al administrador activar un banner inactivo, cambiando su estado a activo.
- **FR-004**: El sistema DEBE permitir al administrador inactivar un banner activo, cambiando su estado a inactivo.
- **FR-005**: El sistema DEBE permitir al administrador eliminar (soft delete) un banner, pero solo si está inactivo. Intentar eliminar un banner activo DEBE devolver un error.
- **FR-006**: El sistema DEBE listar banners en el back office con paginación, soporte de filtro por estado (activo/inactivo) y ordenamiento por posición de visualización y fecha de creación.
- **FR-007**: El sistema DEBE mostrar el detalle completo de un banner por su identificador.
- **FR-008**: El sistema DEBE registrar una entrada de auditoría en cada operación de creación, edición, activación, inactivación y eliminación de banners.
- **FR-009**: El sistema DEBE exponer un endpoint público (sin autenticación) que devuelva solo los banners activos del tenant, filtrados por rango de fechas cuando corresponda.
- **FR-010**: Los banners en el portal público DEBEN ordenarse por orden_visualizacion ascendente (los banners sin posición definida van al final), con desempate por fecha de creación descendente.
- **FR-011**: El sistema DEBE resolver el tenant en el endpoint público a partir del header `x-tenant-key`. Sin ese header, la solicitud debe ser rechazada.
- **FR-012**: La lógica de fechas DEBE funcionar así: si fecha_inicio está definida, el banner solo es visible a partir de esa fecha; si fecha_fin está definida, el banner deja de ser visible después de esa fecha. Si ninguna fecha está definida, el banner es visible siempre (mientras esté activo).
- **FR-013**: El sistema DEBE validar que fecha_inicio no sea posterior a fecha_fin cuando ambas estén definidas.
- **FR-014**: El listado del back office DEBE ser accesible tanto para el rol administrador como para el rol supervisor. Las operaciones de creación, edición, activación, inactivación y eliminación son exclusivas del rol administrador.
- **FR-015**: El sistema DEBE soportar la gestión de imagen del banner (almacenamiento en S3): guardar el identificador público de la imagen y su URL.

### Key Entities

- **Banner**: Pieza de contenido informativo/promocional que puede aparecer en la landing del portal. Tiene un título, descripción opcional, imagen opcional con enlace a recurso externo, URL de destino opcional, estado activo/inactivo, posición de visualización, y fechas de vigencia opcionales. Pertenece a un tenant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los visitantes del portal pueden ver los banners activos del tenant en menos de 2 segundos desde que cargan la landing.
- **SC-002**: El administrador puede crear un nuevo banner y verlo publicado en el portal en menos de 1 minuto.
- **SC-003**: El administrador puede activar o inactivar un banner y el cambio se refleja inmediatamente en el portal (próxima consulta).
- **SC-004**: El 100% de las operaciones de creación, edición, activación, inactivación y eliminación quedan registradas en el historial de auditoría.
- **SC-005**: El portal nunca muestra banners inactivos ni banners fuera de su rango de fechas (0% de fugas de visibilidad no autorizada).
- **SC-006**: El sistema rechaza el 100% de los intentos de eliminar banners activos con un mensaje de error claro.
- **SC-007**: Los banners aparecen en el orden configurado por el administrador en el 100% de las consultas al portal.

## Assumptions

- Las imágenes de los banners son gestionadas externamente (upload y eliminación desde el cliente o un flujo separado); este módulo solo almacena el identificador y la URL resultante provistos por el módulo de archivos del sistema.
- El endpoint público de banners no requiere paginación — se asume que el número de banners activos por tenant será suficientemente pequeño (< 50) para no necesitarla en el MVP.
- No existe un límite máximo de banners por tenant en el MVP.
- Los banners son puramente informativos — no generan descuentos, no modifican precios, ni se integran con el motor de pedidos en esta versión.
- El campo `orden_visualizacion` acepta valores duplicados; cuando dos banners tienen el mismo orden, el más recientemente creado aparece primero.
- La validación de coherencia de fechas (fecha_inicio ≤ fecha_fin) se aplica solo cuando ambas están presentes; una sola fecha definida es válida.
- Los supervisores tienen acceso de lectura completo al back office de banners pero no pueden realizar ninguna modificación.
- El módulo no depende de ningún otro módulo de negocio (pedidos, menús, clientes) y puede implementarse de forma independiente.
- El soft delete es lógico (campo deleted_at); los registros eliminados no aparecen en ningún listado.
