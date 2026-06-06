# API Contracts: Gestión de Sedes

**Feature**: 001-sedes-crud
**Date**: 2026-06-06
**Base URL**: `/api` (or as configured in the template)

All responses follow the template standard:
- Success: `{ ok: true, data, meta? }`
- Error: `{ ok: false, requestId, statusCode, error: { code, message, details? }, timestamp, path }`

---

## Back Office Endpoints

All back office endpoints require:
- `Authorization: Bearer <jwt>` header
- `x-tenant-id` or resolved from JWT claim

---

### GET /admin/sedes

**Description**: List sedes with pagination, search, and filters.
**Roles**: `administrador`, `supervisor`

**Query Parameters**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 200) |
| `q` | string | No | Search term (ILIKE on nombre, direccion) |
| `sortBy` | string | No | `nombre` \| `orden_visualizacion` \| `created_at` |
| `sortOrder` | string | No | `ASC` \| `DESC` (default: ASC) |
| `activa` | boolean | No | `true` \| `false` — filter by active state |

**Success Response** `200`:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Campus Norte",
      "direccion": "Av. Principal 1234",
      "telefono_contacto": "011-1234-5678",
      "observaciones": null,
      "activa": true,
      "orden_visualizacion": 1,
      "tenant_id": "uuid",
      "created_at": "2026-06-06T10:00:00Z",
      "updated_at": "2026-06-06T10:00:00Z",
      "deleted_at": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

---

### GET /admin/sedes/:id

**Description**: Get single sede detail.
**Roles**: `administrador`, `supervisor`

**Path Parameters**: `id` (UUID)

**Success Response** `200`:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "nombre": "Campus Norte",
    "direccion": "Av. Principal 1234",
    "telefono_contacto": "011-1234-5678",
    "observaciones": "Sede principal",
    "activa": true,
    "orden_visualizacion": 1,
    "tenant_id": "uuid",
    "created_at": "2026-06-06T10:00:00Z",
    "updated_at": "2026-06-06T10:00:00Z",
    "deleted_at": null
  }
}
```

**Error Responses**:
- `404` — `SEDE_NOT_FOUND`: Sede not found or belongs to another tenant

---

### POST /admin/sedes

**Description**: Create a new sede.
**Roles**: `administrador`
**Audit**: `sede.created`

**Request Body**:
```json
{
  "nombre": "Campus Norte",
  "direccion": "Av. Principal 1234",
  "telefono_contacto": "011-1234-5678",
  "observaciones": "Sede principal",
  "orden_visualizacion": 1
}
```

| Field | Type | Required |
|-------|------|----------|
| `nombre` | string (max 150) | Yes |
| `direccion` | string (max 300) | Yes |
| `telefono_contacto` | string (max 50) | No |
| `observaciones` | string | No |
| `orden_visualizacion` | integer (min 1) | No |

**Success Response** `201`:
```json
{
  "ok": true,
  "data": { /* full Sede object */ }
}
```

**Error Responses**:
- `409` — `SEDE_NOMBRE_DUPLICADO`: A sede with this name already exists in this tenant

---

### PATCH /admin/sedes/:id

**Description**: Update an existing sede (partial update).
**Roles**: `administrador`
**Audit**: `sede.updated`

**Path Parameters**: `id` (UUID)

**Request Body**: Same fields as POST, all optional.

**Success Response** `200`:
```json
{
  "ok": true,
  "data": { /* full updated Sede object */ }
}
```

**Error Responses**:
- `404` — `SEDE_NOT_FOUND`
- `409` — `SEDE_NOMBRE_DUPLICADO`

---

### PATCH /admin/sedes/:id/activar

**Description**: Activate an inactive sede.
**Roles**: `administrador`
**Audit**: `sede.activated`

**Path Parameters**: `id` (UUID)
**Request Body**: None

**Success Response** `200`:
```json
{
  "ok": true,
  "data": { /* full updated Sede object with activa: true */ }
}
```

**Error Responses**:
- `404` — `SEDE_NOT_FOUND`
- `409` — `SEDE_YA_ACTIVA`: Sede is already active

---

### PATCH /admin/sedes/:id/inactivar

**Description**: Deactivate an active sede.
**Roles**: `administrador`
**Audit**: `sede.deactivated`

**Path Parameters**: `id` (UUID)
**Request Body**: None

**Success Response** `200`:
```json
{
  "ok": true,
  "data": { /* full updated Sede object with activa: false */ }
}
```

**Error Responses**:
- `404` — `SEDE_NOT_FOUND`
- `409` — `SEDE_YA_INACTIVA`: Sede is already inactive
- *(MVP)*: If sede has active published menus or pending orders, response still succeeds but
  may include a `meta.warning` advisory message. Blocking validation deferred to Stage 2/3.

---

### DELETE /admin/sedes/:id

**Description**: Soft-delete a sede. Sede must be inactive first.
**Roles**: `administrador`
**Audit**: `sede.deleted`

**Path Parameters**: `id` (UUID)

**Success Response** `200`:
```json
{
  "ok": true,
  "data": { "id": "uuid" }
}
```

**Error Responses**:
- `404` — `SEDE_NOT_FOUND`
- `409` — `SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`: Must inactivate before deleting

---

## Public Endpoint

No authentication required. Tenant resolved from `x-tenant-key` header.

---

### GET /public/sedes

**Description**: List active sedes for the public portal. Used by clients to select a sede
when placing an order.
**Authentication**: None (public)
**Tenant Resolution**: From `x-tenant-key` request header (mandatory)

**Headers**:

| Header | Required | Description |
|--------|----------|-------------|
| `x-tenant-key` | Yes | Organization identifier |

**Query Parameters**: None (no pagination)

**Success Response** `200`:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Campus Norte",
      "direccion": "Av. Principal 1234",
      "telefono_contacto": "011-1234-5678",
      "activa": true,
      "orden_visualizacion": 1
    },
    {
      "id": "uuid",
      "nombre": "Campus Sur",
      "direccion": "Av. Secundaria 5678",
      "telefono_contacto": null,
      "activa": true,
      "orden_visualizacion": 2
    },
    {
      "id": "uuid",
      "nombre": "Sede Central",
      "direccion": "Centro 999",
      "telefono_contacto": null,
      "activa": true,
      "orden_visualizacion": null
    }
  ]
}
```

**Ordering**: `orden_visualizacion ASC NULLS LAST`, then `nombre ASC` as tiebreaker.

**Error Responses**:
- `400` — `TENANT_REQUIRED`: `x-tenant-key` header missing or unresolvable

---

## Error Code Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SEDE_NOT_FOUND` | 404 | Sede does not exist or not accessible from current tenant |
| `SEDE_NOMBRE_DUPLICADO` | 409 | A sede with the same name already exists in this tenant |
| `SEDE_YA_ACTIVA` | 409 | Cannot activate an already-active sede |
| `SEDE_YA_INACTIVA` | 409 | Cannot deactivate an already-inactive sede |
| `SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR` | 409 | Sede must be inactive before soft-delete |
| `TENANT_REQUIRED` | 400 | Request missing tenant context |
