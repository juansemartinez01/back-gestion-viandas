# Data Model: Stock Operativo de Viandas

**Branch**: `016-stock-viandas` | **Date**: 2026-06-08

## Entidades

### StockVianda

**Tabla**: `stock_viandas`

Extiende `BaseEntity` (provee `id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at`).

> `deleted_at` heredado de BaseEntity no se usa operativamente (el stock no se elimina), pero se incluye por coherencia con el patrón del template.

| Campo | Tipo TypeORM | Tipo DB | Nullable | Default | Notas |
|-------|-------------|---------|----------|---------|-------|
| `id` | `uuid` (PK) | uuid | NO | auto | Heredado de BaseEntity |
| `tenant_id` | `uuid` | uuid | SÍ* | — | Heredado; obligatorio en práctica |
| `fecha` | `date` | date | NO | — | Fecha de producción / operación |
| `sede_id` | `uuid` | uuid | NO | — | FK → sedes.id |
| `punto_retiro_id` | `uuid` | uuid | NO | — | FK → puntos_retiro.id |
| `menu_publicado_id` | `uuid` | uuid | NO | — | FK → menus_publicados.id |
| `orden_produccion_id` | `uuid` | uuid | NO | — | FK → orden_produccion_vianda.id |
| `stock_reservado_encargues` | `int` | integer | NO | 0 | Unidades para pedidos confirmados |
| `stock_disponible_sobrantes` | `int` | integer | NO | 0 | Unidades para venta presencial |
| `stock_entregado` | `int` | integer | NO | 0 | Consumido por entregas |
| `stock_vendido_sobrante` | `int` | integer | NO | 0 | Consumido por ventas presenciales |
| `stock_ajustado` | `int` | integer | NO | 0 | Ajustes manuales acumulados (±) |
| `stock_restante` | `int` | integer | NO | 0 | Calculado: ver fórmula abajo |
| `created_at` | `timestamptz` | timestamptz | NO | now() | Heredado |
| `updated_at` | `timestamptz` | timestamptz | NO | now() | Heredado |
| `deleted_at` | `timestamptz` | timestamptz | SÍ | null | Heredado (no se usa operativamente) |

**Fórmula de stock_restante**:
```
stock_restante = stock_reservado_encargues - stock_entregado
               + stock_disponible_sobrantes - stock_vendido_sobrante
               + stock_ajustado
```

**Constraint UNIQUE**:
```sql
UNIQUE (tenant_id, fecha, sede_id, punto_retiro_id, menu_publicado_id)
-- Nombre sugerido: uq_sv_combinacion
```

**Índices**:
```sql
INDEX idx_sv_tenant_fecha_sede (tenant_id, fecha, sede_id)
```

**Relaciones** (solo para queries con JOIN, no eager):
- `sede` → `Sede` (ManyToOne, onDelete: RESTRICT)
- `puntoRetiro` → `PuntoRetiro` (ManyToOne, onDelete: RESTRICT)
- `menuPublicado` → `MenuPublicado` (ManyToOne, onDelete: RESTRICT)
- `ordenProduccion` → `OrdenProduccionVianda` (ManyToOne, onDelete: RESTRICT)

---

### MovimientoStockVianda

**Tabla**: `movimientos_stock_viandas`

No extiende `BaseEntity` — declara columnas manualmente para evitar `updated_at` y `deleted_at` (entidad inmutable).

| Campo | Tipo TypeORM | Tipo DB | Nullable | Default | Notas |
|-------|-------------|---------|----------|---------|-------|
| `id` | `uuid` (PK) | uuid | NO | auto gen | `@PrimaryGeneratedColumn('uuid')` |
| `tenant_id` | `uuid` | uuid | NO | — | Multitenancy, `@Index()` |
| `stock_vianda_id` | `uuid` | uuid | NO | — | FK → stock_viandas.id |
| `tipo_movimiento` | `enum` | varchar | NO | — | `TipoMovimientoStockVianda` |
| `cantidad` | `int` | integer | NO | — | Positivo o negativo según tipo |
| `pedido_id` | `uuid` | uuid | SÍ | null | FK lógica → pedidos.id |
| `venta_sobrante_id` | `uuid` | uuid | SÍ | null | FK lógica → (módulo futuro) |
| `usuario_id` | `uuid` | uuid | SÍ | null | Usuario que realizó ajuste manual |
| `observacion` | `text` | text | SÍ | null | Detalle del ajuste o contexto |
| `created_at` | `timestamptz` | timestamptz | NO | now() | `@CreateDateColumn` |

**Relación**:
- `stockVianda` → `StockVianda` (ManyToOne, onDelete: RESTRICT)

---

### Enum: TipoMovimientoStockVianda

**Archivo**: `src/modules/stock-viandas/stock-vianda.enums.ts`

```
alta_produccion       → Stock inicial al confirmar producción (cantidad = total real producido)
consumo_entrega       → Descontado por entrega de encargue (cantidad negativa)
consumo_sobrante      → Descontado por venta presencial (cantidad negativa)
ajuste_positivo       → Corrección manual que suma unidades (cantidad positiva)
ajuste_negativo       → Corrección manual que resta unidades (cantidad negativa)
reasignacion_cancelacion → Unidad movida de encargues a sobrantes por cancelación post-producción (cantidad = 1)
```

---

## Migración

**Archivo sugerido**: `migrations/{timestamp}-CreateStockViandas.ts`

**Tablas a crear**:

```sql
-- stock_viandas
CREATE TABLE stock_viandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  fecha date NOT NULL,
  sede_id uuid NOT NULL,
  punto_retiro_id uuid NOT NULL,
  menu_publicado_id uuid NOT NULL,
  orden_produccion_id uuid NOT NULL,
  stock_reservado_encargues integer NOT NULL DEFAULT 0,
  stock_disponible_sobrantes integer NOT NULL DEFAULT 0,
  stock_entregado integer NOT NULL DEFAULT 0,
  stock_vendido_sobrante integer NOT NULL DEFAULT 0,
  stock_ajustado integer NOT NULL DEFAULT 0,
  stock_restante integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT uq_sv_combinacion UNIQUE (tenant_id, fecha, sede_id, punto_retiro_id, menu_publicado_id)
);
CREATE INDEX idx_sv_tenant_fecha_sede ON stock_viandas (tenant_id, fecha, sede_id);
CREATE INDEX idx_sv_tenant_id ON stock_viandas (tenant_id);

-- movimientos_stock_viandas
CREATE TABLE movimientos_stock_viandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  stock_vianda_id uuid NOT NULL REFERENCES stock_viandas(id) ON DELETE RESTRICT,
  tipo_movimiento varchar NOT NULL,
  cantidad integer NOT NULL,
  pedido_id uuid,
  venta_sobrante_id uuid,
  usuario_id uuid,
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_msv_stock_vianda_id ON movimientos_stock_viandas (stock_vianda_id);
CREATE INDEX idx_msv_tenant_id ON movimientos_stock_viandas (tenant_id);
```

> La migración real se genera con `npm run db:migration:generate -- migrations/CreateStockViandas` y se revisa/ajusta antes de ejecutar.

---

## Diagrama de relaciones (texto)

```
OrdenProduccionVianda (1) ──────── (1) StockVianda
                                        │
                                        │ (1:N)
                                        ▼
                                MovimientoStockVianda
```

`StockVianda` también referencia (solo FK, sin carga eager):
- `Sede`
- `PuntoRetiro`
- `MenuPublicado`
