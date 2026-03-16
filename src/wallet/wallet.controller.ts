import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { TradeCurrencyDto } from './dto/trade-currency.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get user wallet balances by currency' })
  @ApiResponse({ status: 200, description: 'List of currency balances' })
  getBalances(@CurrentUser() user: User) {
    return this.walletService.getBalances(user.id);
  }

  @Post('fund')
  @ApiOperation({ summary: 'Fund wallet with a currency amount' })
  @ApiResponse({ status: 201, description: 'Wallet funded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid currency or amount' })
  fundWallet(@CurrentUser() user: User, @Body() dto: FundWalletDto) {
    return this.walletService.fundWallet(user.id, dto);
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert between currencies using real-time FX rates' })
  @ApiResponse({ status: 201, description: 'Conversion successful' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or invalid currency' })
  convert(@CurrentUser() user: User, @Body() dto: ConvertCurrencyDto) {
    return this.walletService.convertCurrency(user.id, dto);
  }

  @Post('trade')
  @ApiOperation({ summary: 'Trade Naira with other currencies and vice versa' })
  @ApiResponse({ status: 201, description: 'Trade executed successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or invalid currency' })
  trade(@CurrentUser() user: User, @Body() dto: TradeCurrencyDto) {
    return this.walletService.trade(user.id, dto);
  }
}
