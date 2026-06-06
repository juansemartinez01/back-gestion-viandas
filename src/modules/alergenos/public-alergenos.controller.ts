import { Controller, Get } from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { AlergenosService } from './alergenos.service';

@Controller('public/alergenos')
export class PublicAlergenosController {
  constructor(private readonly svc: AlergenosService) {}

  @Get()
  async list() {
    const alergenos = await this.svc.listPublic();
    return ok(alergenos);
  }
}
