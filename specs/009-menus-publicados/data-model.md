# Data Model: Menús Publicados

**Feature**: 009-menus-publicados | **Date**: 2026-06-07

## Entity: MenuPublicado

**Table**: `menus_publicados`
**Base**: `BaseEntity` (id uuid PK, tenant_id uuid indexed, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz nullable — soft delete)

### Columns

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `menu_base_id` | uuid | No | — | FK → `menus_base.id` |
| `sede_id` | uuid | No | — | FK → `sedes.id` |
| `fecha_venta` | date | No | — | Día para el que se publica el menú |
| `precio_encargo` | decimal(10,2) | No | — | Debe ser > 0 |
| `precio_sobrante` | decimal(10,2) | Sí | NULL | Precio para venta de sobrante |
| `fecha_hora_limite_encargo` | timestamptz | No | — | Debe ser ≤ fin del día de `fecha_venta` |
| `fecha_hora_limite_cancelacion` | timestamptz | Sí | NULL | — |
| `limite_maximo_viandas` | int | Sí | NULL | Cap de encargos; NULL = sin límite |
| `tipo_sobreproduccion` | enum | Sí | NULL | `cantidad_fija` \| `porcentaje` |
| `valor_sobreproduccion` | decimal(8,2) | Sí | NULL | Par con `tipo_sobreproduccion` |
| `estado` | enum | No | `activo` | Ver máquina de estados |
| `imagen_public_id` | varchar(500) | Sí | NULL | Sobreescribe imagen del menú base en portal |
| `imagen_url` | varchar(1000) | Sí | NULL | Par con `imagen_public_id` |
| `observaciones` | text | Sí | NULL | — |

### Enums

```typescript
enum EstadoMenuPublicado {
  ACTIVO    = 'activo',
  PAUSADO   = 'pausado',
  CERRADO   = 'cerrado',
  AGOTADO   = 'agotado',
  CANCELADO = 'cancelado',
}

enum TipoSobreproduccion {
  CANTIDAD_FIJA = 'cantidad_fija',
  PORCENTAJE    = 'porcentaje',
}
```

### Validation Rules (enforced at service layer)

- `precio_encargo > 0`
- `fecha_hora_limite_encargo <= fecha_venta + T23:59:59Z`
- Si `tipo_sobreproduccion` presente → `valor_sobreproduccion` requerido (y viceversa)
- `puntos_retiro` ≥ 1, todos activos, todos con `sede_id` = menú publicado's `sede_id`
- `menu_base.activo = true` al crear
- `sede.activa = true` al crear

---

## Relationships

### ManyToOne: MenuPublicado → MenuBase

```
MenuPublicado.menu_base_id → menus_base.id
TypeORM: @ManyToOne(() => MenuBase) @JoinColumn({ name: 'menu_base_id' })
```

### ManyToOne: MenuPublicado → Sede

```
MenuPublicado.sede_id → sedes.id
TypeORM: @ManyToOne(() => Sede) @JoinColumn({ name: 'sede_id' })
```

### ManyToMany: MenuPublicado ↔ PuntoRetiro

```
Join table: menu_publicado_puntos_retiro
  - menu_publicado_id uuid FK → menus_publicados.id
  - punto_retiro_id   uuid FK → puntos_retiro.id
  - PK: (menu_publicado_id, punto_retiro_id)

TypeORM:
  @ManyToMany(() => PuntoRetiro)
  @JoinTable({
    name: 'menu_publicado_puntos_retiro',
    joinColumn: { name: 'menu_publicado_id' },
    inverseJoinColumn: { name: 'punto_retiro_id' },
  })
  puntosRetiro: PuntoRetiro[]
```

**Constraint**: todos los `PuntoRetiro.sede_id` deben igualar `MenuPublicado.sede_id` (validado en servicio, no FK).

---

## State Machine

```
                         ┌─────────────────────────────────────────┐
                         │                ACTIVO                    │
                         └──┬────────────┬─────────────┬───────────┘
                            │            │             │
                        pausar()     cerrar()      agotar()     cancelar() (any role)
                            │            │             │
                            ▼            ▼             ▼
                        ┌───────┐  ┌─────────┐  ┌─────────┐
                        │PAUSADO│  │ CERRADO │  │ AGOTADO │
                        └──┬──┬─┘  └────┬────┘  └────┬────┘
                           │  │         │              │
              reactivar()  │  │    cancelar()     cancelar()
              (→ACTIVO)    │  │    (SOLO ADMIN)   (SOLO ADMIN)
                           │  │         │              │
                       cerrar() │         ▼              ▼
                       cancelar() │       ┌──────────────────────┐
                           │  └────────► │      CANCELADO        │
                           │            │  (estado terminal)     │
                           └──────────► └──────────────────────┘
                                                  │
                                              remove()
                                          (soft delete, solo admin)
```

### Transitions matrix

| From \ To | ACTIVO | PAUSADO | CERRADO | AGOTADO | CANCELADO |
|-----------|--------|---------|---------|---------|-----------|
| ACTIVO | — | `pausar()` | `cerrar()` | `agotar()` | `cancelar()` any role |
| PAUSADO | `reactivar()` | — | `cerrar()` | — | `cancelar()` any role |
| CERRADO | — | — | — | — | `cancelar()` **admin only** |
| AGOTADO | — | — | — | — | `cancelar()` **admin only** |
| CANCELADO | — | — | — | — | — (terminal) |

### Error on invalid transition

`AppError({ code: ErrorCodes.MENU_PUBLICADO_TRANSICION_INVALIDA, status: 409 })`

---

## Indexes

```sql
-- Tenant scope (heredado del BaseEntity)
INDEX idx_menus_publicados_tenant_id ON menus_publicados(tenant_id);

-- Filtros operativos frecuentes
INDEX idx_menus_publicados_fecha_venta ON menus_publicados(tenant_id, fecha_venta);
INDEX idx_menus_publicados_sede_estado ON menus_publicados(tenant_id, sede_id, estado);
```

*No índice único compuesto — se permite publicar el mismo menú base en la misma fecha y sede más de una vez.*

---

## Error Codes (new — to add to ErrorCodes)

| Code | HTTP | Trigger |
|------|------|---------|
| `MENU_PUBLICADO_NOT_FOUND` | 404 | `findOne` no encuentra el menú en el tenant |
| `MENU_PUBLICADO_TRANSICION_INVALIDA` | 409 | Transición de estado no permitida o rol insuficiente |
| `MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS` | 422 | Punto de retiro inactivo, no encontrado, o de otra sede |
| `MENU_PUBLICADO_PRECIO_INVALIDO` | 422 | `precio_encargo <= 0` |
| `MENU_PUBLICADO_FECHA_LIMITE_INVALIDA` | 422 | `fecha_hora_limite_encargo > fecha_venta` |
| `MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA` | 422 | `tipo_sobreproduccion` y `valor_sobreproduccion` incompletos |
| `MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE` | 409 | `remove()` sobre menú que no está en estado CANCELADO |

---

## Cross-entity Validation Summary

| Validation | When | How |
|-----------|------|-----|
| `MenuBase.activo = true` | `create()` | `MenusBaseService.findOne(menu_base_id)` → checks activo |
| `Sede.activa = true` | `create()` | `SedesService.findOne(sede_id)` → checks activa |
| `PuntoRetiro.activo = true` | `create()` + `update()` | QB directo sobre `Repository<PuntoRetiro>` |
| `PuntoRetiro.sede_id = MenuPublicado.sede_id` | `create()` + `update()` | QB con `WHERE pr.sede_id = :sedeId` |
