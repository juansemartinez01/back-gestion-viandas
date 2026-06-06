---
description: "API contracts for puntos-retiro module — 8 endpoints"
---

# API Endpoints: Puntos de Retiro

**Base URL**: `/`
**Auth**: `JwtAuthGuard + RolesGuard` en rutas admin. Sin auth en rutas públicas.
**Tenant**: Resuelto via `x-tenant-key` header (TenancyMiddleware).
**Response envelope**: `{ ok: true, data, meta? }` (ok) / `{ ok: false, ... }` (error).

---

## 1. GET /admin/puntos-retiro

Listar puntos de retiro con paginación, búsqueda y filtros.

**Auth**: `administrador`, `supervisor`

**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | No | Búsqueda por nombre (insensible a mayúsculas) |
| `sede_id` | uuid | No | Filtro exacto por sede |
| `activo` | boolean | No | Filtro por estado (`true` / `false`) |
| `sortBy` | string | No | `nombre` \| `orden_visualizacion` \| `created_at` |
| `sortOrder` | string | No | `ASC` \| `DESC` |
| `page` | int | No | Número de página (default: 1) |
| `limit` | int | No | Registros por página (default: 20) |

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "sede_id": "uuid",
      "nombre": "Ventanilla A",
      "descripcion": "Ventanilla principal de atención",
      "activo": true,
      "orden_visualizacion": 1,
      "observaciones": null,
      "created_at": "2026-06-06T10:00:00Z",
      "updated_at": "2026-06-06T10:00:00Z",
      "deleted_at": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## 2. GET /admin/puntos-retiro/:id

Obtener detalle de un punto de retiro.

**Auth**: `administrador`, `supervisor`

**Path params**: `id` (uuid)

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "sede_id": "uuid",
    "nombre": "Ventanilla A",
    "descripcion": "Ventanilla principal",
    "activo": true,
    "orden_visualizacion": 1,
    "observaciones": null,
    "created_at": "2026-06-06T10:00:00Z",
    "updated_at": "2026-06-06T10:00:00Z",
    "deleted_at": null
  }
}
```

**Response 404** (`PUNTO_RETIRO_NOT_FOUND`):
```json
{ "ok": false, "error": { "code": "PUNTO_RETIRO_NOT_FOUND", "message": "Punto de retiro no encontrado" } }
```

---

## 3. POST /admin/puntos-retiro

Crear un punto de retiro.

**Auth**: `administrador`

**Body**:
```json
{
  "sede_id": "uuid",
  "nombre": "Ventanilla B",
  "descripcion": "Ventanilla secundaria",
  "orden_visualizacion": 2,
  "observaciones": "Abre a las 8hs"
}
```

**Response 201**:
```json
{ "ok": true, "data": { ...puntoRetiro } }
```

**Errors**:
- `404 SEDE_NOT_FOUND` — sede_id no existe en el tenant
- `409 SEDE_INACTIVA` — la sede existe pero está inactiva
- `409 PUNTO_RETIRO_NOMBRE_DUPLICADO` — ya existe ese nombre en la misma sede y tenant

**Audit**: `punto_retiro.created`

---

## 4. PATCH /admin/puntos-retiro/:id

Editar un punto de retiro.

**Auth**: `administrador`

**Body** (todos opcionales):
```json
{
  "nombre": "Ventanilla Principal",
  "descripcion": "Nueva descripción",
  "orden_visualizacion": 1,
  "observaciones": "Cerrada los feriados"
}
```

> `sede_id` se ignora si se envía — no puede modificarse.

**Response 200**: `{ "ok": true, "data": { ...puntoRetiro } }`

**Errors**:
- `404 PUNTO_RETIRO_NOT_FOUND`
- `409 PUNTO_RETIRO_NOMBRE_DUPLICADO` (si el nuevo nombre ya existe en la misma sede)

**Audit**: `punto_retiro.updated`

---

## 5. PATCH /admin/puntos-retiro/:id/activar

Activar un punto de retiro inactivo.

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...puntoRetiro, "activo": true } }`

**Errors**:
- `404 PUNTO_RETIRO_NOT_FOUND`
- `409 PUNTO_RETIRO_YA_ACTIVO`

**Audit**: `punto_retiro.activated`

---

## 6. PATCH /admin/puntos-retiro/:id/inactivar

Inactivar un punto de retiro activo.

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...puntoRetiro, "activo": false } }`

**Errors**:
- `404 PUNTO_RETIRO_NOT_FOUND`
- `409 PUNTO_RETIRO_YA_INACTIVO`

**Audit**: `punto_retiro.deactivated`

> MVP: Sin verificación de pedidos pendientes asociados al punto.

---

## 7. DELETE /admin/puntos-retiro/:id

Soft delete de un punto de retiro (solo si está inactivo).

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { "id": "uuid" } }`

**Errors**:
- `404 PUNTO_RETIRO_NOT_FOUND`
- `409 PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`

**Audit**: `punto_retiro.deleted`

---

## 8. GET /public/puntos-retiro?sede_id=:uuid

Listar puntos de retiro activos de una sede (portal público, sin auth).

**Auth**: Ninguna
**Headers requeridos**: `x-tenant-key: <tenant-key>`

**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sede_id` | uuid | **Sí** | Filtro de sede obligatorio |

**Order**: `orden_visualizacion ASC NULLS LAST`, luego `nombre ASC`

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "sede_id": "uuid",
      "nombre": "Ventanilla A",
      "descripcion": "Ventanilla principal",
      "activo": true,
      "orden_visualizacion": 1
    }
  ]
}
```

**Errors**:
- `400 TENANT_REQUIRED` — falta el header `x-tenant-key`

> Sin paginación. Devuelve todos los activos de la sede.
