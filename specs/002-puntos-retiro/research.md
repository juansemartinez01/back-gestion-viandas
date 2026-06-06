---
description: "Research findings for puntos-retiro module — patterns derived from sedes implementation"
---

# Research: Módulo Puntos de Retiro

## R-01 — Patrón `list()` en BaseCrudTenantService

**Decision**: Usar `super.list()` con `filterAllowed: ['activo', 'sede_id']`.

**Finding**: `BaseCrudTenantService.list()` acepta `filterAllowed` como array de columnas. Pasando `sede_id` en `filters` y en `filterAllowed`, el base service aplica `WHERE p.sede_id = :sede_id` automáticamente scoped por tenant.

**Rationale**: Evita reimplementar paginación y filtrado. `filterAllowed` es el mecanismo aprobado para filtros exactos tipo UUID.

**Alternatives considered**: QB manual para el list — descartado porque aumenta código sin beneficio; los filtros exactos son suficientemente manejados por el base service.

---

## R-02 — Unicidad compuesta (tenant_id, sede_id, nombre)

**Decision**: Validar nombre único con QueryBuilder que compara `LOWER(p.nombre) = LOWER(:nombre)` AND `p.sede_id = :sedeId` AND `p.tenant_id = :tenantId` AND `deleted_at IS NULL`. Además, índice parcial en migración.

**Finding**: El módulo `sedes` usa `assertNombreUnico()` privado que compara LOWER. El mismo patrón aplica aquí pero con la condición adicional `sede_id`. La unicidad dentro de la misma sede es más restrictiva que la de sedes (solo por tenant).

**Key difference**: La validación excluye el registro actual en `update()` pasando `excludeId`.

---

## R-03 — Validación de sede activa al crear

**Decision**: Inyectar `SedesService` en `PuntosRetiroService` a través de `SedesModule` importado en `PuntosRetiroModule`. Llamar `sedesService.findOne(dto.sede_id)` — si la sede no existe en el tenant, lanza `SEDE_NOT_FOUND`. Si existe pero no está activa, lanzar `SEDE_INACTIVA`.

**Finding**: `SedesService.findOne()` ya hace el scope por tenant y lanza `SEDE_NOT_FOUND` si no existe. Solo falta agregar la validación de `activa === false` después de obtener la sede.

**Rationale**: Reusar la validación de tenant del `SedesService` en lugar de duplicar queries.

**Constraint**: `SedesModule` debe exportar `SedesService` — ya lo hace (`exports: [SedesService]`).

---

## R-04 — Endpoint público con filtro por sede_id

**Decision**: El endpoint `GET /public/puntos-retiro?sede_id=:id` usa un `QueryBuilder` propio (no `super.list()`) para aplicar `NULLS LAST` y filtrar por `sede_id`.

**Finding**: Igual que `listPublic()` en `SedesService`, `NULLS LAST` requiere QB propio. Adicionalmente, este endpoint necesita un filtro por `sede_id` que no tiene la versión de sedes.

**Implementation**:
```typescript
const qb = this.puntoRetiroRepo.createQueryBuilder('p');
this.applyTenantScopeQb(qb, 'p', { strictTenant: true });
qb.andWhere('p.activo = true')
  .andWhere('p.sede_id = :sedeId', { sedeId })
  .orderBy('p.orden_visualizacion', 'ASC', 'NULLS LAST')
  .addOrderBy('p.nombre', 'ASC');
return qb.getMany();
```

---

## R-05 — sede_id inmutable en update

**Decision**: `UpdatePuntoRetiroDto` NO incluye `sede_id`. Si el cliente lo envía igual se ignora porque no está en el DTO.

**Finding**: La sede es parte de la identidad del punto de retiro — cambiarla sería un caso extremo que no está en los requerimientos. Omitirlo del DTO es la solución más limpia.

**Rationale**: Simplifica la lógica de validación. Si en el futuro se necesita mover un punto de sede, se crea un endpoint específico con validación propia.

---

## R-06 — Relación ManyToOne con Sede en la entidad

**Decision**: Declarar `@ManyToOne(() => Sede, { eager: false })` con `@JoinColumn({ name: 'sede_id' })`. NO eager loading. NO cascade.

**Finding**: El template no usa eager loading por defecto — aumenta el costo de queries. Cuando necesitemos el nombre de la sede en una respuesta, se puede hacer un JOIN explícito con QB.

**Rationale**: `ON DELETE RESTRICT` a nivel de migración garantiza que no se puede eliminar una sede con puntos de retiro activos.

---

## R-07 — Migración y FK

**Decision**: Generar migración con `npm run db:migration:generate -- migrations/CreatePuntosRetiro`. Editar manualmente:
1. Reemplazar el índice único por índice parcial con `WHERE deleted_at IS NULL`.
2. Verificar que la FK a `sedes` tenga `ON DELETE RESTRICT` (TypeORM por defecto pone `NO ACTION` que es equivalente a RESTRICT en PostgreSQL al momento de la transacción).

**Finding**: TypeORM genera `ON DELETE NO ACTION` para ManyToOne, que en PostgreSQL previene eliminar la sede referenciada. Es suficiente para los requisitos.

---

## R-08 — ErrorCodes nuevos a agregar

**Decision**: Agregar en `src/common/errors/error-codes.ts`:
```typescript
// puntos-retiro
PUNTO_RETIRO_NOT_FOUND: 'PUNTO_RETIRO_NOT_FOUND',
PUNTO_RETIRO_NOMBRE_DUPLICADO: 'PUNTO_RETIRO_NOMBRE_DUPLICADO',
PUNTO_RETIRO_YA_ACTIVO: 'PUNTO_RETIRO_YA_ACTIVO',
PUNTO_RETIRO_YA_INACTIVO: 'PUNTO_RETIRO_YA_INACTIVO',
PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
// sedes (si no existe)
SEDE_INACTIVA: 'SEDE_INACTIVA',
```

**Finding**: `SEDE_INACTIVA` no existe en la lista actual. Los 5 códigos de PUNTO_RETIRO son análogos a los de SEDE.

---

## R-09 — Patrón de controller público

**Decision**: `PublicPuntosRetiroController` con prefijo `/public/puntos-retiro`, sin guards, recibe `sede_id` como query param `@IsUUID`, `@IsNotEmpty`. Llama `svc.listPublic(sedeId)`.

**Finding**: Igual que `PublicSedesController` pero con query param obligatorio. El DTO de query del endpoint público es separado del DTO admin — solo contiene `sede_id`.

**Note**: No se usa `@IsOptional()` en `sede_id` para el endpoint público — es obligatorio.

---

## R-10 — Auditoría: patrón del controller

**Decision**: Llamar `auditLogPayload()` y `audit.write('admin', {...})` en el controller para las operaciones mutantes, igual que en `SedesController`. El `logger.info(auditData, 'admin_audit')` va primero.

**Finding**: El patrón exacto del controller de sedes es el modelo de referencia. Las acciones del audit son: `punto_retiro.created`, `punto_retiro.updated`, `punto_retiro.activated`, `punto_retiro.deactivated`, `punto_retiro.deleted`.
