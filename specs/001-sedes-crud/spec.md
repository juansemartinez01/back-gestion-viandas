# Feature Specification: Gestión de Sedes

**Feature Branch**: `001-sedes-crud`

**Created**: 2026-06-06

**Status**: Draft

**Input**: Módulo sedes — ubicaciones físicas Rochester desde las cuales se ofrecen, producen, entregan y venden viandas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrador gestiona el catálogo de sedes (Priority: P1)

Un administrador necesita poder crear, consultar, editar y eliminar (de forma lógica) sedes del
sistema, para mantener actualizado el catálogo de ubicaciones físicas de Rochester donde se
operan las viandas. Cada sede tiene un nombre único dentro de la organización, dirección, datos
de contacto opcionales, y un orden de visualización para el portal público.

**Why this priority**: Sin sedes cargadas, ningún otro módulo del sistema puede operar —
los menús, pedidos y entregas dependen de que exista al menos una sede activa. Es el dato maestro
raíz del sistema.

**Independent Test**: Se puede probar creando una sede, verificando que aparece en el listado con
sus datos completos, editando un campo y confirmando el cambio, y finalmente eliminándola
lógicamente. Todo esto sin depender de ningún otro módulo.

**Acceptance Scenarios**:

1. **Given** un usuario con rol administrador autenticado, **When** crea una sede con nombre,
   dirección y datos opcionales, **Then** la sede queda registrada con estado activo y aparece
   en el listado de sedes del back office.

2. **Given** una sede existente, **When** el administrador edita su dirección o datos de contacto,
   **Then** los cambios se reflejan inmediatamente en el detalle y el listado, y queda un registro
   de auditoría de la modificación.

3. **Given** una sede existente con nombre "Campus Norte", **When** el administrador intenta crear
   otra sede con el mismo nombre en la misma organización, **Then** el sistema rechaza la operación
   con un mensaje indicando que el nombre ya existe.

4. **Given** una sede en estado inactivo, **When** el administrador solicita su eliminación lógica,
   **Then** la sede desaparece del listado operativo pero se conserva para trazabilidad histórica.

5. **Given** una sede en estado activo, **When** el administrador intenta eliminarla lógicamente,
   **Then** el sistema rechaza la operación indicando que primero debe inactivarla.

---

### User Story 2 - Cliente selecciona sede en el portal público (Priority: P2)

Un cliente que quiere hacer un pedido a través del portal público necesita ver la lista de sedes
activas de Rochester para elegir desde cuál desea retirar o recibir su vianda, sin necesidad de
iniciar sesión.

**Why this priority**: El portal público es el canal de pedidos online. Si el cliente no puede
ver las sedes, no puede completar un pedido. Es el punto de entrada al flujo de compra.

**Independent Test**: Se puede probar accediendo al endpoint público de sedes (sin credenciales
pero con el identificador de organización en el encabezado de la solicitud), y verificando que
sólo aparecen sedes activas, ordenadas por su campo de prioridad visual.

**Acceptance Scenarios**:

1. **Given** una organización con tres sedes (dos activas, una inactiva), **When** el portal
   público solicita el listado de sedes, **Then** la respuesta contiene sólo las dos sedes
   activas, ordenadas por su campo de orden de visualización de menor a mayor.

2. **Given** el portal público, **When** se realiza la solicitud sin el identificador de
   organización en el encabezado, **Then** el sistema rechaza la solicitud con un error claro.

3. **Given** una sede activa con `orden_visualizacion` nulo, **When** aparece en el listado
   público, **Then** se ubica al final (después de las sedes con orden definido).

---

### User Story 3 - Administrador activa o inactiva una sede (Priority: P3)

Un administrador necesita poder cambiar el estado operativo de una sede — activarla cuando entra
en funcionamiento o inactivarla cuando deja de operar — para controlar qué sedes están disponibles
para nuevas operaciones sin perder la trazabilidad histórica.

**Why this priority**: El control de estado es una operación de gestión; el sistema puede operar
sin ella (las sedes quedan activas por defecto), pero es crítica para el ciclo de vida operativo.

**Independent Test**: Se puede probar inactivando una sede activa, verificando que desaparece del
portal público, y luego reactivándola para confirmar que vuelve a aparecer.

**Acceptance Scenarios**:

1. **Given** una sede activa, **When** el administrador la inactiva, **Then** la sede cambia a
   estado inactivo, deja de aparecer en el portal público y queda registrada la acción en auditoría.

2. **Given** una sede inactiva, **When** el administrador la activa, **Then** la sede vuelve a
   estado activo, aparece nuevamente en el portal público y queda registrada la acción en auditoría.

3. **Given** una sede activa que tiene menús publicados vigentes o pedidos confirmados pendientes
   de entrega para hoy o fechas futuras, **When** el administrador intenta inactivarla, **Then**
   el sistema advierte que la sede tiene operaciones pendientes. *(En el MVP esta validación es
   informativa; la verificación cruzada se activa cuando los módulos de menús y pedidos existan.)*

---

### User Story 4 - Supervisor y administrador consultan el listado con filtros (Priority: P4)

Un supervisor o administrador necesita buscar y filtrar sedes en el back office para localizar
rápidamente una sede específica, ver solo las activas o solo las inactivas, y ordenar por nombre
o por orden de visualización.

**Why this priority**: Funcionalidad de soporte; el listado básico (US1) es suficiente para el
MVP. Los filtros y la búsqueda mejoran la usabilidad cuando el catálogo crece.

**Independent Test**: Se puede probar cargando varias sedes, aplicando un filtro de búsqueda por
nombre parcial y verificando que sólo aparecen las coincidencias.

**Acceptance Scenarios**:

1. **Given** un listado con diez sedes, **When** el usuario busca por una palabra parcial del
   nombre, **Then** el resultado muestra sólo las sedes cuyo nombre contiene esa cadena
   (búsqueda sin distinción de mayúsculas/minúsculas).

2. **Given** un listado mixto de sedes activas e inactivas, **When** el usuario filtra por
   "sólo activas", **Then** el resultado excluye las inactivas.

3. **Given** el listado paginado, **When** el usuario solicita la segunda página, **Then**
   la respuesta incluye los ítems correctos y metadatos de paginación (total, página actual,
   páginas totales).

---

### Edge Cases

- ¿Qué pasa si se intenta activar una sede que ya está activa? El sistema DEBE responder con
  un error indicando que ya se encuentra en ese estado (operación idempotente fallida con aviso).
- ¿Qué pasa si se intenta inactivar una sede que ya está inactiva? Mismo comportamiento.
- ¿Qué pasa si `orden_visualizacion` tiene el mismo valor en dos sedes? El sistema DEBE ordenar
  secundariamente por nombre (orden alfabético) como desempate.
- ¿Qué pasa si el nombre de sede supera el límite de caracteres? El sistema DEBE rechazar la
  operación con un error de validación antes de intentar persistir.
- ¿Qué pasa si se intenta obtener el detalle de una sede que no pertenece a la organización
  actual? El sistema DEBE responder como si la sede no existiera (no filtrar por tenant es un
  error de seguridad).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a usuarios con rol `administrador` crear nuevas sedes con
  nombre (obligatorio), dirección (obligatoria), teléfono de contacto (opcional), observaciones
  (opcionales) y orden de visualización (opcional).
- **FR-002**: El sistema MUST rechazar la creación o edición de una sede si el nombre ya existe
  en la misma organización (comparación sin distinción de mayúsculas).
- **FR-003**: El sistema MUST listar sedes del back office con soporte de paginación, búsqueda
  por nombre (parcial, sin distinción de mayúsculas), filtro por estado (activa/inactiva/todas)
  y ordenamiento por nombre y por orden de visualización.
- **FR-004**: El sistema MUST permitir a usuarios con rol `administrador` o `supervisor` consultar
  el detalle completo de cualquier sede de su organización.
- **FR-005**: El sistema MUST permitir a usuarios con rol `administrador` editar todos los campos
  de una sede existente (excepto tenant y marcas de tiempo internas).
- **FR-006**: El sistema MUST permitir a usuarios con rol `administrador` inactivar una sede activa,
  cambiando su estado a inactivo y registrando la acción en auditoría.
- **FR-007**: El sistema MUST permitir a usuarios con rol `administrador` activar una sede inactiva,
  cambiando su estado a activo y registrando la acción en auditoría.
- **FR-008**: El sistema MUST rechazar el intento de eliminar lógicamente una sede que aún está
  activa, exigiendo que primero sea inactivada.
- **FR-009**: El sistema MUST realizar eliminación lógica (soft delete) de sedes inactivas,
  preservando los datos para trazabilidad histórica.
- **FR-010**: El sistema MUST registrar un evento de auditoría para cada una de las siguientes
  acciones: crear sede, editar sede, activar sede, inactivar sede, eliminar sede.
- **FR-011**: El portal público MUST exponer un listado de sedes activas sin requerir
  autenticación, pero sí identificación de la organización mediante encabezado de solicitud.
- **FR-012**: El listado público MUST devolver sólo sedes activas, ordenadas por
  `orden_visualizacion` ascendente; en caso de empate, ordenadas alfabéticamente por nombre.
- **FR-013**: El sistema MUST rechazar solicitudes al portal público que no incluyan el
  identificador de organización en el encabezado.
- **FR-014**: Todos los endpoints del back office MUST requerir autenticación; los endpoints de
  sólo lectura (`listar`, `detalle`) deben ser accesibles para roles `administrador` y `supervisor`;
  los endpoints de escritura (`crear`, `editar`, `activar`, `inactivar`, `eliminar`) deben ser
  exclusivos del rol `administrador`.
- **FR-015**: El sistema MUST aislar completamente los datos de cada organización; una sede de
  la organización A nunca debe ser visible ni modificable desde el contexto de la organización B.

### Key Entities

- **Sede**: Ubicación física de Rochester donde se operan viandas. Atributos: nombre único
  por organización, dirección, teléfono de contacto (opcional), observaciones (opcional),
  estado activo/inactivo, orden de visualización numérico (opcional para portal público),
  organización propietaria, marcas de tiempo de creación/modificación/eliminación lógica.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede crear, editar e inactivar una sede en menos de 2 minutos
  sin asistencia técnica.
- **SC-002**: El portal público devuelve el listado de sedes activas en menos de 500 ms bajo
  carga normal de operación.
- **SC-003**: El 100% de las acciones auditables genera un registro de auditoría sin excepción;
  ninguna acción sensible pasa sin trazabilidad.
- **SC-004**: Ninguna consulta realizada desde el contexto de una organización devuelve datos de
  otra organización — validado mediante pruebas de aislamiento multi-tenant.
- **SC-005**: El listado del back office soporta al menos 500 sedes en catálogo sin degradación
  perceptible de rendimiento con paginación activa.
- **SC-006**: Las reglas de unicidad de nombre se aplican de forma consistente; intentar crear
  un duplicado siempre resulta en error sin persistir datos.

## Assumptions

- Se asume que la organización (tenant) ya existe y está activa en el sistema; la creación de
  organizaciones es responsabilidad de otro módulo fuera del alcance de esta especificación.
- Se asume que el sistema de autenticación y los roles (`administrador`, `supervisor`) ya están
  implementados en la plataforma base y son reutilizables.
- Se asume que el mecanismo de auditoría global ya existe en la plataforma base y acepta eventos
  de cualquier módulo de negocio.
- La validación cruzada de "sede con operaciones pendientes" (FR-006 avanzado) está documentada
  pero su verificación real se implementa sólo cuando los módulos de menús publicados y pedidos
  estén disponibles (Stage 2 y 3 del plan de implementación). En el MVP, la regla se comunica
  al usuario como advertencia informativa.
- Los campos `telefono_contacto`, `observaciones` y `orden_visualizacion` son opcionales; una
  sede es válida sin ellos.
- `orden_visualizacion` acepta valores enteros positivos; no se valida unicidad de este valor
  entre sedes (el desempate se hace por nombre).
- El límite de longitud del campo `nombre` es 150 caracteres y de `direccion` es 300 caracteres,
  valores coherentes con la convención de la plataforma base para campos de texto corto.
- El portal público no requiere paginación; se asume que el número de sedes activas por
  organización es manejable en una sola respuesta (estimado < 50 sedes por organización).
