import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FxService } from './fx.service';
import { FxController } from './fx.controller';
import { FxRateSnapshot } from '../analytics/fx-rate-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FxRateSnapshot])],
  controllers: [FxController],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
