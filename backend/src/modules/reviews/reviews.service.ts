import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/security/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { UpsertReviewDto } from './dto/upsert-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async recalculateDocumentRating(documentId: number) {
    const aggregate = await this.prisma.reviews.aggregate({
      where: { document_id: documentId, is_deleted: { not: true } },
      _avg: { rating: true },
      _count: { _all: true }
    });

    const avg = aggregate._avg.rating ?? 0;
    const count = aggregate._count._all;

    await this.prisma.documents.update({
      where: { document_id: documentId },
      data: {
        average_rating: new Prisma.Decimal(avg).toDecimalPlaces(2),
        // rating_count: count
      }
    });
  }

  async listByDocument(documentId: string) {
    const docId = Number(documentId);

    const reviews = await this.prisma.reviews.findMany({
      where: { document_id: docId, is_deleted: { not: true } },
      include: {
        customer_profiles: {
          select: {
            customer_id: true,
            full_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return toJsonSafe(
      reviews.map((review) => ({
        id: review.review_id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
        buyer: {
          id: review.customer_profiles.customer_id,
          name: review.customer_profiles.full_name
        },
        sellerReply: review.seller_reply,
        repliedAt: review.replied_at
      }))
    );
  }

  async upsertMyReview(user: AuthUser, documentId: string, dto: UpsertReviewDto) {
    if (!user.customerId) throw new ForbiddenException('Tai khoan nay khong the danh gia.');

    const docId = Number(documentId);
    const document = await this.prisma.documents.findUnique({ where: { document_id: docId } });
    if (!document) throw new NotFoundException('Khong tim thay tai lieu.');

    const eligibleOrderItems = await this.prisma.order_items.findMany({
      where: {
        document_id: docId,
        orders: {
          buyer_id: user.customerId,
          status: 'PAID'
        },
        status: { in: ['PAID', 'HELD', 'RELEASED'] }
      },
      orderBy: { created_at: 'asc' }
    });

    if (eligibleOrderItems.length === 0) {
      throw new ForbiddenException('Ban chi co the danh gia tai lieu da mua.');
    }

    const existingByDoc = await this.prisma.reviews.findFirst({
      where: {
        buyer_id: user.customerId,
        document_id: docId
      }
    });

    if (existingByDoc && existingByDoc.is_deleted) {
      throw new ForbiddenException('Bạn chỉ được tham gia đánh giá 1 lần cho mỗi tài liệu (Đánh giá của bạn đã bị xóa)');
    }

    const result = existingByDoc
      ? await this.prisma.reviews.update({
          where: { review_id: existingByDoc.review_id },
          data: {
            rating: dto.rating,
            comment: dto.comment,
            updated_at: new Date()
          }
        })
      : await this.prisma.reviews.create({
          data: {
            order_item_id: eligibleOrderItems[0].order_item_id,
            document_id: docId,
            buyer_id: user.customerId,
            rating: dto.rating,
            comment: dto.comment
          }
        });

    await this.recalculateDocumentRating(docId);

    return toJsonSafe(result);
  }

  async replyToReview(user: AuthUser, reviewId: number, replyText: string) {
    if (!user.customerId) throw new ForbiddenException('Only sellers can reply.');

    const review = await this.prisma.reviews.findUnique({
      where: { review_id: reviewId },
      include: { documents: true }
    });

    if (!review) throw new NotFoundException('Khong tim thay danh gia nay.');

    if (review.documents.seller_id !== user.customerId) {
      throw new ForbiddenException('Bạn không phải là người bán của tài liệu này.');
    }

    const updated = await this.prisma.reviews.update({
      where: { review_id: reviewId },
      data: {
        seller_reply: replyText,
        replied_at: new Date()
      }
    });

    return toJsonSafe(updated);
  }

  async deleteReview(user: AuthUser, reviewId: number) {
    const review = await this.prisma.reviews.findUnique({ where: { review_id: reviewId } });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá.');

    const isStaff = user.roleNames?.some(r => ['admin', 'mod'].includes(r.toLowerCase()));
    if (!isStaff && review.buyer_id !== user.customerId) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này.');
    }

    await this.prisma.reviews.update({
      where: { review_id: reviewId },
      data: { is_deleted: true }
    });
    await this.recalculateDocumentRating(review.document_id);
    return { success: true, message: 'Đã xóa đánh giá.' };
  }

  async deleteReply(user: AuthUser, reviewId: number) {
    const review = await this.prisma.reviews.findUnique({ 
      where: { review_id: reviewId },
      include: { documents: true }
    });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá.');

    const isStaff = user.roleNames?.some(r => ['admin', 'mod'].includes(r.toLowerCase()));
    if (!isStaff && review.documents.seller_id !== user.customerId) {
      throw new ForbiddenException('Bạn không có quyền xóa phản hồi này.');
    }

    await this.prisma.reviews.update({
      where: { review_id: reviewId },
      data: {
        seller_reply: null,
        replied_at: null
      }
    });

    return { success: true, message: 'Đã xóa phản hồi của người bán.' };
  }
}
