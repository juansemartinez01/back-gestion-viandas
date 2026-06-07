# API Contracts: Módulo Menús Base

**Base path — back office**: `/admin/menus-base`
**Base path — portal público**: `/public/menus-base`

---

## Back Office Endpoints

### GET /admin/menus-base

Listar menús base del tenant con paginación y filtros.

**Auth**: `JwtAuthGuard` + `RolesGuard`
**Roles**: `administrador`, `supervisor`

**Query params**:

| Param | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| q | string | NO | Búsqueda ILIKE en nombre |
| activo | boolean | NO | Filtro por estado |
| categoria_id | uuid | NO | INNER JOIN con menu_base_categorias |
| etiqueta_id | uuid | NO | INNER JOIN con menu_base_etiquetas |
| alergeno_id | uuid | NO | INNER JOIN con menu_base_alergenos |
| sortBy | `nombre` \| `created_at` | NO | Default: `created_at` |
| sortOrder | `ASC` \| `DESC` | NO | Default: `DESC` |
| page | number | NO | Default: 1 |
| limit | number | NO | Default: 20 |

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "nombre": "Milanesa con puré",
        "descripcion": "Clásica milanesa de ternera...",
        "imagen_public_id": "abc123",
        "imagen_url": "https://cdn.example.com/abc123.jpg",
        "ingredientes_principales": "Ternera, pan rallado...",
        "calorias_aprox": 480.00,
        "proteinas_aprox": 35.00,
        "carbohidratos_aprox": 45.00,
        "grasas_aprox": 12.00,
        "activo": true,
        "categorias": [{ "id": "uuid", "nombre": "Almuerzo" }],
        "etiquetas": [{ "id": "uuid", "nombre": "Sin gluten" }],
        "alergenos": [{ "id": "uuid", "nombre": "Gluten" }],
        "created_at": "2026-06-06T12:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### GET /admin/menus-base/:id

Detalle completo de un menú base.

**Auth**: `JwtAuthGuard` + `RolesGuard`
**Roles**: `administrador`, `supervisor`

**Response 200**: objeto MenuBase completo con relaciones (mismo shape que ítem del listado).

**Response 404**:
```json
{ "ok": false, "error": { "code": "MENU_BASE_NOT_FOUND", "message": "..." } }
```

---

### POST /admin/menus-base

Crear nuevo menú base.

**Auth**: `JwtAuthGuard` + `RolesGuard`
**Roles**: `administrador`
**Audita**: `menu_base.created`

**Body**:
```json
{
  "nombre": "Milanesa con puré",
  "descripcion": "Descripción opcional",
  "imagen_public_id": "abc123",
  "imagen_url": "https://cdn.example.com/abc123.jpg",
  "ingredientes_principales": "Ternera...",
  "calorias_aprox": 480,
  "proteinas_aprox": 35,
  "carbohidratos_aprox": 45,
  "grasas_aprox": 12,
  "categoria_ids": ["uuid-cat-1"],
  "etiqueta_ids": ["uuid-et-1"],
  "alergeno_ids": ["uuid-al-1"]
}
```

**Response 201**: objeto MenuBase creado con relaciones.

**Response 409** (nombre duplicado):
```json
{ "ok": false, "error": { "code": "MENU_BASE_NOMBRE_DUPLICADO", "message": "..." } }
```

**Response 422** (relación inválida — no existe, inactiva, o de otro tenant):
```json
{ "ok": false, "error": { "code": "MENU_BASE_RELACION_INVALIDA", "message": "CategoriaMenu uuid-x no válida para este tenant" } }
```

---

### PATCH /admin/menus-base/:id

Editar menú base. Todos los campos opcionales. Si vienen `*_ids` (incluso vacíos `[]`), se reemplazan completamente.

**Auth**: `JwtAuthGuard` + `RolesGuard`
**Roles**: `administrador`
**Audita**: `menu_base.updated`

**Body** (campos opcionales, cualquier subconjunto):
```json
{
  "nombre": "Nuevo nombre",
  "activo": true,
  "categoria_ids": ["uuid-cat-2"],
  "etiqueta_ids": [],
  "alergeno_ids": ["uuid-al-1", "uuid-al-2"]
}
```

**Response 200**: objeto MenuBase actualizado con relaciones.

**Response 404**: `MENU_BASE_NOT_FOUND`
**Response 409**: `MENU_BASE_NOMBRE_DUPLICADO`
**Response 422**: `MENU_BASE_RELACION_INVALIDA`

---

### PATCH /admin/menus-base/:id/activar

Activar un menú base inactivo.

**Auth**: `JwtAuthGuard` + `RolesGuard`
**Roles**: `administrador`
**Audita**: `menu_base.activated`

**Body**: vacío `{}`

**Response 200**: `{ "ok": true, "data": { "id": "...", "activo": true } }`
**Response 404**: `MENU_BASE_NOT_FOUND`
**Response 409**: `MENU_BASE_YA_ACTIVO`

---

### PATCH /admin/menus-base/:id/inactivar

Inactivar un menú base activo.

**Auth**: `JwtAuthGuard` + `RolesGuard`
**Roles**: `administrador`
**Audita**: `menu_base.deactivated`

**Body**: vacío `{}`

**Response 200**: `{ "ok": true, "data": { "id": "...", "activo": false } }`
**Response 404**: `MENU_BASE_NOT_FOUND`
**Response 409**: `MENU_BASE_YA_INACTIVO`

---

### DELETE /admin/menus-base/:id

Soft delete de un menú base. Solo funciona si está inactivo.

**Auth**: `JwtAuthGuard` + `RolesGuard`
**Roles**: `administrador`
**Audita**: `menu_base.deleted`

**Response 200**: `{ "ok": true, "data": null }`
**Response 404**: `MENU_BASE_NOT_FOUND`
**Response 409**: `MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`

---

## Portal Público Endpoints

### GET /public/menus-base

Listado de menús base activos del tenant. Sin paginación.

**Auth**: Sin JWT. Tenant resuelto desde `x-tenant-key` header.
**Roles**: Público.

**Headers**:
```
x-tenant-key: <tenant-key>
```

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Milanesa con puré",
      "descripcion": "...",
      "imagen_url": "https://cdn.example.com/abc123.jpg",
      "ingredientes_principales": "...",
      "calorias_aprox": 480.00,
      "proteinas_aprox": 35.00,
      "carbohidratos_aprox": 45.00,
      "grasas_aprox": 12.00,
      "categorias": [{ "id": "uuid", "nombre": "Almuerzo" }],
      "etiquetas": [{ "id": "uuid", "nombre": "Sin gluten" }],
      "alergenos": [{ "id": "uuid", "nombre": "Gluten" }]
    }
  ]
}
```

Ordenados por `nombre ASC`. Sin campos sensibles del tenant.

**Response 400/401**: tenant inválido o faltante (manejado por middleware).

---

### GET /public/menus-base/:id

Detalle público de un menú base activo.

**Auth**: Sin JWT. Tenant resuelto desde `x-tenant-key` header.

**Response 200**: objeto MenuBase activo con relaciones completas.

**Response 404** (no existe, inactivo, o de otro tenant):
```json
{ "ok": false, "error": { "code": "MENU_BASE_NOT_FOUND", "message": "..." } }
```
