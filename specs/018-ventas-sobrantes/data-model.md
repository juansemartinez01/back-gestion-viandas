# Data Model: Ventas de Sobrantes

**Feature**: 018-ventas-sobrantes | **Date**: 2026-06-08

---

## Entidad principal: VentaSobrante

**Tabla**: `ventas_sobrantes`

**Nota**: No extiende `BaseEntity`. No tiene `updated_at` ni `deleted_at` — registro inmutable.

| Columna | Tipo PostgreSQL | TypeORM | Nullable | Descripción |
|---------|----------------|---------|----------|-------------|
| `id` | `uuid` | `PrimaryGeneratedColumn('uuid')` | No | PK |
| `tenant_id` | `uuid` | `@Index() @Column` | No | FK implícita a tenant |
| `fecha` | `date` | `@Column({ type: 'date' })` | No | Fecha de la venta (= fecha del día operativo) |
| `sede_id` | `uuid` | `@Column({ type: 'uuid' })` | No | FK → sedes |
| `punto_retiro_id` | `uuid` | `@Column({ type: 'uuid' })` | No | FK → puntos_retiro |
| `menu_publicado_id` | `uuid` | `@Column({ type: 'uuid' })` | No | FK → menus_publicados |
| `cantidad` | `int` | `@Column({ type: 'int' })` | No | Unidades vendidas (≥ 1) |
| `precio_unitario` | `decimal(10,2)` | `@Column({ type: 'decimal', precision: 10, scale: 2 })` | No | precio_sobrante ?? precio_encargo del menú |
| `importe_total` | `decimal(10,2)` | `@Column({ type: 'decimal', precision: 10, scale: 2 })` | No | precio_unitario × cantidad |
| `usuario_id` | `uuid` | `@Column({ type: 'uuid' })` | No | Usuario autenticado que registró la venta |
| `observacion` | `text` | `@Column({ type: 'text', nullable: true })` | Sí | Comentario libre opcional |
| `created_at` | `timestamptz` | `@CreateDateColumn({ type: 'timestamptz' })` | No | Timestamp de creación |

**Índices**:
```typescript
@Index('idx_vs_tenant_fecha_sede', ['tenant_id', 'fecha', 'sede_id'])
```

**Relaciones** (lazy — sin eager):
- `@ManyToOne(() => Sede)` → `sede_id`
- `@ManyToOne(() => PuntoRetiro)` → `punto_retiro_id`
- `@ManyToOne(() => MenuPublicado)` → `menu_publicado_id`

---

## Entidades dependientes (solo lectura o acceso directo dentro del QueryRunner)

### StockVianda (acceso directo en el QueryRunner)

Columnas relevantes actualizadas durante la venta:

| Columna | Operación |
|---------|-----------|
| `stock_vendido_sobrante` | `+= dto.cantidad` |
| `stock_restante` | recalculado (stock_reservado_encargues - stock_entregado + stock_disponible_sobrantes - stock_vendido_sobrante + stock_ajustado) |

Se accede con `SELECT FOR UPDATE` dentro del QueryRunner.

### MovimientoStockVianda (insert dentro del QueryRunner)

| Campo | Valor |
|-------|-------|
| `tenant_id` | del contexto |
| `stock_vianda_id` | stock.id |
| `tipo_movimiento` | `TipoMovimientoStockVianda.CONSUMO_SOBRANTE` |
| `cantidad` | `-dto.cantidad` |
| `venta_sobrante_id` | savedVenta.id |
| `pedido_id` | null |
| `usuario_id` | usuarioId |
| `observacion` | null |

### OrdenProduccionVianda (solo lectura)

Consultada por `(tenant_id, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id)`.
Estados válidos: `CONFIRMADA_COMPLETA`, `CONFIRMADA_CON_DIFERENCIA`.

### MenuPublicado (solo lectura)

Consultada por `(id, tenant_id)`. Campos usados: `precio_sobrante`, `precio_encargo`.

---

## Error codes nuevos en ErrorCodes

```typescript
// ventas-sobrantes
VENTA_SOBRANTE_NOT_FOUND: 'VENTA_SOBRANTE_NOT_FOUND',
SOBRANTE_PRODUCCION_NO_CONFIRMADA: 'SOBRANTE_PRODUCCION_NO_CONFIRMADA',
```

Los existentes reutilizados:
- `MENU_PUBLICADO_NOT_FOUND` (404)
- `STOCK_VIANDA_NOT_FOUND` (404)
- `STOCK_INSUFICIENTE_SOBRANTES` (409)

---

## Migración

**Comando**: `npm run db:migration:generate -- migrations/CreateVentasSobrantes`

La migración crea:
1. Tabla `ventas_sobrantes` con todas las columnas listadas
2. Índice `idx_vs_tenant_fecha_sede` en `(tenant_id, fecha, sede_id)`
3. FK constraints a `sedes`, `puntos_retiro`, `menus_publicados` (RESTRICT on delete)

**No agrega** `updated_at` ni `deleted_at`.

---

## Diagrama de relaciones (simplificado)

```
OrdenProduccionVianda ──(lectura validación)──┐
MenuPublicado ──────────────────────────────── VentaSobrante ──@Index── tenant_id
StockVianda ───(SELECT FOR UPDATE + update)───┘                         fecha
                                                                         sede_id
MovimientoStockVianda ←─ insert dentro del mismo QueryRunner
```
