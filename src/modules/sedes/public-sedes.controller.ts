import { Controller, Get } from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { SedesService } from './sedes.service';

@Controller('public/sedes')
export class PublicSedesController {
  constructor(private readonly svc: SedesService) {}

  @Get()
  async list() {
    const sedes = await this.svc.listPublic();
    return ok(sedes);
  }
}
