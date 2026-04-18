import { Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listMyNotifications(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.notificationsService.listMyNotifications(user, Number(limit ?? 10));
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markAsRead(user, id);
  }
}
