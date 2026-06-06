import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { Alergeno } from './entities/alergeno.entity';
import { CreateAlergenoDto } from './dto/create-alergeno.dto';
import { UpdateAlergenoDto } from './dto/update-alergeno.dto';
import { QueryAlergenoDto } from './dto/query-alergeno.dto';

@Injectable()
export class AlergenosService extends BaseCrudTenantService<Alergeno> {
  constructor(
    @InjectRepository(Alergeno)
    private readonly alergenoRepo: Repository<Alergeno>,
  ) {
    super(alergenoRepo);
  }

  async list(query: QueryAlergenoDto) {
    const filters: Record<string, any> = {};
    if (query.activo !== undefined) filters.activo = query.activo;

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
        sortAllowed: ['nombre', 'created_at'],
        sortFallback: { by: 'nombre', order: 'ASC' },
        filterAllowed: ['activo'],
        strictTenant: true,
      },
    );
  }

  async findOne(id: string): Promise<Alergeno> {
    const al = await this.findById(id, { strictTenant: true });
    if (!al) {
      throw new AppError({
        code: ErrorCodes.ALERGENO_NOT_FOUND,
        message: 'Alérgeno no encontrado',
        status: 404,
        details: { id },
      });
    }
    return al;
  }

  async create(dto: CreateAlergenoDto): Promise<Alergeno> {
    await this.assertNombreUnico(dto.nombre);
    return super.create(dto as Partial<Alergeno>, { strictTenant: true });
  }

  async update(id: string, dto: UpdateAlergenoDto): Promise<Alergeno> {
    await this.findOne(id);
    if (dto.nombre !== undefined) {
      await this.assertNombreUnico(dto.nombre, id);
    }
    return super.update(id, dto as Partial<Alergeno>, { strictTenant: true });
  }

  async activar(id: string): Promise<Alergeno> {
    const al = await this.findOne(id);
    if (al.activo) {
      throw new AppError({
        code: ErrorCodes.ALERGENO_YA_ACTIVO,
        message: 'El alérgeno ya se encuentra activo',
        status: 409,
        details: { id },
      });
    }
    al.activo = true;
    return this.alergenoRepo.save(al);
  }

  async inactivar(id: string): Promise<Alergeno> {
    const al = await this.findOne(id);
    if (!al.activo) {
      throw new AppError({
        code: ErrorCodes.ALERGENO_YA_INACTIVO,
        message: 'El alérgeno ya se encuentra inactivo',
        status: 409,
        details: { id },
      });
    }
    // MVP: validación de menús base activos asociados es informativa — se implementa en Stage 2
    al.activo = false;
    return this.alergenoRepo.save(al);
  }

  async remove(id: string): Promise<void> {
    const al = await this.findOne(id);
    if (al.activo) {
      throw new AppError({
        code: ErrorCodes.ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR,
        message: 'El alérgeno debe estar inactivo antes de poder eliminarse',
        status: 409,
        details: { id },
      });
    }
    await super.softDelete(id, { strictTenant: true });
  }

  async listPublic(): Promise<Alergeno[]> {
    const qb = this.alergenoRepo.createQueryBuilder('al');
    this.applyTenantScopeQb(qb, 'al', { strictTenant: true });
    qb.andWhere('al.activo = true').orderBy('al.nombre', 'ASC');
    return qb.getMany();
  }

  private async assertNombreUnico(nombre: string, excludeId?: string): Promise<void> {
    const tenantId = this.getTenantId({ strictTenant: true });

    const qb = this.alergenoRepo
      .createQueryBuilder('al')
      .where('LOWER(al.nombre) = LOWER(:nombre)', { nombre })
      .andWhere('al.tenant_id = :tenantId', { tenantId })
      .andWhere('al.deleted_at IS NULL');

    if (excludeId) {
      qb.andWhere('al.id != :excludeId', { excludeId });
    }

    const exists = await qb.getOne();
    if (exists) {
      throw new AppError({
        code: ErrorCodes.ALERGENO_NOMBRE_DUPLICADO,
        message: `Ya existe un alérgeno con el nombre "${nombre}"`,
        status: 409,
        details: { nombre },
      });
    }
  }
}
