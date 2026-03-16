import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletBalance } from './wallet-balance.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { FxModule } from '../fx/fx.module';
import { Transaction } from '../transactions/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletBalance, Transaction]),
    FxModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
