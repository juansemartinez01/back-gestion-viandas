---
description: "Smoke tests and dev commands for categorias-menu module"
---

# Quickstart: Categorías de Menú

## Setup

```bash
# Generar migración (después de crear la entidad)
npm run db:migration:generate -- migrations/CreateCategoriasMenu

# Editar el archivo generado para agregar el índice parcial (ver plan.md §3)

# Aplicar migración
npm run db:migration:run

# Levantar servidor
npm run start:dev
```

## Smoke Tests

Reemplazar `TOKEN` con un JWT válido de rol `administrador`, y `TENANT_KEY` con la clave del tenant de prueba.

### 1. Crear categoría (admin)
```bash
curl -s -X POST http://localhost:3000/admin/categorias-menu \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Saludable","descripcion":"Opciones bajas en calorías","orden_visualizacion":1}' \
  | jq '.ok, .data.id'
# Expected: true, <uuid>
```

### 2. Nombre duplicado devuelve 409
```bash
curl -s -X POST http://localhost:3000/admin/categorias-menu \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Saludable"}' \
  | jq '.ok, .error.code'
# Expected: false, "CATEGORIA_MENU_NOMBRE_DUPLICADO"
```

### 3. Listar con filtro y paginación (admin)
```bash
curl -s "http://localhost:3000/admin/categorias-menu?q=salu&activa=true&page=1&limit=10" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .meta.total'
# Expected: true, 1
```

### 4. Inactivar categoría
```bash
curl -s -X PATCH http://localhost:3000/admin/categorias-menu/CATEGORIA_ID/inactivar \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .data.activa'
# Expected: true, false
```

### 5. Inactivar ya inactiva devuelve 409
```bash
curl -s -X PATCH http://localhost:3000/admin/categorias-menu/CATEGORIA_ID/inactivar \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .error.code'
# Expected: false, "CATEGORIA_MENU_YA_INACTIVA"
```

### 6. Soft delete solo si inactiva
```bash
# Intentar eliminar categoría activa → debe fallar
curl -s -X DELETE http://localhost:3000/admin/categorias-menu/CATEGORIA_ACTIVA_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.error.code'
# Expected: "CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR"

# Eliminar categoría inactiva → debe funcionar
curl -s -X DELETE http://localhost:3000/admin/categorias-menu/CATEGORIA_INACTIVA_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .data.id'
# Expected: true, <uuid>
```

### 7. Portal público — categorías activas ordenadas
```bash
curl -s "http://localhost:3000/public/categorias-menu" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, (.data | length), .data[0].nombre'
# Expected: true, <n>, primer nombre por orden_visualizacion o nombre ASC
```

### 8. Portal público sin tenant key → error
```bash
curl -s "http://localhost:3000/public/categorias-menu" \
  | jq '.ok, .error.code'
# Expected: false, "TENANT_REQUIRED"
```

### 9. Supervisor puede listar pero no crear
```bash
# Listar con supervisor → OK
curl -s "http://localhost:3000/admin/categorias-menu" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok'
# Expected: true

# Crear con supervisor → 403
curl -s -X POST http://localhost:3000/admin/categorias-menu \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Test"}' \
  | jq '.ok, .error.code'
# Expected: false, "AUTH_FORBIDDEN"
```
