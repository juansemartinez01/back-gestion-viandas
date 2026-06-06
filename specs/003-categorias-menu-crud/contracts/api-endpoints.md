---
description: "API contracts for categorias-menu module — 8 endpoints"
---

# API Endpoints: Categorías de Menú

**Base URL**: `/`
**Auth**: `JwtAuthGuard + RolesGuard` en rutas admin. Sin auth en rutas públicas.
**Tenant**: Resuelto via `x-tenant-key` header (TenancyMiddleware).
**Response envelope**: `{ ok: true, data, meta? }` (ok) / `{ ok: false, ... }` (error).

---

## 1. GET /admin/categorias-menu

Listar categorías con paginación, búsqueda y filtros.

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
      "nombre": "Saludable",
      "descripcion": "Opciones bajas en calorías y grasas",
      "activa": true,
      "orden_visualizacion": 1,
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

## 2. GET /admin/categorias-menu/:id

Obtener detalle de una categoría.

**Auth**: `administrador`, `supervisor`

**Path params**: `id` (uuid)

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "nombre": "Vegetariano",
    "descripcion": "Sin carne ni pescado",
    "activa": true,
    "orden_visualizacion": 2,
    "created_at": "2026-06-06T10:00:00Z",
    "updated_at": "2026-06-06T10:00:00Z",
    "deleted_at": null
  }
}
```

**Response 404** (`CATEGORIA_MENU_NOT_FOUND`):
```json
{ "ok": false, "error": { "code": "CATEGORIA_MENU_NOT_FOUND", "message": "Categoría no encontrada" } }
```

---

## 3. POST /admin/categorias-menu

Crear una categoría.

**Auth**: `administrador`

**Body**:
```json
{
  "nombre": "Clásico",
  "descripcion": "Menú tradicional del día",
  "orden_visualizacion": 1
}
```

**Response 201**:
```json
{ "ok": true, "data": { ...categoriaMenu } }
```

**Errors**:
- `409 CATEGORIA_MENU_NOMBRE_DUPLICADO` — ya existe esa categoría en el tenant

**Audit**: `categoria_menu.created`

---

## 4. PATCH /admin/categorias-menu/:id

Editar una categoría.

**Auth**: `administrador`

**Body** (todos opcionales):
```json
{
  "nombre": "Clásico Premium",
  "descripcion": "Menú tradicional mejorado",
  "orden_visualizacion": 1
}
```

**Response 200**: `{ "ok": true, "data": { ...categoriaMenu } }`

**Errors**:
- `404 CATEGORIA_MENU_NOT_FOUND`
- `409 CATEGORIA_MENU_NOMBRE_DUPLICADO` (si el nuevo nombre ya existe en el tenant)

**Audit**: `categoria_menu.updated`

---

## 5. PATCH /admin/categorias-menu/:id/activar

Activar una categoría inactiva.

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...categoriaMenu, "activa": true } }`

**Errors**:
- `404 CATEGORIA_MENU_NOT_FOUND`
- `409 CATEGORIA_MENU_YA_ACTIVA`

**Audit**: `categoria_menu.activated`

---

## 6. PATCH /admin/categorias-menu/:id/inactivar

Inactivar una categoría activa.

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...categoriaMenu, "activa": false } }`

**Errors**:
- `404 CATEGORIA_MENU_NOT_FOUND`
- `409 CATEGORIA_MENU_YA_INACTIVA`

**Audit**: `categoria_menu.deactivated`

> MVP: Sin bloqueo por menús base activos. La validación completa se implementa en Stage 2 (módulo `menus-base`).

---

## 7. DELETE /admin/categorias-menu/:id

Soft delete de una categoría (solo si está inactiva).

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { "id": "uuid" } }`

**Errors**:
- `404 CATEGORIA_MENU_NOT_FOUND`
- `409 CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`

**Audit**: `categoria_menu.deleted`

---

## 8. GET /public/categorias-menu

Listar categorías activas del tenant (portal público, sin auth).

**Auth**: Ninguna
**Headers requeridos**: `x-tenant-key: <tenant-key>`

**Query params**: Ninguno

**Order**: `orden_visualizacion ASC NULLS LAST`, luego `nombre ASC`

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Clásico",
      "descripcion": "Menú tradicional del día",
      "activa": true,
      "orden_visualizacion": 1
    },
    {
      "id": "uuid",
      "nombre": "Saludable",
      "descripcion": "Opciones bajas en calorías",
      "activa": true,
      "orden_visualizacion": 2
    }
  ]
}
```

**Errors**:
- `400 TENANT_REQUIRED` — falta el header `x-tenant-key`

> Sin paginación. Devuelve todas las categorías activas del tenant.
