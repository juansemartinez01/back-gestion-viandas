import { Controller, Get } from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { CategoriasMenuService } from './categorias-menu.service';

@Controller('public/categorias-menu')
export class PublicCategoriasMenuController {
  constructor(private readonly svc: CategoriasMenuService) {}

  @Get()
  async list() {
    const categorias = await this.svc.listPublic();
    return ok(categorias);
  }
}
