---
description: "Data model for banners-promociones module"
---

# Data Model: Banners y Promociones

## Entity: Banner

**Table**: `banners_promociones`
**Module**: `src/modules/banners-promociones/entities/banner.entity.ts`
**Base**: `BaseEntity` (hereda `id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at`)

### Columns

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | uuid | PK, NOT NULL | `uuid_generate_v4()` | Identificador único |
| `tenant_id` | uuid | nullable, indexed | — | Organización propietaria |
| `titulo` | varchar(200) | NOT NULL | — | Título del banner |
| `descripcion` | text | nullable | NULL | Descripción o cuerpo del mensaje |
| `imagen_public_id` | varchar(500) | nullable | NULL | Identificador S3/CDN de la imagen |
| `imagen_url` | varchar(1000) | nullable | NULL | URL pública de la imagen |
| `url_destino` | varchar(500) | nullable | NULL | Link al que lleva el banner al hacer click |
| `activo` | boolean | NOT NULL | `true` | Estado operativo del banner |
| `orden_visualizacion` | int | nullable | NULL | Posición en portal público (ASC, NULLS LAST) |
| `fecha_inicio` | date | nullable | NULL | Fecha desde la que el banner es visible |
| `fecha_fin` | date | nullable | NULL | Fecha hasta la que el banner es visible (inclusive) |
| `created_at` | timestamptz | NOT NULL | `now()` | Creación |
| `updated_at` | timestamptz | NOT NULL | `now()` | Última modificación |
| `deleted_at` | timestamptz | nullable | NULL | Soft delete timestamp |

### Indexes

| Name | Columns | Type | Condition |
|------|---------|------|-----------|
| `PK_banners_promociones` | `id` | PRIMARY KEY | — |
| `IDX_banners_tenant_id` | `tenant_id` | BTREE (heredado) | — |
| `idx_banners_tenant_activo` | `(tenant_id, activo)` | BTREE | — |

> Sin índice único — no hay restricción de unicidad en el título (múltiples banners pueden tener el mismo título).

### Foreign Keys

Ninguna — módulo sin dependencias de otros módulos de negocio.

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
- `activar()`: solo si `activo === false` → error `BANNER_YA_ACTIVO` (409) si ya está activo
- `inactivar()`: solo si `activo === true` → error `BANNER_YA_INACTIVO` (409) si ya está inactivo
- `remove()`: solo si `activo === false` → error `BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR` (409) si activo

---

## Date Range Logic (listPublic)

La visibilidad de un banner activo en el portal público depende de sus fechas:

```
fecha_inicio    fecha_fin     Resultado
─────────────────────────────────────────────────────────────────────
NULL            NULL          Siempre visible (mientras activo)
'2026-06-01'    NULL          Visible desde el 1 Jun 2026 en adelante
NULL            '2026-12-31'  Visible hasta el 31 Dic 2026
'2026-06-01'    '2026-12-31'  Visible entre 1 Jun 2026 y 31 Dic 2026 (inclusive)
```

**SQL aplicado en listPublic()**:
```sql
WHERE activo = true
  AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE)
  AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
ORDER BY orden_visualizacion ASC NULLS LAST, created_at DESC
```

---

## DTOs

### CreateBannerDto

| Field | Decorator | Required | Validation |
|-------|-----------|----------|------------|
| `titulo` | `@IsString`, `@IsNotEmpty`, `@MaxLength(200)` | ✅ | Máx 200 chars |
| `descripcion` | `@IsOptional`, `@IsString` | ❌ | Sin límite de longitud |
| `imagen_public_id` | `@IsOptional`, `@IsString`, `@MaxLength(500)` | ❌ | Máx 500 chars |
| `imagen_url` | `@IsOptional`, `@IsUrl`, `@MaxLength(1000)` | ❌ | URL válida, máx 1000 chars |
| `url_destino` | `@IsOptional`, `@IsString`, `@MaxLength(500)` | ❌ | Máx 500 chars |
| `activo` | `@IsOptional`, `@IsBoolean` | ❌ | Default: `true` en entidad |
| `orden_visualizacion` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Type(() => Number)` | ❌ | Entero ≥ 1 |
| `fecha_inicio` | `@IsOptional`, `@IsDateString` | ❌ | Formato ISO 8601 (YYYY-MM-DD) |
| `fecha_fin` | `@IsOptional`, `@IsDateString` | ❌ | Formato ISO 8601 (YYYY-MM-DD) |

> Validación cruzada de fechas se realiza en el service (no en el DTO): si ambas están presentes, `fecha_inicio <= fecha_fin`.

### UpdateBannerDto

Todos los campos opcionales. Declarados explícitamente (sin `PartialType`), mismo patrón que módulos anteriores.

| Field | Decorator |
|-------|-----------|
| `titulo` | `@IsOptional`, `@IsString`, `@IsNotEmpty`, `@MaxLength(200)` |
| `descripcion` | `@IsOptional`, `@IsString` |
| `imagen_public_id` | `@IsOptional`, `@IsString`, `@MaxLength(500)` |
| `imagen_url` | `@IsOptional`, `@IsUrl`, `@MaxLength(1000)` |
| `url_destino` | `@IsOptional`, `@IsString`, `@MaxLength(500)` |
| `orden_visualizacion` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Type(() => Number)` |
| `fecha_inicio` | `@IsOptional`, `@IsDateString` |
| `fecha_fin` | `@IsOptional`, `@IsDateString` |

### QueryBannerDto

Extiende `PageQueryDto` del template.

| Field | Decorator | Description |
|-------|-----------|-------------|
| `activo` | `@IsOptional`, `@IsBoolean`, `@Transform` | Filtro por estado |
| `sortBy` | `@IsOptional`, `@IsIn(['orden_visualizacion','created_at'])` | Campo de ordenamiento |
| `sortOrder` | `@IsOptional`, `@IsIn(['ASC','DESC'])` | Dirección |

> Sin campo `q` (búsqueda textual) — el spec no la requiere para el listado admin.

---

## Error Codes

Agregar en `src/common/errors/error-codes.ts` antes de cualquier otra implementación:

| Code | HTTP | Description |
|------|------|-------------|
| `BANNER_NOT_FOUND` | 404 | Banner no encontrado en el tenant |
| `BANNER_YA_ACTIVO` | 409 | El banner ya se encuentra activo |
| `BANNER_YA_INACTIVO` | 409 | El banner ya se encuentra inactivo |
| `BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR` | 409 | Solo se pueden eliminar banners inactivos |
| `BANNER_FECHAS_INVALIDAS` | 422 | fecha_inicio no puede ser posterior a fecha_fin |

---

## Migration Checklist

- [ ] Tabla `banners_promociones` con todos los campos
- [ ] Índice `IDX_banners_tenant_id` en `tenant_id` (heredado de BaseEntity)
- [ ] Índice `idx_banners_tenant_activo` compuesto en `(tenant_id, activo)`
- [ ] Sin índice único en título
- [ ] `down()` con DROP de índices y tabla en orden correcto
