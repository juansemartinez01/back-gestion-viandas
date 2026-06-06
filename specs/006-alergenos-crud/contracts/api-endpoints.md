# API Endpoints: Módulo Alérgenos

**Feature**: `006-alergenos-crud`
**Base path admin**: `/admin/alergenos`
**Base path público**: `/public/alergenos`

## Back Office (requieren JWT + Roles)

### GET /admin/alergenos

**Descripción**: Listar alérgenos con paginación, búsqueda y filtros.
**Guards**: `JwtAuthGuard`, `RolesGuard`
**Roles**: `administrador`, `supervisor`

**Query params**:
| Param | Tipo | Descripción |
|-------|------|-------------|
| page | number | Página (default: 1) |
| limit | number | Registros por página (default: 20) |
| q | string | Búsqueda parcial por nombre |
| activo | boolean | Filtrar por estado (true/false) |
| sortBy | string | Campo de orden: `nombre`, `created_at` |
| sortOrder | 'ASC'\|'DESC' | Dirección de orden |

**Response 200**:
```json
{
  "ok": true,
  "data": [
    { "id": "uuid", "nombre": "Gluten", "descripcion": null, "activo": true, "tenant_id": "uuid", "created_at": "...", "updated_at": "..." }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

### GET /admin/alergenos/:id

**Descripción**: Obtener detalle de un alérgeno por ID.
**Guards**: `JwtAuthGuard`, `RolesGuard`
**Roles**: `administrador`, `supervisor`

**Response 200**:
```json
{ "ok": true, "data": { "id": "uuid", "nombre": "Lactosa", "descripcion": "...", "activo": true, ... } }
```

**Response 404**: `ALERGENO_NOT_FOUND`

---

### POST /admin/alergenos

**Descripción**: Crear un nuevo alérgeno. Auditable.
**Guards**: `JwtAuthGuard`, `RolesGuard`
**Roles**: `administrador`
**HTTP Status**: 201

**Body**:
```json
{ "nombre": "Frutos secos", "descripcion": "Incluye nueces, almendras, avellanas" }
```

**Validaciones**:
- `nombre`: requerido, string, max 100 chars
- `descripcion`: opcional, string, max 300 chars

**Response 201**: `{ "ok": true, "data": { ...alergeno creado... } }`

**Errors**:
- 409: `ALERGENO_NOMBRE_DUPLICADO` — ya existe un alérgeno con ese nombre en el tenant

**Audit action**: `alergeno.created`

---

### PATCH /admin/alergenos/:id

**Descripción**: Editar nombre y/o descripción de un alérgeno. Auditable.
**Guards**: `JwtAuthGuard`, `RolesGuard`
**Roles**: `administrador`

**Body** (todos opcionales):
```json
{ "nombre": "Gluten (trigo)", "descripcion": "Presente en trigo, cebada, centeno" }
```

**Response 200**: `{ "ok": true, "data": { ...alergeno actualizado... } }`

**Errors**:
- 404: `ALERGENO_NOT_FOUND`
- 409: `ALERGENO_NOMBRE_DUPLICADO`

**Audit action**: `alergeno.updated`

---

### PATCH /admin/alergenos/:id/activar

**Descripción**: Activar un alérgeno inactivo. Auditable.
**Guards**: `JwtAuthGuard`, `RolesGuard`
**Roles**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...alergeno con activo: true... } }`

**Errors**:
- 404: `ALERGENO_NOT_FOUND`
- 409: `ALERGENO_YA_ACTIVO`

**Audit action**: `alergeno.activated`

---

### PATCH /admin/alergenos/:id/inactivar

**Descripción**: Inactivar un alérgeno activo. Auditable.
**Guards**: `JwtAuthGuard`, `RolesGuard`
**Roles**: `administrador`

**Response 200**: `{ "ok": true, "data": { ...alergeno con activo: false... } }`

**Errors**:
- 404: `ALERGENO_NOT_FOUND`
- 409: `ALERGENO_YA_INACTIVO`

**MVP Note**: La validación de menús base activos asociados es informativa — se implementará en Stage 2.

**Audit action**: `alergeno.deactivated`

---

### DELETE /admin/alergenos/:id

**Descripción**: Eliminar lógicamente un alérgeno inactivo. Auditable.
**Guards**: `JwtAuthGuard`, `RolesGuard`
**Roles**: `administrador`

**Response 200**: `{ "ok": true, "data": { "id": "uuid" } }`

**Errors**:
- 404: `ALERGENO_NOT_FOUND`
- 409: `ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`

**Audit action**: `alergeno.deleted`

---

## Portal Público (sin auth)

### GET /public/alergenos

**Descripción**: Listar alérgenos activos del tenant, ordenados por nombre A→Z.
**Guards**: Ninguno
**Headers requeridos**: `x-tenant-key: <tenant-key>`

**Response 200**:
```json
{
  "ok": true,
  "data": [
    { "id": "uuid", "nombre": "Frutos secos", "descripcion": "...", "activo": true, ... },
    { "id": "uuid", "nombre": "Gluten", "descripcion": null, "activo": true, ... },
    { "id": "uuid", "nombre": "Huevo", "descripcion": null, "activo": true, ... }
  ]
}
```

**Orden**: `nombre ASC` (alfabético, sin NULLS LAST — `nombre` es NOT NULL)

**Errors**:
- 400/403: Tenant requerido (sin `x-tenant-key`)
