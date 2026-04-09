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
  ) { }

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

    // --- RULE MỚI: BẮT BUỘC STATUS = HELD ---
    if (orderItem.status !== 'HELD') {
      throw new BadRequestException('Chỉ có thể khiếu nại đối với đơn hàng đang trong thời gian tạm giữ tiền.');
    }

    // --- RULE MỚI: BẮT BUỘC CHƯA QUÁ HẠN HOLD ---
    if (orderItem.hold_until && orderItem.hold_until <= new Date()) {
      throw new BadRequestException('Thời gian tạm giữ tiền cho đơn hàng này đã kết thúc, không thể tạo khiếu nại.');
    }

    // Rule cũ: Dispute chỉ hiện khi NOW() - order.created_at <= 2 ngày 
    // (Có thể cân nhắc bỏ nếu hold_until đã cover, nhưng cứ giữ cho an toàn 2 lớp)
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

  async getAllDisputes() {
    return this.prisma.disputes.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        order_items: {
          include: {
            documents: { select: { title: true } },
            orders: { select: { order_id: true } }
          }
        },
        customer_profiles: { select: { full_name: true } }
      }
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

      // --- RULE MỚI: CHỐT CHẶN BẢO VỆ Ở TẦNG RESOLVE ---
      // Lỡ trong lúc đang Investigating, cronjob chạy và giải phóng tiền thì sao? Phải chặn lại!
      if (orderItem.status !== 'HELD') {
        throw new BadRequestException('Đơn hàng không còn ở trạng thái tạm giữ (HELD). Không thể hoàn tiền lúc này.');
      }

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

        // 3. Trừ tiền người bán 
        // DO ĐÃ CHẶN HELD Ở TRÊN, NAY CHỈ CẦN TRỪ PENDING BALANCE (Xóa logic RELEASED/PAID)
        await tx.wallets.update({
          where: { wallet_id: sellerWallet.wallet_id },
          data: { pending_balance: { decrement: orderItem.seller_earning } }
        });

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

        // 6. Ghi Ledger REFUND 
        await this.ledger.recordTransaction(
          tx,
          'REFUND',
          'DISPUTE',
          disputeId,
          `Hoàn tiền khiếu nại (Item ID: ${orderItem.order_item_id})`,
          [
            // Đã fix lỗi Nợ/Có kế toán từ round trước
            { wallet_id: buyerWallet.wallet_id, debit_amount: 0, credit_amount: orderItem.unit_price },
            { wallet_id: sellerWallet.wallet_id, debit_amount: orderItem.seller_earning, credit_amount: 0 },
            { wallet_id: systemRevenue.wallet_id, debit_amount: orderItem.commission_fee, credit_amount: 0 }
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