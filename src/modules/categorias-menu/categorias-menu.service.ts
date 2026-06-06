import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { CategoriaMenu } from './entities/categoria-menu.entity';
import { CreateCategoriaMenuDto } from './dto/create-categoria-menu.dto';
import { UpdateCategoriaMenuDto } from './dto/update-categoria-menu.dto';
import { QueryCategoriaMenuDto } from './dto/query-categoria-menu.dto';

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
      {
        page: query.page,
        limit: query.limit,
        q: query.q,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        filters,
      },
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
    if (!cat) {
      throw new AppError({
        code: ErrorCodes.CATEGORIA_MENU_NOT_FOUND,
        message: 'Categoría de menú no encontrada',
        status: 404,
        details: { id },
      });
    }
    return cat;
  }

  async create(dto: CreateCategoriaMenuDto): Promise<CategoriaMenu> {
    await this.assertNombreUnico(dto.nombre);
    return super.create(dto as Partial<CategoriaMenu>, { strictTenant: true });
  }

  async update(id: string, dto: UpdateCategoriaMenuDto): Promise<CategoriaMenu> {
    await this.findOne(id);
    if (dto.nombre !== undefined) {
      await this.assertNombreUnico(dto.nombre, id);
    }
    return super.update(id, dto as Partial<CategoriaMenu>, { strictTenant: true });
  }

  async activar(id: string): Promise<CategoriaMenu> {
    const cat = await this.findOne(id);
    if (cat.activa) {
      throw new AppError({
        code: ErrorCodes.CATEGORIA_MENU_YA_ACTIVA,
        message: 'La categoría de menú ya se encuentra activa',
        status: 409,
        details: { id },
      });
    }
    cat.activa = true;
    return this.categoriaMenuRepo.save(cat);
  }

  async inactivar(id: string): Promise<CategoriaMenu> {
    const cat = await this.findOne(id);
    if (!cat.activa) {
      throw new AppError({
        code: ErrorCodes.CATEGORIA_MENU_YA_INACTIVA,
        message: 'La categoría de menú ya se encuentra inactiva',
        status: 409,
        details: { id },
      });
    }
    // MVP: validación de menús base activos asociados es informativa — se implementa en Stage 2
    cat.activa = false;
    return this.categoriaMenuRepo.save(cat);
  }

  async remove(id: string): Promise<void> {
    const cat = await this.findOne(id);
    if (cat.activa) {
      throw new AppError({
        code: ErrorCodes.CATEGORIA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR,
        message: 'La categoría de menú debe estar inactiva antes de poder eliminarse',
        status: 409,
        details: { id },
      });
    }
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

    const qb = this.categoriaMenuRepo
      .createQueryBuilder('cm')
      .where('LOWER(cm.nombre) = LOWER(:nombre)', { nombre })
      .andWhere('cm.tenant_id = :tenantId', { tenantId })
      .andWhere('cm.deleted_at IS NULL');

    if (excludeId) {
      qb.andWhere('cm.id != :excludeId', { excludeId });
    }

    const exists = await qb.getOne();
    if (exists) {
      throw new AppError({
        code: ErrorCodes.CATEGORIA_MENU_NOMBRE_DUPLICADO,
        message: `Ya existe una categoría de menú con el nombre "${nombre}"`,
        status: 409,
        details: { nombre },
      });
    }
  }
}
