import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { AuthUser } from '../../common/security/auth-user.interface';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, status?: string, pageStr?: string, limitStr?: string) {
    const isInternalRole = user.roleNames.some((role) => ['admin', 'mod', 'accountant'].includes(role));

    const where = isInternalRole
      ? undefined
      : {
          buyer_id: user.customerId ?? -1
        };

    const whereConfig: any = { ...where };
    if (status && status !== 'ALL') {
      whereConfig.status = status;
    }

    const page = pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      this.prisma.orders.count({ where: whereConfig }),
      this.prisma.orders.findMany({
        where: whereConfig,
        skip,
        take: limit,
        orderBy: { order_id: 'desc' },
        include: {
          customer_profiles: true,
          order_items: {
            include: {
              documents: {
                select: {
                  document_id: true,
                  title: true,
                  slug: true
                }
              }
            }
          }
        }
      })
    ]);

    return {
      meta: { page, limit, total },
      data: toJsonSafe(
      orders.map((order) => ({
        id: order.order_id,
        buyerId: order.buyer_id,
        buyerName: order.customer_profiles.full_name,
        totalAmount: order.total_amount,
        status: order.status,
        createdAt: order.created_at,
        items: order.order_items.map((item) => ({
          id: item.order_item_id,
          status: item.status,
          unitPrice: item.unit_price,
          document: {
            id: item.documents.document_id,
            title: item.documents.title,
            slug: item.documents.slug
          }
        }))
      }))
      )
    };
  }
}
