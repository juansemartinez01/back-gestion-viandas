---
description: "Data model for puntos-retiro module"
---

# Data Model: Puntos de Retiro

## Entity: PuntoRetiro

**Table**: `puntos_retiro`
**Module**: `src/modules/puntos-retiro/entities/punto-retiro.entity.ts`
**Base**: `BaseEntity` (hereda `id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at`)

### Columns

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | uuid | PK, NOT NULL | `uuid_generate_v4()` | Identificador único |
| `tenant_id` | uuid | nullable, indexed | — | Organización propietaria |
| `sede_id` | uuid | NOT NULL, FK → sedes.id | — | Sede a la que pertenece |
| `nombre` | varchar(150) | NOT NULL | — | Nombre del punto |
| `descripcion` | varchar(300) | nullable | NULL | Descripción breve |
| `activo` | boolean | NOT NULL | `true` | Estado operativo |
| `orden_visualizacion` | int | nullable | NULL | Orden en portal público |
| `observaciones` | text | nullable | NULL | Notas internas |
| `created_at` | timestamptz | NOT NULL | `now()` | Creación |
| `updated_at` | timestamptz | NOT NULL | `now()` | Última modificación |
| `deleted_at` | timestamptz | nullable | NULL | Soft delete timestamp |

### Indexes

| Name | Columns | Type | Condition |
|------|---------|------|-----------|
| `PK_puntos_retiro` | `id` | PRIMARY KEY | — |
| `IDX_puntos_retiro_tenant_id` | `tenant_id` | BTREE | — |
| `IDX_puntos_retiro_sede_id` | `sede_id` | BTREE | — |
| `UQ_puntos_retiro_tenant_sede_nombre` | `(tenant_id, sede_id, nombre)` | UNIQUE | `WHERE deleted_at IS NULL` |

### Foreign Keys

| Column | References | On Delete | On Update |
|--------|-----------|-----------|-----------|
| `sede_id` | `sedes(id)` | NO ACTION (RESTRICT equiv.) | NO ACTION |

### Relationships

- **ManyToOne** → `Sede` via `sede_id` (eager: false, no cascade)

---

## State Transitions: activo

```
[Created] ──────────────────────────────► activo = true  (default)
                                                │
                                        inactivar()
                                                │
                                                ▼
                                         activo = false
                                                │
                                    activar() ◄─┘
                                    (returns to activo = true)
                                                │
                                          remove()
                                         (solo desde activo = false)
                                                │
                                                ▼
                                         deleted_at SET
                                         (soft delete)
```

**Reglas de transición**:
- `activar()`: solo si `activo === false` → error `PUNTO_RETIRO_YA_ACTIVO` si ya está activo
- `inactivar()`: solo si `activo === true` → error `PUNTO_RETIRO_YA_INACTIVO` si ya está inactivo
- `remove()`: solo si `activo === false` → error `PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR` si activo

---

## DTOs

### CreatePuntoRetiroDto

| Field | Decorator | Required | Validation |
|-------|-----------|----------|------------|
| `sede_id` | `@IsUUID`, `@IsNotEmpty` | ✅ | UUID válido |
| `nombre` | `@IsString`, `@IsNotEmpty`, `@MaxLength(150)` | ✅ | Máx 150 chars |
| `descripcion` | `@IsOptional`, `@IsString`, `@MaxLength(300)` | ❌ | Máx 300 chars |
| `activo` | `@IsOptional`, `@IsBoolean` | ❌ | Boolean (default true en entidad) |
| `orden_visualizacion` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Type(() => Number)` | ❌ | Entero ≥ 1 |
| `observaciones` | `@IsOptional`, `@IsString` | ❌ | Sin límite de chars |

### UpdatePuntoRetiroDto

Igual que `CreatePuntoRetiroDto` pero **sin `sede_id`** y todos los campos opcionales.

| Field | Decorator |
|-------|-----------|
| `nombre` | `@IsOptional`, `@IsString`, `@IsNotEmpty`, `@MaxLength(150)` |
| `descripcion` | `@IsOptional`, `@IsString`, `@MaxLength(300)` |
| `activo` | `@IsOptional`, `@IsBoolean` |
| `orden_visualizacion` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Type(() => Number)` |
| `observaciones` | `@IsOptional`, `@IsString` |

> **Nota**: `sede_id` se omite deliberadamente — la sede de un punto de retiro no puede modificarse.

### QueryPuntoRetiroDto

Extiende `PageQueryDto` del template.

| Field | Decorator | Description |
|-------|-----------|-------------|
| `q` | `@IsOptional`, `@IsString` | Búsqueda por nombre (ILIKE) |
| `sede_id` | `@IsOptional`, `@IsUUID` | Filtro exacto por sede |
| `activo` | `@IsOptional`, `@IsBoolean`, `@Transform` | Filtro por estado |
| `sortBy` | `@IsOptional`, `@IsString` | Campo de ordenamiento |
| `sortOrder` | `@IsOptional`, `@IsIn(['ASC','DESC'])` | Dirección |

### PublicQueryPuntoRetiroDto (solo para endpoint público)

| Field | Decorator | Description |
|-------|-----------|-------------|
| `sede_id` | `@IsUUID`, `@IsNotEmpty` | Sede requerida — sin `@IsOptional` |

---

## Migration Checklist

- [ ] Tabla `puntos_retiro` con todos los campos
- [ ] FK `sede_id → sedes(id)` ON DELETE NO ACTION
- [ ] Índice `IDX_puntos_retiro_tenant_id` en `tenant_id`
- [ ] Índice `IDX_puntos_retiro_sede_id` en `sede_id`
- [ ] Índice parcial único `UQ_puntos_retiro_tenant_sede_nombre` con `WHERE deleted_at IS NULL`
- [ ] `down()` con DROP de FK, índices y tabla en orden correcto
