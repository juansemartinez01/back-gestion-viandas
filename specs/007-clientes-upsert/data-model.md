# Data Model: Módulo Clientes

**Branch**: `007-clientes-upsert` | **Date**: 2026-06-06

## Entidad: Cliente

**Tabla**: `clientes`
**Hereda de**: `BaseEntity` (id uuid PK, tenant_id uuid, created_at, updated_at, deleted_at)

### Columnas

| Campo | Tipo DB | Tipo TS | Nulable | Default | Notas |
|-------|---------|---------|---------|---------|-------|
| `id` | uuid | string | NO | gen_random_uuid() | Heredado de BaseEntity |
| `tenant_id` | uuid | string | NO | — | Heredado de BaseEntity |
| `dni` | varchar(20) | string | NO | — | Identificador principal del cliente en el tenant |
| `nombre` | varchar(100) | string | NO | — | — |
| `apellido` | varchar(100) | string | NO | — | — |
| `telefono` | varchar(50) | string \| null | SÍ | NULL | Solo actualiza si viene informado en upsert |
| `email` | varchar(200) | string \| null | SÍ | NULL | Solo actualiza si viene informado en upsert |
| `fecha_primera_operacion` | date | Date | NO | — | Se asigna solo en creación, nunca se actualiza |
| `fecha_ultima_operacion` | date | Date | NO | — | Se actualiza en cada upsert |
| `activo` | boolean | boolean | NO | true | false = bloqueado |
| `created_at` | timestamptz | Date | NO | NOW() | Heredado |
| `updated_at` | timestamptz | Date | NO | NOW() | Heredado |
| `deleted_at` | timestamptz | Date \| null | SÍ | NULL | Heredado; no se usa en flujo normal |

### Índices

| Nombre | Columnas | Condición | Tipo |
|--------|----------|-----------|------|
| `PK_clientes_id` | `id` | — | PRIMARY KEY |
| `UQ_clientes_tenant_dni` | `(tenant_id, dni)` | `WHERE deleted_at IS NULL` | UNIQUE PARTIAL |

> **Nota**: El `@Index` en la entidad TypeScript es decorativo para que la migración generada incluya el índice. La migración debe editarse manualmente para reemplazarlo por el índice parcial con la cláusula `WHERE deleted_at IS NULL` (mismo patrón que alergenos y otras entidades del template).

### Diagrama de estados

```
[CREADO por upsert]
       │
       ▼
   activo=true ◄──── desbloquear ────┐
       │                             │
       └──── bloquear ──────► activo=false
```

No hay transición a eliminado — los clientes se bloquean, no se eliminan.

---

## DTOs

### UpsertClienteDto

Usado exclusivamente por `upsertByDni`. No expuesto como cuerpo de endpoint HTTP.

```typescript
export class UpsertClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  dni!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;
}
```

### QueryClienteDto

```typescript
export class QueryClienteDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  q?: string;  // Busca en dni OR nombre OR apellido (ILIKE)

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsIn(['apellido', 'nombre', 'fecha_ultima_operacion', 'created_at'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
```

---

## Reglas de negocio en el modelo

| Regla | Implementación |
|-------|---------------|
| DNI único por tenant (no eliminados) | Índice único parcial `UQ_clientes_tenant_dni` + `AppError CLIENTE_DNI_DUPLICADO` si QB encuentra duplicado en upsert de nuevo cliente |
| `fecha_primera_operacion` inmutable | Solo se asigna en `repo.create()`; `upsertByDni` no la sobrescribe |
| `fecha_ultima_operacion` siempre actualiza | `upsertByDni` siempre `cliente.fecha_ultima_operacion = new Date()` |
| Campos opcionales no se pisan con vacío | `if (dto.telefono !== undefined && dto.telefono !== '') cliente.telefono = dto.telefono` |
| No puede bloquear un cliente ya bloqueado | Service lanza `CLIENTE_YA_BLOQUEADO` si `activo === false` |
| No puede desbloquear un cliente ya activo | Service lanza `CLIENTE_YA_ACTIVO` si `activo === true` |
| No hay soft delete operativo | No se expone `DELETE /admin/clientes/:id`; `deleted_at` existe en tabla pero no se usa |

---

## Error Codes a agregar

```typescript
// src/common/errors/error-codes.ts — sección // clientes
CLIENTE_NOT_FOUND: 'CLIENTE_NOT_FOUND',           // 404
CLIENTE_DNI_DUPLICADO: 'CLIENTE_DNI_DUPLICADO',   // 409 (reservado, raramente alcanzable)
CLIENTE_YA_BLOQUEADO: 'CLIENTE_YA_BLOQUEADO',     // 409
CLIENTE_YA_ACTIVO: 'CLIENTE_YA_ACTIVO',           // 409
```

> `CLIENTE_DNI_DUPLICADO` es un código de defensa: en condiciones normales el upsert nunca lanza duplicado porque el flujo siempre hace update si el DNI existe. Puede ocurrir en race condition antes de que el índice único rechace la inserción concurrent.
