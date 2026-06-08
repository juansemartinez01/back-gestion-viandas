# API Contracts: Entregas de Viandas

**Feature**: 017-entregas | **Date**: 2026-06-08  
**Base path**: `/admin/entregas`  
**Auth**: `JwtAuthGuard` + `RolesGuard` en todos los endpoints

---

## POST /admin/entregas

**Descripción**: Registrar la entrega de un pedido confirmado. Opera en una transacción atómica que valida el pedido, consume stock, registra cobro presencial si corresponde, actualiza el estado del pedido y crea el registro de entrega.

**Roles permitidos**: `administrador`, `operador_caja`

**Auditoría**: `entrega.registrada`

### Request

```http
POST /admin/entregas
Authorization: Bearer <token>
Content-Type: application/json
x-tenant-key: <tenant>
```

```json
{
  "pedido_id": "uuid-del-pedido",
  "punto_retiro_id": "uuid-del-punto-retiro",
  "observacion": "Texto opcional del operador"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `pedido_id` | UUID | Sí | ID del pedido a entregar |
| `punto_retiro_id` | UUID | Sí | Punto de retiro donde se realiza la entrega |
| `observacion` | string | No | Nota libre del operador |

### Response 201

```json
{
  "ok": true,
  "data": {
    "id": "uuid-entrega",
    "pedido_id": "uuid-del-pedido",
    "sede_id": "uuid-sede",
    "punto_retiro_id": "uuid-punto-retiro",
    "usuario_id": "uuid-operador",
    "importe_cobrado_caja": "150.00",
    "fecha_entrega": "2026-06-08T14:30:00.000Z",
    "observacion": null,
    "tenant_id": "uuid-tenant",
    "created_at": "2026-06-08T14:30:00.000Z",
    "pedido": {
      "id": "uuid-del-pedido",
      "codigo_publico": "VIA-2026-000042",
      "dni_informado": "12345678",
      "nombre_informado": "Juan",
      "apellido_informado": "Pérez",
      "estado_pedido": "entregado",
      "medio_pago": "presencial",
      "importe_total": "150.00",
      "fecha_retiro": "2026-06-08"
    }
  }
}
```

### Errores

| Código HTTP | ErrorCode | Situación |
|-------------|-----------|-----------|
| 404 | `PEDIDO_NOT_FOUND` | Pedido no existe para el tenant |
| 409 | `ENTREGA_PEDIDO_NO_ENTREGABLE` | Estado del pedido no permite entrega (cancelado, pendiente_pago_online, ya entregado, no_retirado) |
| 409 | `ENTREGA_YA_REGISTRADA` | Ya existe una entrega para este pedido |
| 409 | `STOCK_INSUFICIENTE_ENTREGAS` | Stock reservado para encargues agotado |
| 404 | `PAGO_NOT_FOUND` | Pedido presencial sin pago registrado |
| 409 | `PAGO_YA_COBRADO` | Pago presencial ya estaba cobrado |

---

## GET /admin/entregas

**Descripción**: Listar entregas con filtros opcionales por rango de fecha, sede, punto de retiro y operador. Devuelve resultados paginados.

**Roles permitidos**: `administrador`, `supervisor`, `operador_caja`

### Request

```http
GET /admin/entregas?fecha_desde=2026-06-08&fecha_hasta=2026-06-08&sede_id=uuid&punto_retiro_id=uuid&usuario_id=uuid&page=1&limit=20
Authorization: Bearer <token>
x-tenant-key: <tenant>
```

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `fecha_desde` | ISO date string | No | Filtro inicio: `fecha_entrega >= fecha_desde` |
| `fecha_hasta` | ISO date string | No | Filtro fin: `fecha_entrega <= fecha_hasta` |
| `sede_id` | UUID | No | Filtrar por sede |
| `punto_retiro_id` | UUID | No | Filtrar por punto de retiro |
| `usuario_id` | UUID | No | Filtrar por operador que realizó la entrega |
| `page` | number | No | Página (default: 1) |
| `limit` | number | No | Items por página (default: 20) |

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid-entrega",
      "pedido_id": "uuid-pedido",
      "sede_id": "uuid-sede",
      "punto_retiro_id": "uuid-punto",
      "usuario_id": "uuid-operador",
      "importe_cobrado_caja": "150.00",
      "fecha_entrega": "2026-06-08T14:30:00.000Z",
      "observacion": null,
      "created_at": "2026-06-08T14:30:00.000Z",
      "pedido": {
        "id": "uuid-pedido",
        "codigo_publico": "VIA-2026-000042",
        "dni_informado": "12345678",
        "nombre_informado": "Juan",
        "apellido_informado": "Pérez",
        "medio_pago": "presencial",
        "importe_total": "150.00"
      }
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20
  }
}
```

---

## GET /admin/entregas/buscar-por-dni

> **IMPORTANTE**: Este endpoint debe declararse **antes** de `GET /admin/entregas/:id` en el controller para evitar que NestJS interprete `buscar-por-dni` como un UUID.

**Descripción**: Buscar pedidos confirmados y disponibles para entrega por DNI del cliente. Usado por la pantalla de caja para identificar qué pedido corresponde al cliente que se presenta a retirar.

**Roles permitidos**: `administrador`, `operador_caja`

### Request

```http
GET /admin/entregas/buscar-por-dni?dni=12345678&fecha=2026-06-08&sede_id=uuid&punto_retiro_id=uuid
Authorization: Bearer <token>
x-tenant-key: <tenant>
```

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `dni` | string | Sí | DNI del cliente (búsqueda por ILIKE — case insensitive) |
| `fecha` | ISO date string | Sí | Fecha de retiro del pedido |
| `sede_id` | UUID | Sí | Sede del punto de caja |
| `punto_retiro_id` | UUID | No | Filtrar por punto de retiro específico |

### Response 200

Devuelve pedidos en estado `confirmado_pago_online` o `confirmado_pago_presencial` que no hayan sido entregados aún, ordenados por apellido ASC.

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid-pedido",
      "codigo_publico": "VIA-2026-000042",
      "dni_informado": "12345678",
      "nombre_informado": "Juan",
      "apellido_informado": "Pérez",
      "telefono_informado": "11-1234-5678",
      "estado_pedido": "confirmado_pago_presencial",
      "medio_pago": "presencial",
      "importe_total": "150.00",
      "cantidad": 1,
      "fecha_retiro": "2026-06-08",
      "sede_id": "uuid-sede",
      "punto_retiro_id": "uuid-punto",
      "menuPublicado": {
        "id": "uuid-mp",
        "menuBase": {
          "id": "uuid-mb",
          "nombre": "Menú del día - Milanesa"
        }
      }
    }
  ]
}
```

Devuelve lista vacía `[]` si no hay pedidos disponibles para ese DNI/fecha/sede.

### Errores

| Código HTTP | ErrorCode | Situación |
|-------------|-----------|-----------|
| 400 | `BAD_REQUEST` | Parámetros requeridos faltantes (`dni`, `fecha`, `sede_id`) |

---

## GET /admin/entregas/:id

**Descripción**: Obtener el detalle completo de una entrega por su ID.

**Roles permitidos**: `administrador`, `supervisor`, `operador_caja`

### Request

```http
GET /admin/entregas/uuid-entrega
Authorization: Bearer <token>
x-tenant-key: <tenant>
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "uuid-entrega",
    "pedido_id": "uuid-pedido",
    "sede_id": "uuid-sede",
    "punto_retiro_id": "uuid-punto",
    "usuario_id": "uuid-operador",
    "importe_cobrado_caja": "150.00",
    "fecha_entrega": "2026-06-08T14:30:00.000Z",
    "observacion": null,
    "tenant_id": "uuid-tenant",
    "created_at": "2026-06-08T14:30:00.000Z",
    "pedido": {
      "id": "uuid-pedido",
      "codigo_publico": "VIA-2026-000042",
      "dni_informado": "12345678",
      "nombre_informado": "Juan",
      "apellido_informado": "Pérez",
      "telefono_informado": "11-1234-5678",
      "email_informado": "juan@example.com",
      "estado_pedido": "entregado",
      "medio_pago": "presencial",
      "importe_total": "150.00",
      "cantidad": 1,
      "fecha_retiro": "2026-06-08",
      "fecha_confirmacion": "2026-06-08T14:30:00.000Z"
    }
  }
}
```

### Errores

| Código HTTP | ErrorCode | Situación |
|-------------|-----------|-----------|
| 404 | `ENTREGA_NOT_FOUND` | Entrega no encontrada para el tenant |

---

## Resumen de endpoint order en el controller

```typescript
@Controller('admin/entregas')
export class EntregasController {
  @Post('/')             // registrarEntrega
  @Get('/')              // list
  @Get('buscar-por-dni') // buscarPorDni  ← DEBE IR ANTES DE /:id
  @Get(':id')            // findOne
}
```
