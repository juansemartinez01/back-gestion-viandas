# Feature Specification: Módulo Categorías de Menú

**Feature Branch**: `003-categorias-menu-crud`

**Created**: 2026-06-06

**Status**: Draft

**Input**: Módulo de gestión de categorías para clasificar menús en el sistema Gestión de Viandas Rochester.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Administrador crea y gestiona categorías (Priority: P1)

El administrador necesita organizar la oferta de viandas en categorías reconocibles (Saludable, Clásico, Vegetariano, etc.) para que los clientes puedan identificar el tipo de comida y para que el portal público los filtre correctamente. Sin categorías activas, los nuevos menús no pueden ser clasificados.

**Why this priority**: Es el flujo base sin el cual el módulo no entrega ningún valor. Las demás historias dependen de que existan categorías creadas y activas.

**Independent Test**: Se puede probar creando una categoría "Vegetariano" como administrador autenticado y verificando que aparece en el listado del back office.

**Acceptance Scenarios**:

1. **Given** un usuario con rol `administrador` autenticado, **When** envía `POST /admin/categorias-menu` con nombre "Saludable" y descripción opcional, **Then** la categoría es creada con `activa = true` y el sistema registra un evento de auditoría.
2. **Given** una categoría existente, **When** el administrador envía `PATCH /admin/categorias-menu/:id` con un nuevo nombre, **Then** los datos son actualizados y se registra un evento de auditoría.
3. **Given** un nombre ya existente en el mismo tenant, **When** el administrador intenta crear otra categoría con ese mismo nombre, **Then** el sistema devuelve un error de conflicto (nombre duplicado) y no crea la categoría.
4. **Given** un usuario con rol `supervisor`, **When** intenta crear o editar una categoría, **Then** el sistema devuelve un error de permisos insuficientes.

---

### User Story 2 — Administrador activa o inactiva categorías (Priority: P2)

El administrador puede gestionar el ciclo de vida de una categoría: activarla o inactivarla sin eliminarla, para preservar la trazabilidad histórica de los menús que la usaron.

**Why this priority**: La activación/inactivación es el mecanismo de control que determina qué categorías están disponibles para nuevos menús y cuáles se muestran en el portal público.

**Independent Test**: Se puede probar inactivando una categoría activa y verificando que ya no aparece en el endpoint público.

**Acceptance Scenarios**:

1. **Given** una categoría activa, **When** el administrador llama `PATCH /admin/categorias-menu/:id/inactivar`, **Then** la categoría pasa a `activa = false` y se registra auditoría.
2. **Given** una categoría inactiva, **When** el administrador llama `PATCH /admin/categorias-menu/:id/activar`, **Then** la categoría pasa a `activa = true` y se registra auditoría.
3. **Given** una categoría activa asociada a uno o más menús base activos, **When** el administrador intenta inactivarla, **Then** el sistema emite una advertencia informativa indicando la asociación existente, pero permite la acción (validación informativa en MVP).

---

### User Story 3 — Administrador elimina (soft delete) categorías (Priority: P3)

El administrador puede eliminar lógicamente una categoría que ya no se usará, siempre y cuando esté inactiva, para mantener limpio el catálogo sin perder registros históricos.

**Why this priority**: El soft delete es una operación de mantenimiento de bajo uso. Requiere que la categoría esté previamente inactivada como precondición.

**Independent Test**: Se puede probar intentando eliminar una categoría activa (debe fallar) y luego inactivarla y eliminarla (debe tener éxito).

**Acceptance Scenarios**:

1. **Given** una categoría inactiva, **When** el administrador llama `DELETE /admin/categorias-menu/:id`, **Then** la categoría queda marcada con `deleted_at` y se registra auditoría.
2. **Given** una categoría activa, **When** el administrador intenta eliminarla, **Then** el sistema devuelve un error de regla de negocio indicando que debe inactivarse primero.

---

### User Story 4 — Portal público lista categorías activas (Priority: P2)

El portal público (sin autenticación) consulta las categorías activas del tenant para mostrarlas al cliente final como filtros o agrupadores de la oferta disponible de viandas.

**Why this priority**: Es el consumidor final de este módulo. Sin este endpoint, el portal no puede mostrar la clasificación de menús al cliente.

**Independent Test**: Se puede probar llamando `GET /public/categorias-menu` con el header `x-tenant-key` y verificando que retorna solo categorías activas ordenadas por `orden_visualizacion` ASC.

**Acceptance Scenarios**:

1. **Given** un tenant con categorías activas e inactivas, **When** el portal llama `GET /public/categorias-menu` con el header `x-tenant-key` correcto, **Then** el sistema retorna únicamente las categorías activas, ordenadas por `orden_visualizacion` ASC (nulls al final), desempatadas por nombre ASC.
2. **Given** una solicitud sin el header `x-tenant-key`, **When** el portal llama al endpoint público, **Then** el sistema devuelve un error de tenant no resuelto.

---

### User Story 5 — Administrador y supervisor consultan el listado y detalle (Priority: P1)

El administrador y el supervisor necesitan visualizar todas las categorías (activas e inactivas) con capacidad de búsqueda, filtrado y ordenamiento para gestionar el catálogo desde el back office.

**Why this priority**: Sin listado, no es posible seleccionar categorías para crear ni gestionar su estado.

**Independent Test**: Se puede probar llamando `GET /admin/categorias-menu` con parámetros de paginación y verificando que retorna resultados paginados con metadatos de total.

**Acceptance Scenarios**:

1. **Given** un usuario con rol `administrador` o `supervisor` autenticado, **When** llama `GET /admin/categorias-menu`, **Then** recibe un listado paginado con soporte para `search` (por nombre), filtro `activa` y ordenamiento por `nombre` y `orden_visualizacion`.
2. **Given** un usuario autenticado, **When** llama `GET /admin/categorias-menu/:id` con un ID existente, **Then** recibe el detalle completo de esa categoría.
3. **Given** un ID que no existe en el tenant, **When** el usuario llama `GET /admin/categorias-menu/:id`, **Then** el sistema devuelve un error 404.

---

### Edge Cases

- ¿Qué ocurre si se intenta crear una categoría con nombre en blanco o con solo espacios? → El sistema rechaza la solicitud con error de validación.
- ¿Qué ocurre si `orden_visualizacion` se omite? → Se almacena como `null` y en el listado público se ubica al final (NULLS LAST).
- ¿Qué ocurre si se intenta acceder a una categoría soft-deleted desde el back office? → El sistema devuelve 404 (TypeORM soft delete excluye los registros automáticamente).
- ¿Qué ocurre si el tenant no tiene categorías activas? → El endpoint público retorna un array vacío con `ok: true`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a usuarios con rol `administrador` crear categorías con los campos: nombre (requerido, máx. 100 caracteres), descripción (opcional, máx. 300 caracteres), orden_visualizacion (entero opcional).
- **FR-002**: El sistema DEBE garantizar unicidad de nombre por tenant: dos categorías del mismo tenant no pueden tener el mismo nombre (insensible a mayúsculas/minúsculas).
- **FR-003**: El sistema DEBE crear categorías con `activa = true` por defecto.
- **FR-004**: El sistema DEBE permitir a usuarios con rol `administrador` editar nombre, descripción y orden_visualizacion de una categoría existente.
- **FR-005**: El sistema DEBE permitir activar o inactivar una categoría independientemente mediante endpoints dedicados (`/activar`, `/inactivar`), registrando auditoría en cada caso.
- **FR-006**: El sistema DEBE permitir el soft delete de una categoría **únicamente si está inactiva**; si está activa, la operación DEBE ser rechazada con un error de regla de negocio.
- **FR-007**: El sistema DEBE listar categorías en el back office con paginación, búsqueda por nombre (parcial, insensible a mayúsculas), filtro por campo `activa` y ordenamiento configurable por `nombre` y `orden_visualizacion`.
- **FR-008**: El sistema DEBE exponer un endpoint público (sin autenticación) que retorne solo categorías activas del tenant resuelto por `x-tenant-key`, ordenadas por `orden_visualizacion` ASC NULLS LAST, desempatadas por `nombre` ASC.
- **FR-009**: El sistema DEBE registrar un evento de auditoría en cada operación de escritura: crear, editar, activar, inactivar, eliminar.
- **FR-010**: Los endpoints del back office DEBEN estar protegidos con `JwtAuthGuard`; los roles `administrador` y `supervisor` acceden a lectura; solo `administrador` puede realizar operaciones de escritura.
- **FR-011**: El sistema DEBE emitir una advertencia informativa (no bloqueante en MVP) cuando se intente inactivar una categoría que tenga menús base activos asociados.
- **FR-012**: Todas las operaciones DEBEN estar acotadas al `tenant_id` del usuario autenticado; no es posible acceder a categorías de otro tenant.

### Key Entities

- **CategoriaMenu**: Representa una clasificación temática de menús de viandas. Atributos clave: `id` (UUID), `nombre` (varchar 100), `descripcion` (varchar 300, nullable), `activa` (boolean, default true), `orden_visualizacion` (integer, nullable), `tenant_id` (UUID, requerido), `created_at`, `updated_at`, `deleted_at` (soft delete). Unicidad compuesta: `(tenant_id, nombre)`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede crear, editar, activar, inactivar y eliminar una categoría en menos de 2 minutos desde el back office.
- **SC-002**: El portal público recibe el listado de categorías activas del tenant en menos de 500 ms bajo carga normal.
- **SC-003**: El 100% de las operaciones de escritura genera una entrada de auditoría trazable; ninguna mutación queda sin registro.
- **SC-004**: Los datos de un tenant no son accesibles desde otro tenant en ningún endpoint (0 violaciones de aislamiento multitenant en revisión de seguridad).
- **SC-005**: El listado del back office soporta al menos 1000 categorías por tenant sin degradación perceptible en la respuesta.
- **SC-006**: Las validaciones de negocio (nombre duplicado, soft delete solo si inactiva) son rechazadas con mensajes de error claros y accionables en el 100% de los casos.

## Assumptions

- El módulo sigue el mismo patrón de implementación que `sedes` y `puntos-retiro` (Type A — CRUD tenant-safe simple), usando `BaseCrudTenantService` y `BaseCrudController`.
- La validación de menús base activos al inactivar una categoría es **informativa en MVP**: el sistema emite advertencia pero no bloquea la operación. El bloqueo se implementará cuando el módulo `menus-base` esté completo (Stage 2).
- El campo `orden_visualizacion` es de uso libre; no hay restricciones de unicidad sobre él. Si dos categorías tienen el mismo valor, el desempate es por `nombre` ASC.
- El listado público no requiere paginación; se asume que el número de categorías activas por tenant será manejable (< 50) en el horizonte del MVP.
- El tenant se resuelve en endpoints públicos exclusivamente desde el header `x-tenant-key`; no se acepta resolución por subdominio ni parámetro de query.
- La comparación de unicidad de nombre se hará de forma insensible a mayúsculas/minúsculas (ILIKE o normalización en PostgreSQL).
- No se requiere imagen ni icono para las categorías en el MVP.
- El campo `descripcion` es libre y no requiere validación semántica más allá de la longitud máxima.
