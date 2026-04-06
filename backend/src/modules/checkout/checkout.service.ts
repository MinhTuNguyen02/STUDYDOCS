import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, payment_status } from '@prisma/client';
import { createHmac } from 'crypto';
import { AuthUser } from '../../common/security/auth-user.interface';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { LedgerService } from '../wallets/ledger.service';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ledger: LedgerService
  ) { }

  // Giống hàm sortObject() trong demo chính thức của VNPAY
  // Keys + Values được encode bằng encodeURIComponent, %20 đổi thành +
  private sortObject(params: Record<string, string | number>): Record<string, string> {
    const sorted: Record<string, string> = {};
    // Sort theo encoded key
    const encodedKeys = Object.keys(params).map(k => encodeURIComponent(k)).sort();
    for (const encodedKey of encodedKeys) {
      const rawKey = decodeURIComponent(encodedKey);
      sorted[encodedKey] = encodeURIComponent(String(params[rawKey])).replace(/%20/g, '+');
    }
    return sorted;
  }

  // stringify các cặp key=value đã encode, không encode thêm (giống qs.stringify({encode:false}))
  private buildSignData(sortedParams: Record<string, string>): string {
    return Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
  }

  private signHmac(data: string): string {
    const secretKey = this.config.get<string>('VNPAY_HASH_SECRET', '');
    return createHmac('sha512', secretKey)
      .update(Buffer.from(data, 'utf-8'))
      .digest('hex');
  }

  private genOrderCode() {
    const suffix = Math.floor(Math.random() * 900000 + 100000);
    return `ORD-${Date.now()}-${suffix}`;
  }

  async createOrder(user: AuthUser, dto: CreateCheckoutDto) {
    if (!user.customerId) {
      throw new ForbiddenException('Tai khoan nay khong co quyen mua hang.');
    }

    const docIds = dto.documentIds.map((id) => Number(id));

    const docs = await this.prisma.documents.findMany({
      where: {
        document_id: { in: docIds },
        status: 'APPROVED',
      },
      select: {
        document_id: true,
        seller_id: true,
        price: true
      }
    });

    if (docs.length !== docIds.length) {
      throw new BadRequestException('Mot hoac nhieu tai lieu khong hop le de mua.');
    }

    // Chặn seller tự mua tài liệu của chính mình
    const selfOwned = docs.find(doc => doc.seller_id === user.customerId);
    if (selfOwned) {
      throw new BadRequestException('Khong the mua tai lieu cua chinh minh.');
    }

    // Chặn mua trùng tài liệu đã mua
    const alreadyBought = await this.prisma.order_items.findFirst({
      where: {
        document_id: { in: docIds },
        orders: {
          buyer_id: user.customerId!,
          status: 'PAID'
        },
        status: { in: ['PAID', 'HELD', 'RELEASED'] }
      }
    });
    if (alreadyBought) {
      throw new BadRequestException('Ban da mua tai lieu nay roi. Khong can mua lai.');
    }

    const totalAmount = docs.reduce((sum, doc) => sum.add(doc.price), new Prisma.Decimal(0));

    const commissionConfig = await this.prisma.configs.findUnique({ where: { config_key: 'COMMISSION_RATE' } });
    const commissionRate = new Prisma.Decimal(commissionConfig?.config_value ?? '0.5');
    const holdConfig = await this.prisma.configs.findUnique({ where: { config_key: 'HOLD_DURATION_HOURS' } });
    const holdHours = Number(holdConfig?.config_value ?? '48');

    const paymentWallet = await this.prisma.wallets.findUnique({
      where: {
        customer_id_wallet_type: { customer_id: user.customerId, wallet_type: 'PAYMENT' }
      }
    });

    if (!paymentWallet || paymentWallet.balance.lt(totalAmount)) {
      throw new BadRequestException('Số dư ví thanh toán không đủ. Vui lòng nạp thêm.');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const { systemRevenue } = await this.ledger.getSystemWallets(tx);

      // 1. Tru tien vi PAYMENT cua Buyer
      await tx.wallets.update({
        where: { wallet_id: paymentWallet.wallet_id },
        data: { balance: { decrement: totalAmount } }
      });

      // 2. Tao order PAID
      const createdOrder = await tx.orders.create({
        data: {
          buyer_id: user.customerId!,
          total_amount: totalAmount,
          status: 'PAID'
        }
      });

      let totalCommissionFee = new Prisma.Decimal(0);
      let sellerLedgerEntries = [];

      for (const doc of docs) {
        const commissionFee = doc.price.mul(commissionRate);
        const sellerEarning = doc.price.sub(commissionFee);

        totalCommissionFee = totalCommissionFee.add(commissionFee);

        // 3. Tao order_item HELD dang cho doi soat
        await tx.order_items.create({
          data: {
            order_id: createdOrder.order_id,
            document_id: doc.document_id,
            seller_id: doc.seller_id,
            unit_price: doc.price,
            commission_fee: commissionFee,
            seller_earning: sellerEarning,
            status: 'HELD',
            hold_until: new Date(Date.now() + holdHours * 60 * 60 * 1000)
          }
        });

        // 4. Cong tien vao Pending Balance vi REVENUE cua Seller
        const sellerWallet = await tx.wallets.upsert({
          where: {
            customer_id_wallet_type: { customer_id: doc.seller_id, wallet_type: 'REVENUE' }
          },
          create: {
            customer_id: doc.seller_id,
            wallet_type: 'REVENUE',
            balance: new Prisma.Decimal(0),
            pending_balance: sellerEarning
          },
          update: {
            pending_balance: { increment: sellerEarning }
          }
        });

        sellerLedgerEntries.push({
          wallet_id: sellerWallet.wallet_id,
          debit_amount: 0,
          credit_amount: sellerEarning
        });
      }

      // 5. Update SYSTEM_REVENUE
      await tx.wallets.update({
        where: { wallet_id: systemRevenue.wallet_id },
        data: { balance: { increment: totalCommissionFee } }
      });

      // 6. Record Double-Entry
      const ledgerEntries = [
        { wallet_id: paymentWallet.wallet_id, debit_amount: totalAmount, credit_amount: 0 },
        ...sellerLedgerEntries,
        { wallet_id: systemRevenue.wallet_id, debit_amount: 0, credit_amount: totalCommissionFee }
      ];

      await this.ledger.recordTransaction(
        tx,
        'PURCHASE',
        'ORDER',
        createdOrder.order_id,
        'Thanh toan mua tai lieu',
        ledgerEntries
      );

      // 7. Clear cart items
      await tx.cart_items.deleteMany({
        where: {
          documents: { document_id: { in: docIds } },
          carts: { customer_id: user.customerId! }
        }
      });

      return createdOrder;
    },
      {
        maxWait: 5000,
        timeout: 30000 // Tăng thời gian sống lên 30 giây (hoặc 60000 nếu máy chạy chậm)
      });

    return {
      orderId: order.order_id.toString(),
      status: order.status,
      message: 'Thanh toan don hang thanh cong bang vi PAYMENT.'
    };
  }

  // ──────────────────────────────────────────────
  // VN-PAY: TOP-UP WALLET LOGIC
  // ──────────────────────────────────────────────

  async createTopup(user: AuthUser, amount: number) {
    if (!user.customerId) throw new ForbiddenException('Khong the nap tien vao tai khoan nay.');

    if (amount < 10000) throw new BadRequestException('So tien nap toi thieu la 10,000 VND.');

    const txnRef = `TOPUP-${Date.now()}-${user.customerId}`;

    const payment = await this.prisma.payments.create({
      data: {
        provider: 'VNPAY',
        purpose: 'WALLET_TOPUP',
        amount: new Prisma.Decimal(amount),
        status: 'PENDING',
        request_payload: { customerId: user.customerId, txnRef } as Prisma.InputJsonValue
      }
    });

    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE', '');
    const secretKey = this.config.get<string>('VNPAY_HASH_SECRET', '');
    const vnpUrl = this.config.get<string>('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    const returnUrl = 'http://localhost:5173/payment/vnpay-return';

    const date = new Date();
    const createDate =
      `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}` +
      `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;

    let vnp_Params: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: payment.payment_id.toString(), // Truyen payment_id vao TxnRef
      vnp_OrderInfo: `Nap tien vao vi PAYMENT ${user.customerId}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: createDate
    };

    const sortedParams = this.sortObject(vnp_Params);
    const signData = this.buildSignData(sortedParams);
    const signed = this.signHmac(signData);

    // Build URL: ky bang encoded params, build URL cung dung encoded params (KHONG encode them)
    // Giong demo: vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false })
    const finalParams: Record<string, string> = { ...sortedParams, vnp_SecureHash: signed };
    const queryString = Object.entries(finalParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    return {
      paymentId: payment.payment_id,
      paymentUrl: `${vnpUrl}?${queryString}`
    };
  }

  // Handle IPN cho giao dich TOP-UP
  async handlePaymentWebhook({ providerTxnId, status, payload, eventId }: PaymentWebhookDto) {
    const paymentId = Number(payload!['vnp_TxnRef']); // Vnp_TxnRef mapping voi payment_id

    const payment = await this.prisma.payments.findUnique({
      where: { payment_id: paymentId }
    });

    if (!payment) throw new NotFoundException('Khong tim thay giao dich nap tien.');
    if (payment.status === 'COMPLETED') return { message: 'Da xu ly roi.', idempotent: true };

    const mappedStatus: payment_status = status === 'SUCCESS' ? 'COMPLETED' : 'FAILED';

    await this.prisma.$transaction(async (tx) => {
      await tx.payments.update({
        where: { payment_id: paymentId },
        data: {
          status: mappedStatus,
          provider_txn_id: providerTxnId,
          callback_payload: payload as Prisma.InputJsonValue
        }
      });

      if (mappedStatus === 'COMPLETED') {
        const reqPayload = payment.request_payload as any;
        const customerId = reqPayload.customerId;

        const { gatewayPool } = await this.ledger.getSystemWallets(tx);

        await tx.wallets.update({
          where: { wallet_id: gatewayPool.wallet_id },
          data: { balance: { increment: payment.amount } }
        });

        // Cong tien truc tiep vao vi PAYMENT (Balance thuc te)
        const buyerWallet = await tx.wallets.upsert({
          where: { customer_id_wallet_type: { customer_id: customerId, wallet_type: 'PAYMENT' } },
          create: {
            customer_id: customerId,
            wallet_type: 'PAYMENT',
            balance: payment.amount,
            pending_balance: new Prisma.Decimal(0)
          },
          update: {
            balance: { increment: payment.amount }
          }
        });

        await this.ledger.recordTransaction(
          tx,
          'DEPOSIT',
          'PAYMENT',
          payment.payment_id,
          'Nap tien vao vi qua VNPay',
          [
            { wallet_id: gatewayPool.wallet_id, debit_amount: payment.amount, credit_amount: 0 },
            { wallet_id: buyerWallet.wallet_id, debit_amount: 0, credit_amount: payment.amount }
          ]
        );
      }
    }, {
      maxWait: 5000,
      timeout: 30000
    });

    return { message: 'Nap tien Wallet thanh cong.' };
  }

  async getOrderStatus(user: AuthUser, orderId: string) {
    const id = Number(orderId);

    const order = await this.prisma.orders.findUnique({
      where: { order_id: id },
      include: {
        payments: { orderBy: { created_at: 'desc' }, take: 1 },
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
    });

    if (!order) throw new NotFoundException('Khong tim thay don hang.');

    const isInternal = user.roleNames.some((role) => ['admin', 'mod', 'accountant'].includes(role));
    if (!isInternal && order.buyer_id !== user.customerId) {
      throw new ForbiddenException('Ban khong co quyen xem don hang nay.');
    }

    const payment = order.payments[0];

    return toJsonSafe({
      orderId: order.order_id,
      status: order.status,
      paymentStatus: payment?.status ?? null,
      items: order.order_items.map((item) => ({
        id: item.order_item_id,
        status: item.status,
        unitPrice: item.unit_price,
        document: item.documents
      }))
    });
  }


  // async vnpayIpn(rawQuery: Record<string, string>) {
  //   // Tách riêng secureHash TRƯỚC khi xử lý, không mutate rawQuery trực tiếp
  //   const secureHash = rawQuery['vnp_SecureHash'];
  //   const vnpParams: Record<string, string> = { ...rawQuery };
  //   delete vnpParams['vnp_SecureHash'];
  //   delete vnpParams['vnp_SecureHashType'];

  //   // Dùng cùng hàm sortObject như khi tạo chữ ký
  //   const sortedParams = this.sortObject(vnpParams);
  //   const signData = this.buildSignData(sortedParams);
  //   const signed = this.signHmac(signData);

  //   if (secureHash !== signed) {
  //     // VNPAY yêu cầu trả JSON, không được throw exception
  //     return { RspCode: '97', Message: 'Checksum failed' };
  //   }

  //   const responseCode = rawQuery['vnp_ResponseCode'];
  //   const isSuccess = responseCode === '00';

  //   try {
  //     await this.handlePaymentWebhook({
  //       orderId: '0',
  //       providerTxnId: rawQuery['vnp_TransactionNo'],
  //       status: isSuccess ? 'SUCCESS' : 'FAILED',
  //       eventId: rawQuery['vnp_TransactionNo'],
  //       payload: rawQuery
  //     });
  //   } catch (err: any) {
  //     if (err?.status === 404) return { RspCode: '01', Message: 'Order not found' };
  //     if (err?.message?.includes('COMPLETED')) return { RspCode: '02', Message: 'Order already confirmed' };
  //     return { RspCode: '99', Message: err?.message || 'Unknown error' };
  //   }

  //   return { RspCode: '00', Message: 'Confirm Success' };
  // }
  async vnpayIpn(rawQuery: Record<string, string>) {
    console.log('--- NHẬN IPN TỪ VNPAY ---', rawQuery); // LOG 1: Xem VNPAY gửi gì lên

    const secureHash = rawQuery['vnp_SecureHash'];
    const vnpParams: Record<string, string> = { ...rawQuery };
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnpParams);
    const signData = this.buildSignData(sortedParams);
    const signed = this.signHmac(signData);

    if (secureHash !== signed) {
      console.error('LỖI: Sai chữ ký (Checksum failed)'); // LOG 2
      return { RspCode: '97', Message: 'Checksum failed' };
    }

    const paymentId = Number(rawQuery['vnp_TxnRef']);
    const vnpAmount = Number(rawQuery['vnp_Amount']) / 100;
    const responseCode = rawQuery['vnp_ResponseCode'];
    const transactionStatus = rawQuery['vnp_TransactionStatus'];

    try {
      const payment = await this.prisma.payments.findUnique({
        where: { payment_id: paymentId }
      });

      if (!payment) {
        console.error('LỖI: Không tìm thấy payment_id:', paymentId); // LOG 3
        return { RspCode: '01', Message: 'Order not found' };
      }

      console.log(`Kiểm tra tiền: DB=${payment.amount}, VNPAY=${vnpAmount}`); // LOG 4
      if (Number(payment.amount) !== vnpAmount) {
        console.error('LỖI: Sai số tiền'); // LOG 5
        return { RspCode: '04', Message: 'Invalid amount' };
      }

      if (payment.status === 'COMPLETED' || payment.status === 'FAILED') {
        console.log('CẢNH BÁO: Đơn hàng đã được xử lý trước đó');
        return { RspCode: '02', Message: 'Order already confirmed' };
      }

      const isSuccess = responseCode === '00' && transactionStatus === '00';

      await this.handlePaymentWebhook({
        orderId: '0',
        providerTxnId: rawQuery['vnp_TransactionNo'],
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        eventId: rawQuery['vnp_TransactionNo'],
        payload: rawQuery
      });

      console.log('THÀNH CÔNG: Đã cập nhật trạng thái'); // LOG 6
      return { RspCode: '00', Message: 'Confirm Success' };

    } catch (err: any) {
      console.error('LỖI HỆ THỐNG/DATABASE:', err); // LOG 7
      return { RspCode: '99', Message: err?.message || 'Unknown error' };
    }
  }
}

