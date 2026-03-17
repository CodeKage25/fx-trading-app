import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('trades')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get trade volume and count statistics (admin only)' })
  getTradeStats() {
    return this.analyticsService.getTradeStats();
  }

  @Get('fx-trends')
  @Public()
  @ApiOperation({ summary: 'Get historical FX rate trends for a currency' })
  @ApiQuery({ name: 'currency', example: 'USD' })
  @ApiQuery({ name: 'days', example: 7, required: false })
  getFxTrends(
    @Query('currency') currency: string = 'USD',
    @Query('days') days: number = 7,
  ) {
    return this.analyticsService.getFxTrends(currency, Number(days));
  }

  @Get('users/:id/activity')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get activity summary for a specific user (admin only)' })
  getUserActivity(@Param('id') id: string) {
    return this.analyticsService.getUserActivity(id);
  }
}
