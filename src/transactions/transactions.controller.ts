import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'View transaction history (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['FUNDING', 'CONVERSION', 'TRADE'],
  })
  @ApiResponse({ status: 200, description: 'Paginated transaction history' })
  getTransactions(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('type') type?: string,
  ) {
    return this.transactionsService.findByUser(
      user.id,
      Number(page),
      Number(limit),
      type,
    );
  }
}
