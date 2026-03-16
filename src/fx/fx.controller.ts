import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FxService } from './fx.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('fx')
@ApiBearerAuth()
@Controller('fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Retrieve current FX rates for supported currency pairs' })
  @ApiQuery({ name: 'base', required: false, example: 'NGN', description: 'Base currency (default: NGN)' })
  @ApiResponse({ status: 200, description: 'Live FX rates' })
  getRates(@Query('base') base = 'NGN') {
    return this.fxService.getRates(base.toUpperCase());
  }

  @Get('supported')
  @Public()
  @ApiOperation({ summary: 'List all supported currencies' })
  getSupportedCurrencies() {
    return { currencies: this.fxService.getSupportedCurrencies() };
  }
}
