---
description: "API contracts for banners-promociones module — 8 endpoints"
---

# API Endpoints: Banners y Promociones

**Base URL**: `/`
**Auth**: `JwtAuthGuard + RolesGuard` en rutas admin. Sin auth en rutas públicas.
**Tenant**: Resuelto via `x-tenant-key` header (TenancyMiddleware).
**Response envelope**: `{ ok: true, data, meta? }` (ok) / `{ ok: false, ... }` (error).

---

## 1. GET /admin/banners

Listar banners con paginación y filtros.

**Auth**: `administrador`, `supervisor`

**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `activo` | boolean | No | Filtro por estado (`true` / `false`) |
| `sortBy` | string | No | `orden_visualizacion` \| `created_at` |
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
      "titulo": "Menú del día con 10% de descuento",
      "descripcion": "Válido de lunes a viernes",
      "imagen_public_id": "banners/abc123",
      "imagen_url": "https://cdn.example.com/banners/abc123.jpg",
      "url_destino": "https://portal.example.com/menu",
      "activo": true,
      "orden_visualizacion": 1,
      "fecha_inicio": "2026-06-01",
      "fecha_fin": "2026-06-30",
      "created_at": "2026-06-07T10:00:00Z",
      "updated_at": "2026-06-07T10:00:00Z",
      "deleted_at": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

---

## 2. GET /admin/banners/:id

Obtener detalle de un banner.

**Auth**: `administrador`, `supervisor`

**Path params**: `id` (uuid)

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "titulo": "Nuevo menú vegetariano disponible",
    "descripcion": "¡Prueba nuestra nueva línea de opciones verdes!",
    "imagen_public_id": "banners/veg001",
    "imagen_url": "https://cdn.example.com/banners/veg001.jpg",
    "url_destino": null,
    "activo": true,
    "orden_visualizacion": 2,
    "fecha_inicio": null,
    "fecha_fin": null,
    "created_at": "2026-06-07T10:00:00Z",
    "updated_at": "2026-06-07T10:00:00Z",
    "deleted_at": null
  }
}
```

**Response 404** (`BANNER_NOT_FOUND`):
```json
{ "ok": false, "error": { "code": "BANNER_NOT_FOUND", "message": "Banner no encontrado" } }
```

---

## 3. POST /admin/banners

Crear un banner.

**Auth**: `administrador`

**Body**:
```json
{
  "titulo": "Horario especial esta semana",
  "descripcion": "Atendemos de 10:00 a 14:00 hs",
  "imagen_public_id": "banners/horario001",
  "imagen_url": "https://cdn.example.com/banners/horario001.jpg",
  "url_destino": null,
  "orden_visualizacion": 3,
  "fecha_inicio": "2026-06-09",
  "fecha_fin": "2026-06-13"
}
```

**Response 201**:
```json
{ "ok": true, "data": { ...banner } }
```

**Errors**:
- `422 BANNER_FECHAS_INVALIDAS` — `fecha_inicio` es posterior a `fecha_fin`

**Audit**: `banner.created`

---

## 4. PATCH /admin/banners/:id

Editar un banner existente.

**Auth**: `administrador`

**Body** (todos opcionales):
```json
{
  "titulo": "Horario especial ACTUALIZADO",
  "orden_visualizacion": 1,
  "fecha_fin": "2026-06-15"
}
```

**Response 200**: `{ "ok": true, "data": { ...banner } }`

**Errors**:
- `404 BANNER_NOT_FOUND`
- `422 BANNER_FECHAS_INVALIDAS` — coherencia entre fecha_inicio (existente o nueva) y fecha_fin

**Audit**: `banner.updated`

---

## 5. PATCH /admin/banners/:id/activar

Activar un banner inactivo.

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...banner, "activo": true } }`

**Errors**:
- `404 BANNER_NOT_FOUND`
- `409 BANNER_YA_ACTIVO`

**Audit**: `banner.activated`

---

## 6. PATCH /admin/banners/:id/inactivar

Inactivar un banner activo.

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...banner, "activo": false } }`

**Errors**:
- `404 BANNER_NOT_FOUND`
- `409 BANNER_YA_INACTIVO`

**Audit**: `banner.deactivated`

---

## 7. DELETE /admin/banners/:id

Soft delete de un banner (solo si está inactivo).

**Auth**: `administrador`

**Response 200**: `{ "ok": true, "data": { "id": "uuid" } }`

**Errors**:
- `404 BANNER_NOT_FOUND`
- `409 BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`

**Audit**: `banner.deleted`

---

## 8. GET /public/banners

Listar banners activos del tenant (portal público, sin autenticación).

**Auth**: Ninguna
**Headers requeridos**: `x-tenant-key: <tenant-key>`

**Query params**: Ninguno (sin paginación)

**Filtros aplicados automáticamente**:
- `activo = true`
- `fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE`
- `fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE`

**Order**: `orden_visualizacion ASC NULLS LAST`, luego `created_at DESC`

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "titulo": "Menú del día con 10% de descuento",
      "descripcion": "Válido de lunes a viernes",
      "imagen_public_id": "banners/abc123",
      "imagen_url": "https://cdn.example.com/banners/abc123.jpg",
      "url_destino": "https://portal.example.com/menu",
      "activo": true,
      "orden_visualizacion": 1,
      "fecha_inicio": "2026-06-01",
      "fecha_fin": "2026-06-30"
    },
    {
      "id": "uuid",
      "titulo": "Nuevo menú vegetariano disponible",
      "descripcion": "¡Prueba nuestra nueva línea de opciones verdes!",
      "imagen_public_id": "banners/veg001",
      "imagen_url": "https://cdn.example.com/banners/veg001.jpg",
      "url_destino": null,
      "activo": true,
      "orden_visualizacion": 2,
      "fecha_inicio": null,
      "fecha_fin": null
    }
  ]
}
```

**Errors**:
- `400 TENANT_REQUIRED` — falta el header `x-tenant-key`

> Sin paginación. Devuelve todos los banners activos y vigentes del tenant ordenados por posición.
