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
import { StockViandasService } from './stock-viandas.service';
import { AjustarStockDto } from './dto/ajustar-stock.dto';
import { QueryStockDto } from './dto/query-stock.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/stock-viandas')
export class StockViandasController {
  constructor(private readonly svc: StockViandasService) {}

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get()
  async list(@Query() query: QueryStockDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const stock = await this.svc.findOne(id);
    return ok(stock);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Post(':id/ajustar')
  @HttpCode(200)
  async ajustar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AjustarStockDto,
  ) {
    const result = await this.svc.ajustarStock(id, dto, req.user?.sub);
    return ok(result);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id/movimientos')
  async movimientos(@Param('id') id: string) {
    const items = await this.svc.listMovimientos(id);
    return ok(items);
  }
}
