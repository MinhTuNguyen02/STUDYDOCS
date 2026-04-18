import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PrismaModule, GatewayModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
