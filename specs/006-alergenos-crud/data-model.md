# Data Model: Módulo Alérgenos

**Feature**: `006-alergenos-crud`
**Date**: 2026-06-06

## Entidad: Alergeno

**Tabla**: `alergenos`
**Clase TypeScript**: `Alergeno`
**Archivo**: `src/modules/alergenos/entities/alergeno.entity.ts`
**Base**: `BaseEntity` (hereda `id uuid`, `tenant_id uuid`, `created_at`, `updated_at`, `deleted_at`)

### Campos

| Campo | Tipo DB | Tipo TS | Nullable | Default | Descripción |
|-------|---------|---------|----------|---------|-------------|
| id | uuid | string | NO | uuid_generate_v4() | PK heredado |
| tenant_id | uuid | string \| null | YES | — | FK lógica al tenant |
| nombre | varchar(100) | string | NO | — | Nombre único por tenant |
| descripcion | varchar(300) | string \| null | YES | NULL | Descripción opcional |
| activo | boolean | boolean | NO | true | Estado del alérgeno |
| created_at | timestamptz | Date | NO | now() | Heredado |
| updated_at | timestamptz | Date | NO | now() | Heredado |
| deleted_at | timestamptz | Date \| null | YES | NULL | Soft delete (heredado) |

### Índices

| Nombre | Columnas | Tipo | Condición |
|--------|----------|------|-----------|
| PK_alergenos | id | PRIMARY KEY | — |
| IDX_alergenos_tenant | tenant_id | INDEX | — |
| UQ_alergenos_tenant_nombre | (tenant_id, nombre) | UNIQUE | WHERE deleted_at IS NULL |

> **IMPORTANTE**: El `@Index` TypeORM en la entidad genera un índice completo. La migración debe ser editada manualmente para agregar `WHERE "deleted_at" IS NULL`.

### Restricciones de negocio

- `nombre` debe ser único por tenant (comparación LOWER, excluyendo soft-deleted).
- Solo se puede hacer soft delete si `activo = false`.
- Si `activo = true` al intentar soft delete → error `ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`.
- Si ya `activo = true` al activar → error `ALERGENO_YA_ACTIVO`.
- Si ya `activo = false` al inactivar → error `ALERGENO_YA_INACTIVO`.

### Transiciones de estado

```
          activar()
inactivo ──────────→ activo
         ←────────── 
          inactivar()

activo/inactivo ──softDelete()──→ eliminado lógicamente (solo si inactivo)
```

## DTOs

### CreateAlergenoDto

```typescript
// src/modules/alergenos/dto/create-alergeno.dto.ts
export class CreateAlergenoDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nombre!: string;

  @IsOptional() @IsString() @MaxLength(300)
  descripcion?: string;
}
```

### UpdateAlergenoDto

```typescript
// src/modules/alergenos/dto/update-alergeno.dto.ts
// Sin PartialType — declarar explícitamente
export class UpdateAlergenoDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(300)
  descripcion?: string;
}
```

### QueryAlergenoDto

```typescript
// src/modules/alergenos/dto/query-alergeno.dto.ts
export class QueryAlergenoDto extends PageQueryDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @Transform(...) @IsBoolean()
  activo?: boolean;        // ← masculino

  @IsOptional() @IsString()
  sortBy?: string;

  @IsOptional() @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
```

> **Nota clave**: El campo de filtro se llama `activo` (masculino), no `activa`.

## Migración

**Comando**: `npm run db:migration:generate -- migrations/CreateAlergenos`

**Edición manual requerida** — reemplazar el índice auto-generado por:
```sql
CREATE UNIQUE INDEX "UQ_alergenos_tenant_nombre"
ON "alergenos" ("tenant_id", "nombre")
WHERE "deleted_at" IS NULL;
```

Y en `down()`:
```sql
DROP INDEX IF EXISTS "public"."UQ_alergenos_tenant_nombre";
```

## Diferencias respecto a módulos anteriores

| Aspecto | categorias-menu | etiquetas-menu | alergenos |
|---------|----------------|----------------|-----------|
| Campo estado | `activa` | `activa` | `activo` |
| `orden_visualizacion` | ✅ int nullable | ✅ int nullable | ❌ no existe |
| Orden listPublic() | `orden_visualizacion ASC NULLS LAST, nombre ASC` | `orden_visualizacion ASC NULLS LAST, nombre ASC` | `nombre ASC` |
| QB alias | `'cm'` | `'em'` | `'al'` |
| sortAllowed | nombre, orden_visualizacion, created_at | nombre, orden_visualizacion, created_at | nombre, created_at |
