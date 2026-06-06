---
description: "Quickstart guide and smoke tests for puntos-retiro module"
---

# Quickstart: Puntos de Retiro

## Orden de implementación (7 pasos)

```
1. ErrorCodes nuevos (6 códigos en error-codes.ts)
2. PuntoRetiro entity (punto-retiro.entity.ts)
3. Migración (generar + editar índice parcial)
4. DTOs: CreatePuntoRetiroDto, UpdatePuntoRetiroDto, QueryPuntoRetiroDto
5. PuntosRetiroService (toda la lógica de negocio)
6. PuntosRetiroController + PublicPuntosRetiroController
7. PuntosRetiroModule + registro en AppModule
```

## Variables de entorno necesarias

```bash
# .env.local (ya configurado)
DATABASE_URL=postgresql://postgres:1234@localhost:5432/de_rochester
JWT_ACCESS_SECRET=change-me-access
SEED_TENANT_ID=00000000-0000-0000-0000-000000000001
```

## Seed mínimo para smoke tests

Antes de los smoke tests se necesita:
1. Tenant con ID `00000000-0000-0000-0000-000000000001` (ya en SEED_TENANT_ID)
2. Admin user (ya seedeado por `npm run db:seed`)
3. Una **sede activa** (crear via API o seed manual)

```bash
# Obtener JWT
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admininnoview@innoview.com","password":"admin123"}' \
  | jq -r '.data.access_token')

TENANT="x-tenant-key: rochester"
AUTH="Authorization: Bearer $TOKEN"
```

## Smoke Tests

### ST-01: Crear punto de retiro en sede activa

```bash
# Primero obtener el ID de una sede activa
SEDE_ID=$(curl -s http://localhost:3000/admin/sedes \
  -H "$AUTH" -H "$TENANT" | jq -r '.data[0].id')

# Crear punto de retiro
curl -X POST http://localhost:3000/admin/puntos-retiro \
  -H "Content-Type: application/json" \
  -H "$AUTH" -H "$TENANT" \
  -d "{\"sede_id\":\"$SEDE_ID\",\"nombre\":\"Ventanilla A\",\"orden_visualizacion\":1}"
# Esperado: 201, data con activo=true
```

### ST-02: Nombre duplicado en la misma sede

```bash
curl -X POST http://localhost:3000/admin/puntos-retiro \
  -H "Content-Type: application/json" \
  -H "$AUTH" -H "$TENANT" \
  -d "{\"sede_id\":\"$SEDE_ID\",\"nombre\":\"Ventanilla A\"}"
# Esperado: 409, code: PUNTO_RETIRO_NOMBRE_DUPLICADO
```

### ST-03: Crear en sede inactiva

```bash
# Asumiendo que existe una sede inactiva con SEDE_INACTIVA_ID
curl -X POST http://localhost:3000/admin/puntos-retiro \
  -H "Content-Type: application/json" \
  -H "$AUTH" -H "$TENANT" \
  -d "{\"sede_id\":\"$SEDE_INACTIVA_ID\",\"nombre\":\"Test\"}"
# Esperado: 409, code: SEDE_INACTIVA
```

### ST-04: Ciclo de vida activo/inactivo

```bash
PR_ID="<id del punto creado en ST-01>"

# Inactivar
curl -X PATCH http://localhost:3000/admin/puntos-retiro/$PR_ID/inactivar \
  -H "$AUTH" -H "$TENANT"
# Esperado: 200, activo=false

# Inactivar de nuevo (debe fallar)
curl -X PATCH http://localhost:3000/admin/puntos-retiro/$PR_ID/inactivar \
  -H "$AUTH" -H "$TENANT"
# Esperado: 409, code: PUNTO_RETIRO_YA_INACTIVO

# Activar
curl -X PATCH http://localhost:3000/admin/puntos-retiro/$PR_ID/activar \
  -H "$AUTH" -H "$TENANT"
# Esperado: 200, activo=true
```

### ST-05: Delete requiere inactivación previa

```bash
# Intentar eliminar punto activo
curl -X DELETE http://localhost:3000/admin/puntos-retiro/$PR_ID \
  -H "$AUTH" -H "$TENANT"
# Esperado: 409, code: PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR

# Inactivar y luego eliminar
curl -X PATCH http://localhost:3000/admin/puntos-retiro/$PR_ID/inactivar \
  -H "$AUTH" -H "$TENANT"
curl -X DELETE http://localhost:3000/admin/puntos-retiro/$PR_ID \
  -H "$AUTH" -H "$TENANT"
# Esperado: 200, data: { id: "..." }
```

### ST-06: Portal público — listado por sede

```bash
# Solo puntos activos, ordenados por orden_visualizacion
curl "http://localhost:3000/public/puntos-retiro?sede_id=$SEDE_ID" \
  -H "x-tenant-key: rochester"
# Esperado: 200, solo puntos activos, ordenados por orden_visualizacion ASC NULLS LAST

# Sin header de tenant
curl "http://localhost:3000/public/puntos-retiro?sede_id=$SEDE_ID"
# Esperado: 400, code: TENANT_REQUIRED

# Sin sede_id
curl http://localhost:3000/public/puntos-retiro \
  -H "x-tenant-key: rochester"
# Esperado: 400, validation error (sede_id requerido)
```

### ST-07: Filtros en listado admin

```bash
# Filtrar por sede
curl "http://localhost:3000/admin/puntos-retiro?sede_id=$SEDE_ID" \
  -H "$AUTH" -H "$TENANT"

# Buscar por nombre
curl "http://localhost:3000/admin/puntos-retiro?q=ventanilla" \
  -H "$AUTH" -H "$TENANT"

# Solo inactivos
curl "http://localhost:3000/admin/puntos-retiro?activo=false" \
  -H "$AUTH" -H "$TENANT"

# Ordenar por orden_visualizacion
curl "http://localhost:3000/admin/puntos-retiro?sortBy=orden_visualizacion&sortOrder=ASC" \
  -H "$AUTH" -H "$TENANT"
```

## Verificar en base de datos

```sql
-- Tabla creada correctamente
SELECT * FROM puntos_retiro LIMIT 5;

-- Índice parcial existe
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename = 'puntos_retiro';

-- FK a sedes
SELECT conname, confupdtype, confdeltype FROM pg_constraint
WHERE conrelid = 'puntos_retiro'::regclass AND contype = 'f';

-- Migración registrada
SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;
```

## Comandos de desarrollo

```bash
# Levantar app
npm run start:dev

# Generar migración (después de crear entity)
npm run db:migration:generate -- migrations/CreatePuntosRetiro

# Correr migración manualmente (opcional, migrationsRun:true lo hace al iniciar)
npm run db:migration:run

# Build
npm run build
```
