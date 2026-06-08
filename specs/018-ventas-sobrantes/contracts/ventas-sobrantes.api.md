# API Contract: Ventas de Sobrantes

**Feature**: 018-ventas-sobrantes | **Date**: 2026-06-08
**Base path**: `/admin/ventas-sobrantes`
**Auth**: `JwtAuthGuard` + `RolesGuard` en todos los endpoints

---

## POST /admin/ventas-sobrantes

Registra una venta de sobrante. Ejecuta el flujo transaccional completo con SELECT FOR UPDATE.

**Roles**: `administrador`, `operador_caja`

### Request body

```json
{
  "fecha": "2026-06-08",
  "sede_id": "uuid",
  "punto_retiro_id": "uuid",
  "menu_publicado_id": "uuid",
  "cantidad": 2,
  "observacion": "texto libre opcional"
}
```

**Validaciones**:
- `fecha`: requerido, formato ISO date string
- `sede_id`, `punto_retiro_id`, `menu_publicado_id`: requeridos, UUID v4
- `cantidad`: requerido, entero, mínimo 1
- `observacion`: opcional, string

### Response 201

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "fecha": "2026-06-08",
    "sede_id": "uuid",
    "punto_retiro_id": "uuid",
    "menu_publicado_id": "uuid",
    "cantidad": 2,
    "precio_unitario": "150.00",
    "importe_total": "300.00",
    "usuario_id": "uuid",
    "observacion": null,
    "created_at": "2026-06-08T14:30:00.000Z",
    "menuPublicado": {
      "id": "uuid",
      "precio_sobrante": "150.00",
      "precio_encargo": "180.00"
    }
  }
}
```

### Errores posibles

| Código HTTP | Error code | Descripción |
|-------------|------------|-------------|
| 404 | `MENU_PUBLICADO_NOT_FOUND` | El menú publicado no existe para el tenant |
| 404 | `STOCK_VIANDA_NOT_FOUND` | No existe StockVianda para la combinación fecha/sede/punto/menú |
| 409 | `SOBRANTE_PRODUCCION_NO_CONFIRMADA` | La producción del día no está confirmada |
| 409 | `STOCK_INSUFICIENTE_SOBRANTES` | Stock disponible para sobrantes insuficiente |
| 400 | `BAD_REQUEST` | Validación de DTO fallida |

---

## GET /admin/ventas-sobrantes/disponibles

Lista los menús con stock de sobrantes disponible > 0 para la fecha, sede y punto de retiro indicados.

**IMPORTANTE**: Esta ruta debe declararse ANTES de `GET /:id` en el controller.

**Roles**: `administrador`, `operador_caja`

### Query params

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `fecha` | date string | Sí | Fecha del día operativo |
| `sede_id` | UUID | Sí | Sede a consultar |
| `punto_retiro_id` | UUID | No | Filtro adicional por punto de retiro |

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "stock_id": "uuid",
      "menu_publicado_id": "uuid",
      "nombre_menu": "Milanesa con puré",
      "precio_sobrante": "150.00",
      "precio_encargo": "180.00",
      "cantidad_disponible": 3
    }
  ]
}
```

### Errores posibles

| Código HTTP | Error code | Descripción |
|-------------|------------|-------------|
| 400 | `BAD_REQUEST` | `fecha` o `sede_id` faltantes o inválidos |

---

## GET /admin/ventas-sobrantes

Lista el historial de ventas de sobrantes con filtros opcionales.

**Roles**: `administrador`, `supervisor`, `operador_caja`

### Query params

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `fecha` | date string | No | Filtrar por fecha exacta |
| `sede_id` | UUID | No | Filtrar por sede |
| `punto_retiro_id` | UUID | No | Filtrar por punto de retiro |
| `menu_publicado_id` | UUID | No | Filtrar por menú publicado |
| `page` | int | No | Página (default: 1) |
| `limit` | int | No | Límite por página (default: 20) |

### Response 200

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "fecha": "2026-06-08",
        "sede_id": "uuid",
        "punto_retiro_id": "uuid",
        "menu_publicado_id": "uuid",
        "cantidad": 2,
        "precio_unitario": "150.00",
        "importe_total": "300.00",
        "usuario_id": "uuid",
        "observacion": null,
        "created_at": "2026-06-08T14:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

## GET /admin/ventas-sobrantes/:id

Retorna el detalle de una venta de sobrante por su ID.

**Roles**: `administrador`, `supervisor`, `operador_caja`

### Path param

- `id`: UUID de la venta

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "fecha": "2026-06-08",
    "sede_id": "uuid",
    "punto_retiro_id": "uuid",
    "menu_publicado_id": "uuid",
    "cantidad": 2,
    "precio_unitario": "150.00",
    "importe_total": "300.00",
    "usuario_id": "uuid",
    "observacion": null,
    "created_at": "2026-06-08T14:30:00.000Z",
    "menuPublicado": {
      "id": "uuid",
      "precio_sobrante": "150.00",
      "precio_encargo": "180.00"
    }
  }
}
```

### Errores posibles

| Código HTTP | Error code | Descripción |
|-------------|------------|-------------|
| 404 | `VENTA_SOBRANTE_NOT_FOUND` | La venta no existe o no pertenece al tenant |
