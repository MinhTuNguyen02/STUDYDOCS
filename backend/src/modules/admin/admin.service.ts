import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../wallets/ledger.service';
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
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly ledger: LedgerService,
    private readonly notificationsService: NotificationsService
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

    // ── Parse startDate/endDate as VN local time (UTC+7) ────────────────────
    // Client sends "YYYY-MM-DD" strings representing VN local dates.
    // Parsing with new Date("YYYY-MM-DD") gives midnight UTC → 7:00 VN = wrong boundary.
    // We add 7h offset manually so the boundary aligns with VN midnight.
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

    let startOfDay: Date, endOfDay: Date;
    if (params?.startDate && params?.endDate) {
      // Parse as VN midnight: "YYYY-MM-DD" → midnight UTC+7
      startOfDay = new Date(new Date(params.startDate).getTime() + VN_OFFSET_MS);
      startOfDay.setUTCHours(0, 0, 0, 0);
      // Subtract back to get UTC equivalent of VN 00:00
      startOfDay = new Date(startOfDay.getTime() - VN_OFFSET_MS);

      endOfDay = new Date(new Date(params.endDate).getTime() + VN_OFFSET_MS);
      endOfDay.setUTCHours(23, 59, 59, 999);
      endOfDay = new Date(endOfDay.getTime() - VN_OFFSET_MS);
    } else {
      startOfDay = new Date(now);
      startOfDay.setDate(startOfDay.getDate() - 6);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
    }

    // Helper: get VN local date string "YYYY-MM-DD" from a UTC Date
    const toVNDateKey = (d: Date) => {
      const vnDate = new Date(d.getTime() + VN_OFFSET_MS);
      const y = vnDate.getUTCFullYear();
      const m = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(vnDate.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const [pendingApprovals, totalDocuments, payments, orders, documents, commissionItems, packageSales, refundedItems] = await Promise.all([
      this.prisma.documents.count({ where: { status: 'PENDING' } }),
      // Only count publicly visible APPROVED documents
      this.prisma.documents.count({ where: { status: 'APPROVED' } }),
      // Nạp tiền vào ví
      this.prisma.payments.findMany({
        where: { status: 'COMPLETED', created_at: { gte: startOfDay, lte: endOfDay } },
        select: { amount: true, created_at: true }
      }),
      // Đơn hàng thành công (PAID), không tính REFUNDED
      this.prisma.orders.findMany({
        where: {
          status: 'PAID',
          created_at: { gte: startOfDay, lte: endOfDay },
          order_items: { none: { status: 'REFUNDED' } }
        },
        select: { created_at: true }
      }),
      this.prisma.documents.findMany({
        where: { created_at: { gte: startOfDay, lte: endOfDay } },
        select: { created_at: true }
      }),
      // Doanh thu hoa hồng từ bán tài liệu (commission_fee)
      this.prisma.order_items.findMany({
        where: {
          status: { in: ['HELD', 'RELEASED'] },
          created_at: { gte: startOfDay, lte: endOfDay }
        },
        select: { commission_fee: true, created_at: true }
      }),
      // Doanh thu từ bán package (join với packages để lấy giá)
      this.prisma.user_packages.findMany({
        where: { purchased_at: { gte: startOfDay, lte: endOfDay } },
        select: { purchased_at: true, packages: { select: { price: true, package_id: true, name: true } } }
      }),
      // Giao dịch bị hoàn tiền (per-day data for chart toggle)
      this.prisma.order_items.findMany({
        where: {
          status: 'REFUNDED',
          updated_at: { gte: startOfDay, lte: endOfDay }
        },
        select: { updated_at: true }
      })
    ]);

    const depositRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const commissionRevenue = commissionItems.reduce((sum, p) => sum + Number(p.commission_fee ?? 0), 0);
    const pkgRevenue = packageSales.reduce((sum, p) => sum + Number(p.packages?.price ?? 0), 0);
    // Platform total revenue = deposits + commissions + package sales
    const revenueRange = depositRevenue + commissionRevenue + pkgRevenue;
    const ordersRange = orders.length;

    // ── Build chart data keyed by VN local date ──────────────────────────────
    const chartMap = new Map<string, {
      date: string;
      revenue: number;         // total (all sources)
      depositRevenue: number;  // nạp ví
      commissionRevenue: number; // hoa hồng tài liệu
      packageRevenue: number;  // bán gói
      orders: number;
      refunded: number;
      documents: number;
    }>();
    let current = new Date(startOfDay);
    while (current <= endOfDay) {
      const dateKey = toVNDateKey(current);
      if (!chartMap.has(dateKey)) {
        chartMap.set(dateKey, { date: dateKey, revenue: 0, depositRevenue: 0, commissionRevenue: 0, packageRevenue: 0, orders: 0, refunded: 0, documents: 0 });
      }
      current.setDate(current.getDate() + 1);
    }

    payments.forEach(p => {
      if (!p.created_at) return;
      const key = toVNDateKey(p.created_at);
      if (chartMap.has(key)) {
        const entry = chartMap.get(key)!;
        const amt = Number(p.amount);
        entry.depositRevenue += amt;
        entry.revenue += amt;
      }
    });
    commissionItems.forEach(p => {
      if (!p.created_at) return;
      const key = toVNDateKey(p.created_at);
      if (chartMap.has(key)) {
        const entry = chartMap.get(key)!;
        const amt = Number(p.commission_fee ?? 0);
        entry.commissionRevenue += amt;
        entry.revenue += amt;
      }
    });
    packageSales.forEach(p => {
      const key = toVNDateKey(p.purchased_at);
      if (chartMap.has(key)) {
        const entry = chartMap.get(key)!;
        const amt = Number(p.packages?.price ?? 0);
        entry.packageRevenue += amt;
        entry.revenue += amt;
      }
    });
    orders.forEach(o => {
      if (!o.created_at) return;
      const key = toVNDateKey(o.created_at);
      if (chartMap.has(key)) chartMap.get(key)!.orders += 1;
    });
    refundedItems.forEach(r => {
      if (!r.updated_at) return;
      const key = toVNDateKey(r.updated_at);
      if (chartMap.has(key)) chartMap.get(key)!.refunded += 1;
    });
    documents.forEach(d => {
      const key = toVNDateKey(d.created_at);
      if (chartMap.has(key)) chartMap.get(key)!.documents += 1;
    });

    const chartData = Array.from(chartMap.values());

    // ── Top Packages by purchase count ───────────────────────────────────────
    const topPackagesGroup = await this.prisma.user_packages.groupBy({
      by: ['package_id'],
      _count: { user_package_id: true },
      where: { purchased_at: { gte: startOfDay, lte: endOfDay } },
      orderBy: { _count: { user_package_id: 'desc' } },
      take: 5
    });
    const pkgIds = topPackagesGroup.map(p => p.package_id);
    const pkgMeta = await this.prisma.packages.findMany({
      where: { package_id: { in: pkgIds } },
      select: { package_id: true, name: true, price: true }
    });
    const pkgMetaMap = new Map(pkgMeta.map(p => [p.package_id, p]));
    const topPackages = topPackagesGroup.map(p => ({
      id: p.package_id,
      name: pkgMetaMap.get(p.package_id)?.name ?? 'Gói không xác định',
      price: Number(pkgMetaMap.get(p.package_id)?.price ?? 0),
      count: p._count.user_package_id
    }));

    // Top Uploaders (chỉ tính file đã APPROVED)
    const topUploadersGroup = await this.prisma.documents.groupBy({
      by: ['seller_id'],
      _count: { document_id: true },
      where: { created_at: { gte: startOfDay, lte: endOfDay }, status: 'APPROVED' },
      orderBy: { _count: { document_id: 'desc' } },
      take: 5
    });

    // Top Sellers by Quantity (exclude REFUNDED)
    const topSellersGroup = await this.prisma.order_items.groupBy({
      by: ['seller_id'],
      _count: { order_item_id: true },
      where: {
        created_at: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PAID', 'HELD', 'RELEASED'] }
      },
      orderBy: { _count: { order_item_id: 'desc' } },
      take: 5
    });

    // Top Sellers by Revenue (exclude REFUNDED)
    const topRevenueGroup = await this.prisma.order_items.groupBy({
      by: ['seller_id'],
      _sum: { seller_earning: true },
      where: {
        created_at: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PAID', 'HELD', 'RELEASED'] }
      },
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

    // Top Buyers by order count (exclude orders where all items are REFUNDED)
    const topBuyersGroup = await this.prisma.orders.groupBy({
      by: ['buyer_id'],
      _count: { order_id: true },
      _sum: { total_amount: true },
      where: {
        status: 'PAID',
        created_at: { gte: startOfDay, lte: endOfDay },
        order_items: { none: { status: 'REFUNDED' } }
      },
      orderBy: { _count: { order_id: 'desc' } },
      take: 5
    });
    const buyerIds = topBuyersGroup.map(b => b.buyer_id);
    const buyerProfiles = await this.prisma.customer_profiles.findMany({
      where: { customer_id: { in: buyerIds } },
      select: { customer_id: true, full_name: true }
    });
    const buyerProfileMap = new Map(buyerProfiles.map(p => [p.customer_id, p.full_name]));
    const topBuyers = topBuyersGroup.map(b => ({
      id: b.buyer_id,
      name: buyerProfileMap.get(b.buyer_id),
      count: b._count.order_id,
      totalSpent: Number(b._sum.total_amount || 0)
    }));

    // Top Documents by purchase count (exclude REFUNDED)
    const topDocsOrderedGroup = await this.prisma.order_items.groupBy({
      by: ['document_id'],
      _count: { order_item_id: true },
      where: {
        created_at: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PAID', 'HELD', 'RELEASED'] }
      },
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
      revenueBreakdown: {
        deposit: depositRevenue,
        commission: commissionRevenue,
        package: pkgRevenue
      },
      chartData,
      topUploaders,
      topSellers,
      topRevenueSellers,
      topBuyers,
      topBoughtDocs,
      topDownloadedDocs,
      topPackages
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
    const existing = await this.prisma.documents.findUnique({
      where: { document_id: id },
      include: {
        customer_profiles: {
          select: { account_id: true }
        }
      }
    });
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

    await this.notificationsService.createNotification({
      accountId: existing.customer_profiles.account_id,
      type: 'DOCUMENT_APPROVED',
      title: 'Tài liệu đã được duyệt',
      message: `Tài liệu "${existing.title}" của bạn đã được duyệt và đang hiển thị trên StudyDocs.`,
      link: '/seller/documents',
      metadata: { documentId: updated.document_id }
    });

    return toJsonSafe(updated);
  }

  async rejectDocument(documentId: string, dto: RejectDocumentDto, actor: AuthUser) {
    const id = Number(documentId);
    const existing = await this.prisma.documents.findUnique({
      where: { document_id: id },
      include: {
        customer_profiles: {
          select: { account_id: true }
        }
      }
    });
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

    await this.notificationsService.createNotification({
      accountId: existing.customer_profiles.account_id,
      type: 'DOCUMENT_REJECTED',
      title: 'Tài liệu chưa được duyệt',
      message: `Tài liệu "${existing.title}" chưa được duyệt. Lý do: ${dto.reason ?? 'Không đạt tiêu chuẩn kiểm duyệt.'}`,
      link: '/seller/documents',
      metadata: { documentId: updated.document_id }
    });

    return toJsonSafe(updated);
  }

  async getDocuments(filters: { status?: string; categoryId?: string; search?: string }) {
    let categoryIds: number[] | undefined = undefined;
    if (filters.categoryId && filters.categoryId !== 'ALL') {
      const rootId = Number(filters.categoryId);
      const childCategories = await this.prisma.categories.findMany({
        where: { OR: [{ category_id: rootId }, { parent_id: rootId }] },
        select: { category_id: true }
      });
      categoryIds = childCategories.map(c => c.category_id);
    }

    const docs = await this.prisma.documents.findMany({
      where: {
        status: filters.status && filters.status !== 'ALL' ? (filters.status as any) : undefined,
        category_id: categoryIds ? { in: categoryIds } : undefined,
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

    await this.prisma.audit_logs.create({
      data: {
        account_id: _actor.accountId,
        action: 'STAFF_SOFT_DELETE_DOCUMENT',
        target_table: 'documents',
        target_id: id,
        new_value: { status: 'HIDDEN' }
      }
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

    await this.prisma.audit_logs.create({
      data: {
        account_id: _actor.accountId,
        action: 'STAFF_RESTORE_DOCUMENT',
        target_table: 'documents',
        target_id: id,
        new_value: { status: 'APPROVED' }
      }
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

    await this.prisma.audit_logs.create({
      data: {
        account_id: _actor.accountId,
        action: 'STAFF_TOGGLE_USER_STATUS',
        target_table: 'accounts',
        target_id: account.account_id,
        old_value: { status: account.status },
        new_value: { status: nextStatus }
      }
    });

    return toJsonSafe(updated);
  }

  async createStaffAccount(dto: { email: string; fullName: string; password: string; role: 'MOD' | 'ACCOUNTANT' }, _actor: AuthUser) {
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

    await this.prisma.audit_logs.create({
      data: {
        account_id: _actor.accountId,
        action: 'ADMIN_CREATE_STAFF',
        target_table: 'accounts',
        target_id: account.account_id,
        new_value: { email: account.email, role: account.roles.name }
      }
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

    const taxPayable = await this.prisma.wallets.findFirst({
      where: { wallet_type: 'TAX_PAYABLE' }
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
    const taxBalance = taxPayable?.balance || new Prisma.Decimal(0);
    const userBalance = (userWalletsAgg._sum.balance || new Prisma.Decimal(0)).plus(userWalletsAgg._sum.pending_balance || new Prisma.Decimal(0));

    // GATEWAY_POOL is the total fiat cash in the real bank account.
    // It should perfectly equal all user liabilities (User Balances + Pending) + platform earnings (System) + tax obligations (Tax)
    const discrepancy = gatewayBalance.minus(userBalance).minus(systemBalance).minus(taxBalance);

    return toJsonSafe({
      timestamp: new Date().toISOString(),
      report: {
        totalFiatInBank_GATEWAY_POOL: gatewayBalance,
        totalLiabilities_USER_WALLETS: userBalance,
        totalLiabilities_TAX_PAYABLE: taxBalance,
        totalEquity_SYSTEM_REVENUE: systemBalance,
        accountingEquation: 'GATEWAY_POOL = USER_WALLETS + SYSTEM_REVENUE + TAX_PAYABLE',
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

  async getGatewayWalletReport(startDate: string, endDate: string) {
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const start = new Date(new Date(startDate + 'T00:00:00+07:00').getTime());
    const end = new Date(new Date(endDate + 'T23:59:59+07:00').getTime());

    const gatewayWallet = await this.prisma.wallets.findFirst({
      where: { wallet_type: 'GATEWAY_POOL' }
    });

    if (!gatewayWallet) return { wallet: null, entries: [], summary: null };

    const entries = await this.prisma.ledger_entries.findMany({
      where: {
        wallet_id: gatewayWallet.wallet_id,
        created_at: { gte: start, lte: end }
      },
      include: { ledger_transactions: true },
      orderBy: { created_at: 'desc' }
    });

    // GATEWAY_POOL is an Asset account: DEBIT = increase (In), CREDIT = decrease (Out)
    const totalIn = entries.reduce((sum, e) => sum + Number(e.debit_amount), 0);
    const totalOut = entries.reduce((sum, e) => sum + Number(e.credit_amount), 0);

    return toJsonSafe({
      wallet: {
        wallet_id: gatewayWallet.wallet_id,
        balance: gatewayWallet.balance,
        pending_balance: gatewayWallet.pending_balance
      },
      summary: { totalIn, totalOut, netFlow: totalIn - totalOut, entryCount: entries.length },
      entries
    });
  }

  async getTaxWalletReport(startDate: string, endDate: string) {
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const start = new Date(new Date(startDate + 'T00:00:00+07:00').getTime());
    const end = new Date(new Date(endDate + 'T23:59:59+07:00').getTime());

    const taxWallet = await this.prisma.wallets.findFirst({
      where: { wallet_type: 'TAX_PAYABLE' }
    });

    if (!taxWallet) return { wallet: null, entries: [], summary: null };

    const entries = await this.prisma.ledger_entries.findMany({
      where: {
        wallet_id: taxWallet.wallet_id,
        created_at: { gte: start, lte: end }
      },
      include: { ledger_transactions: true },
      orderBy: { created_at: 'desc' }
    });

    // TAX_PAYABLE is a Liability account: CREDIT = increase (Thu hộ), DEBIT = decrease (Nộp thuế HOẶC Hoàn tiền)
    const totalCollected = entries.reduce((sum, e) => sum + Number(e.credit_amount), 0);
    
    // Only count explicit tax payments to the state, not refunds back to the user
    const totalPaid = entries
      .filter((e) => e.ledger_transactions.reference_type === 'TAX_PAYMENT')
      .reduce((sum, e) => sum + Number(e.debit_amount), 0);

    const totalRefunded = entries
      .filter((e) => e.ledger_transactions.type === 'REFUND')
      .reduce((sum, e) => sum + Number(e.debit_amount), 0);

    return toJsonSafe({
      wallet: {
        wallet_id: taxWallet.wallet_id,
        balance: taxWallet.balance,
        pending_balance: taxWallet.pending_balance
      },
      summary: { totalCollected, totalPaid, totalRefunded, netFlow: totalCollected - totalPaid - totalRefunded, entryCount: entries.length },
      entries
    });
  }

  async payTax(actor: AuthUser, amount: number, note: string) {
    if (amount <= 0) throw new BadRequestException('Số tiền không hợp lệ.');

    const taxAmount = new Prisma.Decimal(amount);

    return await this.prisma.$transaction(async (tx) => {
      const { gatewayPool, taxPayable } = await this.ledger.getSystemWallets(tx);

      if (taxPayable.balance.lt(taxAmount)) {
        throw new BadRequestException('Số tiền nộp thuế vượt quá số dư Thuế Thu Hộ.');
      }
      if (gatewayPool.balance.lt(taxAmount)) {
        throw new BadRequestException('Số dư cổng thanh toán không đủ để thực hiện lệnh rút nộp thuế.');
      }

      await tx.wallets.update({
        where: { wallet_id: taxPayable.wallet_id },
        data: { balance: { decrement: taxAmount } }
      });

      await tx.wallets.update({
        where: { wallet_id: gatewayPool.wallet_id },
        data: { balance: { decrement: taxAmount } }
      });

      const ledgerTx = await tx.ledger_transactions.create({
        data: {
          type: 'WITHDRAW',
          reference_type: 'TAX_PAYMENT',
          reference_id: taxPayable.wallet_id,
          status: 'COMPLETED',
          description: `Nộp thuế TNCN - ${note}`,
          created_at: new Date()
        }
      });

      await tx.ledger_entries.createMany({
        data: [
          {
            transaction_id: ledgerTx.id,
            wallet_id: taxPayable.wallet_id,
            debit_amount: taxAmount,
            credit_amount: 0,
            created_at: new Date()
          },
          {
            transaction_id: ledgerTx.id,
            wallet_id: gatewayPool.wallet_id,
            debit_amount: 0,
            credit_amount: taxAmount,
            created_at: new Date()
          }
        ]
      });

      await tx.audit_logs.create({
        data: {
          account_id: actor.staffId ? Number(actor.staffId) : Number(actor.accountId),
          action: 'TAX_PAYMENT',
          target_id: ledgerTx.id,
          target_table: 'ledger_transactions',
          new_value: { amount, note, wallet_id: taxPayable.wallet_id } as Prisma.InputJsonValue
        }
      });

      return toJsonSafe(ledgerTx);
    });
  }
}
