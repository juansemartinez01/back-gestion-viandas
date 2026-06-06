# API Endpoints: Módulo Clientes

**Branch**: `007-clientes-upsert` | **Date**: 2026-06-06

Todos los endpoints requieren `JwtAuthGuard` + `RolesGuard`. No hay endpoints públicos.

---

## GET /admin/clientes

Lista clientes del tenant con paginación y búsqueda.

**Auth**: JWT requerido | **Roles**: `administrador`, `supervisor`

### Query Parameters

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `page` | number | No | Número de página (default: 1) |
| `limit` | number | No | Items por página (default: 20, max: 100) |
| `q` | string | No | Búsqueda libre — busca en `dni`, `nombre` y `apellido` (ILIKE, OR entre los tres) |
| `activo` | boolean | No | Filtra por estado: `true` = activos, `false` = bloqueados |
| `sortBy` | string | No | Campo de orden: `apellido` \| `nombre` \| `fecha_ultima_operacion` \| `created_at`. Default: `apellido` |
| `sortOrder` | string | No | `ASC` \| `DESC`. Default: `ASC` |

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "dni": "12345678",
      "nombre": "Juan",
      "apellido": "Pérez",
      "telefono": "3511234567",
      "email": "juan@example.com",
      "fecha_primera_operacion": "2026-01-15",
      "fecha_ultima_operacion": "2026-06-01",
      "activo": true,
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-06-01T09:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Errors

| Código HTTP | ErrorCode | Condición |
|-------------|-----------|-----------|
| 401 | `AUTH_INVALID` | JWT ausente o inválido |
| 403 | `AUTH_FORBIDDEN` | Rol insuficiente |

---

## GET /admin/clientes/:id

Detalle completo de un cliente.

**Auth**: JWT requerido | **Roles**: `administrador`, `supervisor`

### Path Parameters

| Param | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID del cliente |

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "dni": "12345678",
    "nombre": "Juan",
    "apellido": "Pérez",
    "telefono": "3511234567",
    "email": "juan@example.com",
    "fecha_primera_operacion": "2026-01-15",
    "fecha_ultima_operacion": "2026-06-01",
    "activo": true,
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-06-01T09:30:00Z"
  }
}
```

### Errors

| Código HTTP | ErrorCode | Condición |
|-------------|-----------|-----------|
| 401 | `AUTH_INVALID` | JWT ausente o inválido |
| 403 | `AUTH_FORBIDDEN` | Rol insuficiente |
| 404 | `CLIENTE_NOT_FOUND` | ID no existe en el tenant actual |

---

## PATCH /admin/clientes/:id/bloquear

Desactiva un cliente (`activo = false`). Genera entrada de auditoría.

**Auth**: JWT requerido | **Roles**: `administrador` únicamente

### Path Parameters

| Param | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID del cliente |

### Request Body

Sin cuerpo.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "dni": "12345678",
    "nombre": "Juan",
    "apellido": "Pérez",
    "activo": false,
    "updated_at": "2026-06-06T10:00:00Z"
  }
}
```

### Errors

| Código HTTP | ErrorCode | Condición |
|-------------|-----------|-----------|
| 401 | `AUTH_INVALID` | JWT ausente o inválido |
| 403 | `AUTH_FORBIDDEN` | Rol insuficiente (supervisor) |
| 404 | `CLIENTE_NOT_FOUND` | ID no existe en el tenant actual |
| 409 | `CLIENTE_YA_BLOQUEADO` | El cliente ya está bloqueado |

### Audit Event

```
action: "cliente.bloqueado"
entity: "cliente"
extra: { clienteId, dni, nombre, apellido }
```

---

## PATCH /admin/clientes/:id/desbloquear

Activa un cliente (`activo = true`). Genera entrada de auditoría.

**Auth**: JWT requerido | **Roles**: `administrador` únicamente

### Path Parameters

| Param | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID del cliente |

### Request Body

Sin cuerpo.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "dni": "12345678",
    "nombre": "Juan",
    "apellido": "Pérez",
    "activo": true,
    "updated_at": "2026-06-06T10:00:00Z"
  }
}
```

### Errors

| Código HTTP | ErrorCode | Condición |
|-------------|-----------|-----------|
| 401 | `AUTH_INVALID` | JWT ausente o inválido |
| 403 | `AUTH_FORBIDDEN` | Rol insuficiente (supervisor) |
| 404 | `CLIENTE_NOT_FOUND` | ID no existe en el tenant actual |
| 409 | `CLIENTE_YA_ACTIVO` | El cliente ya está activo |

### Audit Event

```
action: "cliente.desbloqueado"
entity: "cliente"
extra: { clienteId, dni, nombre, apellido }
```

---

## Método interno: upsertByDni (no es endpoint HTTP)

Llamado por `PedidosService` en Stage 3. No se expone como endpoint.

### Firma

```typescript
async upsertByDni(dto: UpsertClienteDto): Promise<Cliente>
```

### Flujo

```
1. getTenantId({ strictTenant: true })
2. QB: SELECT ... WHERE tenant_id=:t AND dni=:dni AND deleted_at IS NULL
3a. Si existe:
    - cliente.nombre = dto.nombre
    - cliente.apellido = dto.apellido
    - if (dto.telefono) cliente.telefono = dto.telefono
    - if (dto.email) cliente.email = dto.email
    - cliente.fecha_ultima_operacion = new Date()
    - repo.save(cliente)
3b. Si no existe:
    - repo.create({ ...dto, tenant_id, fecha_primera_operacion: today, fecha_ultima_operacion: today, activo: true })
    - repo.save(nuevoCliente)
4. return cliente
```

### Input: UpsertClienteDto

| Campo | Tipo | Requerido |
|-------|------|-----------|
| `dni` | string (max 20) | Sí |
| `nombre` | string (max 100) | Sí |
| `apellido` | string (max 100) | Sí |
| `telefono` | string (max 50) | No |
| `email` | string email (max 200) | No |

### Output

El objeto `Cliente` completo (creado o actualizado).

---

## Resumen de endpoints HTTP

| Método | Ruta | Roles | Auditable |
|--------|------|-------|-----------|
| GET | `/admin/clientes` | administrador, supervisor | No |
| GET | `/admin/clientes/:id` | administrador, supervisor | No |
| PATCH | `/admin/clientes/:id/bloquear` | administrador | Sí |
| PATCH | `/admin/clientes/:id/desbloquear` | administrador | Sí |

**Sin** endpoints `POST /admin/clientes`, `PATCH /admin/clientes/:id`, `DELETE /admin/clientes/:id`.
**Sin** controller público.
