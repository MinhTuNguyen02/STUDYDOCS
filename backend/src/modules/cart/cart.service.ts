import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import { CartActionDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) { }

  private async getOrCreateCart(customerId: number) {
    let cart = await this.prisma.carts.findUnique({
      where: { customer_id: customerId }
    });
    if (!cart) {
      cart = await this.prisma.carts.create({
        data: { customer_id: customerId }
      });
    }
    return cart;
  }

  async getCart(user: AuthUser) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có giỏ hàng.');
    const cart = await this.getOrCreateCart(user.customerId);

    const items = await this.prisma.cart_items.findMany({
      where: { cart_id: cart.cart_id },
      include: {
        documents: {
          select: { 
            document_id: true, 
            title: true, 
            price: true, 
            slug: true,
            file_extension: true,
            customer_profiles: { select: { full_name: true } }
          }
        }
      }
    });

    return {
      message: 'Lấy trạng thái giỏ hàng thành công.',
      cartId: cart.cart_id,
      items: items.map(item => ({
        cartItemId: item.cart_item_id,
        document: {
          id: item.documents.document_id,
          title: item.documents.title,
          price: Number(item.documents.price),
          slug: item.documents.slug,
          fileExtension: item.documents.file_extension,
          sellerName: item.documents.customer_profiles?.full_name || 'Người dùng'
        },
        addedAt: item.add_at
      }))
    };
  }

  async addToCart(user: AuthUser, dto: CartActionDto) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có giỏ hàng.');

    const doc = await this.prisma.documents.findUnique({
      where: { document_id: dto.documentId, status: 'APPROVED' }
    });
    if (!doc) throw new NotFoundException('Tài liệu không tồn tại hoặc chưa được duyệt.');

    // Chặn seller tự mua tài liệu của chính mình
    if (doc.seller_id === user.customerId) {
      throw new ConflictException('Không thể thêm tài liệu của chính mình vào giỏ hàng.');
    }

    const cart = await this.getOrCreateCart(user.customerId);

    const existingItem = await this.prisma.cart_items.findFirst({
      where: { cart_id: cart.cart_id, document_id: dto.documentId }
    });

    if (existingItem) {
      throw new ConflictException('Tài liệu đã có trong giỏ hàng.');
    }

    await this.prisma.cart_items.create({
      data: {
        cart_id: cart.cart_id,
        document_id: dto.documentId
      }
    });

    return { message: 'Đã thêm tài liệu vào giỏ hàng.' };
  }

  async removeFromCart(user: AuthUser, documentId: number) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có giỏ hàng.');

    const cart = await this.getOrCreateCart(user.customerId);

    const deleted = await this.prisma.cart_items.deleteMany({
      where: { cart_id: cart.cart_id, document_id: documentId }
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Tài liệu không có trong giỏ hàng.');
    }

    return { message: 'Đã xóa tài liệu khỏi giỏ hàng.' };
  }

  async clearCart(user: AuthUser) {
    if (!user.customerId) throw new NotFoundException('Chỉ khách hàng mới có giỏ hàng.');

    const cart = await this.getOrCreateCart(user.customerId);
    await this.prisma.cart_items.deleteMany({
      where: { cart_id: cart.cart_id }
    });

    return { message: 'Đã xóa tất cả tài liệu khỏi giỏ hàng.' };
  }
}
