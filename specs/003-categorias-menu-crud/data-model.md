---
description: "Data model for categorias-menu module"
---

# Data Model: Categorías de Menú

## Entity: CategoriaMenu

**Table**: `categorias_menu`
**Module**: `src/modules/categorias-menu/entities/categoria-menu.entity.ts`
**Base**: `BaseEntity` (hereda `id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at`)

### Columns

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | uuid | PK, NOT NULL | `uuid_generate_v4()` | Identificador único |
| `tenant_id` | uuid | nullable, indexed | — | Organización propietaria |
| `nombre` | varchar(100) | NOT NULL | — | Nombre de la categoría |
| `descripcion` | varchar(300) | nullable | NULL | Descripción breve |
| `activa` | boolean | NOT NULL | `true` | Estado operativo |
| `orden_visualizacion` | int | nullable | NULL | Orden en portal público |
| `created_at` | timestamptz | NOT NULL | `now()` | Creación |
| `updated_at` | timestamptz | NOT NULL | `now()` | Última modificación |
| `deleted_at` | timestamptz | nullable | NULL | Soft delete timestamp |

### Indexes

| Name | Columns | Type | Condition |
|------|---------|------|-----------|
| `PK_categorias_menu` | `id` | PRIMARY KEY | — |
| `IDX_categorias_menu_tenant_id` | `tenant_id` | BTREE | — |
| `UQ_categorias_menu_tenant_nombre` | `(tenant_id, nombre)` | UNIQUE | `WHERE deleted_at IS NULL` |

### Foreign Keys

Ninguna — este módulo no tiene FK a otras entidades de negocio (dato maestro puro).

---

## State Transitions: activa

```
[Created] ──────────────────────────────► activa = true  (default)
                                                │
                                        inactivar()
                                                │
                                                ▼
                                         activa = false
                                                │
                                    activar() ◄─┘
                                    (returns to activa = true)
                                                │
                                          remove()
                                         (solo desde activa = false)
                                                │
                                                ▼
                                         deleted_at SET
                                         (soft delete)
```

**Reglas de transición**:
- `activar()`: solo si `activa === false` → error `CATEGORIA_MENU_YA_ACTIVA` si ya está activa
- `inactivar()`: solo si `activa === true` → error `CATEGORIA_MENU_YA_INACTIVA` si ya está inactiva
- `remove()`: solo si `activa === false` → error `CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR` si activa

---

## DTOs

### CreateCategoriaMenuDto

| Field | Decorator | Required | Validation |
|-------|-----------|----------|------------|
| `nombre` | `@IsString`, `@IsNotEmpty`, `@MaxLength(100)` | ✅ | Máx 100 chars |
| `descripcion` | `@IsOptional`, `@IsString`, `@MaxLength(300)` | ❌ | Máx 300 chars |
| `orden_visualizacion` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Type(() => Number)` | ❌ | Entero ≥ 1 |

### UpdateCategoriaMenuDto

Igual que `CreateCategoriaMenuDto` pero todos los campos opcionales. Declarados explícitamente (sin PartialType).

| Field | Decorator |
|-------|-----------|
| `nombre` | `@IsOptional`, `@IsString`, `@IsNotEmpty`, `@MaxLength(100)` |
| `descripcion` | `@IsOptional`, `@IsString`, `@MaxLength(300)` |
| `orden_visualizacion` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Type(() => Number)` |

### QueryCategoriaMenuDto

Extiende `PageQueryDto` del template.

| Field | Decorator | Description |
|-------|-----------|-------------|
| `q` | `@IsOptional`, `@IsString` | Búsqueda por nombre (ILIKE) |
| `activa` | `@IsOptional`, `@IsBoolean`, `@Transform` | Filtro por estado |
| `sortBy` | `@IsOptional`, `@IsString` | Campo de ordenamiento |
| `sortOrder` | `@IsOptional`, `@IsIn(['ASC','DESC'])` | Dirección |

> El endpoint público no necesita DTO de query — no tiene parámetros.

---

## Migration Checklist

- [ ] Tabla `categorias_menu` con todos los campos
- [ ] Índice `IDX_categorias_menu_tenant_id` en `tenant_id`
- [ ] Índice parcial único `UQ_categorias_menu_tenant_nombre` con `WHERE deleted_at IS NULL`
- [ ] `down()` con DROP de índices y tabla en orden correcto
