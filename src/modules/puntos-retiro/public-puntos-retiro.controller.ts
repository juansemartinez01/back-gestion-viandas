import { Controller, Get, Query } from '@nestjs/common';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ok } from 'src/common/http/api-response';
import { PuntosRetiroService } from './puntos-retiro.service';

class PublicQueryPuntoRetiroDto {
  @IsUUID()
  @IsNotEmpty()
  sede_id!: string;
}

@Controller('public/puntos-retiro')
export class PublicPuntosRetiroController {
  constructor(private readonly svc: PuntosRetiroService) {}

  @Get()
  async list(@Query() query: PublicQueryPuntoRetiroDto) {
    const puntos = await this.svc.listPublic(query.sede_id);
    return ok(puntos);
  }
}
