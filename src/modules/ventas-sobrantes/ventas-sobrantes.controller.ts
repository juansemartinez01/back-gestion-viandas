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
import { VentasSobrantesService } from './ventas-sobrantes.service';
import { CrearVentaSobranteDto } from './dto/crear-venta-sobrante.dto';
import { QueryDisponiblesDto } from './dto/query-disponibles.dto';
import { QueryVentasSobrantesDto } from './dto/query-ventas-sobrantes.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/ventas-sobrantes')
export class VentasSobrantesController {
  constructor(private readonly svc: VentasSobrantesService) {}

  @Roles('administrador', 'operador_caja')
  @Post()
  @HttpCode(201)
  async create(@Req() req: any, @Body() dto: CrearVentaSobranteDto) {
    const venta = await this.svc.registrarVenta(dto, req.user?.sub);
    return ok(venta);
  }

  // IMPORTANT: declared before /:id to prevent NestJS routing conflict
  @Roles('administrador', 'operador_caja')
  @Get('disponibles')
  async listDisponibles(@Query() query: QueryDisponiblesDto) {
    const result = await this.svc.listDisponibles(query);
    return ok(result);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get()
  async list(@Query() query: QueryVentasSobrantesDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const venta = await this.svc.findOne(id);
    return ok(venta);
  }
}
