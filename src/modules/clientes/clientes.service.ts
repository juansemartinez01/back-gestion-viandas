import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { Cliente } from './entities/cliente.entity';
import { QueryClienteDto } from './dto/query-cliente.dto';
import { UpsertClienteDto } from './dto/upsert-cliente.dto';

@Injectable()
export class ClientesService extends BaseCrudTenantService<Cliente> {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {
    super(clienteRepo);
  }

  async list(query: QueryClienteDto) {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.clienteRepo
      .createQueryBuilder('cl')
      .where('cl.tenant_id = :tenantId', { tenantId })
      .andWhere('cl.deleted_at IS NULL');

    if (query.q) {
      qb.andWhere(
        '(cl.dni ILIKE :q OR cl.nombre ILIKE :q OR cl.apellido ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    if (query.activo !== undefined) {
      qb.andWhere('cl.activo = :activo', { activo: query.activo });
    }

    const allowedSort = ['apellido', 'nombre', 'fecha_ultima_operacion', 'created_at'];
    const sortBy = allowedSort.includes(query.sortBy ?? '') ? query.sortBy! : 'apellido';
    qb.orderBy(`cl.${sortBy}`, query.sortOrder ?? 'ASC');

    const limit = query.limit ?? 20;
    const currentPage = query.page ?? 1;
    qb.skip((currentPage - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: string): Promise<Cliente> {
    const cl = await this.findById(id, { strictTenant: true });
    if (!cl) {
      throw new AppError({
        code: ErrorCodes.CLIENTE_NOT_FOUND,
        message: 'Cliente no encontrado',
        status: 404,
        details: { id },
      });
    }
    return cl;
  }

  async upsertByDni(dto: UpsertClienteDto): Promise<Cliente> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const today = new Date();

    const existing = await this.clienteRepo
      .createQueryBuilder('cl')
      .where('cl.tenant_id = :tenantId', { tenantId })
      .andWhere('cl.dni = :dni', { dni: dto.dni })
      .andWhere('cl.deleted_at IS NULL')
      .getOne();

    if (existing) {
      existing.nombre = dto.nombre;
      existing.apellido = dto.apellido;
      if (dto.telefono !== undefined && dto.telefono !== '') existing.telefono = dto.telefono;
      if (dto.email !== undefined && dto.email !== '') existing.email = dto.email;
      existing.fecha_ultima_operacion = today;
      return this.clienteRepo.save(existing);
    }

    const nuevo = this.clienteRepo.create({
      tenant_id: tenantId,
      dni: dto.dni,
      nombre: dto.nombre,
      apellido: dto.apellido,
      telefono: dto.telefono ?? null,
      email: dto.email ?? null,
      fecha_primera_operacion: today,
      fecha_ultima_operacion: today,
      activo: true,
    });
    return this.clienteRepo.save(nuevo);
  }

  async bloquear(id: string): Promise<Cliente> {
    const cl = await this.findOne(id);
    if (!cl.activo) {
      throw new AppError({
        code: ErrorCodes.CLIENTE_YA_BLOQUEADO,
        message: 'El cliente ya se encuentra bloqueado',
        status: 409,
        details: { id },
      });
    }
    cl.activo = false;
    return this.clienteRepo.save(cl);
  }

  async desbloquear(id: string): Promise<Cliente> {
    const cl = await this.findOne(id);
    if (cl.activo) {
      throw new AppError({
        code: ErrorCodes.CLIENTE_YA_ACTIVO,
        message: 'El cliente ya se encuentra activo',
        status: 409,
        details: { id },
      });
    }
    cl.activo = true;
    return this.clienteRepo.save(cl);
  }
}
