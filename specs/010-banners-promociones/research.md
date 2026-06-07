---
description: "Technical research for banners-promociones module"
---

# Research: Banners y Promociones

## Decisión 1 — Clasificación de módulo

**Decision**: Type A — CRUD tenant-safe simple (extiende `BaseCrudTenantService` + `BaseCrudController`).

**Rationale**: El módulo no tiene lógica de negocio compleja ni dependencias a otros módulos. La única diferencia respecto a `categorias-menu` es la lógica de fechas en `listPublic()` y la validación de coherencia fecha_inicio ≤ fecha_fin. Ambas se implementan como métodos custom dentro del mismo service sin necesidad de clasificar como Type B.

**Alternatives considered**: Type B (CRUD + business logic) — rechazado porque la lógica de fechas no crea dependencias entre módulos ni requiere transacciones complejas.

---

## Decisión 2 — Unicidad de título

**Decision**: Sin restricción de unicidad en el título. No hay `@Index` único ni validación de duplicados en el service.

**Rationale**: El spec lo define explícitamente: "No hay unicidad de título — pueden existir varios banners con el mismo título." Esto simplifica el service al eliminar la `assertNombreUnico()` que existe en `categorias-menu`.

**Alternatives considered**: Unicidad por (tenant_id, titulo) — rechazada por especificación explícita del dominio.

---

## Decisión 3 — Filtro de fechas en listPublic()

**Decision**: Usar `QueryBuilder` propio con condiciones `IS NULL OR` para manejar los campos opcionales.

**Rationale**: El listado público requiere: `(fecha_inicio IS NULL OR fecha_inicio <= :hoy) AND (fecha_fin IS NULL OR fecha_fin >= :hoy)`. Este patrón no puede expresarse con el helper `list()` de `BaseCrudTenantService` — requiere QB propio, igual que `listPublic()` en `categorias-menu`.

**Pattern**:
```typescript
const hoy = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
qb.andWhere('(b.fecha_inicio IS NULL OR b.fecha_inicio <= :hoy)', { hoy })
  .andWhere('(b.fecha_fin IS NULL OR b.fecha_fin >= :hoy)', { hoy });
```

**Alternatives considered**: Filtrar en memoria post-query — rechazado por ineficiencia y violación de principio de tenant scoping en DB.

---

## Decisión 4 — Validación de coherencia de fechas en update

**Decision**: Al editar, si solo viene una de las dos fechas, combinarla con el valor ya persistido antes de validar.

**Rationale**: Si el banner ya tiene `fecha_inicio = '2026-06-01'` y el PATCH solo envía `fecha_fin = '2026-05-01'`, la validación debe detectar la incoherencia comparando el nuevo `fecha_fin` contra el `fecha_inicio` existente en DB (no solo los campos del DTO).

**Pattern**:
```typescript
const fechaInicio = dto.fecha_inicio ?? existing.fecha_inicio;
const fechaFin    = dto.fecha_fin    ?? existing.fecha_fin;
if (fechaInicio && fechaFin && new Date(fechaInicio) > new Date(fechaFin)) {
  throw new AppError({ code: ErrorCodes.BANNER_FECHAS_INVALIDAS, ... });
}
```

**Alternatives considered**: Solo validar si ambas fechas vienen en el DTO — rechazado porque permitiría estados incoherentes (ej. fecha_fin < fecha_inicio existente).

---

## Decisión 5 — Índice de performance

**Decision**: Agregar `@Index('idx_banners_tenant_activo', ['tenant_id', 'activo'])` en la entidad para acelerar el endpoint público.

**Rationale**: El endpoint `/public/banners` filtra siempre por `tenant_id` (via tenancy middleware) y `activo = true`. Un índice compuesto en estos dos campos mejora el rendimiento de la consulta más frecuente del módulo.

**Alternatives considered**: Solo índice en `tenant_id` (ya heredado de BaseEntity) — suficiente para MVP pero el índice compuesto es costo cero de implementación y mejora observablemente las consultas públicas.

---

## Decisión 6 — Campos de imagen

**Decision**: El módulo almacena solo `imagen_public_id` y `imagen_url` como strings. No hay lógica de upload ni delete de archivos S3 en este módulo.

**Rationale**: Por constitución (Principio VI): "File uploads MUST store `public_id` (assetId) + `url` in the entity column — never binary data." El upload/delete es responsabilidad del cliente o de un flujo separado via `FilesModule`.

**Alternatives considered**: Integrar `FilesModule` para validar que el `public_id` exista — rechazado para el MVP; el módulo no tiene dependencias de otros módulos.

---

## Decisión 7 — Ordenamiento público: NULLS LAST en PostgreSQL

**Decision**: Usar `createQueryBuilder` con `.orderBy('b.orden_visualizacion', 'ASC', 'NULLS LAST').addOrderBy('b.created_at', 'DESC')`.

**Rationale**: TypeORM QueryBuilder soporta el tercer argumento `'NULLS LAST'` directamente en `.orderBy()` para PostgreSQL. Esto coloca los banners sin `orden_visualizacion` al final de la lista, con desempate por fecha de creación descendente.

**Note**: El helper `list()` de `BaseCrudTenantService` no soporta `NULLS LAST` nativo — motivo adicional para usar QB propio en `listPublic()`.
