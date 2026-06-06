import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { SedesService } from 'src/modules/sedes/sedes.service';
import { PuntoRetiro } from './entities/punto-retiro.entity';
import { CreatePuntoRetiroDto } from './dto/create-punto-retiro.dto';
import { UpdatePuntoRetiroDto } from './dto/update-punto-retiro.dto';
import { QueryPuntoRetiroDto } from './dto/query-punto-retiro.dto';

@Injectable()
export class PuntosRetiroService extends BaseCrudTenantService<PuntoRetiro> {
  constructor(
    @InjectRepository(PuntoRetiro)
    private readonly puntoRetiroRepo: Repository<PuntoRetiro>,
    private readonly sedesService: SedesService,
  ) {
    super(puntoRetiroRepo);
  }

  async list(query: QueryPuntoRetiroDto) {
    const filters: Record<string, any> = {};
    if (query.activo !== undefined) filters.activo = query.activo;
    if (query.sede_id !== undefined) filters.sede_id = query.sede_id;

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
        filterAllowed: ['activo', 'sede_id'],
        strictTenant: true,
      },
    );
  }

  async findOne(id: string): Promise<PuntoRetiro> {
    const punto = await this.findById(id, { strictTenant: true });
    if (!punto) {
      throw new AppError({
        code: ErrorCodes.PUNTO_RETIRO_NOT_FOUND,
        message: 'Punto de retiro no encontrado',
        status: 404,
        details: { id },
      });
    }
    return punto;
  }

  async create(dto: CreatePuntoRetiroDto): Promise<PuntoRetiro> {
    const sede = await this.sedesService.findOne(dto.sede_id);
    if (!sede.activa) {
      throw new AppError({
        code: ErrorCodes.SEDE_INACTIVA,
        message: 'No se puede crear un punto de retiro en una sede inactiva',
        status: 409,
        details: { sede_id: dto.sede_id },
      });
    }
    await this.assertNombreUnico(dto.nombre, dto.sede_id);
    return super.create(dto as Partial<PuntoRetiro>, { strictTenant: true });
  }

  async update(id: string, dto: UpdatePuntoRetiroDto): Promise<PuntoRetiro> {
    const punto = await this.findOne(id);
    if (dto.nombre !== undefined) {
      await this.assertNombreUnico(dto.nombre, punto.sede_id, id);
    }
    return super.update(id, dto as Partial<PuntoRetiro>, { strictTenant: true });
  }

  async activar(id: string): Promise<PuntoRetiro> {
    const punto = await this.findOne(id);
    if (punto.activo) {
      throw new AppError({
        code: ErrorCodes.PUNTO_RETIRO_YA_ACTIVO,
        message: 'El punto de retiro ya se encuentra activo',
        status: 409,
        details: { id },
      });
    }
    punto.activo = true;
    return this.puntoRetiroRepo.save(punto);
  }

  async inactivar(id: string): Promise<PuntoRetiro> {
    const punto = await this.findOne(id);
    if (!punto.activo) {
      throw new AppError({
        code: ErrorCodes.PUNTO_RETIRO_YA_INACTIVO,
        message: 'El punto de retiro ya se encuentra inactivo',
        status: 409,
        details: { id },
      });
    }
    punto.activo = false;
    return this.puntoRetiroRepo.save(punto);
  }

  async remove(id: string): Promise<void> {
    const punto = await this.findOne(id);
    if (punto.activo) {
      throw new AppError({
        code: ErrorCodes.PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR,
        message: 'El punto de retiro debe estar inactivo antes de poder eliminarse',
        status: 409,
        details: { id },
      });
    }
    await super.softDelete(id, { strictTenant: true });
  }

  async listPublic(sedeId: string): Promise<PuntoRetiro[]> {
    const qb = this.puntoRetiroRepo.createQueryBuilder('pr');
    this.applyTenantScopeQb(qb, 'pr', { strictTenant: true });
    qb.andWhere('pr.activo = true')
      .andWhere('pr.sede_id = :sedeId', { sedeId })
      .orderBy('pr.orden_visualizacion', 'ASC', 'NULLS LAST')
      .addOrderBy('pr.nombre', 'ASC');
    return qb.getMany();
  }

  private async assertNombreUnico(
    nombre: string,
    sedeId: string,
    excludeId?: string,
  ): Promise<void> {
    const tenantId = this.getTenantId({ strictTenant: true });

    const qb = this.puntoRetiroRepo
      .createQueryBuilder('pr')
      .where('LOWER(pr.nombre) = LOWER(:nombre)', { nombre })
      .andWhere('pr.tenant_id = :tenantId', { tenantId })
      .andWhere('pr.sede_id = :sedeId', { sedeId })
      .andWhere('pr.deleted_at IS NULL');

    if (excludeId) {
      qb.andWhere('pr.id != :excludeId', { excludeId });
    }

    const exists = await qb.getOne();
    if (exists) {
      throw new AppError({
        code: ErrorCodes.PUNTO_RETIRO_NOMBRE_DUPLICADO,
        message: `Ya existe un punto de retiro con el nombre "${nombre}" en esta sede`,
        status: 409,
        details: { nombre, sede_id: sedeId },
      });
    }
  }
}
