import { Controller, Get, Param } from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { MenusBaseService } from './menus-base.service';

@Controller('public/menus-base')
export class PublicMenusBaseController {
  constructor(private readonly svc: MenusBaseService) {}

  @Get()
  async listPublic() {
    const menus = await this.svc.listPublic();
    return ok(menus);
  }

  @Get(':id')
  async findOnePublic(@Param('id') id: string) {
    const menu = await this.svc.findOnePublic(id);
    return ok(menu);
  }
}
