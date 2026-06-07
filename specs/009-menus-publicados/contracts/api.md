# API Contracts: Menús Publicados

**Feature**: 009-menus-publicados | **Date**: 2026-06-07

All responses follow the Innoview Backend Template standard:
- Success: `{ ok: true, data, meta? }`
- Error: `{ ok: false, requestId, statusCode, error: { code, message, details? }, timestamp, path }`

---

## Back Office Endpoints

**Base path**: `/admin/menus-publicados`
**Guards**: `JwtAuthGuard`, `RolesGuard`

---

### GET /admin/menus-publicados

Lista paginada de menús publicados con filtros.

**Roles**: `administrador`, `supervisor`

**Query params**:
```
page?          number   default 1
limit?         number   default 20, max 200
fecha_venta?   string   YYYY-MM-DD
sede_id?       string   UUID
estado?        string   activo|pausado|cerrado|agotado|cancelado
menu_base_id?  string   UUID
sortBy?        string   created_at|fecha_venta|precio_encargo (default: created_at)
sortOrder?     string   ASC|DESC (default: DESC)
```

**Response 200**:
```json
{
  "ok": true,
  "data": [MenuPublicadoSummary],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

`MenuPublicadoSummary`:
```json
{
  "id": "uuid",
  "menu_base_id": "uuid",
  "sede_id": "uuid",
  "fecha_venta": "2026-06-10",
  "precio_encargo": "850.00",
  "precio_sobrante": null,
  "fecha_hora_limite_encargo": "2026-06-09T20:00:00Z",
  "fecha_hora_limite_cancelacion": null,
  "limite_maximo_viandas": 50,
  "tipo_sobreproduccion": null,
  "valor_sobreproduccion": null,
  "estado": "activo",
  "imagen_public_id": null,
  "imagen_url": null,
  "observaciones": null,
  "tenant_id": "uuid",
  "created_at": "2026-06-07T10:00:00Z",
  "updated_at": "2026-06-07T10:00:00Z",
  "menuBase": { "id": "uuid", "nombre": "Pollo grillado", "imagen_url": "..." },
  "puntosRetiro": [{ "id": "uuid", "nombre": "Mostrador A" }]
}
```

---

### GET /admin/menus-publicados/:id

Detalle completo del menú publicado con todas las relaciones.

**Roles**: `administrador`, `supervisor`

**Path param**: `id` (UUID)

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "menu_base_id": "uuid",
    "sede_id": "uuid",
    "fecha_venta": "2026-06-10",
    "precio_encargo": "850.00",
    "precio_sobrante": null,
    "fecha_hora_limite_encargo": "2026-06-09T20:00:00Z",
    "fecha_hora_limite_cancelacion": null,
    "limite_maximo_viandas": 50,
    "tipo_sobreproduccion": null,
    "valor_sobreproduccion": null,
    "estado": "activo",
    "imagen_public_id": null,
    "imagen_url": null,
    "observaciones": null,
    "tenant_id": "uuid",
    "created_at": "...",
    "updated_at": "...",
    "menuBase": {
      "id": "uuid",
      "nombre": "Pollo grillado",
      "descripcion": "...",
      "imagen_url": "...",
      "ingredientes_principales": "...",
      "calorias_aprox": 450,
      "proteinas_aprox": 35,
      "carbohidratos_aprox": 20,
      "grasas_aprox": 12,
      "activo": true,
      "categorias": [{ "id": "uuid", "nombre": "Proteínas" }],
      "etiquetas": [{ "id": "uuid", "nombre": "Sin TACC" }],
      "alergenos": []
    },
    "sede": { "id": "uuid", "nombre": "Sede Central", "activa": true },
    "puntosRetiro": [
      { "id": "uuid", "nombre": "Mostrador A", "activo": true }
    ]
  }
}
```

**Errors**:
- `404 MENU_PUBLICADO_NOT_FOUND` — ID no encontrado en tenant

---

### POST /admin/menus-publicados

Crea un nuevo menú publicado.

**Roles**: `administrador`, `supervisor`
**Auditable**: `menu_publicado.created`

**Request body**:
```json
{
  "menu_base_id": "uuid",                       // required
  "sede_id": "uuid",                            // required
  "puntos_retiro_ids": ["uuid", "uuid"],        // required, minLength 1
  "fecha_venta": "2026-06-10",                  // required, YYYY-MM-DD
  "precio_encargo": 850.00,                     // required, > 0
  "precio_sobrante": 700.00,                    // optional
  "fecha_hora_limite_encargo": "2026-06-09T20:00:00Z",   // required
  "fecha_hora_limite_cancelacion": "2026-06-09T12:00:00Z", // optional
  "limite_maximo_viandas": 50,                  // optional, int ≥ 1
  "tipo_sobreproduccion": "porcentaje",         // optional (must pair with valor)
  "valor_sobreproduccion": 10.00,              // optional (must pair with tipo)
  "imagen_public_id": "img_abc123",            // optional
  "imagen_url": "https://...",                 // optional
  "observaciones": "Menú de lunes"             // optional
}
```

**Response 201**:
```json
{
  "ok": true,
  "data": { /* MenuPublicado completo con relaciones */ }
}
```

**Errors**:
- `404 MENU_BASE_NOT_FOUND` — menú base no existe en tenant
- `422 MENU_BASE_YA_INACTIVO` — menú base no está activo (reutiliza el código existente)
- `404 SEDE_NOT_FOUND` — sede no existe en tenant
- `422 SEDE_INACTIVA` — sede no está activa
- `422 MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS` — punto inactivo, inexistente o de otra sede
- `422 MENU_PUBLICADO_PRECIO_INVALIDO` — precio_encargo ≤ 0
- `422 MENU_PUBLICADO_FECHA_LIMITE_INVALIDA` — fecha_hora_limite_encargo > fecha_venta
- `422 MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA` — tipo sin valor o viceversa

---

### PATCH /admin/menus-publicados/:id

Edita campos y/o puntos de retiro de un menú publicado existente.

**Roles**: `administrador` (solo)
**Auditable**: `menu_publicado.updated`

**Request body** (todos los campos son opcionales; `puntos_retiro_ids` si viene requiere ≥ 1 elemento):
```json
{
  "puntos_retiro_ids": ["uuid"],
  "precio_encargo": 900.00,
  "precio_sobrante": null,
  "fecha_hora_limite_encargo": "2026-06-09T18:00:00Z",
  "fecha_hora_limite_cancelacion": null,
  "limite_maximo_viandas": 40,
  "tipo_sobreproduccion": null,
  "valor_sobreproduccion": null,
  "imagen_public_id": "new_img_id",
  "imagen_url": "https://...",
  "observaciones": "Actualizado"
}
```

**Response 200**: `{ "ok": true, "data": { /* MenuPublicado completo */ } }`

**Errors**:
- `404 MENU_PUBLICADO_NOT_FOUND`
- `422 MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS`
- `422 MENU_PUBLICADO_PRECIO_INVALIDO`
- `422 MENU_PUBLICADO_FECHA_LIMITE_INVALIDA`
- `422 MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA`

---

### PATCH /admin/menus-publicados/:id/pausar

Cambia estado a `pausado`. Estado anterior requerido: `activo`.

**Roles**: `administrador`, `supervisor`
**Auditable**: `menu_publicado.pausado`

**Request body**: `{}` (vacío)

**Response 200**: `{ "ok": true, "data": { /* MenuPublicado actualizado */ } }`

**Errors**:
- `404 MENU_PUBLICADO_NOT_FOUND`
- `409 MENU_PUBLICADO_TRANSICION_INVALIDA` — estado actual ≠ activo

---

### PATCH /admin/menus-publicados/:id/reactivar

Cambia estado a `activo`. Estado anterior requerido: `pausado`.

**Roles**: `administrador`, `supervisor`
**Auditable**: `menu_publicado.reactivado`

**Response 200**: `{ "ok": true, "data": { /* MenuPublicado actualizado */ } }`

**Errors**:
- `404 MENU_PUBLICADO_NOT_FOUND`
- `409 MENU_PUBLICADO_TRANSICION_INVALIDA` — estado actual ≠ pausado

---

### PATCH /admin/menus-publicados/:id/cerrar

Cambia estado a `cerrado`. Estado anterior requerido: `activo` o `pausado`.

**Roles**: `administrador`, `supervisor`
**Auditable**: `menu_publicado.cerrado`

**Response 200**: `{ "ok": true, "data": { /* MenuPublicado actualizado */ } }`

**Errors**:
- `404 MENU_PUBLICADO_NOT_FOUND`
- `409 MENU_PUBLICADO_TRANSICION_INVALIDA`

---

### PATCH /admin/menus-publicados/:id/agotar

Cambia estado a `agotado`. Estado anterior requerido: `activo`.

**Roles**: `administrador`, `supervisor`
**Auditable**: `menu_publicado.agotado`

**Response 200**: `{ "ok": true, "data": { /* MenuPublicado actualizado */ } }`

**Errors**:
- `404 MENU_PUBLICADO_NOT_FOUND`
- `409 MENU_PUBLICADO_TRANSICION_INVALIDA`

---

### PATCH /admin/menus-publicados/:id/cancelar

Cambia estado a `cancelado`.

**Roles**: `administrador`, `supervisor`
**Auditable**: `menu_publicado.cancelado`

**State rules**:
- Desde `activo` o `pausado`: cualquier rol autorizado puede cancelar
- Desde `cerrado` o `agotado`: solo `administrador`
- Desde `cancelado`: rechazado con `MENU_PUBLICADO_TRANSICION_INVALIDA`

**Implementation**: el controlador extrae `req.user.rol` y lo pasa a `svc.cancelar(id, rol)`.

**Response 200**: `{ "ok": true, "data": { /* MenuPublicado actualizado */ } }`

**Errors**:
- `404 MENU_PUBLICADO_NOT_FOUND`
- `409 MENU_PUBLICADO_TRANSICION_INVALIDA` — ya cancelado o rol insuficiente para estado actual

---

### DELETE /admin/menus-publicados/:id

Soft delete. Solo permitido si el estado es `cancelado`.

**Roles**: `administrador` (solo)
**Auditable**: `menu_publicado.deleted`

**Response 200**: `{ "ok": true, "data": { "id": "uuid" } }`

**Errors**:
- `404 MENU_PUBLICADO_NOT_FOUND`
- `409 MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE`

---

## Public Endpoint

**Base path**: `/public/menus-disponibles`
**Guards**: ninguno (endpoint público)
**Required header**: `x-tenant-key: <tenant-key>` (procesado por `TenancyModule`)

---

### GET /public/menus-disponibles

Lista menús publicados activos para hoy y los próximos 7 días.

**Query params**:
```
sede_id           string  UUID  required
punto_retiro_id?  string  UUID  optional — filtra menús disponibles en ese punto
```

**Response 200**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "fecha_venta": "2026-06-10",
      "precio_encargo": "850.00",
      "precio_sobrante": null,
      "fecha_hora_limite_encargo": "2026-06-09T20:00:00Z",
      "fecha_hora_limite_cancelacion": null,
      "limite_maximo_viandas": 50,
      "estado": "activo",
      "imagen_url": null,
      "observaciones": null,
      "menuBase": {
        "id": "uuid",
        "nombre": "Pollo grillado",
        "descripcion": "...",
        "imagen_url": "https://...",
        "ingredientes_principales": "...",
        "calorias_aprox": 450,
        "proteinas_aprox": 35,
        "carbohidratos_aprox": 20,
        "grasas_aprox": 12,
        "categorias": [{ "id": "uuid", "nombre": "Proteínas" }],
        "etiquetas": [{ "id": "uuid", "nombre": "Sin TACC" }],
        "alergenos": []
      },
      "puntosRetiro": [
        { "id": "uuid", "nombre": "Mostrador A" }
      ]
    }
  ]
}
```

Orden: `fecha_venta ASC`, `menuBase.nombre ASC`.

**Errors**:
- `400 TENANT_REQUIRED` — sin header `x-tenant-key` válido
- `400 BAD_REQUEST` — `sede_id` faltante o inválido

---

## DTO Summary

### CreateMenuPublicadoDto

| Field | Validator | Notes |
|-------|-----------|-------|
| `menu_base_id` | `@IsUUID @IsNotEmpty` | |
| `sede_id` | `@IsUUID @IsNotEmpty` | |
| `puntos_retiro_ids` | `@IsArray @ArrayMinSize(1) @IsUUID({each:true})` | |
| `fecha_venta` | `@IsDateString` | YYYY-MM-DD |
| `precio_encargo` | `@IsNumber @Min(0.01)` | |
| `precio_sobrante` | `@IsOptional @IsNumber @Min(0)` | |
| `fecha_hora_limite_encargo` | `@IsISO8601` | timestamptz |
| `fecha_hora_limite_cancelacion` | `@IsOptional @IsISO8601` | |
| `limite_maximo_viandas` | `@IsOptional @IsInt @Min(1)` | |
| `tipo_sobreproduccion` | `@IsOptional @IsEnum(TipoSobreproduccion)` | |
| `valor_sobreproduccion` | `@IsOptional @IsNumber @Min(0)` | |
| `imagen_public_id` | `@IsOptional @IsString` | |
| `imagen_url` | `@IsOptional @IsString` | |
| `observaciones` | `@IsOptional @IsString` | |

### UpdateMenuPublicadoDto

Todos los campos de `CreateMenuPublicadoDto` son opcionales, excepto:
- `menu_base_id`, `sede_id`, `fecha_venta` — no editables post-creación (excluidos del DTO)
- `puntos_retiro_ids` — si viene, `@ArrayMinSize(1)` aplica igualmente

### QueryMenuPublicadoDto

Extiende `PageQueryDto`. Agrega:
- `fecha_venta?`: `@IsOptional @IsDateString`
- `sede_id?`: `@IsOptional @IsUUID`
- `estado?`: `@IsOptional @IsEnum(EstadoMenuPublicado)`
- `menu_base_id?`: `@IsOptional @IsUUID`

### QueryMenusDisponiblesDto

- `sede_id`: `@IsUUID @IsNotEmpty`
- `punto_retiro_id?`: `@IsOptional @IsUUID`
