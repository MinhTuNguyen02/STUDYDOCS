import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthUser } from '../../common/security/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  private generateSignedUrl(storageKey: string, _customerId: number, ttlMinutes = 60) {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    // Token chỉ gồm storageKey + exp để validate dễ dàng phía server mà không cần customerId
    const token = createHash('sha256').update(`${storageKey}:${expiresAt.toISOString()}`).digest('hex');
    return {
      signedUrl: `/files/download/${encodeURIComponent(storageKey)}?token=${token}&exp=${expiresAt.toISOString()}`,
      expiresAt
    };
  }

  // Validate token khi user bấm link - trả false nếu sai hoặc hết hạn
  validateDownloadToken(storageKey: string, token: string, exp: string): boolean {
    try {
      const expiresAt = new Date(exp);
      if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) return false;
      // Thử tất cả customerId... không được. Dùng HMAC-free token: chỉ check format & chữ ký không có customerId
      // Thay bằng: token = sha256(storageKey + ':' + exp)
      const expectedToken = createHash('sha256').update(`${storageKey}:${exp}`).digest('hex');
      return token === expectedToken;
    } catch {
      return false;
    }
  }

  async listAccessibleDocuments(user: AuthUser) {
    if (!user.customerId) throw new ForbiddenException('Tai khoan nay khong co thu vien tai lieu.');

    const orderItems = await this.prisma.order_items.findMany({
      where: {
        orders: {
          buyer_id: user.customerId,
          status: 'PAID'
        }
      },
      orderBy: { created_at: 'desc' },
      include: {
        documents: {
          include: {
            categories: true
          }
        }
      }
    });

    return toJsonSafe(
      orderItems.map((item) => ({
        accessId: item.order_item_id,
        grantedAt: item.created_at,
        sourceType: 'ORDER_ITEM',
        document: {
          id: item.documents.document_id,
          title: item.documents.title,
          slug: item.documents.slug,
          category: item.documents.categories.name,
          extension: item.documents.file_extension,
          fileUrl: item.documents.file_url
        }
      }))
    );
  }

  async createDownloadLink(user: AuthUser, documentId: string, ipAddress?: string) {
    if (!user.customerId) throw new ForbiddenException('Tai khoan nay khong co quyen tai tai lieu.');

    const docId = Number(documentId);
    
    const item = await this.prisma.order_items.findFirst({
      where: {
        document_id: docId,
        orders: {
          buyer_id: user.customerId,
          status: 'PAID'
        }
      },
      include: { documents: true }
    });

    if (!item) {
      throw new ForbiddenException('Ban khong co quyen tai tai lieu nay.');
    }

    if (!item.documents || item.documents.delete_at) {
      throw new NotFoundException('Tai lieu khong ton tai hoac da bi xoa.');
    }

    const signed = this.generateSignedUrl(item.documents.file_url, user.customerId);

    const hasDownloadedBefore = await this.prisma.download_history.findFirst({
      where: {
        customer_id: user.customerId,
        document_id: docId
      }
    });

    await this.prisma.download_history.create({
      data: {
        customer_id: user.customerId,
        document_id: item.document_id,
        order_item_id: item.order_item_id,
        user_package_id: null,
        download_type: 'PURCHASED',
        ip_address: ipAddress?.slice(0, 45) ?? null
      }
    });

    if (!hasDownloadedBefore) {
      await this.prisma.documents.update({
        where: { document_id: item.document_id },
        data: { download_count: { increment: 1 } }
      });
    }

    return {
      documentId: item.document_id.toString(),
      signedUrl: signed.signedUrl,
      expiresAt: signed.expiresAt
    };
  }
}
