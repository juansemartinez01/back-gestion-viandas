---
description: "Research findings for etiquetas-menu module — identical pattern to categorias-menu"
---

# Research: Módulo Etiquetas de Menú

> Este módulo es estructuralmente idéntico a `categorias-menu`. Todos los findings de research aplican sin cambios. Solo se documentan las diferencias concretas.

## R-01 — Patrón base: identical to categorias-menu

**Decision**: Replicar el módulo `categorias-menu` con sustitución de nombres.

**Finding**: Los research findings R-01 a R-10 de `specs/003-categorias-menu-crud/research.md` aplican sin modificación. No hay decisiones técnicas nuevas en este módulo.

**Key substitutions**:
- `CategoriaMenu` → `EtiquetaMenu`
- `categorias_menu` → `etiquetas_menu`
- `CategoriasMenuService` → `EtiquetasMenuService`
- `CategoriasMenuController` → `EtiquetasMenuController`
- `PublicCategoriasMenuController` → `PublicEtiquetasMenuController`
- `CategoriasMenuModule` → `EtiquetasMenuModule`
- `/admin/categorias-menu` → `/admin/etiquetas-menu`
- `/public/categorias-menu` → `/public/etiquetas-menu`
- `CATEGORIA_MENU_*` → `ETIQUETA_MENU_*`
- QB alias `'cm'` → `'em'`
- Audit actions `categoria_menu.*` → `etiqueta_menu.*`

---

## R-02 — Diferencia semántica (no técnica)

**Decision**: Las etiquetas son destacados visuales de card; las categorías son clasificaciones administrativas.

**Finding**: Esta diferencia es puramente semántica para el negocio. A nivel de código y base de datos, la estructura es idéntica. No hay implicaciones técnicas adicionales.

---

## R-03 — Índice único parcial

**Decision**: `UQ_etiquetas_menu_tenant_nombre` ON `etiquetas_menu (tenant_id, nombre) WHERE deleted_at IS NULL`

**Finding**: Mismo patrón que `categorias-menu`. Editar manualmente después de `npm run db:migration:generate -- migrations/CreateEtiquetasMenu`.

---

## R-04 — ErrorCodes

**Decision**: Agregar 5 códigos con prefijo `ETIQUETA_MENU_` en `error-codes.ts`.

**Finding**: Análogos a los 5 códigos de `CATEGORIA_MENU_`. No hay conflictos con códigos existentes.
