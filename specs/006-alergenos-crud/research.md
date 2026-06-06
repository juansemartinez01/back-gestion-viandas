# Research: Módulo Alérgenos

**Feature**: `006-alergenos-crud`
**Date**: 2026-06-06

## Findings

### Decision 1: Patrón de implementación — Type A idéntico a categorias-menu/etiquetas-menu

- **Decision**: Reutilizar exactamente el mismo patrón Type A del template (BaseCrudTenantService + BaseCrudController) ya validado en sedes, puntos-retiro, categorias-menu y etiquetas-menu.
- **Rationale**: El módulo tiene la misma estructura de datos y comportamiento. No requiere investigación adicional — el patrón está demostrado en producción dentro del mismo repositorio.
- **Alternatives considered**: Ninguna — patrón mandado por constitución (Principio VI).

### Decision 2: Campo `activo` (masculino)

- **Decision**: Usar `activo` (masculino) en lugar de `activa`, consistente con sedes y puntos-retiro.
- **Rationale**: Género gramatical correcto en español para el sustantivo "alérgeno" (masculino). Sedes y puntos-retiro ya usan `activo`. Categorias-menu y etiquetas-menu usan `activa` porque el sustantivo es femenino.
- **Alternatives considered**: N/A — es una decisión lingüística explícita en la spec.

### Decision 3: Sin `orden_visualizacion`

- **Decision**: La entidad `Alergeno` no tiene campo `orden_visualizacion`. El orden del listado público es siempre alfabético por `nombre ASC`.
- **Rationale**: Los alérgenos son un conjunto técnico/regulatorio donde el orden alfabético es el más intuitivo y consistente. No necesitan ser reordenados visualmente por operadores.
- **Alternatives considered**: Agregar `orden_visualizacion` para consistencia — rechazado porque complica la entidad innecesariamente y no aporta valor de negocio.

### Decision 4: QB alias `'al'`

- **Decision**: Usar `'al'` como alias de QueryBuilder para la entidad `Alergeno`.
- **Rationale**: Convención de dos letras consistente con `'cm'` (CategoriaMenu), `'em'` (EtiquetaMenu), `'pr'` (PuntoRetiro), `'se'` (Sede). `'al'` es la abreviatura natural de "alérgeno".
- **Alternatives considered**: `'alerge'` — rechazado por ser demasiado largo.

### Decision 5: Índice parcial `WHERE deleted_at IS NULL`

- **Decision**: El índice único `UQ_alergenos_tenant_nombre` debe ser parcial (excluye soft-deleted).
- **Rationale**: Misma razón que en todos los módulos anteriores: permite reutilizar nombres de alérgenos eliminados lógicamente sin violar unicidad. TypeORM no soporta índices parciales nativamente — la migración debe editarse manualmente.
- **Alternatives considered**: Índice completo — rechazado porque impide crear un alérgeno con el mismo nombre después de un soft delete.

### Decision 6: `listPublic()` — sin NULLS LAST

- **Decision**: `ORDER BY al.nombre ASC` sin `NULLS LAST`.
- **Rationale**: El campo `nombre` es NOT NULL en la entidad, así que `NULLS LAST` no aplica. Sin `orden_visualizacion`, el `NULLS LAST` de los módulos anteriores era para ese campo int nullable.
- **Alternatives considered**: Incluir `NULLS LAST` por consistencia — rechazado porque es redundante y puede confundir.

## No hay NEEDS CLARIFICATION

Todas las decisiones de diseño están completamente especificadas por el usuario o son derivaciones directas del patrón establecido. No se requiere investigación externa.
