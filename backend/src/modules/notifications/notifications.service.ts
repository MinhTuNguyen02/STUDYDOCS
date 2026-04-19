import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { notification_type } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface CreateNotificationParams {
  accountId: number;
  type: notification_type;
  title: string;
  message: string;
  referenceId?: number;
  referenceType?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  // ── Core: tạo notification + push realtime ────────────────────

  /**
   * Tạo notification cho 1 user cụ thể và push qua Socket.IO.
   * GỌI SAU KHI TRANSACTION COMMIT, không gọi bên trong $transaction.
   */
  async notify(params: CreateNotificationParams) {
    const notification = await this.prisma.notifications.create({
      data: {
        account_id: params.accountId,
        type: params.type,
        title: params.title,
        message: params.message,
        reference_id: params.referenceId ?? null,
        reference_type: params.referenceType ?? null,
      },
    });

    // Push realtime
    this.gateway.sendToUser(params.accountId, 'notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      referenceId: notification.reference_id,
      referenceType: notification.reference_type,
      isRead: notification.is_read,
      createdAt: notification.created_at,
    });

    return notification;
  }

  /**
   * Tạo notification cho nhiều users cùng lúc (batch).
   */
  async notifyMany(accountIds: number[], params: Omit<CreateNotificationParams, 'accountId'>) {
    if (accountIds.length === 0) return;

    // Batch insert
    await this.prisma.notifications.createMany({
      data: accountIds.map((accountId) => ({
        account_id: accountId,
        type: params.type,
        title: params.title,
        message: params.message,
        reference_id: params.referenceId ?? null,
        reference_type: params.referenceType ?? null,
      })),
    });

    // Push realtime to each user
    const payload = {
      type: params.type,
      title: params.title,
      message: params.message,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      isRead: false,
      createdAt: new Date(),
    };

    for (const accountId of accountIds) {
      this.gateway.sendToUser(accountId, 'notification', payload);
    }
  }

  /**
   * Broadcast notification cho tất cả user thuộc 1 role (admin, mod, accountant).
   */
  async notifyRole(role: string, params: Omit<CreateNotificationParams, 'accountId'>) {
    // Tìm tất cả account thuộc role
    const accounts = await this.prisma.accounts.findMany({
      where: {
        roles: { name: { equals: role, mode: 'insensitive' } },
        status: 'ACTIVE',
      },
      select: { account_id: true },
    });

    if (accounts.length === 0) return;

    const accountIds = accounts.map((a) => a.account_id);

    // Batch insert
    await this.prisma.notifications.createMany({
      data: accountIds.map((account_id) => ({
        account_id,
        type: params.type,
        title: params.title,
        message: params.message,
        reference_id: params.referenceId ?? null,
        reference_type: params.referenceType ?? null,
      })),
    });

    // Broadcast via role room (single emit instead of N emits)
    this.gateway.sendToRole(role, 'notification', {
      type: params.type,
      title: params.title,
      message: params.message,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      isRead: false,
      createdAt: new Date(),
    });
  }

  // ── REST API methods ──────────────────────────────────────────

  async getMyNotifications(accountId: number, pageStr?: string, limitStr?: string) {
    const page = pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1;
    const limit = limitStr ? Math.min(50, parseInt(limitStr, 10)) : 20;
    const skip = (page - 1) * limit;

    const [total, notifications] = await Promise.all([
      this.prisma.notifications.count({ where: { account_id: accountId } }),
      this.prisma.notifications.findMany({
        where: { account_id: accountId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      meta: { page, limit, total },
      data: toJsonSafe(
        notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          referenceId: n.reference_id,
          referenceType: n.reference_type,
          isRead: n.is_read,
          createdAt: n.created_at,
        })),
      ),
    };
  }

  async getUnreadCount(accountId: number) {
    const count = await this.prisma.notifications.count({
      where: { account_id: accountId, is_read: false },
    });
    return { unreadCount: count };
  }

  async markAsRead(accountId: number, notificationId: number) {
    const notification = await this.prisma.notifications.findFirst({
      where: { id: notificationId, account_id: accountId },
    });
    if (!notification) throw new NotFoundException('Không tìm thấy thông báo.');

    await this.prisma.notifications.update({
      where: { id: notificationId },
      data: { is_read: true },
    });

    return { success: true };
  }

  async markAllAsRead(accountId: number) {
    await this.prisma.notifications.updateMany({
      where: { account_id: accountId, is_read: false },
      data: { is_read: true },
    });

    return { success: true };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications() {
    this.logger.log('Bắt đầu dọn dẹp các thông báo cũ (hơn 30 ngày)...');
    try {
      const date30DaysAgo = new Date();
      date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

      const result = await this.prisma.notifications.deleteMany({
        where: {
          created_at: {
            lt: date30DaysAgo,
          },
        },
      });

      this.logger.log(`Đã xóa ${result.count} thông báo cũ.`);
    } catch (error) {
      this.logger.error('Lỗi khi dọn dẹp thông báo cũ:', error);
    }
  }
}
