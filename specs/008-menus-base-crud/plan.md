# Implementation Plan: Módulo Menús Base

**Branch**: `008-menus-base-crud` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

## Summary

CRUD tenant-safe de menús base con relaciones many-to-many a categorías, etiquetas y alérgenos de Stage 1. Incluye portal público de solo lectura y ciclo de vida (activar/inactivar/soft-delete). Toda la lógica de relaciones requiere validación cruzada de tenant.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20.x

**Primary Dependencies**: NestJS 10, TypeORM 0.3, class-validator, class-transformer

**Storage**: PostgreSQL 15 (tablas: `menus_base`, `menu_base_categorias`, `menu_base_etiquetas`, `menu_base_alergenos`)

**Testing**: Manual smoke tests (quickstart.md)

**Target Platform**: Linux server (Docker)

**Project Type**: REST API module sobre Innoview Backend Template

**Performance Goals**: < 200ms p95 en listados con join de 3 tablas intermedias

**Constraints**: multi-tenant strict, sin eager loading, sin throw new Error(), todas las respuestas via ok()/page()

**Scale/Scope**: < 200 menús activos por tenant en MVP

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| Template API Contract (ok/page/AppError) | ✅ | ok() en todos los returns, page() en list(), AppError para todos los errores |
| Multi-Tenancy (getTenantId strictTenant) | ✅ | getTenantId({ strictTenant: true }) en todos los métodos de service |
| RBAC (JwtAuthGuard + RolesGuard + @Roles) | ✅ | admin en CUD+activar/inactivar; admin+supervisor en R; público sin guard |
| Business Rule Integrity | ✅ | assertNombreUnico, assertRelacionesValidas, state guards en activar/inactivar/remove |
| Audit Trail | ✅ | AuditService.write() en create/update/activar/inactivar/remove |
| Module Architecture (Type B) | ✅ | Extiende BaseCrudTenantService, sobreescribe todos los métodos CRUD |
| Implementation Discipline | ✅ | Sin PartialType, sin eager loading, sin repo.find() sin scope de tenant |

## Project Structure

### Documentation

```text
specs/008-menus-base-crud/
├── plan.md              ← este archivo
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-endpoints.md
└── tasks.md             (generado por /speckit-tasks)
```

### Source Code

```text
src/modules/menus-base/
├── entities/
│   └── menu-base.entity.ts
├── dto/
│   ├── create-menu-base.dto.ts
│   ├── update-menu-base.dto.ts
│   └── query-menu-base.dto.ts
├── menus-base.service.ts
├── menus-base.controller.ts
├── public-menus-base.controller.ts
└── menus-base.module.ts

src/common/errors/error-codes.ts   ← agregar 6 códigos MENU_BASE_*
src/app.module.ts                  ← importar MenusBaseModule

migrations/
└── <timestamp>-CreateMenusBase.ts
```

---

## Fase 0: Entidad y DTOs

### `src/modules/menus-base/entities/menu-base.entity.ts`

```typescript
import { Entity, Column, ManyToMany, JoinTable, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { CategoriaMenu } from 'src/modules/categorias-menu/entities/categoria-menu.entity';
import { EtiquetaMenu } from 'src/modules/etiquetas-menu/entities/etiqueta-menu.entity';
import { Alergeno } from 'src/modules/alergenos/entities/alergeno.entity';

@Entity('menus_base')
@Index('UQ_menus_base_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })
export class MenuBase extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen_public_id!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imagen_url!: string | null;

  @Column({ type: 'text', nullable: true })
  ingredientes_principales!: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  calorias_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  proteinas_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  carbohidratos_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  grasas_aprox!: number | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @ManyToMany(() => CategoriaMenu)
  @JoinTable({
    name: 'menu_base_categorias',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'categoria_menu_id' },
  })
  categorias!: CategoriaMenu[];

  @ManyToMany(() => EtiquetaMenu)
  @JoinTable({
    name: 'menu_base_etiquetas',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'etiqueta_menu_id' },
  })
  etiquetas!: EtiquetaMenu[];

  @ManyToMany(() => Alergeno)
  @JoinTable({
    name: 'menu_base_alergenos',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'alergeno_id' },
  })
  alergenos!: Alergeno[];
}
```

---

## Fase 1: Error Codes

En `src/common/errors/error-codes.ts`, agregar en el objeto `ErrorCodes`:

```typescript
// menus-base
MENU_BASE_NOT_FOUND: 'MENU_BASE_NOT_FOUND',
MENU_BASE_NOMBRE_DUPLICADO: 'MENU_BASE_NOMBRE_DUPLICADO',
MENU_BASE_YA_ACTIVO: 'MENU_BASE_YA_ACTIVO',
MENU_BASE_YA_INACTIVO: 'MENU_BASE_YA_INACTIVO',
MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
MENU_BASE_RELACION_INVALIDA: 'MENU_BASE_RELACION_INVALIDA',
```

---

## Fase 2: Service

### `src/modules/menus-base/menus-base.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/services/base-crud-tenant.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { MenuBase } from './entities/menu-base.entity';
import { CategoriaMenu } from 'src/modules/categorias-menu/entities/categoria-menu.entity';
import { EtiquetaMenu } from 'src/modules/etiquetas-menu/entities/etiqueta-menu.entity';
import { Alergeno } from 'src/modules/alergenos/entities/alergeno.entity';
import { CreateMenuBaseDto } from './dto/create-menu-base.dto';
import { UpdateMenuBaseDto } from './dto/update-menu-base.dto';
import { QueryMenuBaseDto } from './dto/query-menu-base.dto';

@Injectable()
export class MenusBaseService extends BaseCrudTenantService<MenuBase> {
  constructor(
    @InjectRepository(MenuBase) private readonly menuBaseRepo: Repository<MenuBase>,
    @InjectRepository(CategoriaMenu) private readonly categoriaRepo: Repository<CategoriaMenu>,
    @InjectRepository(EtiquetaMenu) private readonly etiquetaRepo: Repository<EtiquetaMenu>,
    @InjectRepository(Alergeno) private readonly alergenoRepo: Repository<Alergeno>,
    private readonly auditService: AuditService,
  ) {
    super(menuBaseRepo);
  }

  async list(query: QueryMenuBaseDto) {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.menuBaseRepo.createQueryBuilder('mb')
      .where('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al');

    if (query.q) {
      qb.andWhere('mb.nombre ILIKE :q', { q: `%${query.q}%` });
    }
    if (query.activo !== undefined) {
      qb.andWhere('mb.activo = :activo', { activo: query.activo });
    }
    if (query.categoria_id) {
      qb.innerJoin('mb.categorias', 'catf', 'catf.id = :categoriaId', { categoriaId: query.categoria_id });
    }
    if (query.etiqueta_id) {
      qb.innerJoin('mb.etiquetas', 'etf', 'etf.id = :etiquetaId', { etiquetaId: query.etiqueta_id });
    }
    if (query.alergeno_id) {
      qb.innerJoin('mb.alergenos', 'alf', 'alf.id = :alergenoId', { alergenoId: query.alergeno_id });
    }

    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'DESC';
    qb.orderBy(`mb.${sortBy}`, sortOrder);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<MenuBase> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const menu = await this.menuBaseRepo.createQueryBuilder('mb')
      .where('mb.id = :id', { id })
      .andWhere('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al')
      .getOne();

    if (!menu) throw new AppError(ErrorCodes.MENU_BASE_NOT_FOUND, 404);
    return menu;
  }

  async findOnePublic(id: string): Promise<MenuBase> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const menu = await this.menuBaseRepo.createQueryBuilder('mb')
      .where('mb.id = :id', { id })
      .andWhere('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .andWhere('mb.activo = true')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al')
      .getOne();

    if (!menu) throw new AppError(ErrorCodes.MENU_BASE_NOT_FOUND, 404);
    return menu;
  }

  async create(dto: CreateMenuBaseDto): Promise<MenuBase> {
    await this.assertNombreUnico(dto.nombre);

    const categorias = dto.categoria_ids?.length
      ? await this.assertCategoriasValidas(dto.categoria_ids)
      : [];
    const etiquetas = dto.etiqueta_ids?.length
      ? await this.assertEtiquetasValidas(dto.etiqueta_ids)
      : [];
    const alergenos = dto.alergeno_ids?.length
      ? await this.assertAlergenosValidos(dto.alergeno_ids)
      : [];

    const menu = this.menuBaseRepo.create({
      tenant_id: this.getTenantId({ strictTenant: true }),
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      imagen_public_id: dto.imagen_public_id ?? null,
      imagen_url: dto.imagen_url ?? null,
      ingredientes_principales: dto.ingredientes_principales ?? null,
      calorias_aprox: dto.calorias_aprox ?? null,
      proteinas_aprox: dto.proteinas_aprox ?? null,
      carbohidratos_aprox: dto.carbohidratos_aprox ?? null,
      grasas_aprox: dto.grasas_aprox ?? null,
      activo: true,
      categorias,
      etiquetas,
      alergenos,
    });

    const saved = await this.menuBaseRepo.save(menu);
    await this.auditService.write('menu_base.created', saved.id);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateMenuBaseDto): Promise<MenuBase> {
    const menu = await this.findOne(id);

    if (dto.nombre !== undefined) {
      await this.assertNombreUnico(dto.nombre, id);
      menu.nombre = dto.nombre;
    }
    if (dto.descripcion !== undefined) menu.descripcion = dto.descripcion ?? null;
    if (dto.imagen_public_id !== undefined) menu.imagen_public_id = dto.imagen_public_id ?? null;
    if (dto.imagen_url !== undefined) menu.imagen_url = dto.imagen_url ?? null;
    if (dto.ingredientes_principales !== undefined) menu.ingredientes_principales = dto.ingredientes_principales ?? null;
    if (dto.calorias_aprox !== undefined) menu.calorias_aprox = dto.calorias_aprox ?? null;
    if (dto.proteinas_aprox !== undefined) menu.proteinas_aprox = dto.proteinas_aprox ?? null;
    if (dto.carbohidratos_aprox !== undefined) menu.carbohidratos_aprox = dto.carbohidratos_aprox ?? null;
    if (dto.grasas_aprox !== undefined) menu.grasas_aprox = dto.grasas_aprox ?? null;

    if (dto.categoria_ids !== undefined) {
      menu.categorias = dto.categoria_ids.length
        ? await this.assertCategoriasValidas(dto.categoria_ids)
        : [];
    }
    if (dto.etiqueta_ids !== undefined) {
      menu.etiquetas = dto.etiqueta_ids.length
        ? await this.assertEtiquetasValidas(dto.etiqueta_ids)
        : [];
    }
    if (dto.alergeno_ids !== undefined) {
      menu.alergenos = dto.alergeno_ids.length
        ? await this.assertAlergenosValidos(dto.alergeno_ids)
        : [];
    }

    await this.menuBaseRepo.save(menu);
    await this.auditService.write('menu_base.updated', menu.id);
    return this.findOne(id);
  }

  async activar(id: string): Promise<MenuBase> {
    const menu = await this.findOne(id);
    if (menu.activo) throw new AppError(ErrorCodes.MENU_BASE_YA_ACTIVO, 409);
    menu.activo = true;
    await this.menuBaseRepo.save(menu);
    await this.auditService.write('menu_base.activated', menu.id);
    return menu;
  }

  async inactivar(id: string): Promise<MenuBase> {
    const menu = await this.findOne(id);
    if (!menu.activo) throw new AppError(ErrorCodes.MENU_BASE_YA_INACTIVO, 409);
    menu.activo = false;
    await this.menuBaseRepo.save(menu);
    await this.auditService.write('menu_base.deactivated', menu.id);
    return menu;
  }

  async remove(id: string): Promise<void> {
    const menu = await this.findOne(id);
    if (menu.activo) throw new AppError(ErrorCodes.MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR, 409);
    await this.menuBaseRepo.softDelete(id);
    await this.auditService.write('menu_base.deleted', id);
  }

  async listPublic(): Promise<MenuBase[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    return this.menuBaseRepo.createQueryBuilder('mb')
      .where('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .andWhere('mb.activo = true')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al')
      .orderBy('mb.nombre', 'ASC')
      .getMany();
  }

  private async assertNombreUnico(nombre: string, excludeId?: string): Promise<void> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.menuBaseRepo.createQueryBuilder('mb')
      .where('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .andWhere('LOWER(mb.nombre) = LOWER(:nombre)', { nombre });

    if (excludeId) {
      qb.andWhere('mb.id != :excludeId', { excludeId });
    }

    const exists = await qb.getOne();
    if (exists) throw new AppError(ErrorCodes.MENU_BASE_NOMBRE_DUPLICADO, 409);
  }

  private async assertCategoriasValidas(ids: string[]): Promise<CategoriaMenu[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const result: CategoriaMenu[] = [];
    for (const id of ids) {
      const cat = await this.categoriaRepo.createQueryBuilder('cat')
        .where('cat.id = :id', { id })
        .andWhere('cat.tenant_id = :tenantId', { tenantId })
        .andWhere('cat.deleted_at IS NULL')
        .andWhere('cat.activa = true')
        .getOne();
      if (!cat) throw new AppError(ErrorCodes.MENU_BASE_RELACION_INVALIDA, 422, `CategoriaMenu ${id} no válida`);
      result.push(cat);
    }
    return result;
  }

  private async assertEtiquetasValidas(ids: string[]): Promise<EtiquetaMenu[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const result: EtiquetaMenu[] = [];
    for (const id of ids) {
      const et = await this.etiquetaRepo.createQueryBuilder('et')
        .where('et.id = :id', { id })
        .andWhere('et.tenant_id = :tenantId', { tenantId })
        .andWhere('et.deleted_at IS NULL')
        .andWhere('et.activa = true')
        .getOne();
      if (!et) throw new AppError(ErrorCodes.MENU_BASE_RELACION_INVALIDA, 422, `EtiquetaMenu ${id} no válida`);
      result.push(et);
    }
    return result;
  }

  private async assertAlergenosValidos(ids: string[]): Promise<Alergeno[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const result: Alergeno[] = [];
    for (const id of ids) {
      const al = await this.alergenoRepo.createQueryBuilder('al')
        .where('al.id = :id', { id })
        .andWhere('al.tenant_id = :tenantId', { tenantId })
        .andWhere('al.deleted_at IS NULL')
        .andWhere('al.activo = true')
        .getOne();
      if (!al) throw new AppError(ErrorCodes.MENU_BASE_RELACION_INVALIDA, 422, `Alergeno ${id} no válido`);
      result.push(al);
    }
    return result;
  }
}
```

> **Campo activo vs activa**: `CategoriaMenu` y `EtiquetaMenu` usan `activa` (femenino); `Alergeno` usa `activo` (masculino). Esto está hardcoded en los tres métodos privados separados, no en un método genérico.

---

## Fase 3: Controllers

### `src/modules/menus-base/menus-base.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ok, page } from 'src/common/helpers/response.helper';
import { MenusBaseService } from './menus-base.service';
import { CreateMenuBaseDto } from './dto/create-menu-base.dto';
import { UpdateMenuBaseDto } from './dto/update-menu-base.dto';
import { QueryMenuBaseDto } from './dto/query-menu-base.dto';

@Controller('admin/menus-base')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenusBaseController {
  constructor(private readonly menusBaseService: MenusBaseService) {}

  @Get()
  @Roles('administrador', 'supervisor')
  async list(@Query() query: QueryMenuBaseDto) {
    const result = await this.menusBaseService.list(query);
    return page(result);
  }

  @Get(':id')
  @Roles('administrador', 'supervisor')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const menu = await this.menusBaseService.findOne(id);
    return ok(menu);
  }

  @Post()
  @Roles('administrador')
  async create(@Body() dto: CreateMenuBaseDto) {
    const menu = await this.menusBaseService.create(dto);
    return ok(menu);
  }

  @Patch(':id')
  @Roles('administrador')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMenuBaseDto) {
    const menu = await this.menusBaseService.update(id, dto);
    return ok(menu);
  }

  @Patch(':id/activar')
  @Roles('administrador')
  async activar(@Param('id', ParseUUIDPipe) id: string) {
    const menu = await this.menusBaseService.activar(id);
    return ok(menu);
  }

  @Patch(':id/inactivar')
  @Roles('administrador')
  async inactivar(@Param('id', ParseUUIDPipe) id: string) {
    const menu = await this.menusBaseService.inactivar(id);
    return ok(menu);
  }

  @Delete(':id')
  @Roles('administrador')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.menusBaseService.remove(id);
    return ok(null);
  }
}
```

### `src/modules/menus-base/public-menus-base.controller.ts`

```typescript
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ok } from 'src/common/helpers/response.helper';
import { MenusBaseService } from './menus-base.service';

@Controller('public/menus-base')
export class PublicMenusBaseController {
  constructor(private readonly menusBaseService: MenusBaseService) {}

  @Get()
  async listPublic() {
    const menus = await this.menusBaseService.listPublic();
    return ok(menus);
  }

  @Get(':id')
  async findOnePublic(@Param('id', ParseUUIDPipe) id: string) {
    const menu = await this.menusBaseService.findOnePublic(id);
    return ok(menu);
  }
}
```

---

## Fase 4: Module

### `src/modules/menus-base/menus-base.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuBase } from './entities/menu-base.entity';
import { CategoriaMenu } from 'src/modules/categorias-menu/entities/categoria-menu.entity';
import { EtiquetaMenu } from 'src/modules/etiquetas-menu/entities/etiqueta-menu.entity';
import { Alergeno } from 'src/modules/alergenos/entities/alergeno.entity';
import { AuditModule } from 'src/modules/audit/audit.module';
import { MenusBaseService } from './menus-base.service';
import { MenusBaseController } from './menus-base.controller';
import { PublicMenusBaseController } from './public-menus-base.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuBase, CategoriaMenu, EtiquetaMenu, Alergeno]),
    AuditModule,
  ],
  providers: [MenusBaseService],
  controllers: [MenusBaseController, PublicMenusBaseController],
  exports: [MenusBaseService],
})
export class MenusBaseModule {}
```

Registrar en `src/app.module.ts`:
```typescript
import { MenusBaseModule } from './modules/menus-base/menus-base.module';
// ...
imports: [
  // ... módulos existentes ...
  MenusBaseModule,
],
```

---

## Fase 5: Migración

```bash
npm run db:migration:generate -- migrations/CreateMenusBase
```

Verificar que la migración generada contiene:
- Tabla `menus_base` con todos los campos
- Tablas intermedias `menu_base_categorias`, `menu_base_etiquetas`, `menu_base_alergenos` con FKs correctas
- Índice único sobre `(tenant_id, nombre)`

**Editar manualmente** el índice único generado por TypeORM para convertirlo a índice parcial:

```typescript
// Reemplazar el CREATE UNIQUE INDEX generado por:
await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_menus_base_tenant_nombre"
  ON "menus_base" ("tenant_id", "nombre")
  WHERE "deleted_at" IS NULL
`);

// En down():
await queryRunner.query(`DROP INDEX IF EXISTS "UQ_menus_base_tenant_nombre"`);
```

Aplicar:
```bash
npm run db:migration:run
```

---

## Verificación Constitution Check (post-diseño)

| Principio | Verificado | Evidencia |
|-----------|------------|----------|
| Template API Contract | ✅ | ok()/page() en todos los handlers; AppError en todos los throws |
| Multi-Tenancy | ✅ | getTenantId({ strictTenant: true }) en list, findOne, findOnePublic, create, update, remove, listPublic, assertNombreUnico, los 3 assert*Validos |
| RBAC | ✅ | JwtAuthGuard+RolesGuard en admin controller; sin guard en public controller |
| Business Rule Integrity | ✅ | assertNombreUnico en create/update; assert*Validos en create/update; state guards en activar/inactivar/remove |
| Audit Trail | ✅ | auditService.write() en create/update/activar/inactivar/remove |
| Module Architecture | ✅ | Type B; no eager loading; INNER JOIN para filtros; LEFT JOIN para carga |
| Implementation Discipline | ✅ | Sin PartialType; sin repo.find() sin tenant; sin throw new Error(); sin eager:true |

**Constitution Check: 7/7 ✅**
