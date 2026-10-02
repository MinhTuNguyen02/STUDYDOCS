import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import { report_status } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';
import { ReportListQueryDto } from './dto/report-list-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async createReport(user: AuthUser, dto: { documentId: number; type: string; reason: string }) {
    if (!user.customerId) throw new ForbiddenException('Chỉ khách hàng mới có quyền báo cáo.');

    const doc = await this.prisma.documents.findUnique({ where: { document_id: dto.documentId } });
    if (!doc || doc.delete_at || doc.status !== 'APPROVED') {
      throw new NotFoundException('Không tìm thấy tài liệu.');
    }
    if (doc.seller_id === user.customerId) {
      throw new BadRequestException('Không thể báo cáo tài liệu của chính bạn.');
    }

    const duplicate = await this.prisma.reports.findFirst({
      where: {
        customer_id: user.customerId,
        document_id: dto.documentId,
        type: dto.type,
        status: { in: ['PENDING', 'REVIEWING'] }
      }
    });
    if (duplicate) {
      throw new BadRequestException('Báo cáo tương tự của bạn đang được xử lý.');
    }

    const report = await this.prisma.reports.create({
      data: {
        customer_id: user.customerId,
        document_id: dto.documentId,
        type: dto.type,
        reason: dto.reason,
        status: 'PENDING'
      }
    });

    // Notify staff: có report mới cần xử lý
    void this.notifications
      .notifyStaffRoles(['admin', 'mod'], {
        type: 'REPORT_NEW',
        title: 'Báo cáo vi phạm mới',
        message: `Report mới #${report.report_id}: "${dto.reason}" cho tài liệu "${doc.title}".`,
        referenceId: report.report_id,
        referenceType: 'REPORT'
      })
      .catch(() => undefined);

    return { message: 'Đã gửi báo cáo vi phạm thành công.', report };
  }

  async resolveReport(user: AuthUser, reportId: number, status: report_status) {
    if (!user.staffId) throw new ForbiddenException('Bạn không phải là Mod/Admin.');

    const report = await this.prisma.reports.findUnique({ where: { report_id: reportId } });
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo này.');

    // Validate status transition lifecycle
    const validTransitions: Record<string, string[]> = {
      PENDING: ['REVIEWING', 'RESOLVED', 'REJECTED'],
      REVIEWING: ['RESOLVED', 'REJECTED'],
      RESOLVED: [],
      REJECTED: []
    };

    const allowed = validTransitions[report.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Không thể chuyển từ trạng thái ${report.status} sang ${status}.`
      );
    }

    const updated = await this.prisma.reports.update({
      where: { report_id: reportId },
      data: {
        status: status,
        staff_id: user.staffId,
        updated_at: new Date()
      }
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: user.accountId,
        action: 'STAFF_RESOLVE_REPORT',
        target_table: 'reports',
        target_id: reportId,
        old_value: { status: report.status },
        new_value: { status: updated.status }
      }
    });

    // Notify user: report has been handled
    const customerAccount = await this.prisma.customer_profiles.findUnique({
      where: { customer_id: report.customer_id },
      select: { account_id: true }
    });

    if (customerAccount) {
      void this.notifications
        .notify({
          accountId: customerAccount.account_id,
          type: 'REPORT_HANDLED',
          title: 'Báo cáo đã được xử lý',
          message: `Báo cáo vi phạm #${reportId} của bạn đã được quản trị viên xử lý.`,
          referenceId: reportId,
          referenceType: 'REPORT'
        })
        .catch(() => undefined);
    }

    return { message: `Đã xử lý báo cáo thành công với trạng thái: ${status}`, data: updated };
  }

  async listReports(query: ReportListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.reportsWhereInput = {
      status: query.status && query.status !== 'ALL' ? query.status : undefined,
      OR: query.search
        ? [
            { reason: { contains: query.search, mode: 'insensitive' } },
            { type: { contains: query.search, mode: 'insensitive' } },
            { documents: { title: { contains: query.search, mode: 'insensitive' } } },
            {
              customer_profiles: {
                accounts: { email: { contains: query.search, mode: 'insensitive' } }
              }
            }
          ]
        : undefined
    };
    const [total, reports] = await Promise.all([
      this.prisma.reports.count({ where }),
      this.prisma.reports.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ created_at: 'desc' }, { report_id: 'desc' }],
        include: {
          documents: { select: { title: true } },
          customer_profiles: {
            select: {
              full_name: true,
              accounts: { select: { email: true } }
            }
          }
        }
      })
    ]);
    return { meta: { page, limit, total }, data: reports };
  }
}
