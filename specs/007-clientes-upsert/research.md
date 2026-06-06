# Research: Módulo Clientes

**Branch**: `007-clientes-upsert` | **Date**: 2026-06-06

## Decision Log

### R-001: Upsert por DNI — estrategia de implementación

**Decision**: Implementar `upsertByDni` con QueryBuilder propio: `SELECT ... WHERE tenant_id = :t AND dni = :dni AND deleted_at IS NULL`, luego bifurcar en create/update manual.

**Rationale**: TypeORM `.upsert()` nativo no es adecuado porque: (a) requiere conocer el constraint name exacto, (b) no permite lógica diferenciada para `fecha_primera_operacion` (solo al crear) vs `fecha_ultima_operacion` (siempre), y (c) no soporta la lógica de "no pisar campos undefined". El enfoque de find-then-create/update es explícito, testeable y consistente con el resto del template.

**Alternatives considered**:
- `repo.upsert()` nativo — descartado (no soporta lógica diferenciada por campo).
- `INSERT ... ON CONFLICT DO UPDATE` via raw SQL — descartado (viola Principio VI: raw SQL solo si ORM no puede expresarlo; aquí sí puede).

---

### R-002: Búsqueda multi-campo OR en list()

**Decision**: Implementar `list()` con QueryBuilder personalizado. Cuando `query.q` está presente, agregar cláusula OR: `(cl.dni ILIKE :q OR cl.nombre ILIKE :q OR cl.apellido ILIKE :q)`.

**Rationale**: `BaseCrudTenantService.list()` acepta `searchColumns` como array, pero el comportamiento OR entre múltiples columnas con el mismo término no está garantizado por la interfaz pública. Usar QB propio da control total sobre la cláusula y es consistente con cómo alergenos usa QB para lógica custom.

**Alternatives considered**:
- `searchColumns: ['dni','nombre','apellido']` — puede funcionar si la base implementa OR; rechazado porque depende de un comportamiento no documentado del template.

---

### R-003: No-sobrescritura de campos opcionales en upsert

**Decision**: Al actualizar un cliente existente, aplicar asignación condicional: `if (dto.telefono !== undefined && dto.telefono !== '') cliente.telefono = dto.telefono`. Lo mismo para `email`.

**Rationale**: El contrato del upsert especifica que los campos opcionales no deben pisarse con null/undefined. Un pedido que no incluya teléfono no debe borrar el teléfono ya almacenado.

**Alternatives considered**:
- Usar `Object.assign` con limpieza previa — más conciso pero menos legible sobre la intención; rechazado para mayor claridad.

---

### R-004: Índice único parcial (tenant_id, dni)

**Decision**: El índice se crea manualmente en la migración como `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`. La anotación `@Index` en la entidad genera el índice completo que TypeORM detecta, pero la migración debe reemplazarlo por el índice parcial (mismo patrón que alérgenos con `@Index` + edición manual).

**Rationale**: Los clientes tienen `deleted_at` en `BaseEntity` por herencia, pero el flujo normal no usa soft delete. El índice parcial garantiza que si algún registro quedara con `deleted_at` seteado (por limpieza excepcional), no bloquee la re-creación del cliente con el mismo DNI.

---

### R-005: Sin endpoint público, sin DELETE

**Decision**: No hay `PublicClientesController`. No hay endpoint `DELETE /admin/clientes/:id`. Los clientes solo se bloquean/desbloquean.

**Rationale**: Requisito explícito del spec. Los clientes son creados solo por `upsertByDni`; el único ciclo de vida en backoffice es bloquear/desbloquear.

---

### R-006: Alias QB para clientes

**Decision**: Usar alias `'cl'` para QueryBuilder de la entidad Cliente.

**Rationale**: Convención: `'al'` para alergenos, `'em'` para etiquetas-menu, `'cm'` para categorias-menu, `'s'` para sedes, `'pr'` para puntos-retiro. `'cl'` es natural y no colisiona.

---

### R-007: getTenantId() en upsertByDni

**Decision**: Llamar `this.getTenantId({ strictTenant: true })` al inicio de `upsertByDni` para obtener el `tenant_id` del contexto de request actual.

**Rationale**: `upsertByDni` será llamado internamente por `PedidosService` en Stage 3. En ese contexto, el middleware de tenancy ya habrá resuelto el tenant. Si alguna vez se llama fuera de un request HTTP, lanzará `TENANT_REQUIRED` — comportamiento correcto para detectar usos incorrectos.
