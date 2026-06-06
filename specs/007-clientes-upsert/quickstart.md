# Quickstart: Módulo Clientes

**Branch**: `007-clientes-upsert` | **Date**: 2026-06-06

## Setup

```bash
# Generar migración
npm run db:migration:generate -- migrations/CreateClientes

# ⚠️ Editar la migración generada: reemplazar índice completo por parcial (ver nota abajo)

# Aplicar migración
npm run db:migration:run

# Iniciar servidor
npm run start:dev
```

> **Edición obligatoria de la migración**: TypeORM genera `CREATE UNIQUE INDEX "UQ_clientes_tenant_dni"` sin `WHERE`. Reemplazarlo por:
> ```sql
> CREATE UNIQUE INDEX "UQ_clientes_tenant_dni"
> ON "clientes" ("tenant_id", "dni")
> WHERE "deleted_at" IS NULL;
> ```
> En `down()`: `DROP INDEX IF EXISTS "public"."UQ_clientes_tenant_dni"`

---

## Smoke Tests (con JWT de administrador)

### 1. upsertByDni — crear cliente nuevo (llamada interna)

Desde un test de integración o seed:

```typescript
const dto: UpsertClienteDto = {
  dni: '12345678',
  nombre: 'Juan',
  apellido: 'Pérez',
  telefono: '3511234567',
  email: 'juan@example.com',
};
const cliente = await clientesService.upsertByDni(dto);
// cliente.fecha_primera_operacion == hoy
// cliente.fecha_ultima_operacion == hoy
// cliente.activo == true
```

### 2. upsertByDni — actualizar cliente existente

```typescript
const dto2: UpsertClienteDto = {
  dni: '12345678',
  nombre: 'Juan Carlos',   // nombre actualizado
  apellido: 'Pérez',
  // sin telefono — no debe pisarse
};
const actualizado = await clientesService.upsertByDni(dto2);
// actualizado.nombre == 'Juan Carlos'
// actualizado.telefono == '3511234567'  ← conservado
// actualizado.fecha_primera_operacion == misma fecha original
// actualizado.fecha_ultima_operacion == hoy
```

### 3. Listar clientes

```bash
GET /admin/clientes
Authorization: Bearer <jwt_admin>
# Respuesta: 200 { ok: true, data: [...], meta: { page, limit, total, totalPages } }
```

```bash
GET /admin/clientes?q=perez&activo=true&sortBy=apellido&sortOrder=ASC
Authorization: Bearer <jwt_admin>
# Respuesta: solo clientes activos con "perez" en dni/nombre/apellido
```

### 4. Detalle de cliente

```bash
GET /admin/clientes/:id
Authorization: Bearer <jwt_admin>
# Respuesta 200: cliente completo
# Respuesta 404 si id no existe o es de otro tenant
```

### 5. Bloquear cliente

```bash
PATCH /admin/clientes/:id/bloquear
Authorization: Bearer <jwt_admin>
# Respuesta 200: cliente con activo=false
# Respuesta 409 CLIENTE_YA_BLOQUEADO si ya estaba bloqueado
# Respuesta 403 si rol es supervisor
```

### 6. Desbloquear cliente

```bash
PATCH /admin/clientes/:id/desbloquear
Authorization: Bearer <jwt_admin>
# Respuesta 200: cliente con activo=true
# Respuesta 409 CLIENTE_YA_ACTIVO si ya estaba activo
# Respuesta 403 si rol es supervisor
```

### 7. Verificar auditoría

```sql
SELECT * FROM audit_logs
WHERE action IN ('cliente.bloqueado', 'cliente.desbloqueado')
ORDER BY created_at DESC;
```

---

## Checklist de validación post-implementación

- [ ] `npm run build` sin errores TypeScript
- [ ] `npm run db:migration:run` aplica la tabla `clientes` + índice parcial correctamente
- [ ] `GET /admin/clientes` con JWT de supervisor → 200
- [ ] `GET /admin/clientes` sin JWT → 401
- [ ] `PATCH /admin/clientes/:id/bloquear` con JWT de supervisor → 403
- [ ] `PATCH /admin/clientes/:id/bloquear` dos veces → segunda → 409 CLIENTE_YA_BLOQUEADO
- [ ] `PATCH /admin/clientes/:id/desbloquear` dos veces → segunda → 409 CLIENTE_YA_ACTIVO
- [ ] `upsertByDni` mismo DNI dos veces → un solo registro en DB, `fecha_primera_operacion` no cambia
- [ ] `upsertByDni` mismo DNI en dos tenants distintos → dos registros independientes
- [ ] `GET /admin/clientes?activo=false` no devuelve clientes activos
- [ ] Registro de auditoría presente tras bloquear/desbloquear
- [ ] `ClientesService` exportado y visible para importación en PedidosModule (Stage 3)
