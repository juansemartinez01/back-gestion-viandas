# Research: Menús Publicados

**Feature**: 009-menus-publicados | **Date**: 2026-06-07

## Phase 0 Findings

All design decisions resolved. No NEEDS CLARIFICATION items remain.

---

### Decision 1: Estructura del módulo — Type B con servicio propio

**Decision**: `MenusPublicadosService` extiende `BaseCrudTenantService<MenuPublicado>` y sobreescribe `list`, `findOne`, `create`, `update`, `remove` con lógica de negocio propia. Los métodos de transición de estado (`pausar`, `reactivar`, `cerrar`, `agotar`, `cancelar`) se agregan como métodos adicionales.

**Rationale**: Este es el patrón Type B definido en la constitución y seguido por `MenusBaseService`. `BaseCrudTenantService` provee `getTenantId()`, `applyTenantScopeQb()`, `findById()` y `softDelete()`, lo cual reduce el boilerplate sin perder control sobre el QueryBuilder.

**Alternatives considered**:
- Servicio puramente custom (Type C): innecesario porque el módulo sí tiene operaciones CRUD estándar.
- Usar los métodos `list`/`create` heredados del base: no aplica porque los filtros y relaciones M2M requieren QB personalizado.

---

### Decision 2: Auditoría en el controlador (no en el servicio)

**Decision**: Toda la lógica de auditoría (`auditLogPayload` + `logger.info` + `audit.write`) vive en el controlador (`MenusPublicadosController`), siguiendo exactamente el patrón de `MenusBaseController`.

**Rationale**: El patrón establecido en el proyecto ubica la auditoría en la capa del controlador, donde hay acceso al objeto `req` (request ID, actor user/email). El servicio no tiene acceso al request context, lo que obliga a pasarlo como parámetro o a acceder a él desde el controlador. El patrón existente elige el controlador.

**Alternatives considered**:
- Auditoría en el servicio: requeriría pasar el actor como argumento a cada método, aumentando la firma de todos los métodos del servicio.

---

### Decision 3: Validación de puntos de retiro — query directa en el servicio

**Decision**: `MenusPublicadosService` inyecta `Repository<PuntoRetiro>` directamente (además de importar `PuntosRetiroModule`) para validar que los IDs proporcionados sean activos y pertenezcan a la sede del menú publicado. Se itera sobre los IDs y se consulta uno a uno con QB tenant-scoped.

**Rationale**: Siguiendo el patrón de `MenusBaseService` con `assertCategoriasValidas` / `assertEtiquetasValidas` / `assertAlergenosValidos`. Cada ID se valida individualmente con el error específico `MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS`. No se usa `PuntosRetiroService.findOne()` porque ese método lanza `PUNTO_RETIRO_NOT_FOUND`, que no es el código de error correcto para este contexto.

**Alternatives considered**:
- Usar `PuntosRetiroService.findOne()` en loop: lanzaría el código de error incorrecto.
- Validar con `IN` query: menos granular, no permite identificar cuál ID falló.

---

### Decision 4: cancelar() recibe el rol del usuario

**Decision**: El método `cancelar(id: string, rolUsuario: string)` recibe el rol del actor autenticado para hacer cumplir la regla de negocio: solo `administrador` puede cancelar desde `cerrado` o `agotado`. El controlador extrae `req.user.rol` y lo pasa al servicio.

**Rationale**: La restricción es una **regla de negocio de la máquina de estado**, no una restricción de acceso al endpoint. El endpoint `/cancelar` es accesible por `administrador` y `supervisor` (ambos via `@Roles`). La decisión de permitir o rechazar la cancelación depende del estado actual del menú combinado con el rol. Esto no puede resolverse solo con guards.

**Alternatives considered**:
- Dos endpoints separados (`/cancelar-forzado` solo admin): crea una API más compleja sin beneficio real.
- Eliminar la restricción por rol en el servicio: viola la regla de negocio documentada en la spec.

---

### Decision 5: listDisponiblesPublic — horizonte de 7 días

**Decision**: El portal público devuelve menús con `fecha_venta >= hoy` y `fecha_venta <= hoy + 7 días`. El valor de 7 días es hardcoded en el servicio (documentado como constante `DIAS_HORIZONTE_PUBLICO = 7`).

**Rationale**: La spec define "fechas futuras próximas" con el assumption de 7 días calendario. Se puede parametrizar en el futuro sin cambios de interfaz.

**Alternatives considered**:
- Traer todos los futuros (sin límite): sobreexpone datos y carga innecesaria.
- Configurable por tenant: fuera del scope de esta iteración.

---

### Decision 6: Módulo no importa MenusBaseModule — usa Repository<MenuBase> directo

**Decision**: `MenusPublicadosModule` importa `TypeOrmModule.forFeature([MenuPublicado, MenuBase, Sede, PuntoRetiro])` para acceder a los repositorios. También importa `MenusBaseModule`, `SedesModule`, `PuntosRetiroModule` para acceder a sus servicios para validación de entidades activas.

**Rationale**: Para cargar las relaciones de `MenuBase` (categorias, etiquetas, alergenos) en el QB de `listDisponiblesPublic`, el servicio necesita el `Repository<MenuBase>`. Para validar que el menú base está activo, usa `MenusBaseService.findOne()` que ya incluye el chequeo de `activo` y de soft delete.

**Important**: No se crea una dependencia circular porque `MenusPublicadosModule` importa `MenusBaseModule` (no al revés).

---

### Decision 7: Fecha de venta comparada como date vs datetime

**Decision**: La validación `fecha_hora_limite_encargo <= fecha_venta` se hace construyendo un objeto `Date` del `fecha_venta` con hora `23:59:59` (fin del día) para la comparación, o usando `<=` directo en UTC si `fecha_hora_limite_encargo` ya viene como timestamptz. Se usa `new Date(dto.fecha_venta + 'T23:59:59Z') >= new Date(dto.fecha_hora_limite_encargo)`.

**Rationale**: `fecha_venta` es un `date` (sin hora), mientras que `fecha_hora_limite_encargo` es `timestamptz`. Para que la comparación tenga sentido, el límite de encargo debe ser antes del fin del día de venta en UTC.

**Alternatives considered**:
- Comparar solo la fecha (ignorar hora): sería demasiado restrictivo, no permitiría poner el límite a las 23:00 del día de venta.

---

### Decision 8: Auditoría en controlador público — NO aplica

**Decision**: `PublicMenusPublicadosController` no tiene auditoría. El endpoint público es de solo lectura (GET) y no requiere trazabilidad de auditoría según la constitución (que solo lista eventos mutativos).

**Rationale**: La constitución lista los eventos auditables: todos son acciones administrativas (crear, editar, cambiar estado). El GET público no modifica datos.

---

### Unknowns resolved

| Unknown | Resolution |
|---------|------------|
| ¿Cómo comparar `fecha_hora_limite_encargo` vs `fecha_venta` (date vs timestamptz)? | Construir Date con `T23:59:59Z` del `fecha_venta` para la comparación |
| ¿Cómo validar puntos de retiro sin usar el error code de PuntosRetiroService? | Query directa sobre `Repository<PuntoRetiro>` con QB tenant-scoped |
| ¿Dónde vive la auditoría? | Controlador (sigue patrón menus-base) |
| ¿Cómo pasar el rol para `cancelar()`? | `req.user.rol` → argumento del servicio |
| ¿Cuántos días de horizonte para el portal público? | 7 días (constante `DIAS_HORIZONTE_PUBLICO`) |
