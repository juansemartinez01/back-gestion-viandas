# Implementation Plan: Módulo Categorías de Menú

**Branch**: `003-categorias-menu-crud` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-categorias-menu-crud/spec.md`

## Summary

Implementar el módulo `categorias-menu` (Stage 1, tercer módulo de Master Data) para el sistema Rochester de gestión de viandas. Una categoría de menú clasifica las viandas de forma administrativa y comercial (Saludable, Clásico, Vegetariano, etc.). El módulo es el Type A más simple del proyecto: no tiene FK a otras entidades de negocio, sin dependencias de otros módulos en Stage 1. La diferencia respecto a `sedes` y `puntos-retiro` es que usa el campo `activa` (no `activo`) y que el endpoint público no requiere ningún query param — solo el header `x-tenant-key`.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer, nestjs-pino

**Storage**: PostgreSQL 15+ via TypeORM (`DataSource`, `Repository`, `QueryBuilder`)

**Target Platform**: Railway (prod) / localhost (dev)

**Project Type**: REST API — módulo de catálogo tenant-safe dentro del Innoview Backend Template

**Performance Goals**: Listados < 2 segundos con hasta 1000 registros; endpoint público < 500ms p95

**Constraints**: Sin `synchronize: true`. Sin `throw new Error()`. Sin `repo.find()` sin scope de tenant. Campo `activa` (femenino) para consistencia semántica con la entidad.

**Scale/Scope**: Múltiples tenants, < 50 categorías por tenant en MVP.

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | ✅ | Usa `ok()`, `page()`, `AppError`, `ErrorCodes` |
| II. Multi-Tenancy by Default | ✅ | `BaseCrudTenantService`, `applyTenantScopeQb`, endpoint público vía `x-tenant-key` |
| III. RBAC | ✅ | `JwtAuthGuard + RolesGuard` a nivel clase; `@Roles()` por método; endpoint público explícito sin guard |
| IV. Business Rule Integrity | ✅ | Unicidad (tenant+nombre), soft delete solo si inactiva, advertencia informativa al inactivar |
| V. Audit Trail | ✅ | `AuditService.write()` en crear, editar, activar, inactivar, eliminar |
| VI. Module Architecture | ✅ | Type A — extends `BaseCrudTenantService`; estructura entity/dto/service/controller/module |
| VII. Implementation Discipline | ✅ | Stage 1, tercer módulo: sedes → puntos-retiro → categorias-menu |

**Resultado**: 7/7 ✅ — sin violaciones. Sin `Complexity Tracking` necesario.

## Project Structure

### Documentation (this feature)

```text
specs/003-categorias-menu-crud/
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
│       └── error-codes.ts          # +5 nuevos códigos CATEGORIA_MENU_*
├── modules/
│   └── categorias-menu/
│       ├── entities/
│       │   └── categoria-menu.entity.ts
│       ├── dto/
│       │   ├── create-categoria-menu.dto.ts
│       │   ├── update-categoria-menu.dto.ts
│       │   └── query-categoria-menu.dto.ts
│       ├── categorias-menu.service.ts
│       ├── categorias-menu.controller.ts
│       ├── public-categorias-menu.controller.ts
│       └── categorias-menu.module.ts
└── app.module.ts                    # Registrar CategoriasMenuModule

migrations/
└── <timestamp>-CreateCategoriasMenu.ts  # Generar + editar índice parcial
```

## Implementation Notes

### 1. ErrorCodes — agregar antes que cualquier otra cosa

```typescript
// src/common/errors/error-codes.ts — agregar al objeto ErrorCodes:
// categorias-menu
CATEGORIA_MENU_NOT_FOUND: 'CATEGORIA_MENU_NOT_FOUND',
CATEGORIA_MENU_NOMBRE_DUPLICADO: 'CATEGORIA_MENU_NOMBRE_DUPLICADO',
CATEGORIA_MENU_YA_ACTIVA: 'CATEGORIA_MENU_YA_ACTIVA',
CATEGORIA_MENU_YA_INACTIVA: 'CATEGORIA_MENU_YA_INACTIVA',
CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
```

### 2. Entidad

```typescript
@Entity('categorias_menu')
@Index('UQ_categorias_menu_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })
export class CategoriaMenu extends BaseEntity {
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

> **Nota**: El `@Index` en la clase genera un índice completo. La migración debe reemplazarlo por un índice parcial con `WHERE deleted_at IS NULL`. Campo es `activa` (femenino) — diferente de `activo` en sedes/puntos-retiro.

### 3. Migración — edición manual obligatoria

Después de `npm run db:migration:generate -- migrations/CreateCategoriasMenu`, editar el archivo generado:

```typescript
// Reemplazar el índice único auto-generado por:
await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_categorias_menu_tenant_nombre"
  ON "categorias_menu" ("tenant_id", "nombre")
  WHERE "deleted_at" IS NULL
`);

// En down() agregar:
await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categorias_menu_tenant_nombre"`);
```

### 4. Service

```typescript
@Injectable()
export class CategoriasMenuService extends BaseCrudTenantService<CategoriaMenu> {
  constructor(
    @InjectRepository(CategoriaMenu)
    private readonly categoriaMenuRepo: Repository<CategoriaMenu>,
  ) {
    super(categoriaMenuRepo);
  }

  async list(query: QueryCategoriaMenuDto) {
    const filters: Record<string, any> = {};
    if (query.activa !== undefined) filters.activa = query.activa;

    return super.list(
      { page: query.page, limit: query.limit, q: query.q, sortBy: query.sortBy, sortOrder: query.sortOrder, filters },
      {
        searchColumns: ['nombre'],
        sortAllowed: ['nombre', 'orden_visualizacion', 'created_at'],
        sortFallback: { by: 'nombre', order: 'ASC' },
        filterAllowed: ['activa'],
        strictTenant: true,
      },
    );
  }

  async findOne(id: string): Promise<CategoriaMenu> {
    const cat = await this.findById(id, { strictTenant: true });
    if (!cat) throw new AppError({ code: ErrorCodes.CATEGORIA_MENU_NOT_FOUND, message: 'Categoría no encontrada', status: 404, details: { id } });
    return cat;
  }

  async create(dto: CreateCategoriaMenuDto): Promise<CategoriaMenu> {
    await this.assertNombreUnico(dto.nombre);
    return super.create(dto as Partial<CategoriaMenu>, { strictTenant: true });
  }

  async update(id: string, dto: UpdateCategoriaMenuDto): Promise<CategoriaMenu> {
    await this.findOne(id);
    if (dto.nombre !== undefined) await this.assertNombreUnico(dto.nombre, id);
    return super.update(id, dto as Partial<CategoriaMenu>, { strictTenant: true });
  }

  async activar(id: string): Promise<CategoriaMenu> {
    const cat = await this.findOne(id);
    if (cat.activa) throw new AppError({ code: ErrorCodes.CATEGORIA_MENU_YA_ACTIVA, message: 'La categoría ya se encuentra activa', status: 409, details: { id } });
    cat.activa = true;
    return this.categoriaMenuRepo.save(cat);
  }

  async inactivar(id: string): Promise<CategoriaMenu> {
    const cat = await this.findOne(id);
    if (!cat.activa) throw new AppError({ code: ErrorCodes.CATEGORIA_MENU_YA_INACTIVA, message: 'La categoría ya se encuentra inactiva', status: 409, details: { id } });
    // MVP: advertencia informativa si tiene menús base activos — validación completa en Stage 2
    cat.activa = false;
    return this.categoriaMenuRepo.save(cat);
  }

  async remove(id: string): Promise<void> {
    const cat = await this.findOne(id);
    if (cat.activa) throw new AppError({ code: ErrorCodes.CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR, message: 'La categoría debe estar inactiva antes de eliminarse', status: 409, details: { id } });
    await super.softDelete(id, { strictTenant: true });
  }

  async listPublic(): Promise<CategoriaMenu[]> {
    const qb = this.categoriaMenuRepo.createQueryBuilder('cm');
    this.applyTenantScopeQb(qb, 'cm', { strictTenant: true });
    qb.andWhere('cm.activa = true')
      .orderBy('cm.orden_visualizacion', 'ASC', 'NULLS LAST')
      .addOrderBy('cm.nombre', 'ASC');
    return qb.getMany();
  }

  private async assertNombreUnico(nombre: string, excludeId?: string): Promise<void> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.categoriaMenuRepo.createQueryBuilder('cm')
      .where('LOWER(cm.nombre) = LOWER(:nombre)', { nombre })
      .andWhere('cm.tenant_id = :tenantId', { tenantId })
      .andWhere('cm.deleted_at IS NULL');
    if (excludeId) qb.andWhere('cm.id != :excludeId', { excludeId });
    const exists = await qb.getOne();
    if (exists) throw new AppError({ code: ErrorCodes.CATEGORIA_MENU_NOMBRE_DUPLICADO, message: `Ya existe una categoría con el nombre "${nombre}"`, status: 409, details: { nombre } });
  }
}
```

### 5. Module — sin dependencias de otros módulos de negocio

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([CategoriaMenu]), AuditModule],
  providers: [CategoriasMenuService],
  controllers: [CategoriasMenuController, PublicCategoriasMenuController],
  exports: [CategoriasMenuService],
})
export class CategoriasMenuModule {}
```

### 6. Controller público — sin query params

El endpoint público no requiere ningún query param (a diferencia de puntos-retiro que requiere `sede_id`). Solo necesita el header `x-tenant-key` (resuelto automáticamente por `TenancyMiddleware`).

```typescript
@Controller('public/categorias-menu')
export class PublicCategoriasMenuController {
  constructor(private readonly svc: CategoriasMenuService) {}

  @Get()
  async list() {
    const categorias = await this.svc.listPublic();
    return ok(categorias);
  }
}
```

### 7. UpdateCategoriaMenuDto — sin PartialType

No usar `PartialType`. Declarar todos los campos explícitamente como opcionales (igual que en sedes y puntos-retiro).

## Constraints Recap

| Constraint | Cómo se aplica |
|-----------|----------------|
| No `repo.find()` sin tenant | Siempre via `super.*()` o `applyTenantScopeQb()` |
| No `throw new Error()` | Solo `AppError` con `ErrorCodes` |
| Campo `activa` (femenino) | Distinto de `activo` en sedes/puntos-retiro — no mezclar |
| Endpoint público sin query params | `listPublic()` sin argumentos; tenant resuelto por middleware |
| Endpoint público NULLS LAST | `createQueryBuilder` propio en `listPublic()` |
| Respuestas via helpers | `ok()` y `page()` de `api-response.ts` |
| `migrationsRun: true` | Ya configurado — no tocar |
| Advertencia inactivar MVP | Solo log/comentario; bloqueo en Stage 2 cuando exista `menus-base` |
