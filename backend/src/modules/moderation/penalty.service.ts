import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PenaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Áp dụng sanction phi tài chính cho hành vi tải file trùng lặp.
   * Mốc 3 lần: cảnh báo chính thức. Mốc 5 lần: khóa tài khoản và thu hồi session.
   */
  async evaluateUserViolations(customerId: number) {
    const profile = await this.prisma.customer_profiles.findUnique({
      where: { customer_id: customerId },
      include: { accounts: true }
    });

    if (!profile) return;

    const violationCount = await this.prisma.audit_logs.count({
      where: {
        account_id: profile.account_id,
        action: 'UPLOAD_VIOLATION'
      }
    });

    if (violationCount === 3) {
      await this.prisma.audit_logs.create({
        data: {
          account_id: profile.account_id,
          action: 'UPLOAD_WARNING',
          target_table: 'accounts',
          target_id: profile.account_id,
          old_value: { status: profile.accounts.status },
          new_value: { violationCount, sanction: 'MANUAL_REVIEW' }
        }
      });

      await this.notifications.notify({
        accountId: profile.account_id,
        type: 'SYSTEM',
        title: 'Cảnh báo vi phạm tải tài liệu',
        message:
          'Bạn đã có 3 lần tải tài liệu trùng lặp. Các lần vi phạm tiếp theo có thể khiến tài khoản bị khóa.',
        referenceId: profile.account_id,
        referenceType: 'ACCOUNT'
      });
      return;
    }

    if (violationCount >= 5 && profile.accounts.status !== 'BANNED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.accounts.update({
          where: { account_id: profile.account_id },
          data: { status: 'BANNED', banned_until: null }
        });
        await tx.user_sessions.updateMany({
          where: { account_id: profile.account_id, is_revoked: false },
          data: { is_revoked: true }
        });
        await tx.audit_logs.create({
          data: {
            account_id: profile.account_id,
            action: 'ACCOUNT_BANNED',
            target_table: 'accounts',
            target_id: profile.account_id,
            old_value: { status: profile.accounts.status },
            new_value: { status: 'BANNED', violationCount, reason: 'UPLOAD_VIOLATION' }
          }
        });
      });

      await this.notifications.notify({
        accountId: profile.account_id,
        type: 'ACCOUNT_BANNED',
        title: 'Tài khoản đã bị khóa',
        message: 'Tài khoản bị khóa do nhiều lần tải lên tài liệu trùng lặp.',
        referenceId: profile.account_id,
        referenceType: 'ACCOUNT'
      });
    }
  }
}
