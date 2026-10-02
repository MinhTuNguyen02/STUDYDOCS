import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { download_type, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/security/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class DownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async requestDownload(user: AuthUser, docId: number, ipAddress: string) {
    if (!user.customerId)
      throw new ForbiddenException('Chỉ khách hàng mới có quyền tải xuống tài liệu.');
    const customerId = user.customerId;
    const doc = await this.prisma.documents.findFirst({
      where: { document_id: docId, status: 'APPROVED', delete_at: null, is_user_hidden: false }
    });
    if (!doc) throw new NotFoundException('Tài liệu không tồn tại hoặc chưa được duyệt.');
    if (doc.seller_id === customerId) {
      throw new BadRequestException('Không thể tải xuống tài liệu của chính mình.');
    }

    // Generate a short-lived URL first. It is never returned unless entitlement succeeds.
    const signedUrl = await this.storageService.getPresignedUrl(doc.file_url, 300);

    const consumeEntitlement = () =>
      this.prisma.$transaction(
        async (tx) => {
          // Serialize entitlement consumption for this customer across concurrent documents.
          // Cast PostgreSQL's void return value so Prisma can deserialize the lock statement.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(${customerId})::text AS lock_result`;

          const previous = await tx.download_history.findFirst({
            where: { customer_id: customerId, document_id: docId },
            orderBy: { download_at: 'asc' }
          });

          let type: download_type = previous?.download_type ?? 'FREE_MONTHLY';
          let orderItemId = previous?.order_item_id ?? null;
          let userPackageId = previous?.user_package_id ?? null;

          if (!previous) {
            if (doc.price.equals(0)) {
              const decremented = await tx.customer_profiles.updateMany({
                where: { customer_id: customerId, free_downloads_remaining: { gt: 0 } },
                data: { free_downloads_remaining: { decrement: 1 } }
              });
              if (decremented.count !== 1) {
                const consumed = await this.consumeActivePackage(tx, customerId);
                if (!consumed) {
                  throw new BadRequestException(
                    'Đã hết lượt tải xuống miễn phí. Vui lòng mua gói dịch vụ.'
                  );
                }
                type = 'PACKAGE';
                userPackageId = consumed.user_package_id;
              }
            } else {
              const paidItem = await tx.order_items.findFirst({
                where: {
                  document_id: docId,
                  status: 'PAID',
                  orders: { buyer_id: customerId, status: 'PAID' }
                },
                orderBy: { created_at: 'asc' }
              });
              if (paidItem) {
                type = 'PURCHASED';
                orderItemId = paidItem.order_item_id;
              } else {
                const consumed = await this.consumeActivePackage(tx, customerId);
                if (!consumed) {
                  throw new ForbiddenException(
                    'Tài liệu có phí. Vui lòng thanh toán hoặc mua gói dịch vụ.'
                  );
                }
                type = 'PACKAGE';
                userPackageId = consumed.user_package_id;
              }
            }

            await tx.documents.update({
              where: { document_id: docId },
              data: { download_count: { increment: 1 } }
            });
          }

          await tx.download_history.create({
            data: {
              customer_id: customerId,
              document_id: docId,
              order_item_id: orderItemId,
              user_package_id: userPackageId,
              download_type: type,
              ip_address: ipAddress.slice(0, 45)
            }
          });

          return type;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

    let downloadType: download_type | undefined;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        downloadType = await consumeEntitlement();
        break;
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!retryable || attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 25));
      }
    }

    if (!downloadType) {
      throw new BadRequestException('KhÃ´ng thá»ƒ xÃ¡c nháº­n quyá»n táº£i xuá»‘ng.');
    }

    return {
      message: 'Lấy link tải file thành công.',
      downloadUrl: signedUrl,
      download_type: downloadType,
      expiresInSeconds: 300
    };
  }

  private async consumeActivePackage(tx: Prisma.TransactionClient, customerId: number) {
    const pkg = await tx.user_packages.findFirst({
      where: {
        customer_id: customerId,
        status: 'ACTIVE',
        turns_remaining: { gt: 0 },
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }]
      },
      orderBy: [{ expires_at: 'asc' }, { purchased_at: 'asc' }]
    });
    if (!pkg) return null;

    const remaining = pkg.turns_remaining - 1;
    await tx.user_packages.update({
      where: { user_package_id: pkg.user_package_id },
      data: {
        turns_remaining: remaining,
        status: remaining === 0 ? 'EXHAUSTED' : 'ACTIVE',
        active_slot: remaining === 0 ? null : 1
      }
    });

    if (remaining === 0) {
      const pending = await tx.user_packages.findFirst({
        where: { customer_id: customerId, status: 'PENDING' },
        include: { packages: { select: { duration_days: true } } },
        orderBy: { purchased_at: 'asc' }
      });
      if (pending) {
        await tx.user_packages.update({
          where: { user_package_id: pending.user_package_id },
          data: {
            status: 'ACTIVE',
            active_slot: 1,
            expires_at: new Date(Date.now() + pending.packages.duration_days * 86_400_000)
          }
        });
      }
    }

    return pkg;
  }
}
