# Implementation Plan: Módulo Banners y Promociones

**Branch**: `010-banners-promociones` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-banners-promociones/spec.md`

## Summary

Implementar el módulo `banners-promociones` (Stage 2, tercer módulo de Menus) para el sistema Rochester de gestión de viandas. Un banner es una pieza de contenido informativo/promocional visible en la landing del portal público. El módulo es Type A (CRUD tenant-safe simple) y extiende `BaseCrudTenantService`, con dos adiciones sobre el patrón `categorias-menu`: (1) lógica de filtro de fechas en el endpoint público (`fecha_inicio / fecha_fin` con IS NULL OR) y (2) validación de coherencia de fechas en create/update. Sin índice único en título. El módulo exporta `BannersPromocionesService` por convención aunque Stage 3+ no lo consuma directamente.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer, nestjs-pino

**Storage**: PostgreSQL 15+ via TypeORM (`DataSource`, `Repository`, `QueryBuilder`)

**Target Platform**: Railway (prod) / localhost (dev)

**Project Type**: REST API — módulo de catálogo tenant-safe dentro del Innoview Backend Template

**Performance Goals**: Listado admin < 2s con hasta 1000 registros; endpoint público < 500ms p95

**Constraints**: Sin `synchronize: true`. Sin `throw new Error()`. Sin `repo.find()` sin scope de tenant. Sin `PartialType` en `UpdateBannerDto`. Sin índice único en título. `migrationsRun: true` ya configurado.

**Scale/Scope**: Múltiples tenants, < 50 banners activos por tenant en MVP.

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | ✅ | Usa `ok()`, `page()`, `AppError`, `ErrorCodes` |
| II. Multi-Tenancy by Default | ✅ | `BaseCrudTenantService`, `applyTenantScopeQb` en `listPublic()`, endpoint público vía `x-tenant-key` |
| III. RBAC | ✅ | `JwtAuthGuard + RolesGuard` a nivel clase; `@Roles()` por método; `PublicBannersController` sin guard, explícitamente separado |
| IV. Business Rule Integrity | ✅ | Soft delete solo si inactivo, validación coherencia fechas, no hay unicidad de título por diseño |
| V. Audit Trail | ✅ | `AuditService.write()` en crear, editar, activar, inactivar, eliminar |
| VI. Module Architecture | ✅ | Type A — extends `BaseCrudTenantService`; estructura entity/dto/service/controller/module |
| VII. Implementation Discipline | ✅ | Stage 2, tercer módulo: menus-base → menus-publicados → banners-promociones |

**Resultado**: 7/7 ✅ — sin violaciones. Sin `Complexity Tracking` necesario.

## Project Structure

### Documentation (this feature)

```text
specs/010-banners-promociones/
├── plan.md              # Este archivo
├── research.md          # Decisiones técnicas
├── data-model.md        # Entidad, DTOs, estados
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
│       └── error-codes.ts              # +5 nuevos códigos BANNER_*
├── modules/
│   └── banners-promociones/
│       ├── entities/
│       │   └── banner.entity.ts
│       ├── dto/
│       │   ├── create-banner.dto.ts
│       │   ├── update-banner.dto.ts
│       │   └── query-banner.dto.ts
│       ├── banners-promociones.service.ts
│       ├── banners-promociones.controller.ts
│       ├── public-banners.controller.ts
│       └── banners-promociones.module.ts
└── app.module.ts                        # Registrar BannersPromocionesModule

migrations/
└── <timestamp>-CreateBanners.ts         # Generar con npm run db:migration:generate
```

## Implementation Notes

### 1. ErrorCodes — agregar antes que cualquier otra cosa

```typescript
// src/common/errors/error-codes.ts — agregar al objeto ErrorCodes:
// banners-promociones
BANNER_NOT_FOUND: 'BANNER_NOT_FOUND',
BANNER_YA_ACTIVO: 'BANNER_YA_ACTIVO',
BANNER_YA_INACTIVO: 'BANNER_YA_INACTIVO',
BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
BANNER_FECHAS_INVALIDAS: 'BANNER_FECHAS_INVALIDAS',
```

### 2. Entidad

```typescript
@Entity('banners_promociones')
@Index('idx_banners_tenant_activo', ['tenant_id', 'activo'])
export class Banner extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  titulo!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen_public_id!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imagen_url!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url_destino!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ type: 'int', nullable: true })
  orden_visualizacion!: number | null;

  @Column({ type: 'date', nullable: true })
  fecha_inicio!: string | null;

  @Column({ type: 'date', nullable: true })
  fecha_fin!: string | null;
}
```

> `fecha_inicio` y `fecha_fin` se mapean como `string | null` (el tipo `date` de PostgreSQL retorna string en TypeORM). Sin índice único — no hay unicidad de título.

### 3. Migración — sin edición manual

A diferencia de `categorias-menu`, esta migración no requiere edición manual post-generación porque no tiene índice único parcial. Solo verificar que el índice compuesto `idx_banners_tenant_activo` quede generado correctamente.

```bash
npm run db:migration:generate -- migrations/CreateBanners
# Verificar que la migración incluye idx_banners_tenant_activo
npm run db:migration:run
```

### 4. Service — validación de fechas

```typescript
@Injectable()
export class BannersPromocionesService extends BaseCrudTenantService<Banner> {
  constructor(
    @InjectRepository(Banner)
    private readonly bannerRepo: Repository<Banner>,
  ) {
    super(bannerRepo);
  }

  async list(query: QueryBannerDto) {
    const filters: Record<string, any> = {};
    if (query.activo !== undefined) filters.activo = query.activo;

    return super.list(
      { page: query.page, limit: query.limit, sortBy: query.sortBy, sortOrder: query.sortOrder, filters },
      {
        sortAllowed: ['orden_visualizacion', 'created_at'],
        sortFallback: { by: 'created_at', order: 'DESC' },
        filterAllowed: ['activo'],
        strictTenant: true,
      },
    );
  }

  async findOne(id: string): Promise<Banner> {
    const banner = await this.findById(id, { strictTenant: true });
    if (!banner) throw new AppError({ code: ErrorCodes.BANNER_NOT_FOUND, message: 'Banner no encontrado', status: 404, details: { id } });
    return banner;
  }

  async create(dto: CreateBannerDto): Promise<Banner> {
    this.validateFechas(dto.fecha_inicio ?? null, dto.fecha_fin ?? null);
    return super.create(dto as Partial<Banner>, { strictTenant: true });
  }

  async update(id: string, dto: UpdateBannerDto): Promise<Banner> {
    const existing = await this.findOne(id);
    const fechaInicio = dto.fecha_inicio !== undefined ? dto.fecha_inicio : existing.fecha_inicio;
    const fechaFin    = dto.fecha_fin    !== undefined ? dto.fecha_fin    : existing.fecha_fin;
    this.validateFechas(fechaInicio ?? null, fechaFin ?? null);
    return super.update(id, dto as Partial<Banner>, { strictTenant: true });
  }

  async activar(id: string): Promise<Banner> {
    const banner = await this.findOne(id);
    if (banner.activo) throw new AppError({ code: ErrorCodes.BANNER_YA_ACTIVO, message: 'El banner ya se encuentra activo', status: 409, details: { id } });
    banner.activo = true;
    return this.bannerRepo.save(banner);
  }

  async inactivar(id: string): Promise<Banner> {
    const banner = await this.findOne(id);
    if (!banner.activo) throw new AppError({ code: ErrorCodes.BANNER_YA_INACTIVO, message: 'El banner ya se encuentra inactivo', status: 409, details: { id } });
    banner.activo = false;
    return this.bannerRepo.save(banner);
  }

  async remove(id: string): Promise<void> {
    const banner = await this.findOne(id);
    if (banner.activo) throw new AppError({ code: ErrorCodes.BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR, message: 'El banner debe estar inactivo antes de eliminarse', status: 409, details: { id } });
    await super.softDelete(id, { strictTenant: true });
  }

  async listPublic(): Promise<Banner[]> {
    const hoy = new Date().toISOString().split('T')[0];
    const qb = this.bannerRepo.createQueryBuilder('b');
    this.applyTenantScopeQb(qb, 'b', { strictTenant: true });
    qb.andWhere('b.activo = true')
      .andWhere('(b.fecha_inicio IS NULL OR b.fecha_inicio <= :hoy)', { hoy })
      .andWhere('(b.fecha_fin IS NULL OR b.fecha_fin >= :hoy)', { hoy })
      .orderBy('b.orden_visualizacion', 'ASC', 'NULLS LAST')
      .addOrderBy('b.created_at', 'DESC');
    return qb.getMany();
  }

  private validateFechas(fechaInicio: string | null, fechaFin: string | null): void {
    if (fechaInicio && fechaFin && new Date(fechaInicio) > new Date(fechaFin)) {
      throw new AppError({
        code: ErrorCodes.BANNER_FECHAS_INVALIDAS,
        message: 'fecha_inicio no puede ser posterior a fecha_fin',
        status: 422,
        details: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      });
    }
  }
}
```

### 5. Module — sin dependencias de otros módulos de negocio

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Banner]), AuditModule],
  providers: [BannersPromocionesService],
  controllers: [BannersPromocionesController, PublicBannersController],
  exports: [BannersPromocionesService],
})
export class BannersPromocionesModule {}
```

### 6. Auditoría — eventos

| Operación | Evento de auditoría |
|-----------|---------------------|
| `create()` | `banner.created` |
| `update()` | `banner.updated` |
| `activar()` | `banner.activated` |
| `inactivar()` | `banner.deactivated` |
| `remove()` | `banner.deleted` |

Seguir el mismo patrón que `categorias-menu`: llamar `AuditService.write(auditLogPayload(...))` dentro de cada método del service antes del `return`.

## Constraints Recap

| Constraint | Cómo se aplica |
|-----------|----------------|
| No `repo.find()` sin tenant | Siempre via `super.*()` o `applyTenantScopeQb()` |
| No `throw new Error()` | Solo `AppError` con `ErrorCodes` |
| No `PartialType` | `UpdateBannerDto` con campos explícitos opcionales |
| Sin unicidad de título | No hay `@Index` único ni `assertNombreUnico()` |
| Fechas: validar coherencia | `validateFechas()` privado en service, llamado en `create` y `update` |
| Update fechas: considerar existentes | Combinar `dto.fecha_*` con `existing.fecha_*` antes de validar |
| Filtro fechas en QB | `IS NULL OR` en `listPublic()` — no filtrar en memoria |
| `NULLS LAST` en orden público | `createQueryBuilder` con tercer argumento en `.orderBy()` |
| Respuestas via helpers | `ok()` y `page()` de `api-response.ts` |
| `migrationsRun: true` | Ya configurado — no tocar |
