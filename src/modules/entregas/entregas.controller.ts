import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { ok, page } from 'src/common/http/api-response';
import { EntregasService } from './entregas.service';
import { CrearEntregaDto } from './dto/crear-entrega.dto';
import { QueryEntregasDto } from './dto/query-entregas.dto';
import { BuscarPorDniDto } from './dto/buscar-por-dni.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/entregas')
export class EntregasController {
  constructor(private readonly svc: EntregasService) {}

  @Roles('administrador', 'operador_caja')
  @Post()
  @HttpCode(201)
  async registrarEntrega(@Req() req: any, @Body() dto: CrearEntregaDto) {
    const entrega = await this.svc.registrarEntrega(dto, req.user?.sub);
    return ok(entrega);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get()
  async list(@Query() query: QueryEntregasDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  // IMPORTANT: declared before /:id to prevent route conflict
  @Roles('administrador', 'operador_caja')
  @Get('buscar-por-dni')
  async buscarPorDni(@Query() query: BuscarPorDniDto) {
    const pedidos = await this.svc.buscarPorDni(query);
    return ok(pedidos);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const entrega = await this.svc.findOne(id);
    return ok(entrega);
  }
}
