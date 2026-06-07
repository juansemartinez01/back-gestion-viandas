import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
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
    @InjectRepository(MenuBase)
    private readonly menuBaseRepo: Repository<MenuBase>,
    @InjectRepository(CategoriaMenu)
    private readonly categoriaRepo: Repository<CategoriaMenu>,
    @InjectRepository(EtiquetaMenu)
    private readonly etiquetaRepo: Repository<EtiquetaMenu>,
    @InjectRepository(Alergeno)
    private readonly alergenoRepo: Repository<Alergeno>,
  ) {
    super(menuBaseRepo);
  }

  async list(query: QueryMenuBaseDto) {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.menuBaseRepo
      .createQueryBuilder('mb')
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
      qb.innerJoin('mb.categorias', 'catf', 'catf.id = :categoriaId', {
        categoriaId: query.categoria_id,
      });
    }
    if (query.etiqueta_id) {
      qb.innerJoin('mb.etiquetas', 'etf', 'etf.id = :etiquetaId', {
        etiquetaId: query.etiqueta_id,
      });
    }
    if (query.alergeno_id) {
      qb.innerJoin('mb.alergenos', 'alf', 'alf.id = :alergenoId', {
        alergenoId: query.alergeno_id,
      });
    }

    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'DESC';
    qb.orderBy(`mb.${sortBy}`, sortOrder);

    const currentPage = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((currentPage - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: currentPage, limit };
  }

  async findOne(id: string): Promise<MenuBase> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const menu = await this.menuBaseRepo
      .createQueryBuilder('mb')
      .where('mb.id = :id', { id })
      .andWhere('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al')
      .getOne();

    if (!menu) {
      throw new AppError({
        code: ErrorCodes.MENU_BASE_NOT_FOUND,
        message: 'Menú base no encontrado',
        status: 404,
        details: { id },
      });
    }
    return menu;
  }

  async findOnePublic(id: string): Promise<MenuBase> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const menu = await this.menuBaseRepo
      .createQueryBuilder('mb')
      .where('mb.id = :id', { id })
      .andWhere('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .andWhere('mb.activo = true')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al')
      .getOne();

    if (!menu) {
      throw new AppError({
        code: ErrorCodes.MENU_BASE_NOT_FOUND,
        message: 'Menú base no encontrado',
        status: 404,
        details: { id },
      });
    }
    return menu;
  }

  async listPublic(): Promise<MenuBase[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    return this.menuBaseRepo
      .createQueryBuilder('mb')
      .where('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .andWhere('mb.activo = true')
      .leftJoinAndSelect('mb.categorias', 'cat')
      .leftJoinAndSelect('mb.etiquetas', 'et')
      .leftJoinAndSelect('mb.alergenos', 'al')
      .orderBy('mb.nombre', 'ASC')
      .getMany();
  }

  async create(dto: CreateMenuBaseDto): Promise<MenuBase> {
    const tenantId = this.getTenantId({ strictTenant: true });
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
      tenant_id: tenantId,
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
    if (dto.ingredientes_principales !== undefined)
      menu.ingredientes_principales = dto.ingredientes_principales ?? null;
    if (dto.calorias_aprox !== undefined) menu.calorias_aprox = dto.calorias_aprox ?? null;
    if (dto.proteinas_aprox !== undefined) menu.proteinas_aprox = dto.proteinas_aprox ?? null;
    if (dto.carbohidratos_aprox !== undefined)
      menu.carbohidratos_aprox = dto.carbohidratos_aprox ?? null;
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
    return this.findOne(id);
  }

  async activar(id: string): Promise<MenuBase> {
    const menu = await this.findOne(id);
    if (menu.activo) {
      throw new AppError({
        code: ErrorCodes.MENU_BASE_YA_ACTIVO,
        message: 'El menú base ya se encuentra activo',
        status: 409,
        details: { id },
      });
    }
    menu.activo = true;
    await this.menuBaseRepo.save(menu);
    return menu;
  }

  async inactivar(id: string): Promise<MenuBase> {
    const menu = await this.findOne(id);
    if (!menu.activo) {
      throw new AppError({
        code: ErrorCodes.MENU_BASE_YA_INACTIVO,
        message: 'El menú base ya se encuentra inactivo',
        status: 409,
        details: { id },
      });
    }
    menu.activo = false;
    await this.menuBaseRepo.save(menu);
    return menu;
  }

  async remove(id: string): Promise<void> {
    const menu = await this.findOne(id);
    if (menu.activo) {
      throw new AppError({
        code: ErrorCodes.MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR,
        message: 'El menú base debe estar inactivo antes de poder eliminarse',
        status: 409,
        details: { id },
      });
    }
    await this.menuBaseRepo.softDelete(id);
  }

  private async assertNombreUnico(nombre: string, excludeId?: string): Promise<void> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.menuBaseRepo
      .createQueryBuilder('mb')
      .where('mb.tenant_id = :tenantId', { tenantId })
      .andWhere('mb.deleted_at IS NULL')
      .andWhere('LOWER(mb.nombre) = LOWER(:nombre)', { nombre });

    if (excludeId) {
      qb.andWhere('mb.id != :excludeId', { excludeId });
    }

    const exists = await qb.getOne();
    if (exists) {
      throw new AppError({
        code: ErrorCodes.MENU_BASE_NOMBRE_DUPLICADO,
        message: `Ya existe un menú base con el nombre "${nombre}"`,
        status: 409,
        details: { nombre },
      });
    }
  }

  private async assertCategoriasValidas(ids: string[]): Promise<CategoriaMenu[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const result: CategoriaMenu[] = [];
    for (const id of ids) {
      const cat = await this.categoriaRepo
        .createQueryBuilder('cat')
        .where('cat.id = :id', { id })
        .andWhere('cat.tenant_id = :tenantId', { tenantId })
        .andWhere('cat.deleted_at IS NULL')
        .andWhere('cat.activa = true')
        .getOne();
      if (!cat) {
        throw new AppError({
          code: ErrorCodes.MENU_BASE_RELACION_INVALIDA,
          message: `CategoriaMenu ${id} no es válida para este tenant`,
          status: 422,
          details: { id },
        });
      }
      result.push(cat);
    }
    return result;
  }

  private async assertEtiquetasValidas(ids: string[]): Promise<EtiquetaMenu[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const result: EtiquetaMenu[] = [];
    for (const id of ids) {
      const et = await this.etiquetaRepo
        .createQueryBuilder('et')
        .where('et.id = :id', { id })
        .andWhere('et.tenant_id = :tenantId', { tenantId })
        .andWhere('et.deleted_at IS NULL')
        .andWhere('et.activa = true')
        .getOne();
      if (!et) {
        throw new AppError({
          code: ErrorCodes.MENU_BASE_RELACION_INVALIDA,
          message: `EtiquetaMenu ${id} no es válida para este tenant`,
          status: 422,
          details: { id },
        });
      }
      result.push(et);
    }
    return result;
  }

  private async assertAlergenosValidos(ids: string[]): Promise<Alergeno[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const result: Alergeno[] = [];
    for (const id of ids) {
      const al = await this.alergenoRepo
        .createQueryBuilder('al')
        .where('al.id = :id', { id })
        .andWhere('al.tenant_id = :tenantId', { tenantId })
        .andWhere('al.deleted_at IS NULL')
        .andWhere('al.activo = true')
        .getOne();
      if (!al) {
        throw new AppError({
          code: ErrorCodes.MENU_BASE_RELACION_INVALIDA,
          message: `Alergeno ${id} no es válido para este tenant`,
          status: 422,
          details: { id },
        });
      }
      result.push(al);
    }
    return result;
  }
}
