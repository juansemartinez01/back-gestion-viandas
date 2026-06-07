import { Controller, Get } from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { BannersPromocionesService } from './banners-promociones.service';

@Controller('public/banners')
export class PublicBannersController {
  constructor(private readonly svc: BannersPromocionesService) {}

  @Get()
  async list() {
    const banners = await this.svc.listPublic();
    return ok(banners);
  }
}
