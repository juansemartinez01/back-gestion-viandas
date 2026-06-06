---
description: "Smoke tests and dev commands for etiquetas-menu module"
---

# Quickstart: Etiquetas de Menú

## Setup

```bash
# Generar migración (después de crear la entidad)
npm run db:migration:generate -- migrations/CreateEtiquetasMenu
# Editar para índice parcial (ver plan.md §3)
npm run db:migration:run
npm run start:dev
```

## Smoke Tests

Reemplazar `TOKEN` con JWT de rol `administrador` y `TENANT_KEY` con clave del tenant de prueba.

### 1. Crear etiqueta
```bash
curl -s -X POST http://localhost:3000/admin/etiquetas-menu \
  -H "Authorization: Bearer TOKEN" -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Sin carne","descripcion":"Apto para vegetarianos","orden_visualizacion":1}' \
  | jq '.ok, .data.id'
# Expected: true, <uuid>
```

### 2. Nombre duplicado devuelve 409
```bash
curl -s -X POST http://localhost:3000/admin/etiquetas-menu \
  -H "Authorization: Bearer TOKEN" -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" -d '{"nombre":"Sin carne"}' \
  | jq '.ok, .error.code'
# Expected: false, "ETIQUETA_MENU_NOMBRE_DUPLICADO"
```

### 3. Listar con filtro
```bash
curl -s "http://localhost:3000/admin/etiquetas-menu?q=carne&activa=true&page=1&limit=10" \
  -H "Authorization: Bearer TOKEN" -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .meta.total'
# Expected: true, 1
```

### 4. Inactivar etiqueta
```bash
curl -s -X PATCH http://localhost:3000/admin/etiquetas-menu/ETIQUETA_ID/inactivar \
  -H "Authorization: Bearer TOKEN" -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .data.activa'
# Expected: true, false
```

### 5. Inactivar ya inactiva → 409
```bash
curl -s -X PATCH http://localhost:3000/admin/etiquetas-menu/ETIQUETA_ID/inactivar \
  -H "Authorization: Bearer TOKEN" -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .error.code'
# Expected: false, "ETIQUETA_MENU_YA_INACTIVA"
```

### 6. Soft delete: activa falla, inactiva OK
```bash
curl -s -X DELETE http://localhost:3000/admin/etiquetas-menu/ETIQUETA_ACTIVA_ID \
  -H "Authorization: Bearer TOKEN" -H "x-tenant-key: TENANT_KEY" \
  | jq '.error.code'
# Expected: "ETIQUETA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR"

curl -s -X DELETE http://localhost:3000/admin/etiquetas-menu/ETIQUETA_INACTIVA_ID \
  -H "Authorization: Bearer TOKEN" -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .data.id'
# Expected: true, <uuid>
```

### 7. Portal público — etiquetas activas ordenadas
```bash
curl -s "http://localhost:3000/public/etiquetas-menu" -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, (.data | length), .data[0].nombre'
# Expected: true, <n>, primera etiqueta por orden_visualizacion ASC NULLS LAST
```

### 8. Portal público sin tenant key → error
```bash
curl -s "http://localhost:3000/public/etiquetas-menu" | jq '.ok, .error.code'
# Expected: false, "TENANT_REQUIRED"
```

### 9. Supervisor puede listar pero no crear
```bash
curl -s "http://localhost:3000/admin/etiquetas-menu" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok'
# Expected: true

curl -s -X POST http://localhost:3000/admin/etiquetas-menu \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" -d '{"nombre":"Test"}' \
  | jq '.ok, .error.code'
# Expected: false, "AUTH_FORBIDDEN"
```
