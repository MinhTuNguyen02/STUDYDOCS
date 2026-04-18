import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { LedgerService } from './ledger.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [WalletsController],
  providers: [WalletsService, LedgerService],
  exports: [WalletsService, LedgerService]
})
export class WalletsModule {}
