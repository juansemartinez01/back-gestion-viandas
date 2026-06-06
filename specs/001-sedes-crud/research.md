# Research: Gestión de Sedes

**Feature**: 001-sedes-crud
**Date**: 2026-06-06

## Findings

### R-01: BaseCrudTenantService — método list() y filtros

**Decision**: Usar `BaseCrudTenantService.list()` con el parámetro `filters` para el filtro
booleano `activa`. El método acepta `query.filters: Record<string, any>` y aplica `applyEqualsFilters`
con una whitelist declarada en `filterAllowed`.

**How to apply**:
```typescript
// En SedesService.list():
return super.list(
  {
    page: query.page,
    limit: query.limit,
    q: query.q,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    filters: query.activa !== undefined ? { activa: query.activa } : {},
  },
  {
    searchColumns: ['nombre', 'direccion'],
    sortAllowed: ['nombre', 'orden_visualizacion', 'created_at'],
    sortFallback: { by: 'nombre', order: 'ASC' },
    filterAllowed: ['activa'],
    strictTenant: true,
  },
);
```

**Alternatives considered**: Custom QueryBuilder en servicio — descartado porque el base ya
abstrae paginación, search, sort y tenant scope.

---

### R-02: Operaciones activar/inactivar — no están en BaseCrudTenantService

**Decision**: Implementar `activar(id)` e `inactivar(id)` como métodos adicionales en
`SedesService`. Ambos usan `mustFindById()` del base (ya aplica tenant scope) y luego
`this.repo.save()` para persistir el cambio de estado.

**Rationale**: El base service no tiene métodos de cambio de estado; son operaciones de
dominio propias del módulo sedes.

---

### R-03: Validación de nombre único por tenant

**Decision**: Antes de `create()` y `update()`, ejecutar una consulta `findOne` con scope
de tenant y comparación case-insensitive via `ILIKE` o usando `LOWER()`:

```typescript
const exists = await this.repo
  .createQueryBuilder('s')
  .where('LOWER(s.nombre) = LOWER(:nombre)', { nombre: dto.nombre })
  .andWhere('s.tenant_id = :tenantId', { tenantId })
  .andWhere('s.deleted_at IS NULL')
  // En update, excluir el propio registro:
  .andWhere('s.id != :id', { id })
  .getOne();
if (exists) throw new AppError({ code: ErrorCodes.SEDE_NOMBRE_DUPLICADO, ... });
```

**Rationale**: El índice único compuesto en la BD protege a nivel de storage, pero la validación
previa permite devolver un error de negocio claro (SEDE_NOMBRE_DUPLICADO) en lugar de un error
genérico de constraint de PostgreSQL.

---

### R-04: Endpoint público — sin JwtAuthGuard, con tenant desde header

**Decision**: Crear `PublicSedesController` separado con prefijo `/public/sedes`. No aplica
`JwtAuthGuard`. La resolución de tenant viene del middleware `TenancyMiddleware` (que ya lee
`x-tenant-key` como fallback cuando no hay JWT). El servicio llama `TenancyService.requireTenantId()`
para fail-closed.

**Key detail**: El middleware de tenancy ya está configurado globalmente y resuelve el tenant
desde el header `x-tenant-key` cuando no hay token JWT. El endpoint público se beneficia
automáticamente sin código extra en el controlador.

**Ordering in public endpoint**:
```typescript
qb.orderBy('s.orden_visualizacion', 'ASC', 'NULLS LAST')
  .addOrderBy('s.nombre', 'ASC');
```
TypeORM QueryBuilder soporta `'NULLS LAST'` como tercer parámetro del `orderBy`.

---

### R-05: Ubicación de migraciones

**Decision**: Las migraciones van en `migrations/` en la **raíz del repositorio** (no en
`src/infra/db/migrations/`). Esto está definido en `makeOrmConfig`:
```typescript
migrations: [__dirname + '/../../../migrations/*{.ts,.js}'],
```
El comando es: `npm run db:migration:generate -- migrations/CreateSedes`
Esto genera: `migrations/<timestamp>-CreateSedes.ts`

---

### R-06: migrationsRun — activar en AppModule + DataSource

**Decision**: Actualizar `migrationsRun: true` en `makeOrmConfig()` para que la app ejecute
automáticamente las migraciones pendientes al iniciar. TypeORM trackea migraciones ya ejecutadas
en la tabla `migrations` — es seguro en producción (Railway).

**Nota**: La configuración está centralizada en `makeOrmConfig()` que es usada tanto por
`AppDataSource` (CLI) como por el `DbModule` en runtime. Cambiar en un lugar afecta a ambos.

---

### R-07: Índice parcial para unicidad con soft delete

**Decision**: El índice único compuesto `(tenant_id, nombre)` debe ser **parcial**:
`WHERE deleted_at IS NULL`. Esto permite que un nombre eliminado lógicamente pueda reutilizarse
sin violar el constraint.

TypeORM no genera índices parciales automáticamente via `@Unique` o `@Index`. La migración
generada tendrá que ser ajustada manualmente para agregar la condición `WHERE deleted_at IS NULL`.

**SQL esperado en migración**:
```sql
CREATE UNIQUE INDEX "UQ_sedes_tenant_nombre"
ON "sedes" ("tenant_id", "nombre")
WHERE "deleted_at" IS NULL;
```

---

### R-08: Remove con validación de estado

**Decision**: Sobrescribir (override) el método `softDelete` del base en `SedesService` para
agregar la validación de que la sede debe estar inactiva antes de eliminarla. Usar `mustFindById()`
y verificar `activa === false` antes de llamar `super.softDelete()`.

**Rationale**: El base `softDelete()` no tiene lógica de negocio. La validación de estado es
responsabilidad del dominio.

---

### R-09: ErrorCodes nuevos a agregar

Los siguientes códigos deben agregarse a `src/common/errors/error-codes.ts`:

```typescript
// sedes
SEDE_NOT_FOUND: 'SEDE_NOT_FOUND',
SEDE_NOMBRE_DUPLICADO: 'SEDE_NOMBRE_DUPLICADO',
SEDE_YA_ACTIVA: 'SEDE_YA_ACTIVA',
SEDE_YA_INACTIVA: 'SEDE_YA_INACTIVA',
SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
```

---

### R-10: Auditoría — patrón del módulo admin

**Decision**: En los métodos del servicio NO escribir auditoría directamente (el servicio no
tiene acceso al request). Inyectar `AuditService` en el **controlador** y llamar
`this.audit.write('admin', { ... })` después de cada operación exitosa, pasando el `req` object.

**Alternative considered**: Escribir auditoría en el servicio inyectando AuditService allí.
Descartado porque el servicio no debería conocer el `request` (requestId, method, path).
El controlador tiene acceso a `@Req() req` y puede extraer esos datos.

**Audit pattern** (tomado del módulo admin existente):
```typescript
await this.audit.write('admin', {
  request_id: req.id,
  method: req.method,
  path: req.url,
  status_code: 201,
  actor_user_id: req.user?.sub,
  actor_email: req.user?.email,
  action: 'sede.created',
  entity: 'sede',
  payload: { id: result.id, nombre: result.nombre },
});
```
