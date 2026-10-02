import { Module } from '@nestjs/common';
import { PenaltyService } from './penalty.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [PenaltyService],
  exports: [PenaltyService]
})
export class ModerationModule {}
