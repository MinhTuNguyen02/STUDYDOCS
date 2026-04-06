import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import { download_type, order_status } from '@prisma/client';

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async requestDownload(user: AuthUser, documentId: string, ipAddress: string) {
    if (!user.customerId) throw new ForbiddenException('Chỉ khách hàng mới có quyền tải tài liệu.');
    const docId = Number(documentId);

    const doc = await this.prisma.documents.findUnique({
      where: { document_id: docId, status: 'APPROVED' }
    });

    if (!doc) throw new NotFoundException('Tài liệu không tồn tại hoặc chưa được duyệt.');

    const hasDownloadedBefore = await this.prisma.download_history.findFirst({
      where: {
        customer_id: user.customerId,
        document_id: docId
      }
    });

    let downloadType: download_type = 'FREE_MONTHLY';

    if (hasDownloadedBefore) {
      // Nếu đã từng tải, không trừ lượt, chỉ sử dụng lại type cũ
      downloadType = hasDownloadedBefore.download_type;
    } else {
      // Rule 1: Is the document free?
      if (doc.price.equals(0)) {
        // Check free runs
        const profile = await this.prisma.customer_profiles.findUnique({ where: { customer_id: user.customerId } });
        if (profile!.free_downloads_remaining <= 0) {
          // Fallback to active packages if out of free runs
          const activePkg = await this.useActivePackage(user.customerId);
          if (!activePkg) {
            throw new BadRequestException('Đã hết lượt tải miễn phí. Vui lòng mua gói dịch vụ.');
          }
          downloadType = 'PACKAGE';
        } else {
          // Deduct 1 free download
          await this.prisma.customer_profiles.update({
            where: { customer_id: user.customerId },
            data: { free_downloads_remaining: { decrement: 1 } }
          });
        }
      } else {
        // Rule 2: Is it purchased?
        const orderItem = await this.prisma.order_items.findFirst({
          where: {
            document_id: docId,
            orders: { buyer_id: user.customerId, status: 'PAID' }
          }
        });

        if (orderItem) {
          downloadType = 'PURCHASED';
        } else {
          // Rule 3: Do we have an active package?
          const activePkg = await this.useActivePackage(user.customerId);
          if (!activePkg) {
             throw new ForbiddenException('Tài liệu có phí. Vui lòng thanh toán hoặc mua gói dịch vụ.');
          }
          downloadType = 'PACKAGE';
        }
      }
    }

    // 6.4 Generate Presigned URL
    const signedUrl = await this.storageService.getPresignedUrl(doc.file_url);

    // 6.5 Record download history
    await this.prisma.download_history.create({
      data: {
        customer_id: user.customerId,
        document_id: docId,
        download_type: downloadType,
        ip_address: ipAddress
      }
    });

    // Tăng download_count trên document (cho sort popular + seller dashboard) nếu đây là lần đầu tiên tải
    if (!hasDownloadedBefore) {
      await this.prisma.documents.update({
        where: { document_id: docId },
        data: { download_count: { increment: 1 } }
      });
    }

    return { 
      message: 'Lấy link tải file thành công.', 
      downloadUrl: signedUrl,
      download_type: downloadType
    };
  }

  private async useActivePackage(customerId: number) {
    const pkg = await this.prisma.user_packages.findFirst({
      where: { customer_id: customerId, status: 'ACTIVE', turns_remaining: { gt: 0 } },
      orderBy: { expires_at: 'asc' }
    });

    if (!pkg) return null;

    const remaining = pkg.turns_remaining - 1;
    await this.prisma.user_packages.update({
      where: { user_package_id: pkg.user_package_id },
      data: { 
        turns_remaining: remaining,
        status: remaining === 0 ? 'EXHAUSTED' : 'ACTIVE'
      }
    });

    return pkg;
  }
}
