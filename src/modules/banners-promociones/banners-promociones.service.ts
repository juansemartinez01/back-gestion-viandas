import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { Banner } from './entities/banner.entity';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { QueryBannerDto } from './dto/query-banner.dto';

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
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        filters,
      },
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
    if (!banner) {
      throw new AppError({
        code: ErrorCodes.BANNER_NOT_FOUND,
        message: 'Banner no encontrado',
        status: 404,
        details: { id },
      });
    }
    return banner;
  }

  async create(dto: CreateBannerDto): Promise<Banner> {
    this.validateFechas(dto.fecha_inicio ?? null, dto.fecha_fin ?? null);
    return super.create(dto as Partial<Banner>, { strictTenant: true });
  }

  async update(id: string, dto: UpdateBannerDto): Promise<Banner> {
    const existing = await this.findOne(id);
    const fechaInicio = dto.fecha_inicio !== undefined ? dto.fecha_inicio : existing.fecha_inicio;
    const fechaFin = dto.fecha_fin !== undefined ? dto.fecha_fin : existing.fecha_fin;
    this.validateFechas(fechaInicio ?? null, fechaFin ?? null);
    return super.update(id, dto as Partial<Banner>, { strictTenant: true });
  }

  async activar(id: string): Promise<Banner> {
    const banner = await this.findOne(id);
    if (banner.activo) {
      throw new AppError({
        code: ErrorCodes.BANNER_YA_ACTIVO,
        message: 'El banner ya se encuentra activo',
        status: 409,
        details: { id },
      });
    }
    banner.activo = true;
    return this.bannerRepo.save(banner);
  }

  async inactivar(id: string): Promise<Banner> {
    const banner = await this.findOne(id);
    if (!banner.activo) {
      throw new AppError({
        code: ErrorCodes.BANNER_YA_INACTIVO,
        message: 'El banner ya se encuentra inactivo',
        status: 409,
        details: { id },
      });
    }
    banner.activo = false;
    return this.bannerRepo.save(banner);
  }

  async remove(id: string): Promise<void> {
    const banner = await this.findOne(id);
    if (banner.activo) {
      throw new AppError({
        code: ErrorCodes.BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR,
        message: 'El banner debe estar inactivo antes de poder eliminarse',
        status: 409,
        details: { id },
      });
    }
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
