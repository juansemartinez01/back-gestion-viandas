# Implementation Plan: Módulo Etiquetas de Menú

**Branch**: `005-etiquetas-menu-crud` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-etiquetas-menu-crud/spec.md`

## Summary

Implementar el módulo `etiquetas-menu` (Stage 1, cuarto módulo de Master Data) para el sistema Rochester de gestión de viandas. Una etiqueta de menú es un destacado visual que aparece en las cards del portal público para que el cliente identifique características de la vianda (Sin carne, Recomendado, Nuevo, etc.). El módulo es **idéntico en estructura y lógica a `categorias-menu`** — solo cambian nombres de entidad, tabla, rutas y códigos de error. Type A CRUD tenant-safe simple.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer, nestjs-pino

**Storage**: PostgreSQL 15+ via TypeORM (`DataSource`, `Repository`, `QueryBuilder`)

**Target Platform**: Railway (prod) / localhost (dev)

**Project Type**: REST API — módulo de catálogo tenant-safe dentro del Innoview Backend Template

**Performance Goals**: Listados < 2 segundos con hasta 1000 registros; endpoint público < 500ms p95

**Constraints**: Sin `synchronize: true`. Sin `throw new Error()`. Sin `repo.find()` sin scope de tenant. Sin `PartialType`.

**Scale/Scope**: Múltiples tenants, < 50 etiquetas por tenant en MVP.

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | ✅ | Usa `ok()`, `page()`, `AppError`, `ErrorCodes` |
| II. Multi-Tenancy by Default | ✅ | `BaseCrudTenantService`, `applyTenantScopeQb`, endpoint público vía `x-tenant-key` |
| III. RBAC | ✅ | `JwtAuthGuard + RolesGuard` a nivel clase; `@Roles()` por método; endpoint público explícito sin guard |
| IV. Business Rule Integrity | ✅ | Unicidad (tenant+nombre), soft delete solo si inactiva, advertencia informativa al inactivar |
| V. Audit Trail | ✅ | `AuditService.write()` en crear, editar, activar, inactivar, eliminar |
| VI. Module Architecture | ✅ | Type A — extends `BaseCrudTenantService`; estructura entity/dto/service/controller/module |
| VII. Implementation Discipline | ✅ | Stage 1, cuarto módulo: sedes → puntos-retiro → categorias-menu → etiquetas-menu |

**Resultado**: 7/7 ✅ — sin violaciones. Sin `Complexity Tracking` necesario.

## Project Structure

### Documentation (this feature)

```text
specs/005-etiquetas-menu-crud/
├── plan.md              # Este archivo
├── research.md          # Findings técnicos
├── data-model.md        # Entidad, DTOs, estado
├── quickstart.md        # Smoke tests + comandos
├── contracts/
│   └── api-endpoints.md # 8 endpoints con contratos completos
└── tasks.md             # Generado por /speckit-tasks
```

### Source Code

```text
src/
├── common/
│   └── errors/
│       └── error-codes.ts          # +5 nuevos códigos ETIQUETA_MENU_*
├── modules/
│   └── etiquetas-menu/
│       ├── entities/
│       │   └── etiqueta-menu.entity.ts
│       ├── dto/
│       │   ├── create-etiqueta-menu.dto.ts
│       │   ├── update-etiqueta-menu.dto.ts
│       │   └── query-etiqueta-menu.dto.ts
│       ├── etiquetas-menu.service.ts
│       ├── etiquetas-menu.controller.ts
│       ├── public-etiquetas-menu.controller.ts
│       └── etiquetas-menu.module.ts
└── app.module.ts                    # Registrar EtiquetasMenuModule

migrations/
└── <timestamp>-CreateEtiquetasMenu.ts  # Generar + editar índice parcial
```

## Implementation Notes

### 1. ErrorCodes — agregar antes que cualquier otra cosa

```typescript
// src/common/errors/error-codes.ts — agregar al objeto ErrorCodes:
// etiquetas-menu
ETIQUETA_MENU_NOT_FOUND: 'ETIQUETA_MENU_NOT_FOUND',
ETIQUETA_MENU_NOMBRE_DUPLICADO: 'ETIQUETA_MENU_NOMBRE_DUPLICADO',
ETIQUETA_MENU_YA_ACTIVA: 'ETIQUETA_MENU_YA_ACTIVA',
ETIQUETA_MENU_YA_INACTIVA: 'ETIQUETA_MENU_YA_INACTIVA',
ETIQUETA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'ETIQUETA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
```

### 2. Entidad

```typescript
@Entity('etiquetas_menu')
@Index('UQ_etiquetas_menu_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })
export class EtiquetaMenu extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion!: string | null;

  @Column({ type: 'boolean', default: true })
  activa!: boolean;

  @Column({ type: 'int', nullable: true })
  orden_visualizacion!: number | null;
}
```

> El `@Index` genera un índice completo. La migración debe reemplazarlo por índice parcial con `WHERE deleted_at IS NULL`.

### 3. Migración — edición manual obligatoria

```typescript
// Reemplazar el índice único auto-generado por:
await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_etiquetas_menu_tenant_nombre"
  ON "etiquetas_menu" ("tenant_id", "nombre")
  WHERE "deleted_at" IS NULL
`);

// En down() agregar:
await queryRunner.query(`DROP INDEX IF EXISTS "UQ_etiquetas_menu_tenant_nombre"`);
```

### 4. Service — idéntico a CategoriasMenuService con sustitución de nombres

```typescript
@Injectable()
export class EtiquetasMenuService extends BaseCrudTenantService<EtiquetaMenu> {
  constructor(
    @InjectRepository(EtiquetaMenu)
    private readonly etiquetaMenuRepo: Repository<EtiquetaMenu>,
  ) {
    super(etiquetaMenuRepo);
  }
  // list(), findOne(), create(), update(), activar(), inactivar(), remove(), listPublic()
  // assertNombreUnico() — misma lógica, alias 'em' en QueryBuilder
}
```

### 5. Alias QB: `em`

Usar alias `'em'` (EtiquetaMenu) en todos los QueryBuilders para distinguir de `'cm'` (CategoriaMenu) en logs.

### 6. Module

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([EtiquetaMenu]), AuditModule],
  providers: [EtiquetasMenuService],
  controllers: [EtiquetasMenuController, PublicEtiquetasMenuController],
  exports: [EtiquetasMenuService],
})
export class EtiquetasMenuModule {}
```

### 7. Controller público — sin query params

Igual que `PublicCategoriasMenuController` — sin parámetros de query, solo tenant desde `x-tenant-key`.

## Constraints Recap

| Constraint | Cómo se aplica |
|-----------|----------------|
| No `repo.find()` sin tenant | Siempre via `super.*()` o `applyTenantScopeQb()` |
| No `throw new Error()` | Solo `AppError` con `ErrorCodes` |
| Campo `activa` (femenino) | Consistente con categorias-menu |
| Endpoint público sin query params | `listPublic()` sin argumentos |
| Endpoint público NULLS LAST | `createQueryBuilder` propio en `listPublic()` |
| Respuestas via helpers | `ok()` y `page()` de `api-response.ts` |
| Sin `PartialType` | `UpdateEtiquetaMenuDto` con campos explícitos |
| `migrationsRun: true` | Ya configurado — no tocar |
