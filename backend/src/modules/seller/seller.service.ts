import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthUser } from '../../common/security/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { CreateSellerDocumentDto } from './dto/create-seller-document.dto';
import { UpdateSellerDocumentDto } from './dto/update-seller-document.dto';
import { PenaltyService } from '../moderation/penalty.service';

@Injectable()
export class SellerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly penaltyService: PenaltyService
  ) { }

  private ensureSeller(user: AuthUser) {
    if (!user.customerId) {
      throw new ForbiddenException('Tai khoan nay khong phai seller.');
    }
    return user.customerId;
  }

  private normalizeExtension(value: string) {
    return value.replace('.', '').trim().toUpperCase();
  }

  async getDashboardStats(user: AuthUser, startDate?: string, endDate?: string) {
    const sellerId = this.ensureSeller(user);
    const now = new Date();

    // Parse date range, default = current month
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Cap end at now – never allow future dates
    if (end > now) end = new Date(now);

    const [earningsAgg, viewsAgg, downloadsAgg, ordersCount] = await Promise.all([
      this.prisma.order_items.aggregate({
        _sum: { seller_earning: true },
        where: {
          documents: { seller_id: sellerId },
          status: { in: ['PAID', 'HELD', 'RELEASED'] },
          created_at: { gte: start, lte: end }
        }
      }),
      this.prisma.documents.aggregate({
        _sum: { view_count: true },
        where: { seller_id: sellerId }
      }),
      this.prisma.documents.aggregate({
        _sum: { download_count: true },
        where: { seller_id: sellerId }
      }),
      this.prisma.order_items.count({
        where: {
          documents: { seller_id: sellerId },
          status: { in: ['PAID', 'HELD', 'RELEASED'] },
          created_at: { gte: start, lte: end }
        }
      })
    ]);

    const topDownloads = await this.prisma.documents.findMany({
      where: { 
        seller_id: sellerId,
        created_at: { lte: end }  // Only include docs that existed within the period
      },
      orderBy: { download_count: 'desc' },
      take: 5,
      select: { document_id: true, title: true, download_count: true, view_count: true, price: true }
    });

    const topViews = await this.prisma.documents.findMany({
      where: { 
        seller_id: sellerId,
        created_at: { lte: end }  // Only include docs that existed within the period
      },
      orderBy: { view_count: 'desc' },
      take: 5,
      select: { document_id: true, title: true, download_count: true, view_count: true, price: true }
    });

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalEarnings: Number(earningsAgg._sum.seller_earning ?? 0),
      totalViews: viewsAgg._sum.view_count ?? 0,
      totalDownloads: downloadsAgg._sum.download_count ?? 0,
      totalOrders: ordersCount,
      topDownloads,
      topViews
    };
  }

  async getMonthlyTrend(user: AuthUser, yearStr?: string) {
    const sellerId = this.ensureSeller(user);
    const year = yearStr ? Number(yearStr) : new Date().getFullYear();

    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const results = await Promise.all(
      months.map(async (m) => {
        const start = new Date(year, m - 1, 1);
        const end = new Date(year, m, 0, 23, 59, 59, 999);

        const [earningsAgg, ordersCount] = await Promise.all([
          this.prisma.order_items.aggregate({
            _sum: { seller_earning: true },
            where: {
              documents: { seller_id: sellerId },
              status: { in: ['PAID', 'HELD', 'RELEASED'] },
              created_at: { gte: start, lte: end }
            }
          }),
          this.prisma.order_items.count({
            where: {
              documents: { seller_id: sellerId },
              status: { in: ['PAID', 'HELD', 'RELEASED'] },
              created_at: { gte: start, lte: end }
            }
          })
        ]);

        return {
          month: m,
          label: `T${m}`,
          earnings: Number(earningsAgg._sum.seller_earning ?? 0),
          orders: ordersCount
        };
      })
    );

    return { year, data: results };
  }

  async listMyDocuments(
    user: AuthUser, 
    status?: string, 
    search?: string, 
    pageStr?: string, 
    limitStr?: string
  ) {
    const sellerId = this.ensureSeller(user);
    const page = pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.documentsWhereInput = {
      seller_id: sellerId,
      status: status && status !== 'ALL' ? (status as any) : undefined,
      title: search ? { contains: search, mode: 'insensitive' } : undefined
    };

    const [total, docs] = await Promise.all([
      this.prisma.documents.count({ where }),
      this.prisma.documents.findMany({
        where,
        skip,
        take: limit,
        include: {
          categories: true
        },
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      meta: { page, limit, total },
      data: toJsonSafe(
        docs.map((doc) => ({
          id: doc.document_id,
          title: doc.title,
          slug: doc.slug,
          status: doc.status,
          price: doc.price,
          viewCount: doc.view_count,
          downloadCount: doc.download_count,
          pageCount: doc.page_count,
          fileExtension: doc.file_extension,
          fileSize: doc.file_size,
          category: doc.categories?.name,
          rejectionReason: doc.rejection_reason,
          createdAt: doc.created_at,
          publishedAt: doc.published_at
        }))
      )
    };
  }

  async createDocument(user: AuthUser, dto: CreateSellerDocumentDto) {
    const sellerId = this.ensureSeller(user);

    if (dto.fileSizeMb > 100) {
      throw new BadRequestException('Kich thuoc file toi da 100MB.');
    }

    const extension = this.normalizeExtension(dto.fileExtension);
    const allowedExtensions = ['DOC', 'DOCX', 'PDF', 'PPT', 'PPTX', 'XLS', 'XLSX', 'docx'];
    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException(`Dinh dang file khong duoc ho tro. (Extension nhận được: "${extension}", File gửi lên: "${dto.fileExtension}")`);
    }

    const category = await this.prisma.categories.findUnique({ where: { category_id: Number(dto.categoryId) } });
    if (!category || category.delete_at) {
      throw new NotFoundException('Danh muc khong ton tai.');
    }

    const duplicateSlug = await this.prisma.documents.findUnique({ where: { slug: dto.slug } });
    if (duplicateSlug) {
      throw new BadRequestException('Slug tai lieu da ton tai.');
    }

    const parsedPrice = new Prisma.Decimal(dto.price);
    const finalPrice = dto.pageCount < 10 ? new Prisma.Decimal(0) : parsedPrice;

    const fileHash =
      dto.fileHash?.trim() || createHash('sha256').update(`${dto.slug}:${Date.now()}:${sellerId.toString()}`).digest('hex');

    // Check duplicate file hash
    const duplicateHash = await this.prisma.documents.findFirst({
      where: {
        file_hash: fileHash,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    });

    if (duplicateHash) {
      // 14. Violation: File already uploaded by someone else
      // Here usually we would record an audit_log for violation
      await this.prisma.audit_logs.create({
        data: {
          account_id: Number(user.accountId),
          action: 'UPLOAD_VIOLATION',
          target_table: 'documents',
          target_id: 0,
          old_value: {},
          new_value: { reason: 'Duplicate document hash detected', fileHash }
        }
      });

      // Call penalty service
      await this.penaltyService.evaluateUserViolations(sellerId);

      throw new BadRequestException('Tai lieu nay da ton tai tren he thong (trung file).');
    }

    const tagIdsArray = dto.tagIds
      ? dto.tagIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      : [];

    const document = await this.prisma.documents.create({
      data: {
        seller_id: sellerId,
        category_id: category.category_id,
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        price: finalPrice,
        page_count: dto.pageCount,
        status: 'PENDING',
        file_url: dto.storageKey ?? `docs/${dto.slug}.${extension.toLowerCase()}`,
        preview_url: dto.previewKey ?? `preview/${dto.slug}`,
        review_url: (dto as any).reviewKey ?? null,
        file_size: Math.floor(dto.fileSizeMb * 1024 * 1024),
        file_extension: extension.toLowerCase(),
        file_hash: fileHash,
        ...((tagIdsArray.length > 0) && {
          document_tags: {
            create: tagIdsArray.map(tag_id => ({ tag_id }))
          }
        })
      }
    });

    return toJsonSafe(document);
  }

  async updateDocument(user: AuthUser, documentId: string, dto: UpdateSellerDocumentDto) {
    const sellerId = this.ensureSeller(user);
    const id = Number(documentId);

    const existing = await this.prisma.documents.findUnique({ where: { document_id: id } });
    if (!existing || existing.seller_id !== sellerId) {
      throw new NotFoundException('Khong tim thay tai lieu cua ban.');
    }

    if (existing.status === 'PENDING' && dto.status !== 'PENDING') {
      throw new BadRequestException('Tai lieu dang cho duyet, khong duoc sua trang thai nay.');
    }

    const nextCategoryId = dto.categoryId ? Number(dto.categoryId) : existing.category_id;
    const nextPrice = dto.price ? new Prisma.Decimal(dto.price) : existing.price;

    const updated = await this.prisma.documents.update({
      where: { document_id: id },
      data: {
        title: dto.title,
        description: dto.description,
        category_id: nextCategoryId,
        price: existing.page_count < 10 ? new Prisma.Decimal(0) : nextPrice,
        status: dto.status ?? existing.status,
        rejection_reason: dto.status === 'PENDING' ? null : existing.rejection_reason,
        updated_at: new Date()
      }
    });

    return toJsonSafe(updated);
  }

  async listSales(
    user: AuthUser, 
    status?: string, 
    search?: string, 
    pageStr?: string, 
    limitStr?: string
  ) {
    const sellerId = this.ensureSeller(user);
    const page = pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.order_itemsWhereInput = {
      seller_id: sellerId,
      status: status && status !== 'ALL' ? (status as any) : undefined,
      documents: search ? { title: { contains: search, mode: 'insensitive' } } : undefined
    };

    // Calculate aggregated stats across all pages
    const overallItems = await this.prisma.order_items.findMany({
      where,
      select: { status: true, seller_earning: true }
    });
    const totalEarnings = overallItems.reduce((sum, item) => {
      if (item.status === 'REFUNDED') return sum;
      return sum + Number(item.seller_earning || 0);
    }, 0);
    const totalOrders = overallItems.length;

    const [total, items] = await Promise.all([
      this.prisma.order_items.count({ where }),
      this.prisma.order_items.findMany({
        where,
        skip,
        take: limit,
        include: {
          documents: { select: { title: true, slug: true } },
          orders: { select: { order_id: true, status: true, created_at: true } }
        },
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      meta: { page, limit, total },
      totalEarnings,
      totalOrders,
      data: toJsonSafe(
        items.map((item) => ({
          id: item.order_item_id,
          status: item.status,
          unitPrice: item.unit_price,
          commissionFee: item.commission_fee,
          sellerEarning: item.seller_earning,
          holdUntil: item.hold_until,
          document: item.documents,
          order: item.orders
        }))
      )
    };
  }
}
