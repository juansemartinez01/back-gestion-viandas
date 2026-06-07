---
description: "Smoke tests and dev commands for banners-promociones module"
---

# Quickstart: Banners y Promociones

## Setup

```bash
# Generar migración (después de crear la entidad)
npm run db:migration:generate -- migrations/CreateBanners

# Aplicar migración
npm run db:migration:run

# Levantar servidor
npm run start:dev
```

## Smoke Tests

Reemplazar `TOKEN` con un JWT válido de rol `administrador`, y `TENANT_KEY` con la clave del tenant de prueba.

### 1. Crear banner sin fechas (admin)
```bash
curl -s -X POST http://localhost:3000/admin/banners \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Nuevo menú vegetariano","descripcion":"Sin carne ni pescado","orden_visualizacion":1}' \
  | jq '.ok, .data.id, .data.activo'
# Expected: true, <uuid>, true
```

### 2. Crear banner con fechas válidas (admin)
```bash
curl -s -X POST http://localhost:3000/admin/banners \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Promo semana","fecha_inicio":"2026-06-01","fecha_fin":"2026-06-30","orden_visualizacion":2}' \
  | jq '.ok, .data.fecha_inicio, .data.fecha_fin'
# Expected: true, "2026-06-01", "2026-06-30"
```

### 3. Fechas incoherentes devuelven 422
```bash
curl -s -X POST http://localhost:3000/admin/banners \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Fechas mal","fecha_inicio":"2026-12-31","fecha_fin":"2026-01-01"}' \
  | jq '.ok, .error.code'
# Expected: false, "BANNER_FECHAS_INVALIDAS"
```

### 4. Listar banners con filtro (admin)
```bash
curl -s "http://localhost:3000/admin/banners?activo=true&sortBy=orden_visualizacion&sortOrder=ASC&page=1&limit=10" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .meta.total'
# Expected: true, <n>
```

### 5. Inactivar banner
```bash
curl -s -X PATCH http://localhost:3000/admin/banners/BANNER_ID/inactivar \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .data.activo'
# Expected: true, false
```

### 6. Inactivar banner ya inactivo devuelve 409
```bash
curl -s -X PATCH http://localhost:3000/admin/banners/BANNER_ID/inactivar \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .error.code'
# Expected: false, "BANNER_YA_INACTIVO"
```

### 7. Soft delete solo si inactivo
```bash
# Intentar eliminar banner activo → debe fallar
curl -s -X DELETE http://localhost:3000/admin/banners/BANNER_ACTIVO_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.error.code'
# Expected: "BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR"

# Eliminar banner inactivo → debe funcionar
curl -s -X DELETE http://localhost:3000/admin/banners/BANNER_INACTIVO_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, .data.id'
# Expected: true, <uuid>
```

### 8. Portal público — banners activos y vigentes
```bash
curl -s "http://localhost:3000/public/banners" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok, (.data | length), .data[0].titulo'
# Expected: true, <n>, primer título por orden_visualizacion
```

### 9. Portal público sin tenant key → error
```bash
curl -s "http://localhost:3000/public/banners" \
  | jq '.ok, .error.code'
# Expected: false, "TENANT_REQUIRED"
```

### 10. Portal público no devuelve banners fuera de rango de fechas
```bash
# Crear banner con fecha_fin pasada
curl -s -X POST http://localhost:3000/admin/banners \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Banner expirado","fecha_fin":"2020-01-01"}' \
  | jq '.data.id'

# Verificar que NO aparece en el portal público
curl -s "http://localhost:3000/public/banners" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '[.data[].titulo] | contains(["Banner expirado"])'
# Expected: false
```

### 11. Supervisor puede listar pero no crear
```bash
# Listar con supervisor → OK
curl -s "http://localhost:3000/admin/banners" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  | jq '.ok'
# Expected: true

# Crear con supervisor → 403
curl -s -X POST http://localhost:3000/admin/banners \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Test"}' \
  | jq '.ok, .error.code'
# Expected: false, "AUTH_FORBIDDEN"
```

### 12. Update con fecha_fin que invalida fecha_inicio existente → 422
```bash
# Primero crear banner con fecha_inicio
BANNER_ID=$(curl -s -X POST http://localhost:3000/admin/banners \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Banner fechas","fecha_inicio":"2026-06-10"}' \
  | jq -r '.data.id')

# Intentar poner fecha_fin anterior a la fecha_inicio existente
curl -s -X PATCH http://localhost:3000/admin/banners/$BANNER_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fecha_fin":"2026-06-01"}' \
  | jq '.ok, .error.code'
# Expected: false, "BANNER_FECHAS_INVALIDAS"
```
