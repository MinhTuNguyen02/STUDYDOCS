import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WalletsModule, NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule { }
