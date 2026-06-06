---
description: "Research findings for categorias-menu module — patterns derived from sedes and puntos-retiro implementations"
---

# Research: Módulo Categorías de Menú

## R-01 — Patrón `list()` en BaseCrudTenantService

**Decision**: Usar `super.list()` con `filterAllowed: ['activa']`.

**Finding**: `BaseCrudTenantService.list()` acepta `filterAllowed` como array de columnas. El filtro `activa` es boolean y se pasa directamente en `filters`. El base service aplica `WHERE cm.activa = :activa` scoped por tenant.

**Rationale**: Evita reimplementar paginación y filtrado. Idéntico al patrón de `sedes` (campo `activa`) — no a `puntos-retiro` (campo `activo`).

**Alternatives considered**: QB manual para el list — descartado porque aumenta código sin beneficio.

---

## R-02 — Unicidad compuesta (tenant_id, nombre)

**Decision**: Validar nombre único con QB que compara `LOWER(cm.nombre) = LOWER(:nombre)` AND `cm.tenant_id = :tenantId` AND `deleted_at IS NULL`. Índice parcial en migración.

**Finding**: Unicidad más simple que `puntos-retiro` (solo tenant+nombre, sin sede_id). `assertNombreUnico(nombre, excludeId?)` no necesita argumentos de referencia adicionales.

**Key difference**: En update se pasa `excludeId` para excluir el registro propio de la validación.

---

## R-03 — Campo `activa` vs `activo`

**Decision**: Usar `activa` (femenino) para coincidir con la semántica de "la categoría" en español.

**Finding**: El módulo `sedes` también usa `activa`. `puntos-retiro` usa `activo` (masculino). Para `categorias-menu`, el campo es `activa` según los requerimientos. **Nunca mezclar** — el QueryBuilder y los DTOs deben usar `activa` consistentemente.

**Rationale**: Consistencia semántica con la entidad femenina. Evita bugs silenciosos por usar el nombre incorrecto en `filterAllowed`.

---

## R-04 — Endpoint público sin query params

**Decision**: `listPublic()` sin argumentos de filtro. El tenant se resuelve por `TenancyMiddleware` desde `x-tenant-key`.

**Finding**: A diferencia de `puntos-retiro` que requiere `sede_id` obligatorio, `categorias-menu` no tiene ningún filtro adicional en el endpoint público. El `PublicCategoriasMenuController` no necesita un DTO de query — solo `@Get()` simple que llama `svc.listPublic()`.

**Implementation**:
```typescript
const qb = this.categoriaMenuRepo.createQueryBuilder('cm');
this.applyTenantScopeQb(qb, 'cm', { strictTenant: true });
qb.andWhere('cm.activa = true')
  .orderBy('cm.orden_visualizacion', 'ASC', 'NULLS LAST')
  .addOrderBy('cm.nombre', 'ASC');
return qb.getMany();
```

---

## R-05 — Validación informativa al inactivar (MVP)

**Decision**: En MVP, `inactivar()` no verifica menús base activos. Se agrega un comentario explícito indicando que la validación completa se implementa en Stage 2.

**Finding**: En Stage 2, cuando `menus-base` exista, se podrá inyectar `MenusBaseService` o hacer una query directa para verificar si hay menús activos con `categoria_menu_id = id`. En MVP esta dependencia no existe.

**Rationale**: No crear dependencias circulares hacia módulos que no existen aún. El comentario en el código sirve como TODO visible.

---

## R-06 — Sin PartialType en UpdateDto

**Decision**: `UpdateCategoriaMenuDto` declara todos los campos de `CreateCategoriaMenuDto` como opcionales explícitamente. NO usar `PartialType`.

**Finding**: `@nestjs/mapped-types` no está instalado en el template (confirmado en sedes y puntos-retiro). El patrón establecido es declarar campos explícitos con `@IsOptional()`.

---

## R-07 — Migración y índice parcial

**Decision**: Generar migración con `npm run db:migration:generate -- migrations/CreateCategoriasMenu`. Editar manualmente para índice parcial.

**Finding**: TypeORM genera un índice completo desde `@Index`. Debe reemplazarse por:
```sql
CREATE UNIQUE INDEX "UQ_categorias_menu_tenant_nombre"
ON "categorias_menu" ("tenant_id", "nombre")
WHERE "deleted_at" IS NULL
```
No hay FK a otras tablas de negocio — la migración es más simple que la de `puntos-retiro`.

---

## R-08 — ErrorCodes nuevos a agregar

**Decision**: Agregar en `src/common/errors/error-codes.ts`:
```typescript
// categorias-menu
CATEGORIA_MENU_NOT_FOUND: 'CATEGORIA_MENU_NOT_FOUND',
CATEGORIA_MENU_NOMBRE_DUPLICADO: 'CATEGORIA_MENU_NOMBRE_DUPLICADO',
CATEGORIA_MENU_YA_ACTIVA: 'CATEGORIA_MENU_YA_ACTIVA',
CATEGORIA_MENU_YA_INACTIVA: 'CATEGORIA_MENU_YA_INACTIVA',
CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
```

**Finding**: Ninguno de estos códigos existe todavía. Son análogos a los de `SEDE_*` pero con prefijo `CATEGORIA_MENU_`.

---

## R-09 — Auditoría: eventos

**Decision**: Usar las acciones `categoria_menu.created`, `categoria_menu.updated`, `categoria_menu.activated`, `categoria_menu.deactivated`, `categoria_menu.deleted` en `auditLogPayload()`.

**Finding**: Idéntico al patrón de `puntos-retiro`. El campo `entity` es `'categoria_menu'` (sin tilde). `extra` incluye `categoriaMenuId` en todas las operaciones, más `nombre` donde sea útil.

---

## R-10 — Registro en AppModule

**Decision**: Importar `CategoriasMenuModule` en `AppModule` junto a los módulos Stage 1 existentes.

**Finding**: `app.module.ts` ya importa `SedesModule` y `PuntosRetiroModule`. Agregar `CategoriasMenuModule` en el mismo bloque, después de `PuntosRetiroModule`.
