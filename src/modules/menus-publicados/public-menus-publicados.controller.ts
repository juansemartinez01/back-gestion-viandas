import { Controller, Get, Query } from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { MenusPublicadosService } from './menus-publicados.service';
import { QueryMenusDisponiblesDto } from './dto/query-menus-disponibles.dto';

@Controller('public/menus-disponibles')
export class PublicMenusPublicadosController {
  constructor(private readonly svc: MenusPublicadosService) {}

  @Get()
  async listDisponibles(@Query() query: QueryMenusDisponiblesDto) {
    const menus = await this.svc.listDisponiblesPublic(query);
    return ok(menus);
  }
}
