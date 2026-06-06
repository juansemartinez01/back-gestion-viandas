import { Controller, Get } from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { EtiquetasMenuService } from './etiquetas-menu.service';

@Controller('public/etiquetas-menu')
export class PublicEtiquetasMenuController {
  constructor(private readonly svc: EtiquetasMenuService) {}

  @Get()
  async list() {
    const etiquetas = await this.svc.listPublic();
    return ok(etiquetas);
  }
}
