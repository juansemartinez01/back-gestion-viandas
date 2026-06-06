# Data Model: Gestión de Sedes

**Feature**: 001-sedes-crud
**Date**: 2026-06-06

## Entity: Sede

**Table**: `sedes`
**File**: `src/modules/sedes/entities/sede.entity.ts`
**Extends**: `BaseEntity` (from `src/common/database/base.entity.ts`)

### Inherited from BaseEntity

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, auto-generated |
| `tenant_id` | `uuid \| null` | Tenant scope, indexed |
| `created_at` | `timestamptz` | Auto-set on insert |
| `updated_at` | `timestamptz` | Auto-set on update |
| `deleted_at` | `timestamptz \| null` | Soft delete column |

### Domain Columns

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `nombre` | `varchar(150)` | No | — | Unique within tenant (partial, excl. deleted) |
| `direccion` | `varchar(300)` | No | — | — |
| `telefono_contacto` | `varchar(50)` | Yes | `null` | — |
| `observaciones` | `text` | Yes | `null` | — |
| `activa` | `boolean` | No | `true` | — |
| `orden_visualizacion` | `integer` | Yes | `null` | Min 1 (validated at DTO level) |

### Indexes

| Name | Columns | Type | Condition |
|------|---------|------|-----------|
| `UQ_sedes_tenant_nombre` | `(tenant_id, nombre)` | UNIQUE | `WHERE deleted_at IS NULL` |

**Note**: This partial index must be created manually in the migration file after generation,
because TypeORM does not auto-generate partial index conditions.

### State Transitions

```
[CREATED] → activa=true
     │
     ▼
  inactivar()  ──→  activa=false
     │                   │
     │                   ▼
     │             remove()  ──→  deleted_at=<timestamp>  (soft delete)
     │
     ▼
  activar()  ──→  activa=true  (can loop back)
```

**State rules**:
- New sedes are always created with `activa=true`.
- `activar()` MUST fail if `activa=true` already (SEDE_YA_ACTIVA).
- `inactivar()` MUST fail if `activa=false` already (SEDE_YA_INACTIVA).
- `remove()` MUST fail if `activa=true` (SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR).

## ErrorCodes to Add

File: `src/common/errors/error-codes.ts`

```typescript
// sedes
SEDE_NOT_FOUND: 'SEDE_NOT_FOUND',                                          // 404
SEDE_NOMBRE_DUPLICADO: 'SEDE_NOMBRE_DUPLICADO',                            // 409
SEDE_YA_ACTIVA: 'SEDE_YA_ACTIVA',                                          // 409
SEDE_YA_INACTIVA: 'SEDE_YA_INACTIVA',                                      // 409
SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR', // 409
```

## DTOs

### CreateSedeDto

File: `src/modules/sedes/dto/create-sede.dto.ts`

| Field | Decorator | Validation |
|-------|-----------|------------|
| `nombre` | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(150)` | Required |
| `direccion` | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(300)` | Required |
| `telefono_contacto` | `@IsOptional()`, `@IsString()`, `@MaxLength(50)` | Optional |
| `observaciones` | `@IsOptional()`, `@IsString()` | Optional |
| `orden_visualizacion` | `@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Type(() => Number)` | Optional |

### UpdateSedeDto

File: `src/modules/sedes/dto/update-sede.dto.ts`

`PartialType(CreateSedeDto)` — all fields optional.

### QuerySedeDto

File: `src/modules/sedes/dto/query-sede.dto.ts`

Extends `PageQueryDto`. Additional fields:

| Field | Decorator | Notes |
|-------|-----------|-------|
| `q` | `@IsOptional()`, `@IsString()` | Search term (ILIKE on nombre, direccion) |
| `sortBy` | `@IsOptional()`, `@IsString()` | Allowed: nombre, orden_visualizacion, created_at |
| `sortOrder` | `@IsOptional()`, `@IsIn(['ASC','DESC'])` | Default ASC |
| `activa` | `@IsOptional()`, `@IsBoolean()`, `@Transform()` | Filter by active state |

**Note on `activa` boolean transformation**: Query params arrive as strings. Use
`@Transform(({ value }) => value === 'true')` or `@Type(() => Boolean)` to coerce.

## Migration Checklist

Generated file: `migrations/<timestamp>-CreateSedes.ts`

Required in `up()`:
- [ ] `CREATE TABLE "sedes"` with all domain columns
- [ ] `ALTER TABLE "sedes" ADD COLUMN "deleted_at" TIMESTAMPTZ` (if not auto-included)
- [ ] Manual: replace auto-generated unique index with partial index:
  ```sql
  CREATE UNIQUE INDEX "UQ_sedes_tenant_nombre"
  ON "sedes" ("tenant_id", "nombre")
  WHERE "deleted_at" IS NULL;
  ```

Required in `down()`:
- [ ] `DROP INDEX "UQ_sedes_tenant_nombre"`
- [ ] `DROP TABLE "sedes"`
