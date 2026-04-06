import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/security/auth-user.interface';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private formatFileSize(bytes: number) {
    return `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB`;
  }

  private resolveRole(roleNames: string[], hasStaffProfile: boolean, hasCustomerProfile: boolean, _documentsCount: number) {
    // Chỉ có 4 roles: admin, mod, accountant, customer
    if (roleNames.includes('admin')) return 'admin';
    if (roleNames.includes('mod')) return 'mod';
    if (roleNames.includes('accountant')) return 'accountant';
    if (roleNames.includes('customer') || hasCustomerProfile) return 'customer';
    return 'customer';
  }

  async getDashboard() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [pendingApprovals, totalDocuments, ordersToday, revenueAgg] = await Promise.all([
      this.prisma.documents.count({ where: { status: 'PENDING' } }),
      this.prisma.documents.count(),
      this.prisma.orders.count({
        where: {
          created_at: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      }),
      this.prisma.payments.aggregate({
        _sum: { amount: true },
        where: {
          status: 'COMPLETED',
        }
      })
    ]);

    return {
      pendingApprovals,
      totalDocuments,
      ordersToday,
      revenueToday: Number((revenueAgg._sum as any).amount ?? 0)
    };
  }

  async getPendingDocuments() {
    const docs = await this.prisma.documents.findMany({
      where: { status: 'PENDING' },
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        customer_profiles: true,
        categories: true,
        document_tags: {
          include: { tags: true }
        }
      }
    });

    return toJsonSafe(
      docs.map((doc) => ({
        id: doc.document_id,
        title: doc.title,
        sellerName: doc.customer_profiles.full_name,
        categoryName: doc.categories.name,
        price: doc.price,
        submittedAt: doc.created_at,
        status: doc.status,
        tags: doc.document_tags.map((item) => item.tags.tag_name),
        description: doc.description,
        format: doc.file_extension.toUpperCase(),
        size: this.formatFileSize(doc.file_size ?? 0)
      }))
    );
  }

  async approveDocument(documentId: string, actor: AuthUser) {
    const id = Number(documentId);
    const existing = await this.prisma.documents.findUnique({ where: { document_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài liệu.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.documents.update({
        where: { document_id: id },
        data: {
          status: 'APPROVED',
          rejection_reason: null,
          published_at: new Date(),
          // approved_by_staff_id: actor.staffId
        }
      });

      await tx.audit_logs.create({
        data: {
          account_id: actor.accountId,
          action: 'APPROVE_DOCUMENT',
          target_table: 'documents',
          target_id: doc.document_id,
          old_value: { status: existing.status },
          new_value: { status: 'APPROVED' }
        }
      });

      return doc;
    });

    return toJsonSafe(updated);
  }

  async rejectDocument(documentId: string, dto: RejectDocumentDto, actor: AuthUser) {
    const id = Number(documentId);
    const existing = await this.prisma.documents.findUnique({ where: { document_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài liệu.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.documents.update({
        where: { document_id: id },
        data: {
          status: 'REJECTED',
          rejection_reason: dto.reason ?? 'Không đạt tiêu chuẩn kiểm duyệt.',
          // approved_by_staff_id: actor.staffId
        }
      });

      await tx.audit_logs.create({
        data: {
          account_id: actor.accountId,
          action: 'REJECT_DOCUMENT',
          target_table: 'documents',
          target_id: doc.document_id,
          old_value: { status: existing.status },
          new_value: { status: 'REJECTED', reason: doc.rejection_reason }
        }
      });

      return doc;
    });

    return toJsonSafe(updated);
  }

  async getDocuments(filters: { status?: string; categoryId?: string; search?: string }) {
    const docs = await this.prisma.documents.findMany({
      where: {
        status: filters.status && filters.status !== 'ALL' ? (filters.status as any) : undefined,
        category_id: filters.categoryId && filters.categoryId !== 'ALL' ? Number(filters.categoryId) : undefined,
        OR: filters.search
          ? [{ title: { contains: filters.search, mode: 'insensitive' } }, { slug: { contains: filters.search, mode: 'insensitive' } }]
          : undefined
      },
      orderBy: { created_at: 'desc' },
      include: {
        customer_profiles: true,
        categories: true,
        document_tags: {
          include: { tags: true }
        }
      }
    });

    return toJsonSafe(
      docs.map((doc) => ({
        id: doc.document_id,
        title: doc.title,
        sellerName: doc.customer_profiles.full_name,
        categoryName: doc.categories.name,
        status: doc.status,
        price: doc.price,
        createdAt: doc.created_at,
        description: doc.description,
        format: doc.file_extension.toUpperCase(),
        pages: doc.page_count,
        size: this.formatFileSize(doc.file_size ?? 0),
        tags: doc.document_tags.map((item) => item.tags.tag_name),
        rejectionReason: doc.rejection_reason
      }))
    );
  }

  async softDeleteDocument(documentId: string, _actor: AuthUser) {
    const id = Number(documentId);
    const existing = await this.prisma.documents.findUnique({ where: { document_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài liệu.');

    const updated = await this.prisma.documents.update({
      where: { document_id: id },
      data: { status: 'HIDDEN', delete_at: new Date() }
    });

    return toJsonSafe(updated);
  }

  async restoreDocument(documentId: string, _actor: AuthUser) {
    const id = Number(documentId);
    const existing = await this.prisma.documents.findUnique({ where: { document_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài liệu.');

    const updated = await this.prisma.documents.update({
      where: { document_id: id },
      data: { status: 'APPROVED', delete_at: null }
    });

    return toJsonSafe(updated);
  }

  async getUsers(search?: string) {
    const users = await this.prisma.accounts.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { customer_profiles: { full_name: { contains: search, mode: 'insensitive' } } },
              { staff_profiles: { full_name: { contains: search, mode: 'insensitive' } } }
            ]
          }
        : undefined,
      include: {
        customer_profiles: true,
        staff_profiles: true,
        roles: true
      },
      orderBy: { created_at: 'desc' }
    });

    const customerIds = users
      .filter((user) => user.customer_profiles)
      .map((user) => user.customer_profiles!.customer_id);

    const [documentCountRows, salesCountRows] = await Promise.all([
      this.prisma.documents.groupBy({
        by: ['seller_id'],
        _count: { _all: true },
        where: { seller_id: { in: customerIds } }
      }),
      this.prisma.order_items.groupBy({
        by: ['seller_id'],
        _count: { _all: true },
        where: { seller_id: { in: customerIds } }
      })
    ]);

    const documentCounts = new Map(documentCountRows.map((row) => [row.seller_id.toString(), row._count._all]));
    const salesCounts = new Map(salesCountRows.map((row) => [row.seller_id.toString(), row._count._all]));

    return toJsonSafe(
      users.map((user) => {
        const customerId = user.customer_profiles?.customer_id.toString();
        const documentsCount = customerId ? (documentCounts.get(customerId) ?? 0) : 0;
        const totalSales = customerId ? (salesCounts.get(customerId) ?? 0) : 0;
        const role = this.resolveRole(
          user.roles ? [user.roles.name] : [],
          Boolean(user.staff_profiles),
          Boolean(user.customer_profiles),
          documentsCount
        );

        return {
          id: user.account_id,
          fullName: user.customer_profiles?.full_name ?? user.staff_profiles?.full_name ?? user.email,
          email: user.email,
          accountStatus: user.status,
          isActive: user.status === 'ACTIVE',
          joinedAt: user.created_at,
          role,
          documentsCount,
          totalSales
        };
      })
    );
  }

  async toggleUserActive(userId: string, _actor: AuthUser) {
    const account = await this.prisma.accounts.findUnique({
      where: { account_id: Number(userId) }
    });
    if (!account) throw new NotFoundException('Không tìm thấy người dùng.');

    const nextStatus = account.status === 'BANNED' ? 'ACTIVE' : 'BANNED';
    const updated = await this.prisma.accounts.update({
      where: { account_id: account.account_id },
      data: { status: nextStatus }
    });
    await this.prisma.user_sessions.updateMany({
      where: { account_id: account.account_id, is_revoked: false },
      data: { is_revoked: true }
    });

    return toJsonSafe(updated);
  }

  async getCategories(search?: string) {
    const categories = await this.prisma.categories.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { documents: true } }
      }
    });

    return toJsonSafe(
      categories.map((item) => ({
        id: item.category_id,
        name: item.name,
        slug: item.slug,
        documentsCount: item._count.documents
      }))
    );
  }

  async createCategory(dto: CreateCategoryDto) {
    try {
      const created = await this.prisma.categories.create({
        data: {
          name: dto.name,
          slug: dto.slug
        }
      });
      return toJsonSafe(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Slug danh mục đã tồn tại.');
      }
      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    try {
      const updated = await this.prisma.categories.update({
        where: { category_id: Number(id) },
        data: {
          name: dto.name,
          slug: dto.slug
        }
      });
      return toJsonSafe(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Slug danh mục đã tồn tại.');
      }
      throw error;
    }
  }

  async deleteCategory(id: string) {
    const deleted = await this.prisma.categories.delete({
      where: { category_id: Number(id) }
    });
    return toJsonSafe(deleted);
  }

  async getTags(search?: string) {
    const tags = await this.prisma.tags.findMany({
      where: search ? { tag_name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { tag_name: 'asc' },
      include: {
        _count: { select: { document_tags: true } }
      }
    });

    return toJsonSafe(
      tags.map((tag) => ({
        id: tag.tag_id,
        name: tag.tag_name,
        slug: tag.slug,
        usageCount: tag._count.document_tags
      }))
    );
  }

  async createTag(dto: CreateTagDto) {
    try {
      const created = await this.prisma.tags.create({
        data: {
          tag_name: dto.name,
          slug: dto.slug
        }
      });
      return toJsonSafe(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Slug hoặc tên thẻ đã tồn tại.');
      }
      throw error;
    }
  }

  async updateTag(id: string, dto: UpdateTagDto) {
    try {
      const updated = await this.prisma.tags.update({
        where: { tag_id: Number(id) },
        data: {
          tag_name: dto.name,
          slug: dto.slug
        }
      });
      return toJsonSafe(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Slug hoặc tên thẻ đã tồn tại.');
      }
      throw error;
    }
  }

  async deleteTag(id: string) {
    const deleted = await this.prisma.tags.delete({
      where: { tag_id: Number(id) }
    });
    return toJsonSafe(deleted);
  }

  // 24. Dashboard đối soát tiền vào (cổng) vs tiền ra (ví seller)
  // 22. Endpoint đối soát (reconciliation) cho Accountant
  async getReconciliation() {
    const systemCustomer = await this.prisma.accounts.findUnique({
      where: { email: 'system@studydocs.vn' },
      include: { customer_profiles: { include: { wallets: true } } }
    });

    const wallets = systemCustomer?.customer_profiles?.wallets || [];
    const gatewayPool = wallets.find((w: any) => w.wallet_type === 'PAYMENT');
    const systemRevenue = wallets.find((w: any) => w.wallet_type === 'REVENUE');

    const systemCustomerId = systemCustomer?.customer_profiles?.customer_id;

    // Aggregate user balances only (exclude the system account)
    const userWalletsAgg = await this.prisma.wallets.aggregate({
      where: { 
        wallet_type: { in: ['PAYMENT', 'REVENUE'] },
        customer_id: { not: systemCustomerId }
      },
      _sum: { balance: true }
    });

    const gatewayBalance = gatewayPool?.balance || new Prisma.Decimal(0);
    const systemBalance = systemRevenue?.balance || new Prisma.Decimal(0);
    const userBalance = userWalletsAgg._sum.balance || new Prisma.Decimal(0);

    // GATEWAY_POOL is the total fiat cash in the real bank account.
    // It should perfectly equal all user liabilities (User Balances) + accumulated platform earnings (System Revenue).
    const discrepancy = gatewayBalance.minus(userBalance).minus(systemBalance);

    return toJsonSafe({
      timestamp: new Date().toISOString(),
      report: {
        totalFiatInBank_GATEWAY_POOL: gatewayBalance,
        totalLiabilities_USER_WALLETS: userBalance,
        totalEquity_SYSTEM_REVENUE: systemBalance,
        accountingEquation: 'GATEWAY_POOL = USER_WALLETS + SYSTEM_REVENUE',
        discrepancy: discrepancy,
        isSystemSolvent: discrepancy.greaterThanOrEqualTo(0),
        isDoubleEntryMatched: discrepancy.equals(0)
      }
    });
  }

  async getAuditLogs(userId?: string, action?: string, limit: number = 50) {
    return this.prisma.audit_logs.findMany({
      where: {
        account_id: userId ? Number(userId) : undefined,
        action: action ? action : undefined
      },
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      include: {
        accounts: { select: { email: true } }
      }
    });
  }

  async exportRevenueReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const systemCustomer = await this.prisma.accounts.findUnique({
      where: { email: 'system@studydocs.vn' },
      include: { customer_profiles: { include: { wallets: true } } }
    });

    const systemRevenueWallet = systemCustomer?.customer_profiles?.wallets?.find(w => w.wallet_type === 'REVENUE');

    if (!systemRevenueWallet) return [];

    return this.prisma.ledger_entries.findMany({
        where: {
            wallet_id: systemRevenueWallet.wallet_id,
            created_at: { gte: start, lte: end }
        },
        include: { ledger_transactions: true },
        orderBy: { created_at: 'asc' }
    });
  }
}
