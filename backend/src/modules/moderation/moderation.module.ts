import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { WalletsModule } from '../wallets/wallets.module';
import { PenaltyService } from './penalty.service';

@Module({
  imports: [WalletsModule],
  controllers: [ModerationController],
  providers: [ModerationService, PenaltyService],
  exports: [ModerationService, PenaltyService]
})
export class ModerationModule {}
