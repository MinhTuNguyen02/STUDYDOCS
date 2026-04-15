import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/security/auth-user.interface';
import { hash } from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) { }

  private formatFileSize(bytes: number) {
    return `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB`;
  }

  private resolveRole(roleNames: string[], hasStaffProfile: boolean, hasCustomerProfile: boolean, _documentsCount: number) {
    const lowerRoles = roleNames.map(r => r.toLowerCase());
    if (lowerRoles.includes('admin')) return 'ADMIN';
    if (lowerRoles.includes('mod')) return 'MOD';
    if (lowerRoles.includes('accountant')) return 'ACCOUNTANT';
    if (hasStaffProfile) return 'STAFF'; // Fallback for valid staff without a specific mod/acc role
    return 'CUSTOMER';
  }

  async getDashboard(params?: { startDate?: string; endDate?: string }) {
    const now = new Date();

    let startOfDay, endOfDay;
    if (params?.startDate && params?.endDate) {
      startOfDay = new Date(params.startDate);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(params.endDate);
      endOfDay.setHours(23, 59, 59, 999);
    } else {
      // Default to last 7 days
      startOfDay = new Date(now);
      startOfDay.setDate(startOfDay.getDate() - 6);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
    }

    const [pendingApprovals, totalDocuments, payments, orders, documents] = await Promise.all([
      this.prisma.documents.count({ where: { status: 'PENDING' } }),
      this.prisma.documents.count(),
      this.prisma.payments.findMany({
        where: { status: 'COMPLETED', created_at: { gte: startOfDay, lte: endOfDay } },
        select: { amount: true, created_at: true }
      }),
      this.prisma.orders.findMany({
        where: { status: 'PAID', created_at: { gte: startOfDay, lte: endOfDay } },
        select: { created_at: true }
      }),
      this.prisma.documents.findMany({
        where: { created_at: { gte: startOfDay, lte: endOfDay } },
        select: { created_at: true }
      })
    ]);

    const revenueRange = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const ordersRange = orders.length;

    // Build chart data
    const chartMap = new Map<string, { date: string; revenue: number; orders: number; documents: number }>();
    let current = new Date(startOfDay);
    while (current <= endOfDay) {
      // format YYYY-MM-DD
      const dateStr = current.toISOString().split('T')[0];
      chartMap.set(dateStr, { date: dateStr, revenue: 0, orders: 0, documents: 0 });
      current.setDate(current.getDate() + 1);
    }

    payments.forEach(p => {
      if (!p.created_at) return;
      const dateStr = p.created_at.toISOString().split('T')[0];
      if (chartMap.has(dateStr)) chartMap.get(dateStr)!.revenue += Number(p.amount);
    });
    orders.forEach(o => {
      if (!o.created_at) return;
      const dateStr = o.created_at.toISOString().split('T')[0];
      if (chartMap.has(dateStr)) chartMap.get(dateStr)!.orders += 1;
    });
    documents.forEach(d => {
      const dateStr = d.created_at.toISOString().split('T')[0];
      if (chartMap.has(dateStr)) chartMap.get(dateStr)!.documents += 1;
    });

    const chartData = Array.from(chartMap.values());

    // Top Uploaders
    const topUploadersGroup = await this.prisma.documents.groupBy({
      by: ['seller_id'],
      _count: { document_id: true },
      where: { created_at: { gte: startOfDay, lte: endOfDay } },
      orderBy: { _count: { document_id: 'desc' } },
      take: 5
    });

    // Top Sellers by Quantity
    const topSellersGroup = await this.prisma.order_items.groupBy({
      by: ['seller_id'],
      _count: { order_item_id: true },
      where: { created_at: { gte: startOfDay, lte: endOfDay } },
      orderBy: { _count: { order_item_id: 'desc' } },
      take: 5
    });

    // Top Sellers by Revenue
    const topRevenueGroup = await this.prisma.order_items.groupBy({
      by: ['seller_id'],
      _sum: { seller_earning: true },
      where: { created_at: { gte: startOfDay, lte: endOfDay } },
      orderBy: { _sum: { seller_earning: 'desc' } },
      take: 5
    });

    // Fetch user profiles for the tops
    const sellerIds = new Set([
      ...topUploadersGroup.map(u => u.seller_id),
      ...topSellersGroup.map(s => s.seller_id),
      ...topRevenueGroup.map(r => r.seller_id)
    ]);
    const profiles = await this.prisma.customer_profiles.findMany({
      where: { customer_id: { in: Array.from(sellerIds) } },
      select: { customer_id: true, full_name: true }
    });
    const profileMap = new Map(profiles.map(p => [p.customer_id, p.full_name]));

    const topUploaders = topUploadersGroup.map(u => ({ id: u.seller_id, name: profileMap.get(u.seller_id), count: u._count.document_id }));
    const topSellers = topSellersGroup.map(s => ({ id: s.seller_id, name: profileMap.get(s.seller_id), count: s._count.order_item_id }));
    const topRevenueSellers = topRevenueGroup.map(r => ({ id: r.seller_id, name: profileMap.get(r.seller_id), revenue: Number(r._sum.seller_earning || 0) }));

    // Top Documents
    const topDocsOrderedGroup = await this.prisma.order_items.groupBy({
      by: ['document_id'],
      _count: { order_item_id: true },
      where: { created_at: { gte: startOfDay, lte: endOfDay } },
      orderBy: { _count: { order_item_id: 'desc' } },
      take: 5
    });
    const topDocsDownloadedGroup = await this.prisma.download_history.groupBy({
      by: ['document_id'],
      _count: { id: true },
      where: { download_at: { gte: startOfDay, lte: endOfDay } },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    const docIds = new Set([...topDocsOrderedGroup.map(d => d.document_id), ...topDocsDownloadedGroup.map(d => d.document_id)]);
    const docsMeta = await this.prisma.documents.findMany({
      where: { document_id: { in: Array.from(docIds) } },
      select: { document_id: true, title: true }
    });
    const docMap = new Map(docsMeta.map(d => [d.document_id, d.title]));

    const topBoughtDocs = topDocsOrderedGroup.map(d => ({ id: d.document_id, title: docMap.get(d.document_id), count: d._count.order_item_id }));
    const topDownloadedDocs = topDocsDownloadedGroup.map(d => ({ id: d.document_id, title: docMap.get(d.document_id), count: d._count.id }));

    return {
      pendingApprovals,
      totalDocuments,
      ordersRange,
      revenueRange,
      chartData,
      topUploaders,
      topSellers,
      topRevenueSellers,
      topBoughtDocs,
      topDownloadedDocs
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

    const mapped = await Promise.all(
      docs.map(async (doc) => {
        // ── Preview URL (30% watermarked, for buyers sample) ──
        let previewSignedUrl: string | null = null;
        const previewKey = doc.preview_url;
        if (previewKey && !previewKey.includes('placeholder')) {
          try {
            previewSignedUrl = await this.storageService.getPresignedUrl(previewKey, 3600);
          } catch { /* ignore */ }
        }

        // ── Review URL (100% full-page, light watermark — staff only) ──
        let reviewSignedUrl: string | null = null;
        const reviewKey = (doc as any).review_url;
        if (reviewKey) {
          try {
            reviewSignedUrl = await this.storageService.getPresignedUrl(reviewKey, 7200); // 2h TTL
          } catch { /* ignore */ }
        }

        return {
          id: doc.document_id,
          title: doc.title,
          sellerName: doc.customer_profiles.full_name,
          categoryName: doc.categories.name,
          price: doc.price,
          createdAt: doc.created_at,
          status: doc.status,
          tags: doc.document_tags.map((item) => item.tags.tag_name),
          description: doc.description,
          format: doc.file_extension.toUpperCase(),
          pageCount: doc.page_count,
          fileExtension: doc.file_extension,
          size: this.formatFileSize(doc.file_size ?? 0),
          previewSignedUrl,
          reviewSignedUrl  // Full-page signed URL for inline staff review (2h TTL, deleted after decision)
        };
      })
    );

    return toJsonSafe(mapped);
  }

  /**
   * Returns a presigned URL for the full original document file (60 min expiry).
   * We log this access for system audit purposes.
   */
  async getDocumentReviewUrl(documentId: string, actor: AuthUser) {
    const id = Number(documentId);
    const doc = await this.prisma.documents.findUnique({ where: { document_id: id } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    if (!doc.file_url) throw new NotFoundException('Tài liệu chưa có file được lưu.');

    // Generate a presigned URL valid for 60 minutes
    const reviewUrl = await this.storageService.getPresignedUrl(doc.file_url, 3600);

    // Audit log
    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'STAFF_REVIEW_DOCUMENT',
        target_table: 'documents',
        target_id: doc.document_id,
        old_value: {},
        new_value: {
          document_title: doc.title,
          reviewer: actor.email,
          reviewedAt: new Date().toISOString(),
          urlExpiry: '60 minutes'
        }
      }
    });

    return {
      reviewUrl,
      expiresInMinutes: 60,
      documentTitle: doc.title,
      fileExtension: doc.file_extension
    };
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

    // Delete review file from storage + clear DB field (non-fatal)
    const reviewKey = (existing as any).review_url;
    if (reviewKey) {
      await this.storageService.deleteFile(reviewKey);
      // Clear DB field after migration is applied (use raw SQL as Prisma type not yet regenerated)
      await this.prisma.$executeRaw`UPDATE documents SET review_url = NULL WHERE document_id = ${id}`;
    }

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

    // Delete review file from storage (non-fatal)
    const reviewKey = (existing as any).review_url;
    if (reviewKey) {
      await this.storageService.deleteFile(reviewKey);
      await this.prisma.$executeRaw`UPDATE documents SET review_url = NULL WHERE document_id = ${id}`;
    }

    return toJsonSafe(updated);
  }

  async getDocuments(filters: { status?: string; categoryId?: string; search?: string }) {
    const docs = await this.prisma.documents.findMany({
      where: {
        status: filters.status && filters.status !== 'ALL' ? (filters.status as any) : undefined,
        category_id: filters.categoryId && filters.categoryId !== 'ALL' ? Number(filters.categoryId) : undefined,
        OR: filters.search
          ? [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { slug: { contains: filters.search, mode: 'insensitive' } },
            {
              customer_profiles: {
                full_name: { contains: filters.search, mode: 'insensitive' }
              }
            }
          ]
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

  async getWithdrawals() {
    const reqs = await this.prisma.withdrawal_requests.findMany({
      include: {
        customer_profiles: {
          select: {
            full_name: true,
            account_id: true,
            accounts: {
              select: { email: true }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    return toJsonSafe(reqs);
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
        where: { seller_id: { in: customerIds }, status: 'APPROVED' }  // Only APPROVED docs
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

  async createStaffAccount(dto: { email: string; fullName: string; password: string; role: 'MOD' | 'ACCOUNTANT' }) {
    const existing = await this.prisma.accounts.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (existing) throw new ConflictException('Email đã được sử dụng.');

    const role = await this.prisma.roles.findFirst({ where: { name: { equals: dto.role, mode: 'insensitive' } } });
    if (!role) throw new NotFoundException(`Không tìm thấy role ${dto.role} trong hệ thống.`);

    const passwordHash = await hash(dto.password, 10);

    const account = await this.prisma.accounts.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        password_hash: passwordHash,
        status: 'ACTIVE',
        roles: { connect: { role_id: role.role_id } },
        staff_profiles: {
          create: { full_name: dto.fullName }
        }
      },
      include: { staff_profiles: true, roles: true }
    });

    return toJsonSafe({
      id: account.account_id,
      email: account.email,
      fullName: account.staff_profiles?.full_name,
      role: account.roles.name,
      status: account.status
    });
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

  // 24. Dashboard đối soát tiền vào (cổng) vs tiền ra (ví seller)
  // 22. Endpoint đối soát (reconciliation) cho Accountant
  async getReconciliation() {
    const gatewayPool = await this.prisma.wallets.findFirst({
      where: { wallet_type: 'GATEWAY_POOL' }
    });

    const systemRevenue = await this.prisma.wallets.findFirst({
      where: { wallet_type: 'SYSTEM_REVENUE' }
    });

    // Aggregate user balances only (exclude SYSTEM_REVENUE and GATEWAY_POOL)
    const userWalletsAgg = await this.prisma.wallets.aggregate({
      where: {
        wallet_type: { in: ['PAYMENT', 'REVENUE'] },
      },
      _sum: { balance: true, pending_balance: true }
    });

    const gatewayBalance = gatewayPool?.balance || new Prisma.Decimal(0);
    const systemBalance = systemRevenue?.balance || new Prisma.Decimal(0);
    const userBalance = (userWalletsAgg._sum.balance || new Prisma.Decimal(0)).plus(userWalletsAgg._sum.pending_balance || new Prisma.Decimal(0));

    // GATEWAY_POOL is the total fiat cash in the real bank account.
    // It should perfectly equal all user liabilities (User Balances + Pending) + accumulated platform earnings (System Revenue).
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

    const systemRevenueWallet = await this.prisma.wallets.findFirst({
      where: { wallet_type: 'SYSTEM_REVENUE' }
    });

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
