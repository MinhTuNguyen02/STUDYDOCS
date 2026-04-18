import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';

interface CreateNotificationInput {
  accountId: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface NotificationRow {
  notification_id: number;
  account_id: number;
  type: string;
  title: string;
  message: string;
  reference_id: number | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: Date;
  link: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapType(type: string) {
    const typeMap: Record<string, string> = {
      DOCUMENT_APPROVED: 'DOC_APPROVED',
      DOCUMENT_REJECTED: 'DOC_REJECTED',
      SELLER_DOCUMENT_SOLD: 'ORDER_NEW',
      PACKAGE_PURCHASED: 'SYSTEM',
      WITHDRAWAL_REQUESTED: 'WITHDRAWAL_NEW',
      WITHDRAWAL_PAID: 'WITHDRAWAL_PAID',
      WITHDRAWAL_REJECTED: 'WITHDRAWAL_REJECTED',
      HELD_FUNDS_RELEASED: 'FUNDS_RELEASED',
    };

    return typeMap[type] ?? 'SYSTEM';
  }

  private getReference(input: CreateNotificationInput) {
    const metadata = input.metadata ?? {};

    if (typeof metadata.documentId === 'number') {
      return { referenceId: metadata.documentId, referenceType: 'DOCUMENT' };
    }
    if (typeof metadata.packageId === 'number') {
      return { referenceId: metadata.packageId, referenceType: 'PACKAGE' };
    }
    if (typeof metadata.requestId === 'number') {
      return { referenceId: metadata.requestId, referenceType: 'WITHDRAWAL_REQUEST' };
    }
    if (typeof metadata.orderItemId === 'number') {
      return { referenceId: metadata.orderItemId, referenceType: 'ORDER_ITEM' };
    }
    if (typeof metadata.orderId === 'number') {
      return { referenceId: metadata.orderId, referenceType: 'ORDER' };
    }

    return { referenceId: null, referenceType: null };
  }

  private buildLink(referenceType: string | null, _referenceId: number | null, fallbackLink?: string | null) {
    if (fallbackLink) return fallbackLink;

    switch (referenceType) {
      case 'DOCUMENT':
        return '/seller/documents';
      case 'PACKAGE':
        return '/packages';
      case 'WITHDRAWAL_REQUEST':
        return '/profile';
      case 'ORDER_ITEM':
      case 'ORDER':
        return '/seller/sales';
      default:
        return null;
    }
  }

  async listMyNotifications(user: AuthUser, limit = 10) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Number(limit), 1), 30) : 10;
    const [items, unreadRows] = await Promise.all([
      this.prisma.$queryRaw<NotificationRow[]>`
        SELECT
          id AS notification_id,
          account_id,
          type::text AS type,
          title,
          message,
          reference_id,
          reference_type,
          is_read,
          created_at,
          CASE
            WHEN reference_type = 'DOCUMENT' THEN '/seller/documents'
            WHEN reference_type = 'PACKAGE' THEN '/packages'
            WHEN reference_type = 'WITHDRAWAL_REQUEST' THEN '/profile'
            WHEN reference_type IN ('ORDER', 'ORDER_ITEM') THEN '/seller/sales'
            ELSE NULL
          END AS link
        FROM notifications
        WHERE account_id = ${user.accountId}
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `,
      this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::bigint AS count
        FROM notifications
        WHERE account_id = ${user.accountId} AND is_read = false
      `,
    ]);

    return toJsonSafe({
      data: items,
      unreadCount: Number(unreadRows[0]?.count ?? 0),
    });
  }

  async markAsRead(user: AuthUser, notificationId: number) {
    const rows = await this.prisma.$queryRaw<Array<{ id: number; account_id: number }>>`
      SELECT id, account_id
      FROM notifications
      WHERE id = ${notificationId}
      LIMIT 1
    `;
    const notification = rows[0];

    if (!notification || notification.account_id !== user.accountId) {
      throw new NotFoundException('Không tìm thấy thông báo.');
    }

    const updatedRows = await this.prisma.$queryRaw<NotificationRow[]>`
      UPDATE notifications
      SET is_read = true
      WHERE id = ${notificationId}
      RETURNING
        id AS notification_id,
        account_id,
        type::text AS type,
        title,
        message,
        reference_id,
        reference_type,
        is_read,
        created_at,
        CASE
          WHEN reference_type = 'DOCUMENT' THEN '/seller/documents'
          WHEN reference_type = 'PACKAGE' THEN '/packages'
          WHEN reference_type = 'WITHDRAWAL_REQUEST' THEN '/profile'
          WHEN reference_type IN ('ORDER', 'ORDER_ITEM') THEN '/seller/sales'
          ELSE NULL
        END AS link
    `;

    return toJsonSafe(updatedRows[0]);
  }

  async markAllAsRead(user: AuthUser) {
    const updatedRows = await this.prisma.$queryRaw<Array<{ id: number }>>`
      UPDATE notifications
      SET is_read = true
      WHERE account_id = ${user.accountId} AND is_read = false
      RETURNING id
    `;

    return { updatedCount: updatedRows.length };
  }

  async createNotification(input: CreateNotificationInput) {
    const mappedType = this.mapType(input.type);
    const { referenceId, referenceType } = this.getReference(input);
    const link = this.buildLink(referenceType, referenceId, input.link);

    const rows = await this.prisma.$queryRaw<NotificationRow[]>`
      INSERT INTO notifications (account_id, type, title, message, reference_id, reference_type)
      VALUES (
        ${input.accountId},
        ${mappedType}::notification_type,
        ${input.title},
        ${input.message},
        ${referenceId},
        ${referenceType}
      )
      RETURNING
        id AS notification_id,
        account_id,
        type::text AS type,
        title,
        message,
        reference_id,
        reference_type,
        is_read,
        created_at,
        ${link}::text AS link
    `;

    return rows[0];
  }

  async createMany(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) {
      return { count: 0 };
    }

    await Promise.all(inputs.map((item) => this.createNotification(item)));
    return { count: inputs.length };
  }
}
