import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { EtiquetaMenu } from './entities/etiqueta-menu.entity';
import { CreateEtiquetaMenuDto } from './dto/create-etiqueta-menu.dto';
import { UpdateEtiquetaMenuDto } from './dto/update-etiqueta-menu.dto';
import { QueryEtiquetaMenuDto } from './dto/query-etiqueta-menu.dto';

@Injectable()
export class EtiquetasMenuService extends BaseCrudTenantService<EtiquetaMenu> {
  constructor(
    @InjectRepository(EtiquetaMenu)
    private readonly etiquetaMenuRepo: Repository<EtiquetaMenu>,
  ) {
    super(etiquetaMenuRepo);
  }

  async list(query: QueryEtiquetaMenuDto) {
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

  async findOne(id: string): Promise<EtiquetaMenu> {
    const etiqueta = await this.findById(id, { strictTenant: true });
    if (!etiqueta) {
      throw new AppError({
        code: ErrorCodes.ETIQUETA_MENU_NOT_FOUND,
        message: 'Etiqueta de menú no encontrada',
        status: 404,
        details: { id },
      });
    }
    return etiqueta;
  }

  async create(dto: CreateEtiquetaMenuDto): Promise<EtiquetaMenu> {
    await this.assertNombreUnico(dto.nombre);
    return super.create(dto as Partial<EtiquetaMenu>, { strictTenant: true });
  }

  async update(id: string, dto: UpdateEtiquetaMenuDto): Promise<EtiquetaMenu> {
    await this.findOne(id);
    if (dto.nombre !== undefined) {
      await this.assertNombreUnico(dto.nombre, id);
    }
    return super.update(id, dto as Partial<EtiquetaMenu>, { strictTenant: true });
  }

  async activar(id: string): Promise<EtiquetaMenu> {
    const etiqueta = await this.findOne(id);
    if (etiqueta.activa) {
      throw new AppError({
        code: ErrorCodes.ETIQUETA_MENU_YA_ACTIVA,
        message: 'La etiqueta de menú ya se encuentra activa',
        status: 409,
        details: { id },
      });
    }
    etiqueta.activa = true;
    return this.etiquetaMenuRepo.save(etiqueta);
  }

  async inactivar(id: string): Promise<EtiquetaMenu> {
    const etiqueta = await this.findOne(id);
    if (!etiqueta.activa) {
      throw new AppError({
        code: ErrorCodes.ETIQUETA_MENU_YA_INACTIVA,
        message: 'La etiqueta de menú ya se encuentra inactiva',
        status: 409,
        details: { id },
      });
    }
    // MVP: validación de menús base activos asociados es informativa — se implementa en Stage 2
    etiqueta.activa = false;
    return this.etiquetaMenuRepo.save(etiqueta);
  }

  async remove(id: string): Promise<void> {
    const etiqueta = await this.findOne(id);
    if (etiqueta.activa) {
      throw new AppError({
        code: ErrorCodes.ETIQUETA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR,
        message: 'La etiqueta de menú debe estar inactiva antes de poder eliminarse',
        status: 409,
        details: { id },
      });
    }
    await super.softDelete(id, { strictTenant: true });
  }

  async listPublic(): Promise<EtiquetaMenu[]> {
    const qb = this.etiquetaMenuRepo.createQueryBuilder('em');
    this.applyTenantScopeQb(qb, 'em', { strictTenant: true });
    qb.andWhere('em.activa = true')
      .orderBy('em.orden_visualizacion', 'ASC', 'NULLS LAST')
      .addOrderBy('em.nombre', 'ASC');
    return qb.getMany();
  }

  private async assertNombreUnico(nombre: string, excludeId?: string): Promise<void> {
    const tenantId = this.getTenantId({ strictTenant: true });

    const qb = this.etiquetaMenuRepo
      .createQueryBuilder('em')
      .where('LOWER(em.nombre) = LOWER(:nombre)', { nombre })
      .andWhere('em.tenant_id = :tenantId', { tenantId })
      .andWhere('em.deleted_at IS NULL');

    if (excludeId) {
      qb.andWhere('em.id != :excludeId', { excludeId });
    }

    const exists = await qb.getOne();
    if (exists) {
      throw new AppError({
        code: ErrorCodes.ETIQUETA_MENU_NOMBRE_DUPLICADO,
        message: `Ya existe una etiqueta de menú con el nombre "${nombre}"`,
        status: 409,
        details: { nombre },
      });
    }
  }
}
