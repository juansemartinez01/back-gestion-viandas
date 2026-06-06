import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { Sede } from './entities/sede.entity';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { QuerySedeDto } from './dto/query-sede.dto';

@Injectable()
export class SedesService extends BaseCrudTenantService<Sede> {
  constructor(
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
  ) {
    super(sedeRepo);
  }

  async list(query: QuerySedeDto) {
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
        searchColumns: ['nombre', 'direccion'],
        sortAllowed: ['nombre', 'orden_visualizacion', 'created_at'],
        sortFallback: { by: 'nombre', order: 'ASC' },
        filterAllowed: ['activa'],
        strictTenant: true,
      },
    );
  }

  async findOne(id: string): Promise<Sede> {
    const sede = await this.findById(id, { strictTenant: true });
    if (!sede) {
      throw new AppError({
        code: ErrorCodes.SEDE_NOT_FOUND,
        message: 'Sede no encontrada',
        status: 404,
        details: { id },
      });
    }
    return sede;
  }

  async create(dto: CreateSedeDto): Promise<Sede> {
    await this.assertNombreUnico(dto.nombre);
    return super.create(dto as Partial<Sede>, { strictTenant: true });
  }

  async update(id: string, dto: UpdateSedeDto): Promise<Sede> {
    await this.findOne(id);
    if (dto.nombre !== undefined) {
      await this.assertNombreUnico(dto.nombre, id);
    }
    return super.update(id, dto as Partial<Sede>, { strictTenant: true });
  }

  async activar(id: string): Promise<Sede> {
    const sede = await this.findOne(id);
    if (sede.activa) {
      throw new AppError({
        code: ErrorCodes.SEDE_YA_ACTIVA,
        message: 'La sede ya se encuentra activa',
        status: 409,
        details: { id },
      });
    }
    sede.activa = true;
    return this.sedeRepo.save(sede);
  }

  async inactivar(id: string): Promise<Sede> {
    const sede = await this.findOne(id);
    if (!sede.activa) {
      throw new AppError({
        code: ErrorCodes.SEDE_YA_INACTIVA,
        message: 'La sede ya se encuentra inactiva',
        status: 409,
        details: { id },
      });
    }
    sede.activa = false;
    return this.sedeRepo.save(sede);
  }

  async remove(id: string): Promise<void> {
    const sede = await this.findOne(id);
    if (sede.activa) {
      throw new AppError({
        code: ErrorCodes.SEDE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR,
        message: 'La sede debe estar inactiva antes de poder eliminarse',
        status: 409,
        details: { id },
      });
    }
    await super.softDelete(id, { strictTenant: true });
  }

  async listPublic(): Promise<Sede[]> {
    const qb = this.sedeRepo.createQueryBuilder('s');
    this.applyTenantScopeQb(qb, 's', { strictTenant: true });
    qb.andWhere('s.activa = true')
      .orderBy('s.orden_visualizacion', 'ASC', 'NULLS LAST')
      .addOrderBy('s.nombre', 'ASC');
    return qb.getMany();
  }

  private async assertNombreUnico(nombre: string, excludeId?: string): Promise<void> {
    const tenantId = this.getTenantId({ strictTenant: true });

    const qb = this.sedeRepo
      .createQueryBuilder('s')
      .where('LOWER(s.nombre) = LOWER(:nombre)', { nombre })
      .andWhere('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.deleted_at IS NULL');

    if (excludeId) {
      qb.andWhere('s.id != :excludeId', { excludeId });
    }

    const exists = await qb.getOne();
    if (exists) {
      throw new AppError({
        code: ErrorCodes.SEDE_NOMBRE_DUPLICADO,
        message: `Ya existe una sede con el nombre "${nombre}" en esta organización`,
        status: 409,
        details: { nombre },
      });
    }
  }
}
