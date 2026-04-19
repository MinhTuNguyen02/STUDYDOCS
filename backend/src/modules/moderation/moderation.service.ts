import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { report_status, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/security/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { CreateReportDto } from './dto/create-report.dto';
import { HandleReportDto } from './dto/handle-report.dto';
import { LedgerService } from '../wallets/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService
  ) { }

  async createReport(user: AuthUser, dto: CreateReportDto) {
    if (!user.customerId) throw new ForbiddenException('Tai khoan nay khong the tao report.');

    const documentId = Number(dto.documentId);
    const document = await this.prisma.documents.findUnique({ where: { document_id: documentId } });
    if (!document) throw new NotFoundException('Khong tim thay tai lieu.');

    const type = dto.type.toUpperCase();
    if (type === 'DISPUTE') {
      const order = await this.prisma.orders.findFirst({
        where: {
          buyer_id: user.customerId,
          status: 'PAID',
          order_items: {
            some: {
              document_id: documentId
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      if (!order) {
        throw new BadRequestException('Khong tim thay don hang de khieu nai.');
      }

      const deadline = new Date(order.created_at.getTime() + 48 * 60 * 60 * 1000);
      if (new Date() > deadline) {
        throw new BadRequestException('Qua thoi han khieu nai 48h.');
      }
    }

    const created = await this.prisma.reports.create({
      data: {
        customer_id: user.customerId!,
        document_id: documentId,
        type,
        reason: dto.reason,
        status: 'PENDING'
      }
    });

    // Notify staff: có report mới cần xử lý
    this.notifications.notifyStaffRoles(['admin', 'mod'], {
      type: 'REPORT_NEW',
      title: 'Báo cáo vi phạm mới',
      message: `Report mới #${created.report_id}: "${dto.reason}" cho tài liệu "${document.title}".`,
      referenceId: created.report_id,
      referenceType: 'REPORT'
    });

    return toJsonSafe(created);
  }

  async listReports() {
    const reports = await this.prisma.reports.findMany({
      include: {
        documents: {
          select: {
            document_id: true,
            title: true,
            status: true,
            seller_id: true
          }
        },
        customer_profiles: {
          select: {
            customer_id: true,
            full_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return toJsonSafe(reports);
  }

  async handleReport(actor: AuthUser, reportId: string, dto: HandleReportDto) {
    const id = Number(reportId);

    const report = await this.prisma.reports.findUnique({
      where: { report_id: id },
      include: { documents: true }
    });

    if (!report) throw new NotFoundException('Khong tim thay report.');

    const newStatus: report_status = dto.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reports.update({
        where: { report_id: id },
        data: {
          status: newStatus,
          staff_id: actor.staffId ? Number(actor.staffId) : undefined,
          updated_at: new Date()
        }
      });

      if (dto.action === 'DELETE_DOCUMENT') {
        await tx.documents.update({
          where: { document_id: report.document_id },
          data: {
            status: 'HIDDEN',
            delete_at: new Date()
          }
        });
      }

      if (dto.action === 'BAN_USER') {
        const sellerProfile = await tx.customer_profiles.findUnique({ where: { customer_id: report.documents.seller_id } });
        if (sellerProfile) {
          await tx.accounts.update({
            where: { account_id: sellerProfile.account_id },
            data: { status: 'BANNED' }
          });

          await tx.user_sessions.updateMany({
            where: { account_id: sellerProfile.account_id, is_revoked: false },
            data: { is_revoked: true }
          });
        }
      }

      if (dto.action === 'REFUND_DOCUMENT' && report.type === 'DISPUTE') {
        const orderItem = await tx.order_items.findFirst({
          where: {
            document_id: report.document_id,
            orders: { buyer_id: report.customer_id, status: 'PAID' },
            status: { in: ['HELD', 'RELEASED'] }
          },
          orderBy: { created_at: 'desc' }
        });

        if (orderItem) {
          const { systemRevenue } = await this.ledger.getSystemWallets(tx);

          // 1. Deduct from Seller
          if (orderItem.status === 'HELD') {
            await tx.wallets.update({
              where: { customer_id_wallet_type: { customer_id: orderItem.seller_id, wallet_type: 'REVENUE' } },
              data: { pending_balance: { decrement: orderItem.seller_earning } }
            });
          } else {
            await tx.wallets.update({
              where: { customer_id_wallet_type: { customer_id: orderItem.seller_id, wallet_type: 'REVENUE' } },
              data: { balance: { decrement: orderItem.seller_earning } }
            });
          }

          const sellerWallet = await tx.wallets.findUnique({
            where: { customer_id_wallet_type: { customer_id: orderItem.seller_id, wallet_type: 'REVENUE' } }
          });

          // 2. Deduct from SYSTEM_REVENUE
          await tx.wallets.update({
            where: { wallet_id: systemRevenue.wallet_id },
            data: { balance: { decrement: orderItem.commission_fee } }
          });

          // 3. Add to Buyer PAYMENT
          const buyerWallet = await tx.wallets.upsert({
            where: { customer_id_wallet_type: { customer_id: report.customer_id, wallet_type: 'PAYMENT' } },
            create: { customer_id: report.customer_id, wallet_type: 'PAYMENT', balance: orderItem.unit_price, pending_balance: 0 },
            update: { balance: { increment: orderItem.unit_price } }
          });

          // 4. Ledger Double Entry
          await this.ledger.recordTransaction(
            tx,
            'REFUND',
            'ORDER_ITEM',
            orderItem.order_item_id,
            'Hoan phan tien mua tai lieu do khieu nai',
            [
              { wallet_id: sellerWallet!.wallet_id, debit_amount: orderItem.seller_earning, credit_amount: 0 },
              { wallet_id: systemRevenue.wallet_id, debit_amount: orderItem.commission_fee, credit_amount: 0 },
              { wallet_id: buyerWallet.wallet_id, debit_amount: 0, credit_amount: orderItem.unit_price }
            ]
          );

          // 5. Update orderItem status
          await tx.order_items.update({
            where: { order_item_id: orderItem.order_item_id },
            data: { status: 'REFUNDED' }
          });
        }
      }

      await tx.audit_logs.create({
        data: {
          account_id: actor.accountId,
          action: 'REPORT_HANDLED',
          target_table: 'reports',
          target_id: report.report_id,
          old_value: { status: report.status },
          new_value: { status: newStatus, action: dto.action, note: dto.note ?? null }
        }
      });

      return updated;
    });

    // Notify reporter: Báo cáo đã được xử lý
    const reporterProfile = await this.prisma.customer_profiles.findUnique({
      where: { customer_id: report.customer_id },
      select: { account_id: true }
    });
    if (reporterProfile) {
      this.notifications.notify({
        accountId: reporterProfile.account_id,
        type: 'REPORT_HANDLED',
        title: 'Báo cáo đã được xử lý',
        message: `Báo cáo #${id} của bạn đã được quản trị viên xử lý.`,
        referenceId: id,
        referenceType: 'REPORT'
      });
    }

    return toJsonSafe(result);
  }
}
