import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';

@Injectable()
export class WishlistsService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleWishlist(user: AuthUser, documentId: number) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có wishlist.');
    
    // Check if doc exists
    const doc = await this.prisma.documents.findUnique({
      where: { document_id: documentId }
    });
    
    if (!doc) throw new NotFoundException('Tài liệu không tồn tại.');

    if (doc.seller_id === user.customerId) {
      throw new ConflictException('Không thể thêm tài liệu của chính mình vào danh sách yêu thích.');
    }

    const existing = await this.prisma.wishlists.findFirst({
      where: { customer_id: user.customerId, document_id: documentId }
    });

    if (existing) {
      await this.prisma.wishlists.delete({
        where: {
          customer_id_document_id: {
            customer_id: user.customerId,
            document_id: documentId
          }
        }
      });
      return { message: 'Đã xóa tài liệu khỏi danh sách yêu thích.', isLiked: false };
    } else {
      await this.prisma.wishlists.create({
        data: {
          customer_id: user.customerId,
          document_id: documentId
        }
      });
      return { message: 'Đã thêm tài liệu vào danh sách yêu thích.', isLiked: true };
    }
  }

  async getWishlists(user: AuthUser) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có wishlist.');
    
    const items = await this.prisma.wishlists.findMany({
      where: { customer_id: user.customerId },
      orderBy: { created_at: 'desc' },
      include: {
        documents: {
          select: { 
            document_id: true, 
            title: true, 
            price: true, 
            slug: true,
            file_extension: true,
            preview_url: true,
            customer_profiles: { select: { full_name: true } }
          }
        }
      }
    });

    return {
      message: 'Lấy trạng thái wishlist thành công.',
      items: items.map(i => ({
        addedAt: i.created_at,
        document: {
          id: i.documents.document_id,
          title: i.documents.title,
          price: Number(i.documents.price),
          slug: i.documents.slug,
          fileExtension: i.documents.file_extension,
          previewUrl: i.documents.preview_url,
          sellerName: i.documents.customer_profiles?.full_name || 'Người dùng',
          isWishlisted: true
        }
      }))
    };
  }
}
