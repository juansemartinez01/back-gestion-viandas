# Feature Specification: Módulo Alérgenos

**Feature Branch**: `006-alergenos-crud`

**Created**: 2026-06-06

**Status**: Draft

**Input**: Gestión de alérgenos de menú — CRUD tenant-safe para el sistema Rochester Viandas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrador gestiona alérgenos (Priority: P1)

El administrador puede crear, editar y consultar alérgenos desde el back office. Esto permite mantener actualizado el catálogo de componentes sensibles disponibles para asociar a los menús.

**Why this priority**: Sin este catálogo operativo, los menús no pueden informar alérgenos al cliente. Es el prerrequisito directo para Stage 2 (menus-base).

**Independent Test**: Crear un alérgeno "Gluten", editarlo a "Gluten (trigo)", listarlo paginado, y consultarlo por ID. Crear un segundo alérgeno con el mismo nombre falla con error de duplicado. Un supervisor puede listar pero no crear.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** crea un alérgeno con nombre "Lactosa" y descripción opcional, **Then** el alérgeno queda registrado como activo y aparece en el listado.
2. **Given** un alérgeno existente, **When** el administrador lo edita cambiando el nombre, **Then** el alérgeno refleja el nuevo nombre.
3. **Given** un alérgeno con nombre "Gluten" ya registrado, **When** se intenta crear otro con el mismo nombre en el mismo tenant, **Then** la operación falla con error de duplicado.
4. **Given** un supervisor autenticado, **When** lista o consulta un alérgeno, **Then** la operación es exitosa; si intenta crear o editar, **Then** recibe error de autorización.

---

### User Story 2 - Ciclo de vida: activar e inactivar alérgenos (Priority: P2)

El administrador puede activar o inactivar un alérgeno para controlar su disponibilidad para nuevos menús y su visibilidad en el portal público.

**Why this priority**: Un alérgeno descontinuado no debe aparecer en el portal ni estar disponible para nuevos menús, pero debe conservarse para trazabilidad histórica.

**Independent Test**: Inactivar un alérgeno activo reduce su disponibilidad; activarlo la restaura. Inactivar uno ya inactivo devuelve error de estado. Activar uno ya activo devuelve error de estado.

**Acceptance Scenarios**:

1. **Given** un alérgeno activo, **When** el administrador lo inactiva, **Then** `activo` pasa a `false` y deja de aparecer en el portal público.
2. **Given** un alérgeno inactivo, **When** el administrador lo activa, **Then** `activo` pasa a `true` y vuelve a aparecer en el portal público.
3. **Given** un alérgeno ya activo, **When** se intenta activar de nuevo, **Then** la operación falla con error indicando que ya está activo.
4. **Given** un alérgeno ya inactivo, **When** se intenta inactivar de nuevo, **Then** la operación falla con error indicando que ya está inactivo.

---

### User Story 3 - Eliminar lógicamente un alérgeno (Priority: P3)

El administrador puede eliminar lógicamente un alérgeno inactivo que ya no se necesita, preservando el historial para trazabilidad.

**Why this priority**: Operación de limpieza poco frecuente; solo viable sobre alérgenos inactivos para preservar integridad referencial futura.

**Independent Test**: Intentar eliminar un alérgeno activo falla. Eliminar uno inactivo lo marca como eliminado y ya no aparece en ningún listado.

**Acceptance Scenarios**:

1. **Given** un alérgeno activo, **When** el administrador intenta eliminarlo, **Then** la operación falla indicando que debe inactivarse primero.
2. **Given** un alérgeno inactivo, **When** el administrador lo elimina, **Then** el registro queda marcado como eliminado y no aparece en listados ni en el portal.

---

### User Story 4 - Portal público lista alérgenos activos (Priority: P2)

El portal público puede obtener el listado de alérgenos activos del tenant sin autenticación, para mostrarlos en el detalle de cada menú.

**Why this priority**: La visibilidad de alérgenos es un requisito informativo crítico para el cliente final. Sin este endpoint, el portal no puede cumplir con la obligación de informar componentes sensibles.

**Independent Test**: `GET /public/alergenos` con header `x-tenant-key` válido devuelve solo alérgenos activos, ordenados por nombre A→Z. Sin el header, la petición falla.

**Acceptance Scenarios**:

1. **Given** tres alérgenos activos (Gluten, Huevo, Lactosa) y uno inactivo (Soja), **When** el portal consulta el listado público con el `x-tenant-key` correcto, **Then** recibe Gluten, Huevo, Lactosa en orden alfabético; Soja no aparece.
2. **Given** una petición pública sin `x-tenant-key`, **When** se consulta el listado, **Then** la petición falla con error de tenant requerido.

---

### User Story 5 - Listar y buscar alérgenos desde el back office (Priority: P1)

El administrador y el supervisor pueden listar todos los alérgenos con paginación, búsqueda por nombre y filtro por estado activo/inactivo.

**Why this priority**: Complementa US1 — sin listado funcional el back office no puede operar el catálogo.

**Independent Test**: `GET /admin/alergenos?q=gluten&activo=true` devuelve solo alérgenos activos cuyo nombre contiene "gluten". La paginación respeta `page` y `limit`.

**Acceptance Scenarios**:

1. **Given** múltiples alérgenos registrados, **When** se lista con `q=hue`, **Then** solo aparecen los que contienen "hue" en el nombre.
2. **Given** alérgenos activos e inactivos, **When** se filtra por `activo=false`, **Then** solo aparecen los inactivos.
3. **Given** más de 20 alérgenos, **When** se solicita `page=2&limit=10`, **Then** se devuelve la segunda página con hasta 10 resultados.

---

### Edge Cases

- ¿Qué pasa si se intenta crear un alérgeno con un nombre que ya existe pero fue eliminado lógicamente? → Se permite (el índice único excluye registros eliminados).
- ¿Qué pasa si se busca un alérgeno por ID de otro tenant? → Se devuelve "no encontrado" (tenant scope aplicado).
- ¿Qué pasa si el nombre enviado tiene espacios al inicio/final? → La unicidad se verifica sin distinguir mayúsculas/minúsculas (LOWER).
- ¿Qué pasa si se intenta inactivar un alérgeno asociado a menús base activos? → En MVP la validación es informativa; la inactivación procede de todos modos (se implementará en Stage 2).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir crear alérgenos con nombre único por tenant (excluyendo eliminados lógicamente).
- **FR-002**: El sistema DEBE impedir crear alérgenos con nombre duplicado dentro del mismo tenant (comparación sin distinción de mayúsculas/minúsculas).
- **FR-003**: El sistema DEBE permitir editar nombre y descripción de un alérgeno existente, verificando unicidad del nuevo nombre.
- **FR-004**: El sistema DEBE permitir activar un alérgeno inactivo y rechazar la operación si ya está activo.
- **FR-005**: El sistema DEBE permitir inactivar un alérgeno activo y rechazar la operación si ya está inactivo.
- **FR-006**: El sistema DEBE impedir eliminar lógicamente un alérgeno que esté activo.
- **FR-007**: El sistema DEBE permitir eliminar lógicamente un alérgeno inactivo (soft delete).
- **FR-008**: El sistema DEBE registrar una entrada de auditoría para cada operación de creación, edición, activación, inactivación y eliminación.
- **FR-009**: El sistema DEBE listar alérgenos del back office con paginación, búsqueda por nombre y filtro por estado activo/inactivo.
- **FR-010**: El portal público DEBE listar solo alérgenos activos del tenant, ordenados por nombre de forma ascendente, sin paginación.
- **FR-011**: El portal público DEBE resolver el tenant desde el header `x-tenant-key` antes de cualquier consulta.
- **FR-012**: El acceso al back office DEBE requerir autenticación con JWT. Creación, edición, activación, inactivación y eliminación requieren rol `administrador`. Listado y detalle requieren rol `administrador` o `supervisor`.

### Key Entities

- **Alergeno**: Componente sensible que puede estar presente en un menú. Atributos clave: nombre (único por tenant), descripción opcional, estado activo/inactivo. Pertenece a un tenant. Soporta eliminación lógica.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede crear, editar y consultar un alérgeno en menos de 5 operaciones desde el back office.
- **SC-002**: El portal público recibe la lista de alérgenos activos ordenada alfabéticamente en cada consulta.
- **SC-003**: Intentar crear un alérgeno con nombre duplicado es rechazado el 100% de las veces con mensaje de error claro.
- **SC-004**: El listado del back office respeta correctamente los filtros de búsqueda y estado en todas las combinaciones posibles.
- **SC-005**: Todas las operaciones sensibles (crear, editar, activar, inactivar, eliminar) quedan registradas en el log de auditoría sin excepción.

## Assumptions

- Los usuarios que acceden al back office ya están autenticados con JWT válido emitido por el sistema de autenticación existente.
- La resolución del tenant se maneja automáticamente por el middleware de tenancy del template; los módulos no necesitan implementarla.
- En MVP, la validación de que un alérgeno no está asociado a menús base activos antes de inactivarlo es solo informativa — la inactivación procede de todos modos.
- El campo `orden_visualizacion` no aplica a alérgenos; el ordenamiento es siempre por nombre alfabético.
- Los alérgenos eliminados lógicamente se conservan en base de datos para trazabilidad histórica y no son accesibles vía ningún endpoint.
- No hay límite de alérgenos por tenant más allá de la capacidad de la base de datos.
