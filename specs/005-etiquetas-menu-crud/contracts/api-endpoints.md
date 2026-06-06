---
description: "API contracts for etiquetas-menu module — 8 endpoints (identical structure to categorias-menu)"
---

# API Endpoints: Etiquetas de Menú

**Base URL**: `/`
**Auth**: `JwtAuthGuard + RolesGuard` en rutas admin. Sin auth en rutas públicas.
**Tenant**: Resuelto via `x-tenant-key` header (TenancyMiddleware).
**Response envelope**: `{ ok: true, data, meta? }` (ok) / `{ ok: false, ... }` (error).

---

## 1. GET /admin/etiquetas-menu

Listar etiquetas con paginación, búsqueda y filtros.

**Auth**: `administrador`, `supervisor`

**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | No | Búsqueda por nombre (insensible a mayúsculas) |
| `activa` | boolean | No | Filtro por estado (`true` / `false`) |
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
      "nombre": "Sin carne",
      "descripcion": "Apto para vegetarianos",
      "activa": true,
      "orden_visualizacion": 1,
      "created_at": "2026-06-06T10:00:00Z",
      "updated_at": "2026-06-06T10:00:00Z",
      "deleted_at": null
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

## 2. GET /admin/etiquetas-menu/:id

Obtener detalle de una etiqueta.

**Auth**: `administrador`, `supervisor`

**Response 200**: `{ "ok": true, "data": { ...etiqueta } }`

**Response 404** (`ETIQUETA_MENU_NOT_FOUND`):
```json
{ "ok": false, "error": { "code": "ETIQUETA_MENU_NOT_FOUND", "message": "Etiqueta de menú no encontrada" } }
```

---

## 3. POST /admin/etiquetas-menu

Crear una etiqueta.

**Auth**: `administrador`

**Body**:
```json
{ "nombre": "Recomendado", "descripcion": "Destacado por el chef", "orden_visualizacion": 1 }
```

**Response 201**: `{ "ok": true, "data": { ...etiqueta } }`

**Errors**:
- `409 ETIQUETA_MENU_NOMBRE_DUPLICADO`

**Audit**: `etiqueta_menu.created`

---

## 4. PATCH /admin/etiquetas-menu/:id

Editar una etiqueta.

**Auth**: `administrador`

**Body** (todos opcionales): `{ "nombre": "...", "descripcion": "...", "orden_visualizacion": 2 }`

**Response 200**: `{ "ok": true, "data": { ...etiqueta } }`

**Errors**: `404 ETIQUETA_MENU_NOT_FOUND`, `409 ETIQUETA_MENU_NOMBRE_DUPLICADO`

**Audit**: `etiqueta_menu.updated`

---

## 5. PATCH /admin/etiquetas-menu/:id/activar

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...etiqueta, "activa": true } }`

**Errors**: `404 ETIQUETA_MENU_NOT_FOUND`, `409 ETIQUETA_MENU_YA_ACTIVA`

**Audit**: `etiqueta_menu.activated`

---

## 6. PATCH /admin/etiquetas-menu/:id/inactivar

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...etiqueta, "activa": false } }`

**Errors**: `404 ETIQUETA_MENU_NOT_FOUND`, `409 ETIQUETA_MENU_YA_INACTIVA`

**Audit**: `etiqueta_menu.deactivated`

> MVP: Sin bloqueo por menús base activos.

---

## 7. DELETE /admin/etiquetas-menu/:id

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { "id": "uuid" } }`

**Errors**: `404 ETIQUETA_MENU_NOT_FOUND`, `409 ETIQUETA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`

**Audit**: `etiqueta_menu.deleted`

---

## 8. GET /public/etiquetas-menu

Listar etiquetas activas del tenant (portal público, sin auth).

**Auth**: Ninguna
**Headers requeridos**: `x-tenant-key: <tenant-key>`

**Order**: `orden_visualizacion ASC NULLS LAST`, luego `nombre ASC`

**Response 200**:
```json
{
  "ok": true,
  "data": [
    { "id": "uuid", "nombre": "Recomendado", "descripcion": "Destacado por el chef", "activa": true, "orden_visualizacion": 1 }
  ]
}
```

**Errors**: `400 TENANT_REQUIRED`

> Sin paginación. Sin query params.
