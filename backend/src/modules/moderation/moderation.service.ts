import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { report_status } from '@prisma/client';
import { AuthUser } from '../../common/security/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { CreateReportDto } from './dto/create-report.dto';
import { HandleReportDto } from './dto/handle-report.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) { }

  async createReport(user: AuthUser, dto: CreateReportDto) {
    if (!user.customerId) throw new ForbiddenException('Tai khoan nay khong the tao report.');

    const documentId = Number(dto.documentId);
    const document = await this.prisma.documents.findUnique({ where: { document_id: documentId } });
    if (!document) throw new NotFoundException('Khong tim thay tai lieu.');

    const type = dto.type.toUpperCase();

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
