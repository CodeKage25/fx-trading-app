import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Transaction } from '../transactions/transaction.entity';
import { FxRateSnapshot } from './fx-rate-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, FxRateSnapshot])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
