# Quickstart: Módulo Menús Base

## Prerequisitos

- Servidor corriendo (`npm run start:dev`)
- DB con migraciones aplicadas (`npm run db:migration:run`)
- Al menos un tenant creado, con `x-tenant-key` válido
- Al menos una CategoriaMenu activa, una EtiquetaMenu activa, y un Alergeno activo del tenant

## Variables de entorno para pruebas

```bash
BASE_URL=http://localhost:3000
ADMIN_TOKEN=<jwt de usuario con rol administrador>
SUPERVISOR_TOKEN=<jwt de usuario con rol supervisor>
TENANT_KEY=<x-tenant-key del tenant>
```

---

## Smoke Test 1 — Crear menú base

```bash
curl -s -X POST "$BASE_URL/admin/menus-base" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Milanesa con puré",
    "descripcion": "Clásica milanesa de ternera con puré de papas.",
    "calorias_aprox": 480,
    "proteinas_aprox": 35,
    "categoria_ids": ["<id-categoria-activa>"],
    "etiqueta_ids": ["<id-etiqueta-activa>"],
    "alergeno_ids": ["<id-alergeno-activo>"]
  }' | jq .
```

**Espera**: `ok: true`, menú creado con `activo: true` y relaciones incluidas.

---

## Smoke Test 2 — Nombre duplicado rechazado

```bash
curl -s -X POST "$BASE_URL/admin/menus-base" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "nombre": "Milanesa con puré" }' | jq .
```

**Espera**: `ok: false`, `error.code: "MENU_BASE_NOMBRE_DUPLICADO"`.

---

## Smoke Test 3 — Listar con filtros

```bash
# Filtrar por nombre y estado
curl -s "$BASE_URL/admin/menus-base?q=milane&activo=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Filtrar por categoria_id
curl -s "$BASE_URL/admin/menus-base?categoria_id=<id-categoria>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Espera**: Solo menús que cumplan los filtros, con relaciones incluidas.

---

## Smoke Test 4 — Detalle con relaciones

```bash
MENU_ID="<id del menú creado>"
curl -s "$BASE_URL/admin/menus-base/$MENU_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Espera**: `ok: true`, objeto con `categorias`, `etiquetas` y `alergenos` completos.

---

## Smoke Test 5 — Editar reemplazando relaciones

```bash
# Reemplazar categorías con array vacío (desasociar todas)
curl -s -X PATCH "$BASE_URL/admin/menus-base/$MENU_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "categoria_ids": [] }' | jq '.data.categorias'
```

**Espera**: `[]` — categorías completamente eliminadas.

---

## Smoke Test 6 — Ciclo de vida: inactivar y activar

```bash
# Inactivar
curl -s -X PATCH "$BASE_URL/admin/menus-base/$MENU_ID/inactivar" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.activo'
# Espera: false

# Intentar inactivar de nuevo
curl -s -X PATCH "$BASE_URL/admin/menus-base/$MENU_ID/inactivar" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.error.code'
# Espera: "MENU_BASE_YA_INACTIVO"

# Activar
curl -s -X PATCH "$BASE_URL/admin/menus-base/$MENU_ID/activar" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.activo'
# Espera: true
```

---

## Smoke Test 7 — Delete: solo si inactivo

```bash
# Intentar eliminar cuando está activo
curl -s -X DELETE "$BASE_URL/admin/menus-base/$MENU_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.error.code'
# Espera: "MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR"

# Inactivar primero, luego eliminar
curl -s -X PATCH "$BASE_URL/admin/menus-base/$MENU_ID/inactivar" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

curl -s -X DELETE "$BASE_URL/admin/menus-base/$MENU_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
# Espera: ok: true, data: null

# Verificar que ya no aparece en el listado
curl -s "$BASE_URL/admin/menus-base" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.items | length'
```

---

## Smoke Test 8 — Portal público

```bash
# Crear un menú activo primero (ver Smoke Test 1)

# Listar activos públicamente
curl -s "$BASE_URL/public/menus-base" \
  -H "x-tenant-key: $TENANT_KEY" | jq '.data | length'
# Espera: 1 (solo activos)

# Detalle público
curl -s "$BASE_URL/public/menus-base/$MENU_ID" \
  -H "x-tenant-key: $TENANT_KEY" | jq .
# Espera: ok: true, objeto completo con relaciones

# Menú inactivo → 404 en portal
INACTIVE_MENU_ID="<id de menú inactivo>"
curl -s "$BASE_URL/public/menus-base/$INACTIVE_MENU_ID" \
  -H "x-tenant-key: $TENANT_KEY" | jq '.error.code'
# Espera: "MENU_BASE_NOT_FOUND"
```

---

## Smoke Test 9 — Validación de relaciones cross-tenant

```bash
# ID de categoría de OTRO tenant (o inventado)
curl -s -X POST "$BASE_URL/admin/menus-base" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Menu con categoria ajena",
    "categoria_ids": ["00000000-0000-0000-0000-000000000000"]
  }' | jq '.error.code'
# Espera: "MENU_BASE_RELACION_INVALIDA"
```

---

## Smoke Test 10 — RBAC: supervisor no puede crear

```bash
curl -s -X POST "$BASE_URL/admin/menus-base" \
  -H "Authorization: Bearer $SUPERVISOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "nombre": "Intento supervisor" }' | jq '.statusCode'
# Espera: 403
```
