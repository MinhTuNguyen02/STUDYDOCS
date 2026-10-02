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
    private readonly gateway: EventsGateway
  ) {}

  // ── Core: tạo notification + push realtime ────────────────────

  /**
   * Tạo notification cho 1 user cụ thể và push qua Socket.IO.
   * GỌI SAU KHI TRANSACTION COMMIT, không gọi bên trong $transaction.
   */
  async notify(params: CreateNotificationParams) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const notification = await this.prisma.notifications.create({
          data: {
            account_id: params.accountId,
            type: params.type,
            title: params.title,
            message: params.message,
            reference_id: params.referenceId ?? null,
            reference_type: params.referenceType ?? null
          }
        });

        this.gateway.sendToUser(params.accountId, 'notification', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          referenceId: notification.reference_id,
          referenceType: notification.reference_type,
          isRead: notification.is_read,
          createdAt: notification.created_at
        });
        return notification;
      } catch (error) {
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 100));
          continue;
        }
        this.logger.error(
          `Không thể tạo thông báo cho account ${params.accountId} sau 3 lần thử.`,
          error instanceof Error ? error.stack : undefined
        );
      }
    }
    return null;
  }

  async notifyCustomerWalletChange(customerId: number) {
    try {
      await this.gateway.sendToCustomer(customerId, 'wallet_updated', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.warn(
        `Không thể đẩy cập nhật ví cho customer ${customerId}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  async notifyAccountWalletChange(accountId: number) {
    try {
      this.gateway.sendToUser(accountId, 'wallet_updated', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.warn(
        `Không thể đẩy cập nhật ví cho account ${accountId}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Tạo notification cho nhiều users cùng lúc.
   * Dùng individual create để có ID cho socket push (tránh dedup failure).
   */
  async notifyMany(accountIds: number[], params: Omit<CreateNotificationParams, 'accountId'>) {
    if (accountIds.length === 0) return;

    // Deduplicate account IDs
    const uniqueIds = [...new Set(accountIds)];

    for (const accountId of uniqueIds) {
      await this.notify({ ...params, accountId });
    }
  }

  /**
   * Broadcast notification cho tất cả user thuộc 1 role.
   */
  async notifyRole(role: string, params: Omit<CreateNotificationParams, 'accountId'>) {
    const accounts = await this.prisma.accounts.findMany({
      where: {
        roles: { name: { equals: role, mode: 'insensitive' } },
        status: 'ACTIVE'
      },
      select: { account_id: true }
    });

    if (accounts.length === 0) return;

    const accountIds = accounts.map((a) => a.account_id);
    await this.notifyMany(accountIds, params);
  }

  /**
   * Gửi notification cho staff thuộc NHIỀU roles (admin + mod, admin + accountant, etc.)
   * MỖI ACCOUNT CHỈ NHẬN 1 BẢN GHI dù thuộc nhiều role cùng lúc.
   * Dùng hàm này thay cho gọi notifyRole() 2 lần riêng lẻ.
   */
  async notifyStaffRoles(roles: string[], params: Omit<CreateNotificationParams, 'accountId'>) {
    const accounts = await this.prisma.accounts.findMany({
      where: {
        roles: { name: { in: roles, mode: 'insensitive' } },
        status: 'ACTIVE'
      },
      select: { account_id: true }
    });

    if (accounts.length === 0) return;

    // Deduplicate: mỗi account chỉ nhận 1 notification
    const uniqueAccountIds = [...new Set(accounts.map((a) => a.account_id))];
    await this.notifyMany(uniqueAccountIds, params);
  }

  // ── REST API methods ──────────────────────────────────────────

  async getMyNotifications(accountId: number, pageValue?: number, limitValue?: number) {
    const page = pageValue ?? 1;
    const limit = Math.min(50, limitValue ?? 20);
    const skip = (page - 1) * limit;

    const [total, notifications] = await Promise.all([
      this.prisma.notifications.count({ where: { account_id: accountId } }),
      this.prisma.notifications.findMany({
        where: { account_id: accountId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      })
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
          createdAt: n.created_at
        }))
      )
    };
  }

  async getUnreadCount(accountId: number) {
    const count = await this.prisma.notifications.count({
      where: { account_id: accountId, is_read: false }
    });
    return { unreadCount: count };
  }

  async markAsRead(accountId: number, notificationId: number) {
    const notification = await this.prisma.notifications.findFirst({
      where: { id: notificationId, account_id: accountId }
    });
    if (!notification) throw new NotFoundException('Không tìm thấy thông báo.');

    await this.prisma.notifications.update({
      where: { id: notificationId },
      data: { is_read: true }
    });

    return { success: true };
  }

  async markAllAsRead(accountId: number) {
    await this.prisma.notifications.updateMany({
      where: { account_id: accountId, is_read: false },
      data: { is_read: true }
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
            lt: date30DaysAgo
          }
        }
      });

      this.logger.log(`Đã xóa ${result.count} thông báo cũ.`);
    } catch (error) {
      this.logger.error('Lỗi khi dọn dẹp thông báo cũ:', error);
    }
  }
}
