# Quickstart & Smoke Tests: Módulo Alérgenos

**Feature**: `006-alergenos-crud`
**Date**: 2026-06-06

## Prerrequisitos

```bash
# Servidor corriendo en localhost:3000
npm run start:dev

# Variables de entorno configuradas (.env.local):
# DATABASE_URL, JWT_SECRET, TENANCY_REQUIRED=true

# Token de admin (obtener via POST /auth/login)
TOKEN=<jwt-token-administrador>
SUPERVISOR_TOKEN=<jwt-token-supervisor>
TENANT_KEY=<x-tenant-key-del-tenant>
```

## Smoke Tests

### Test 1: Crear alérgeno exitosamente

```bash
curl -s -X POST http://localhost:3000/admin/alergenos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Gluten","descripcion":"Presente en trigo, cebada, centeno"}' | jq .
# Esperado: { ok: true, data: { id: "...", nombre: "Gluten", activo: true } }
# HTTP 201
```

### Test 2: Crear con nombre duplicado falla

```bash
curl -s -X POST http://localhost:3000/admin/alergenos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Gluten"}' | jq .
# Esperado: { ok: false, error: { code: "ALERGENO_NOMBRE_DUPLICADO" } }
# HTTP 409
```

### Test 3: Listar con paginación y búsqueda

```bash
# Crear algunos alérgenos más primero
curl -s -X POST http://localhost:3000/admin/alergenos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Lactosa"}' | jq .id

curl -s "http://localhost:3000/admin/alergenos?q=glut&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Esperado: data con alérgenos que contienen "glut" en el nombre, meta.total >= 1
```

### Test 4: Supervisor puede listar, no puede crear

```bash
# Listar como supervisor — OK
curl -s "http://localhost:3000/admin/alergenos" \
  -H "Authorization: Bearer $SUPERVISOR_TOKEN" | jq .ok
# Esperado: true

# Crear como supervisor — falla
curl -s -X POST http://localhost:3000/admin/alergenos \
  -H "Authorization: Bearer $SUPERVISOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Maní"}' | jq .
# Esperado: { ok: false, error: { code: "AUTH_FORBIDDEN" } } — HTTP 403
```

### Test 5: Inactivar alérgeno

```bash
ID=$(curl -s -X POST http://localhost:3000/admin/alergenos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Soja"}' | jq -r '.data.id')

curl -s -X PATCH "http://localhost:3000/admin/alergenos/$ID/inactivar" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Esperado: { ok: true, data: { activo: false } }

# Inactivar de nuevo — falla
curl -s -X PATCH "http://localhost:3000/admin/alergenos/$ID/inactivar" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Esperado: { ok: false, error: { code: "ALERGENO_YA_INACTIVO" } } — HTTP 409
```

### Test 6: Soft delete solo si inactivo

```bash
# Intentar eliminar alérgeno activo — falla
ACTIVO_ID=$(curl -s "http://localhost:3000/admin/alergenos?q=gluten" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

curl -s -X DELETE "http://localhost:3000/admin/alergenos/$ACTIVO_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Esperado: { ok: false, error: { code: "ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR" } } — HTTP 409

# Inactivar primero y luego eliminar — OK
curl -s -X PATCH "http://localhost:3000/admin/alergenos/$ACTIVO_ID/inactivar" \
  -H "Authorization: Bearer $TOKEN" | jq .ok

curl -s -X DELETE "http://localhost:3000/admin/alergenos/$ACTIVO_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Esperado: { ok: true, data: { id: "..." } }
```

### Test 7: Portal público — solo activos, orden alfabético

```bash
curl -s "http://localhost:3000/public/alergenos" \
  -H "x-tenant-key: $TENANT_KEY" | jq .
# Esperado: { ok: true, data: [...solo activos, ordenados por nombre ASC...] }
# "Soja" (inactivado antes) no debe aparecer
```

### Test 8: Portal público sin tenant key falla

```bash
curl -s "http://localhost:3000/public/alergenos" | jq .
# Esperado: error de tenant requerido
```

### Test 9: Filtro por activo=false en back office

```bash
curl -s "http://localhost:3000/admin/alergenos?activo=false" \
  -H "Authorization: Bearer $TOKEN" | jq .
# Esperado: solo alérgenos con activo=false
```

## Notas de integración

- El módulo exporta `AlergenosService` — será importado por `MenusBaseModule` en Stage 2 para validar que los alérgenos asociados a un menú existen y están activos.
- El middleware `TenancyMiddleware` resuelve `tenant_id` desde `x-tenant-key` para el endpoint público automáticamente — no se necesita lógica adicional en el controller.
- Los alérgenos eliminados lógicamente (`deleted_at IS NOT NULL`) no aparecen en ningún listado — el `BaseCrudTenantService` y el índice parcial los excluyen.
