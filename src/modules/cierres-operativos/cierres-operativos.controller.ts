import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { ok, page } from 'src/common/http/api-response';
import { CierresOperativosService } from './cierres-operativos.service';
import { CrearCierreDto } from './dto/crear-cierre.dto';
import { QueryCierresDto } from './dto/query-cierres.dto';
import { QueryResumenPrevioDto } from './dto/query-resumen-previo.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/cierres-operativos')
export class CierresOperativosController {
  constructor(private readonly svc: CierresOperativosService) {}

  // IMPORTANT: declared before /:id to prevent NestJS routing conflict
  @Roles('administrador', 'operador_caja')
  @Get('resumen-previo')
  async getResumenPrevio(@Query() query: QueryResumenPrevioDto) {
    const resumen = await this.svc.calcularResumenPrevio(query);
    return ok(resumen);
  }

  @Roles('administrador', 'operador_caja')
  @Post()
  @HttpCode(201)
  async ejecutarCierre(@Req() req: any, @Body() dto: CrearCierreDto) {
    const cierre = await this.svc.ejecutarCierre(dto, req.user?.sub);
    return ok(cierre);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get()
  async list(@Query() query: QueryCierresDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const cierre = await this.svc.findOne(id);
    return ok(cierre);
  }
}
