import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { MenuBase } from 'src/modules/menus-base/entities/menu-base.entity';
import { Sede } from 'src/modules/sedes/entities/sede.entity';
import { PuntoRetiro } from 'src/modules/puntos-retiro/entities/punto-retiro.entity';
import { MenusBaseService } from 'src/modules/menus-base/menus-base.service';
import { SedesService } from 'src/modules/sedes/sedes.service';
import {
  EstadoMenuPublicado,
  MenuPublicado,
  TipoSobreproduccion,
} from './entities/menu-publicado.entity';
import { CreateMenuPublicadoDto } from './dto/create-menu-publicado.dto';
import { UpdateMenuPublicadoDto } from './dto/update-menu-publicado.dto';
import { QueryMenuPublicadoDto } from './dto/query-menu-publicado.dto';
import { QueryMenusDisponiblesDto } from './dto/query-menus-disponibles.dto';

const DIAS_HORIZONTE_PUBLICO = 7;

@Injectable()
export class MenusPublicadosService extends BaseCrudTenantService<MenuPublicado> {
  constructor(
    @InjectRepository(MenuPublicado)
    private readonly mpRepo: Repository<MenuPublicado>,
    @InjectRepository(PuntoRetiro)
    private readonly puntoRetiroRepo: Repository<PuntoRetiro>,
    private readonly menusBaseService: MenusBaseService,
    private readonly sedesService: SedesService,
  ) {
    super(mpRepo);
  }

  async findOne(id: string): Promise<MenuPublicado> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const mp = await this.mpRepo
      .createQueryBuilder('mp')
      .where('mp.id = :id', { id })
      .andWhere('mp.tenant_id = :tenantId', { tenantId })
      .andWhere('mp.deleted_at IS NULL')
      .leftJoinAndSelect('mp.menuBase', 'mb')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al')
      .leftJoinAndSelect('mp.sede', 'sede')
      .leftJoinAndSelect('mp.puntosRetiro', 'pr')
      .getOne();

    if (!mp) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_NOT_FOUND,
        message: 'Menú publicado no encontrado',
        status: 404,
        details: { id },
      });
    }
    return mp;
  }

  async list(query: QueryMenuPublicadoDto) {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.mpRepo
      .createQueryBuilder('mp')
      .where('mp.tenant_id = :tenantId', { tenantId })
      .andWhere('mp.deleted_at IS NULL')
      .leftJoinAndSelect('mp.menuBase', 'mb')
      .leftJoinAndSelect('mp.puntosRetiro', 'pr');

    if (query.fecha_venta) {
      qb.andWhere('mp.fecha_venta = :fechaVenta', { fechaVenta: query.fecha_venta });
    }
    if (query.sede_id) {
      qb.andWhere('mp.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.estado) {
      qb.andWhere('mp.estado = :estado', { estado: query.estado });
    }
    if (query.menu_base_id) {
      qb.andWhere('mp.menu_base_id = :menuBaseId', { menuBaseId: query.menu_base_id });
    }

    const sortBy = query.sortBy ?? 'created_at';
    const allowedSort = ['created_at', 'fecha_venta', 'precio_encargo'];
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = query.sortOrder ?? 'DESC';
    qb.orderBy(`mp.${safeSort}`, sortOrder);

    const currentPage = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((currentPage - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: currentPage, limit };
  }

  async publicar(dto: CreateMenuPublicadoDto): Promise<MenuPublicado> {
    const tenantId = this.getTenantId({ strictTenant: true });

    // Fields are guaranteed present by class-validator; cast to assert
    const menuBaseId = dto.menu_base_id as string;
    const sedeId = dto.sede_id as string;
    const fechaVenta = dto.fecha_venta as string;
    const precioEncargo = dto.precio_encargo as number;
    const fechaLimiteEncargo = dto.fecha_hora_limite_encargo as string;
    const puntosRetiroIds = dto.puntos_retiro_ids as string[];

    const menuBase = await this.menusBaseService.findOne(menuBaseId);
    if (!menuBase.activo) {
      throw new AppError({
        code: ErrorCodes.MENU_BASE_YA_INACTIVO,
        message: 'El menú base no está activo',
        status: 422,
        details: { menu_base_id: menuBaseId },
      });
    }

    const sede = await this.sedesService.findOne(sedeId);
    if (!sede.activa) {
      throw new AppError({
        code: ErrorCodes.SEDE_INACTIVA,
        message: 'La sede no está activa',
        status: 422,
        details: { sede_id: sedeId },
      });
    }

    this.assertPrecioValido(precioEncargo);
    this.assertFechaLimiteValida(fechaLimiteEncargo, fechaVenta);
    this.assertSobreproduccionCoherente(dto.tipo_sobreproduccion, dto.valor_sobreproduccion);

    const puntosRetiro = await this.assertPuntosRetiroValidos(puntosRetiroIds, sedeId);

    const mp = this.mpRepo.create({
      tenant_id: tenantId,
      menu_base_id: menuBaseId,
      sede_id: sedeId,
      fecha_venta: fechaVenta,
      precio_encargo: precioEncargo,
      precio_sobrante: dto.precio_sobrante ?? null,
      fecha_hora_limite_encargo: new Date(fechaLimiteEncargo),
      fecha_hora_limite_cancelacion: dto.fecha_hora_limite_cancelacion
        ? new Date(dto.fecha_hora_limite_cancelacion)
        : null,
      limite_maximo_viandas: dto.limite_maximo_viandas ?? null,
      tipo_sobreproduccion: dto.tipo_sobreproduccion ?? null,
      valor_sobreproduccion: dto.valor_sobreproduccion ?? null,
      estado: EstadoMenuPublicado.ACTIVO,
      imagen_public_id: dto.imagen_public_id ?? null,
      imagen_url: dto.imagen_url ?? null,
      observaciones: dto.observaciones ?? null,
      puntosRetiro,
    });

    const saved = await this.mpRepo.save(mp);
    return this.findOne(saved.id);
  }

  async editarMenuPublicado(id: string, dto: UpdateMenuPublicadoDto): Promise<MenuPublicado> {
    const mp = await this.findOne(id);

    if (dto.precio_encargo !== undefined) {
      this.assertPrecioValido(dto.precio_encargo);
    }
    if (dto.fecha_hora_limite_encargo !== undefined) {
      this.assertFechaLimiteValida(dto.fecha_hora_limite_encargo, mp.fecha_venta);
    }
    if (dto.tipo_sobreproduccion !== undefined || dto.valor_sobreproduccion !== undefined) {
      const tipo = dto.tipo_sobreproduccion !== undefined ? dto.tipo_sobreproduccion : mp.tipo_sobreproduccion;
      const valor = dto.valor_sobreproduccion !== undefined ? dto.valor_sobreproduccion : mp.valor_sobreproduccion;
      this.assertSobreproduccionCoherente(tipo, valor);
    }
    if (dto.puntos_retiro_ids !== undefined) {
      mp.puntosRetiro = await this.assertPuntosRetiroValidos(dto.puntos_retiro_ids, mp.sede_id);
    }

    if (dto.precio_encargo !== undefined) mp.precio_encargo = dto.precio_encargo;
    if (dto.precio_sobrante !== undefined) mp.precio_sobrante = dto.precio_sobrante ?? null;
    if (dto.fecha_hora_limite_encargo !== undefined)
      mp.fecha_hora_limite_encargo = new Date(dto.fecha_hora_limite_encargo);
    if (dto.fecha_hora_limite_cancelacion !== undefined)
      mp.fecha_hora_limite_cancelacion = dto.fecha_hora_limite_cancelacion
        ? new Date(dto.fecha_hora_limite_cancelacion)
        : null;
    if (dto.limite_maximo_viandas !== undefined) mp.limite_maximo_viandas = dto.limite_maximo_viandas ?? null;
    if (dto.tipo_sobreproduccion !== undefined) mp.tipo_sobreproduccion = dto.tipo_sobreproduccion ?? null;
    if (dto.valor_sobreproduccion !== undefined) mp.valor_sobreproduccion = dto.valor_sobreproduccion ?? null;
    if (dto.imagen_public_id !== undefined) mp.imagen_public_id = dto.imagen_public_id ?? null;
    if (dto.imagen_url !== undefined) mp.imagen_url = dto.imagen_url ?? null;
    if (dto.observaciones !== undefined) mp.observaciones = dto.observaciones ?? null;

    await this.mpRepo.save(mp);
    return this.findOne(id);
  }

  async pausar(id: string): Promise<MenuPublicado> {
    const mp = await this.findOne(id);
    if (mp.estado !== EstadoMenuPublicado.ACTIVO) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_TRANSICION_INVALIDA,
        message: `No se puede pausar un menú en estado "${mp.estado}"`,
        status: 409,
        details: { estadoActual: mp.estado, transicion: 'pausar' },
      });
    }
    mp.estado = EstadoMenuPublicado.PAUSADO;
    return this.mpRepo.save(mp);
  }

  async reactivar(id: string): Promise<MenuPublicado> {
    const mp = await this.findOne(id);
    if (mp.estado !== EstadoMenuPublicado.PAUSADO) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_TRANSICION_INVALIDA,
        message: `No se puede reactivar un menú en estado "${mp.estado}"`,
        status: 409,
        details: { estadoActual: mp.estado, transicion: 'reactivar' },
      });
    }
    mp.estado = EstadoMenuPublicado.ACTIVO;
    return this.mpRepo.save(mp);
  }

  async cerrar(id: string): Promise<MenuPublicado> {
    const mp = await this.findOne(id);
    const permitidos = [EstadoMenuPublicado.ACTIVO, EstadoMenuPublicado.PAUSADO];
    if (!permitidos.includes(mp.estado)) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_TRANSICION_INVALIDA,
        message: `No se puede cerrar un menú en estado "${mp.estado}"`,
        status: 409,
        details: { estadoActual: mp.estado, transicion: 'cerrar' },
      });
    }
    mp.estado = EstadoMenuPublicado.CERRADO;
    return this.mpRepo.save(mp);
  }

  async agotar(id: string): Promise<MenuPublicado> {
    const mp = await this.findOne(id);
    if (mp.estado !== EstadoMenuPublicado.ACTIVO) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_TRANSICION_INVALIDA,
        message: `No se puede marcar como agotado un menú en estado "${mp.estado}"`,
        status: 409,
        details: { estadoActual: mp.estado, transicion: 'agotar' },
      });
    }
    mp.estado = EstadoMenuPublicado.AGOTADO;
    return this.mpRepo.save(mp);
  }

  async cancelar(id: string, roles: string[]): Promise<MenuPublicado> {
    const mp = await this.findOne(id);

    if (mp.estado === EstadoMenuPublicado.CANCELADO) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_TRANSICION_INVALIDA,
        message: 'El menú ya está cancelado y no admite más transiciones',
        status: 409,
        details: { estadoActual: mp.estado, transicion: 'cancelar' },
      });
    }

    const soloAdmin = [EstadoMenuPublicado.CERRADO, EstadoMenuPublicado.AGOTADO];
    if (soloAdmin.includes(mp.estado) && !roles.includes('administrador')) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_TRANSICION_INVALIDA,
        message: `Solo un administrador puede cancelar un menú en estado "${mp.estado}"`,
        status: 409,
        details: { estadoActual: mp.estado, transicion: 'cancelar', razon: 'rol insuficiente' },
      });
    }

    mp.estado = EstadoMenuPublicado.CANCELADO;
    return this.mpRepo.save(mp);
  }

  async remove(id: string): Promise<void> {
    const mp = await this.findOne(id);
    if (mp.estado !== EstadoMenuPublicado.CANCELADO) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE,
        message: 'Solo se pueden eliminar menús publicados en estado "cancelado"',
        status: 409,
        details: { estadoActual: mp.estado },
      });
    }
    await this.mpRepo.softDelete(id);
  }

  async listDisponiblesPublic(query: QueryMenusDisponiblesDto): Promise<MenuPublicado[]> {
    const tenantId = this.getTenantId({ strictTenant: true });

    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + DIAS_HORIZONTE_PUBLICO);

    const qb = this.mpRepo
      .createQueryBuilder('mp')
      .where('mp.tenant_id = :tenantId', { tenantId })
      .andWhere('mp.deleted_at IS NULL')
      .andWhere('mp.estado = :estado', { estado: EstadoMenuPublicado.ACTIVO })
      .andWhere('mp.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere('mp.fecha_venta >= :hoy', { hoy: hoy.toISOString().slice(0, 10) })
      .andWhere('mp.fecha_venta <= :limite', { limite: limite.toISOString().slice(0, 10) })
      .leftJoinAndSelect('mp.menuBase', 'mb')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al')
      .leftJoinAndSelect('mp.puntosRetiro', 'pr')
      .orderBy('mp.fecha_venta', 'ASC')
      .addOrderBy('mb.nombre', 'ASC');

    if (query.punto_retiro_id) {
      qb.innerJoin('mp.puntosRetiro', 'prf', 'prf.id = :prId', {
        prId: query.punto_retiro_id,
      });
    }

    return qb.getMany();
  }

  private assertPrecioValido(precio: number): void {
    if (precio <= 0) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_PRECIO_INVALIDO,
        message: 'El precio de encargo debe ser mayor a 0',
        status: 422,
        details: { precio_encargo: precio },
      });
    }
  }

  private assertFechaLimiteValida(fechaLimite: string, fechaVenta: string): void {
    const limiteDate = new Date(fechaLimite);
    const ventaEndOfDay = new Date(`${fechaVenta}T23:59:59Z`);
    if (limiteDate > ventaEndOfDay) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_FECHA_LIMITE_INVALIDA,
        message: 'La fecha/hora límite de encargo no puede ser posterior al día de venta',
        status: 422,
        details: { fecha_hora_limite_encargo: fechaLimite, fecha_venta: fechaVenta },
      });
    }
  }

  private assertSobreproduccionCoherente(
    tipo: TipoSobreproduccion | null | undefined,
    valor: number | null | undefined,
  ): void {
    const tieneT = tipo !== null && tipo !== undefined;
    const tieneV = valor !== null && valor !== undefined;
    if (tieneT !== tieneV) {
      throw new AppError({
        code: ErrorCodes.MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA,
        message:
          'Los campos tipo_sobreproduccion y valor_sobreproduccion deben estar ambos presentes o ambos ausentes',
        status: 422,
        details: { tipo_sobreproduccion: tipo, valor_sobreproduccion: valor },
      });
    }
  }

  private async assertPuntosRetiroValidos(
    ids: string[],
    sedeId: string,
  ): Promise<PuntoRetiro[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const result: PuntoRetiro[] = [];
    for (const id of ids) {
      const pr = await this.puntoRetiroRepo
        .createQueryBuilder('pr')
        .where('pr.id = :id', { id })
        .andWhere('pr.tenant_id = :tenantId', { tenantId })
        .andWhere('pr.deleted_at IS NULL')
        .andWhere('pr.activo = true')
        .andWhere('pr.sede_id = :sedeId', { sedeId })
        .getOne();

      if (!pr) {
        throw new AppError({
          code: ErrorCodes.MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS,
          message: `El punto de retiro ${id} no es válido, no está activo o no pertenece a la sede indicada`,
          status: 422,
          details: { punto_retiro_id: id, sede_id: sedeId },
        });
      }
      result.push(pr);
    }
    return result;
  }
}
