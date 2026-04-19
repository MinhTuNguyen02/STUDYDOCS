import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../common/security/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) { }

  async listAccessibleDocuments(user: AuthUser) {
    if (!user.customerId) throw new ForbiddenException('Tai khoan nay khong co thu vien tai lieu.');

    // 1. Get documents from PAID orders
    const orderItems = await this.prisma.order_items.findMany({
      where: {
        orders: { buyer_id: user.customerId, status: 'PAID' },
        documents: { delete_at: null } // Ensure document is active
      },
      include: {
        documents: { include: { categories: true } },
        orders: true
      }
    });

    // 2. Get documents from download_history (FREE, PACKAGE, etc)
    const dlHistory = await this.prisma.download_history.findMany({
      where: {
        customer_id: user.customerId,
        documents: { delete_at: null }
      },
      include: {
        documents: { include: { categories: true } }
      }
    });

    // Merge and deduplicate by document_id
    const documentMap = new Map<number, any>();

    for (const item of orderItems) {
      if (!item.documents) continue;
      documentMap.set(item.document_id, {
        id: item.documents.document_id,
        title: item.documents.title,
        slug: item.documents.slug,
        category: item.documents.categories?.name || 'Tài liệu',
        fileExtension: item.documents.file_extension,
        fileUrl: item.documents.file_url,
        previewUrl: item.documents.preview_url,
        accessId: `order_${item.order_item_id}`,
        createdAt: item.created_at,
        sourceType: 'ORDER_ITEM'
      });
    }

    for (const dl of dlHistory) {
      if (!dl.documents) continue;
      if (!documentMap.has(dl.document_id)) {
        documentMap.set(dl.document_id, {
          id: dl.documents.document_id,
          title: dl.documents.title,
          slug: dl.documents.slug,
          category: dl.documents.categories?.name || 'Tài liệu',
          fileExtension: dl.documents.file_extension,
          fileUrl: dl.documents.file_url,
          previewUrl: dl.documents.preview_url,
          accessId: `dl_${dl.id}`,
          createdAt: dl.download_at,
          sourceType: dl.download_type
        });
      }
    }

    const mergedList = Array.from(documentMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return toJsonSafe(mergedList);
  }

  async createDownloadLink(user: AuthUser, documentId: string, ipAddress?: string) {
    if (!user.customerId) throw new ForbiddenException('Tài khoản này không có quyền tải tài liệu.');

    const docId = Number(documentId);

    // 1. Kiểm tra xem user có quyền truy cập không (Đã Mua hoặc Đã Từng Tải)
    const [paidItem, dlHistory] = await Promise.all([
      this.prisma.order_items.findFirst({
        where: { document_id: docId, orders: { buyer_id: user.customerId, status: 'PAID' } },
        include: { documents: true }
      }),
      this.prisma.download_history.findFirst({
        where: { customer_id: user.customerId, document_id: docId },
        include: { documents: true }
      })
    ]);

    // Lấy thông tin document từ nguồn hợp lệ
    const documentToDownload = paidItem?.documents || dlHistory?.documents;

    if (!documentToDownload) {
      throw new ForbiddenException('Bạn không có quyền tải tài liệu này.');
    }

    if (documentToDownload.delete_at) {
      throw new NotFoundException('Tài liệu không tồn tại hoặc đã bị xóa.');
    }

    // 2. Dùng chung cơ chế sinh link S3 trực tiếp giống DownloadsService
    const signedUrl = await this.storageService.getPresignedUrl(documentToDownload.file_url);

    // Xác định type hợp lệ dựa vào Prisma Enum
    const typeToLog = paidItem ? 'PURCHASED' : dlHistory!.download_type;

    // 3. Ghi log tải lại
    await this.prisma.download_history.create({
      data: {
        customer_id: user.customerId,
        document_id: docId,
        order_item_id: paidItem?.order_item_id || dlHistory?.order_item_id || null,
        user_package_id: dlHistory?.user_package_id || null,
        download_type: typeToLog, // Sử dụng lại type hợp lệ từ Prisma
        ip_address: ipAddress?.slice(0, 45) ?? null
      }
    });

    return {
      message: 'Lấy link tải file thành công.',
      documentId: docId.toString(),
      downloadUrl: signedUrl
    };
  }
}
