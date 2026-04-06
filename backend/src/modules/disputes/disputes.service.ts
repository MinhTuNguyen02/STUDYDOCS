import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import { LedgerService } from '../wallets/ledger.service';
import { dispute_status } from '@prisma/client';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService
  ) {}

  async createDispute(user: AuthUser, dto: { orderItemId: number; reason: string; description: string }) {
    if (!user.customerId) throw new ForbiddenException('Chỉ khách hàng mới có thể khiếu nại.');

    const orderItem = await this.prisma.order_items.findUnique({
      where: { order_item_id: dto.orderItemId },
      include: { orders: true, documents: true }
    });

    if (!orderItem) throw new NotFoundException('Không tìm thấy Order Item.');
    if (orderItem.orders.buyer_id !== user.customerId) {
        throw new ForbiddenException('Bạn không phải là người mua của item này.');
    }

    // Rule: Dispute chỉ hiện khi NOW() - order.created_at <= 2 ngày
    const daysSinceOrder = (Date.now() - orderItem.orders.created_at.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceOrder > 2) {
      throw new BadRequestException('Đã quá thời hạn 2 ngày để khiếu nại hoàn tiền.');
    }

    // Kiểm tra xem đã có dispute chưa
    const existing = await this.prisma.disputes.findFirst({
      where: { order_item_id: dto.orderItemId }
    });
    if (existing) throw new BadRequestException('Bạn đã gửi khiếu nại cho item này rồi.');

    const dispute = await this.prisma.disputes.create({
      data: {
        order_item_id: dto.orderItemId,
        customer_id: user.customerId,
        reason: dto.reason,
        description: dto.description,
        status: 'OPEN'
      }
    });

    return { message: 'Đã gửi khiếu nại thành công.', dispute };
  }

  async analyzeDispute(user: AuthUser, disputeId: number) {
    if (!user.staffId) throw new ForbiddenException('Chỉ dành cho Mod/Admin.');
    
    return this.prisma.disputes.update({
      where: { id: disputeId },
      data: { status: 'INVESTIGATING', staff_id: user.staffId }
    });
  }

  async resolveDispute(user: AuthUser, disputeId: number, dto: { status: dispute_status; resolution: string }) {
    if (!user.staffId) throw new ForbiddenException('Chỉ dành cho Mod/Admin.');

    const dispute = await this.prisma.disputes.findUnique({
      where: { id: disputeId },
      include: {
        order_items: { include: { orders: true, documents: true } }
      }
    });

    if (!dispute) throw new NotFoundException('Dispute not found.');
    if (dispute.status === 'RESOLVED' || dispute.status === 'REJECTED') {
      throw new BadRequestException('Dispute đã được xử lý.');
    }

    // Nếu REJECTED -> Không xử lý Ledger, kết thúc luôn
    if (dto.status === 'REJECTED') {
      const updated = await this.prisma.disputes.update({
        where: { id: disputeId },
        data: {
          status: 'REJECTED',
          resolution: dto.resolution,
          resolved_at: new Date(),
          staff_id: user.staffId
        }
      });
      return { message: 'Đã từ chối khiếu nại.', data: updated };
    }

    // Nếu RESOLVED -> Trả lại tiền (Refund)
    if (dto.status === 'RESOLVED') {
      const orderItem = dispute.order_items;
      
      const res = await this.prisma.$transaction(async (tx) => {
        // 1. Trả tiền PAYMENT cho Buyer
        const buyerWallet = await tx.wallets.findFirst({
           where: { customer_id: orderItem.orders.buyer_id, wallet_type: 'PAYMENT' }
        });

        if (!buyerWallet) throw new BadRequestException('Không tìm thấy ví PAYMENT của người mua.');

        await tx.wallets.update({
          where: { wallet_id: buyerWallet.wallet_id },
          data: { balance: { increment: orderItem.unit_price } }
        });

        // 2. Lấy ví người bán và system revenue
        const { systemRevenue } = await this.ledger.getSystemWallets(tx);
        
        const sellerWallet = await tx.wallets.findFirst({
          where: { customer_id: orderItem.documents.seller_id, wallet_type: 'REVENUE' }
        });
        
        if (!sellerWallet) throw new BadRequestException('Không tìm thấy ví REVENUE người bán.');

        // 3. Trừ tiền người bán (Ưu tiên trừ từ pending_balance nếu trạng thái là HELD, nếu RELEASED trừ balance)
        if (orderItem.status === 'HELD') {
            await tx.wallets.update({
              where: { wallet_id: sellerWallet.wallet_id },
              data: { pending_balance: { decrement: orderItem.seller_earning } }
            });
        } else if (orderItem.status === 'RELEASED') { // Or PAID directly
            await tx.wallets.update({
              where: { wallet_id: sellerWallet.wallet_id },
              data: { balance: { decrement: orderItem.seller_earning } }
            });
        }

        // 4. Trừ tiền SYSTEM_REVENUE
        await tx.wallets.update({
          where: { wallet_id: systemRevenue.wallet_id },
          data: { balance: { decrement: orderItem.commission_fee } }
        });

        // 5. Cập nhật trạng thái order_items thành REFUNDED
        await tx.order_items.update({
          where: { order_item_id: orderItem.order_item_id },
          data: { status: 'REFUNDED' }
        });

        // 6. Ghi Ledger REFUND (đảo chiều bút toán PURCHASE)
        // PURCHASE: buyer=debit, seller/system=credit
        // REFUND:   buyer=credit(hoàn), seller/system=debit(thu hồi)
        // Nhưng theo chuẩn kế toán: buyer nhận lại tiền = DEBIT (tài sản tăng)
        // seller/system trả tiền = CREDIT (tài sản giảm)
        await this.ledger.recordTransaction(
          tx,
          'REFUND',
          'DISPUTE',
          disputeId,
          `Hoàn tiền khiếu nại (Item ID: ${orderItem.order_item_id})`,
          [
            { wallet_id: buyerWallet.wallet_id, debit_amount: orderItem.unit_price, credit_amount: 0 },
            { wallet_id: sellerWallet.wallet_id, debit_amount: 0, credit_amount: orderItem.seller_earning },
            { wallet_id: systemRevenue.wallet_id, debit_amount: 0, credit_amount: orderItem.commission_fee }
          ]
        );

        // 7. Cập nhật Dispute Status
        return tx.disputes.update({
          where: { id: disputeId },
          data: {
            status: 'RESOLVED',
            resolution: dto.resolution,
            resolved_at: new Date(),
            staff_id: user.staffId
          }
        });
      });

      return { message: 'Đã hoàn tiền và chấp thuận khiếu nại.', data: res };
    }

    throw new BadRequestException('Trạng thái không hợp lệ.');
  }
}
