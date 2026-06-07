# Research: Módulo Menús Base

**Branch**: `008-menus-base-crud` | **Date**: 2026-06-06

## Decision Log

### R-001: Relaciones M2M — estrategia de carga (eager vs explicit)

**Decision**: Cargar relaciones explícitamente en cada QB via `leftJoinAndSelect`. NO usar `eager: true` en las decoraciones de columna.

**Rationale**: `eager: true` carga relaciones en cada `repo.find*()` — incluyendo llamadas internas del base service que no las necesitan. Con volúmenes de cientos de menús y múltiples relaciones, esto genera N+1 implícitos. El cargado explícito permite control fino: no se cargan en `assertNombreUnico`, sí se cargan en `findOne` y `list`.

**Alternatives considered**:
- `eager: true` — descartado por impacto de performance.
- Lazy loading (Promises) — descartado: rompe la interfaz síncrona esperada por los consumers y require `await entity.categorias`.

---

### R-002: Filtro por categoria_id/etiqueta_id/alergeno_id en list()

**Decision**: Usar `INNER JOIN` con la tabla intermedia cuando el filtro está presente. Cuando no está presente, usar `LEFT JOIN AND SELECT` para cargar la relación sin filtrar.

**Rationale**: Un `LEFT JOIN` para filtrar devolvería filas con NULL cuando el menú no tiene la relación — incorrectas. `INNER JOIN` solo devuelve menús que tienen esa relación. La distinción entre "cargar relación" (LEFT JOIN AND SELECT) y "filtrar por relación" (INNER JOIN sin SELECT) es crítica para la semántica del listado.

**Pattern**:
```typescript
// Cargar siempre (para incluir en respuesta):
qb.leftJoinAndSelect('mb.categorias', 'cat')
  .leftJoinAndSelect('mb.etiquetas', 'et')
  .leftJoinAndSelect('mb.alergenos', 'al');

// Filtrar (solo cuando el query param está presente):
if (query.categoria_id) {
  qb.innerJoin('mb.categorias', 'catf', 'catf.id = :categoriaId', { categoriaId: query.categoria_id });
}
```

---

### R-003: assertRelacionesValidas — campo activo vs activa

**Decision**: La validación de estado activo varía por entidad:
- `CategoriaMenu`: campo `activa` (femenino)
- `EtiquetaMenu`: campo `activa` (femenino)
- `Alergeno`: campo `activo` (masculino)

**Rationale**: Confirmado por lectura directa de los archivos entity de Stage 1. Este es el error más probable al implementar. La función `assertRelacionesValidas` debe recibir el nombre del campo de estado como parámetro o implementarse en métodos separados por entidad.

**Implementation approach**: Tres métodos privados específicos (`assertCategoriasValidas`, `assertEtiquetasValidas`, `assertAlergenosValidos`) en lugar de un método genérico, para que el campo activo/activa sea hardcoded y evitar errores de runtime.

---

### R-004: Reemplazo de relaciones M2M en update()

**Decision**: Para reemplazar completamente las relaciones en un `update`, usar la asignación directa al array del objeto cargado + `repo.save()`. TypeORM detecta los cambios en la join table y emite los DELETE+INSERT necesarios.

**Pattern**:
```typescript
// Si categoria_ids viene en el dto (incluso vacío []):
if (dto.categoria_ids !== undefined) {
  const categorias = await this.assertCategoriasValidas(dto.categoria_ids);
  menu.categorias = categorias; // TypeORM genera diff en join table
}
```

**Alternatives considered**:
- `repo.createQueryBuilder().relation(MenuBase, 'categorias').of(id).addAndRemove(newIds, oldIds)` — más verboso, requiere conocer los IDs viejos. Descartado.
- DELETE manual + INSERT — viola el principio de "no raw SQL innecesario". Descartado.

---

### R-005: Módulo clasificado como Type B

**Decision**: `MenusBaseModule` es **Type B** (CRUD + business logic), no Type A.

**Rationale**: Las relaciones M2M con validación cruzada de tenant, el listado con múltiples filtros de join, y los métodos de ciclo de vida van más allá de lo que cubre `BaseCrudTenantService` directamente. Se extiende la base pero se sobreescriben todos los métodos CRUD principales.

---

### R-006: Validación de relaciones — scope de tenant

**Decision**: Al validar que una categoría/etiqueta/alérgeno es válido para asociar, la query DEBE incluir `tenant_id = :tenantId AND deleted_at IS NULL AND activo/activa = true`. No basta verificar que el ID exista globalmente.

**Rationale**: Sin el filtro de tenant, un administrador podría asociar categorías de otros tenants a sus menús, rompiendo el aislamiento multi-tenant.

---

### R-007: Alias QB para menus-base

**Decision**: Usar alias `'mb'` para QueryBuilder de `MenuBase`.

**Rationale**: Convención del proyecto: `'al'` para alergenos, `'cl'` para clientes, `'cm'` para categorias-menu, `'em'` para etiquetas-menu. `'mb'` es natural para menús-base.

---

### R-008: Dependencias circulares — módulos Stage 1

**Decision**: Importar `CategoriasMenuModule`, `EtiquetasMenuModule` y `AlergenosModule` en `MenusBaseModule` para acceder a sus repositorios vía `TypeOrmModule.forFeature`. No usar `forwardRef`.

**Rationale**: Stage 1 no depende de Stage 2 — no hay circularidad. Los módulos de Stage 1 exportan sus servicios que MenusBaseService puede usar para la validación.

**Alternative**: Usar `TypeOrmModule.forFeature([..., CategoriaMenu, EtiquetaMenu, Alergeno])` directamente en MenusBaseModule para inyectar sus repositorios sin importar los módulos completos. Esto es más ligero si solo se necesitan las queries de validación.

**Final choice**: Inyectar repositorios directamente via `TypeOrmModule.forFeature([MenuBase, CategoriaMenu, EtiquetaMenu, Alergeno])` — evita dependencias de módulos completos y es más explícito.
