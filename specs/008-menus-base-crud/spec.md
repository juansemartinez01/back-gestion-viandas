# Feature Specification: Módulo Menús Base

**Feature Branch**: `008-menus-base-crud`

**Created**: 2026-06-06

**Status**: Draft

**Input**: Módulo menus-base: CRUD tenant-safe con relaciones many-to-many, imagen S3, portal público.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrador crea y edita menús base (Priority: P1)

El administrador puede crear un nuevo menú base con nombre, descripción, información nutricional, imagen e imagen asociada, y asignarle categorías, etiquetas y alérgenos. También puede editar un menú base existente, actualizando cualquier campo y reemplazando completamente las relaciones.

**Why this priority**: Sin menús base no existe oferta de viandas. Es el prerrequisito directo de Stage 2 (menus-publicados) y de todo el flujo de ventas.

**Independent Test**: Crear un menú base "Milanesa con puré" con categoría "Almuerzo", etiqueta "Sin gluten" y alérgeno "Gluten" → aparece en el listado. Editarlo cambiando el nombre → refleja el nuevo nombre. Intentar crear otro con el mismo nombre en el mismo tenant → falla con error de duplicado.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** crea un menú base con nombre, categorías, etiquetas y alérgenos válidos del mismo tenant, **Then** el menú queda registrado como activo con todas las relaciones.
2. **Given** un menú base existente, **When** el administrador lo edita reemplazando las categorías, **Then** las categorías antiguas son eliminadas y las nuevas quedan asociadas.
3. **Given** un menú base con nombre "Milanesa" ya registrado en el tenant, **When** se intenta crear otro con el mismo nombre, **Then** la operación falla con error de duplicado.
4. **Given** un administrador que intenta asociar una categoría de otro tenant, **When** envía el ID de esa categoría al crear un menú, **Then** la operación falla con error de validación.
5. **Given** un administrador que intenta asociar una categoría inactiva, **When** envía el ID de esa categoría al crear un menú, **Then** la operación falla con error de validación.
6. **Given** un supervisor autenticado, **When** intenta crear o editar un menú base, **Then** recibe error de autorización.

---

### User Story 2 - Administrador y supervisor listan y consultan menús base (Priority: P1)

El administrador y el supervisor pueden listar todos los menús base con paginación, búsqueda por nombre, filtros por estado activo/inactivo, categoría, etiqueta y alérgeno, y ordenamiento. También pueden consultar el detalle completo de un menú base con todas sus relaciones.

**Why this priority**: Complementa US1 — sin listado y detalle no se puede gestionar el catálogo ni preparar la publicación de menús.

**Independent Test**: `GET /admin/menus-base?q=milane&activo=true&categoria_id=X` devuelve solo menús activos cuyo nombre contiene "milane" pertenecientes a la categoría X. `GET /admin/menus-base/:id` devuelve el menú con sus categorías, etiquetas y alérgenos.

**Acceptance Scenarios**:

1. **Given** múltiples menús base registrados, **When** se lista con `q=pollo`, **Then** solo aparecen los menús cuyo nombre contiene "pollo".
2. **Given** menús activos e inactivos, **When** se filtra por `activo=false`, **Then** solo aparecen los inactivos.
3. **Given** un menú base existente con relaciones, **When** se consulta su detalle, **Then** la respuesta incluye sus categorías, etiquetas y alérgenos completos.
4. **Given** un ID de menú de otro tenant, **When** se consulta el detalle, **Then** la respuesta es "no encontrado".
5. **Given** menús filtrados por `categoria_id=X`, **When** se lista, **Then** solo aparecen los menús asociados a esa categoría.

---

### User Story 3 - Ciclo de vida: activar e inactivar menús base (Priority: P2)

El administrador puede activar o inactivar un menú base para controlar su disponibilidad para publicación y su visibilidad en el portal público.

**Why this priority**: Controla qué menús están disponibles para publicar en una semana sin eliminarlos. Un menú inactivo no aparece en el portal ni puede publicarse.

**Independent Test**: Inactivar un menú activo → `activo=false`, deja de aparecer en portal. Inactivar uno ya inactivo devuelve error de estado. Activar uno ya activo devuelve error de estado.

**Acceptance Scenarios**:

1. **Given** un menú base activo, **When** el administrador lo inactiva, **Then** `activo` pasa a `false` y deja de aparecer en el portal público.
2. **Given** un menú base inactivo, **When** el administrador lo activa, **Then** `activo` pasa a `true` y vuelve a estar disponible para publicación.
3. **Given** un menú ya activo, **When** se intenta activar de nuevo, **Then** la operación falla con error de estado.
4. **Given** un menú ya inactivo, **When** se intenta inactivar de nuevo, **Then** la operación falla con error de estado.

---

### User Story 4 - Administrador elimina lógicamente un menú base (Priority: P3)

El administrador puede eliminar lógicamente un menú base inactivo que ya no se necesita, conservando el historial para trazabilidad.

**Why this priority**: Operación de limpieza poco frecuente; solo viable sobre menús inactivos para preservar integridad referencial con menús publicados históricos.

**Independent Test**: Eliminar un menú activo falla. Eliminar uno inactivo lo marca como eliminado y ya no aparece en ningún listado.

**Acceptance Scenarios**:

1. **Given** un menú base activo, **When** el administrador intenta eliminarlo, **Then** la operación falla indicando que debe inactivarse primero.
2. **Given** un menú base inactivo, **When** el administrador lo elimina, **Then** el registro queda marcado como eliminado y no aparece en listados ni en el portal.

---

### User Story 5 - Portal público lista y consulta menús base activos (Priority: P2)

El portal público puede obtener el listado de todos los menús base activos del tenant con sus relaciones, para mostrarlos a los clientes finales. También puede consultar el detalle de un menú específico.

**Why this priority**: Los clientes necesitan ver la oferta de viandas disponibles para hacer sus encargos. Sin este listado el portal no puede operar.

**Independent Test**: `GET /public/menus-base` con `x-tenant-key` válido devuelve solo menús activos con sus categorías, etiquetas y alérgenos, ordenados por nombre A→Z. `GET /public/menus-base/:id` devuelve el detalle completo de un menú activo.

**Acceptance Scenarios**:

1. **Given** menús activos e inactivos, **When** el portal consulta el listado con `x-tenant-key` correcto, **Then** solo recibe los activos con sus relaciones, ordenados por nombre.
2. **Given** una petición sin `x-tenant-key`, **When** se consulta el listado público, **Then** la petición falla con error de tenant requerido.
3. **Given** un menú activo, **When** el portal consulta su detalle por ID, **Then** recibe nombre, descripción, información nutricional, imagen e imagen y todas sus relaciones.
4. **Given** un menú inactivo, **When** el portal intenta consultar su detalle por ID, **Then** la respuesta es "no encontrado".

---

### Edge Cases

- ¿Qué pasa si se intenta crear un menú con nombre ya existente pero eliminado lógicamente? → Se permite (el índice único excluye registros eliminados).
- ¿Qué pasa si se editan relaciones enviando una lista vacía de categorías? → Se reemplaza completamente; el menú queda sin categorías asignadas.
- ¿Qué pasa si se intenta eliminar un menú con menús publicados históricos (eliminados/finalizados)? → En MVP se permite; la restricción aplica solo si tiene menús publicados activos (validación informativa en Stage 2).
- ¿Qué pasa si se consulta un menú base por ID en portal público y el menú existe pero es de otro tenant? → Se devuelve "no encontrado" (tenant scope aplicado).
- ¿Qué pasa si la imagen referenciada en `imagen_public_id` ya no existe en el almacenamiento? → El menú se devuelve igual; el sistema de archivos es responsable de la validez de la URL — no se valida la existencia en este módulo.
- ¿Qué pasa si se intenta inactivar un menú con menús publicados activos? → En MVP la validación es informativa; la inactivación procede de todos modos (restricción efectiva en Stage 2).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir crear menús base con nombre único por tenant (excluyendo eliminados lógicamente).
- **FR-002**: El sistema DEBE impedir crear menús base con nombre duplicado dentro del mismo tenant.
- **FR-003**: El sistema DEBE permitir editar cualquier campo de un menú base existente, incluyendo reemplazo completo de categorías, etiquetas y alérgenos.
- **FR-004**: Al crear o editar, el sistema DEBE validar que cada categoría, etiqueta y alérgeno referenciado pertenezca al mismo tenant y esté activo.
- **FR-005**: El sistema DEBE permitir activar un menú inactivo y rechazar la operación si ya está activo.
- **FR-006**: El sistema DEBE permitir inactivar un menú activo y rechazar la operación si ya está inactivo.
- **FR-007**: El sistema DEBE impedir eliminar lógicamente un menú base que esté activo.
- **FR-008**: El sistema DEBE permitir eliminar lógicamente un menú base inactivo (soft delete).
- **FR-009**: El sistema DEBE registrar una entrada de auditoría para cada operación de creación, edición, activación, inactivación y eliminación.
- **FR-010**: El sistema DEBE listar menús base del back office con paginación, búsqueda por nombre, filtro por estado, filtro por categoría, filtro por etiqueta, filtro por alérgeno, y ordenamiento por nombre o fecha de creación.
- **FR-011**: El detalle de un menú base DEBE incluir todas sus relaciones (categorías, etiquetas, alérgenos) con sus datos completos.
- **FR-012**: El portal público DEBE listar solo menús base activos del tenant con sus relaciones, ordenados por nombre ascendente, sin paginación.
- **FR-013**: El portal público DEBE permitir consultar el detalle de un menú base activo por ID, devolviendo "no encontrado" si el menú no existe, está inactivo o es de otro tenant.
- **FR-014**: El portal público DEBE resolver el tenant desde el encabezado `x-tenant-key` antes de cualquier consulta.
- **FR-015**: El acceso al back office DEBE requerir autenticación. Creación, edición, activación, inactivación y eliminación requieren rol `administrador`. Listado y detalle requieren rol `administrador` o `supervisor`.
- **FR-016**: La imagen del menú se gestiona mediante un identificador de archivo y una URL pública proporcionados externamente; el sistema los almacena sin validar la existencia del archivo.

### Key Entities

- **MenuBase**: Plantilla reutilizable de menú. Atributos clave: nombre (único por tenant), descripción, información nutricional (calorías, proteínas, carbohidratos, grasas), ingredientes, imagen (identificador + URL), estado activo/inactivo. Soporta eliminación lógica. Se relaciona con categorías, etiquetas y alérgenos.
- **CategoriaMenu**: Clasificación funcional del menú (ej. Almuerzo, Cena). Ya existe en Stage 1.
- **EtiquetaMenu**: Característica dietética o especial (ej. Sin gluten, Vegano). Ya existe en Stage 1.
- **Alergeno**: Componente sensible presente en el menú (ej. Lactosa, Gluten). Ya existe en Stage 1.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede crear un menú base completo con relaciones en menos de 5 operaciones desde el back office.
- **SC-002**: Intentar crear un menú base con nombre duplicado es rechazado el 100% de las veces con mensaje de error claro.
- **SC-003**: El listado del back office respeta correctamente todos los filtros (nombre, estado, categoría, etiqueta, alérgeno) en todas las combinaciones posibles.
- **SC-004**: El portal público recibe la lista de menús activos con sus relaciones completas, ordenada por nombre, en cada consulta.
- **SC-005**: Al editar relaciones de un menú, el reemplazo completo se aplica correctamente: las relaciones antiguas son eliminadas y las nuevas son las únicas asociadas.
- **SC-006**: Todas las operaciones sensibles (crear, editar, activar, inactivar, eliminar) quedan registradas en el log de auditoría sin excepción.
- **SC-007**: La validación de relaciones cruzadas de tenant (categorías/etiquetas/alérgenos de otro tenant) es rechazada el 100% de las veces.

## Assumptions

- Los usuarios del back office ya están autenticados con JWT válido emitido por el sistema de autenticación existente.
- La resolución del tenant en back office se maneja automáticamente por el middleware de tenancy; los módulos no necesitan implementarla.
- La imagen del menú es pre-subida por el frontend a través del módulo de archivos existente; este módulo solo almacena el identificador de archivo y la URL resultante.
- En MVP, la restricción de no inactivar un menú con publicaciones activas es solo informativa — la validación efectiva se implementa en Stage 2 (menus-publicados).
- En MVP, no hay restricción para eliminar menús con publicaciones históricas finalizadas.
- El listado público no requiere paginación; se asume un volumen de menús base por tenant menor a 200 registros activos en MVP.
- Las relaciones (categorías, etiquetas, alérgenos) son reemplazadas completamente al editar — no existe operación de agregar/quitar relaciones individuales.
- Un menú base puede existir sin categorías, etiquetas ni alérgenos asignados (todas las relaciones son opcionales).
- `MenusBaseService` debe exportarse para consumo por `MenusPublicadosModule` en Stage 2.
