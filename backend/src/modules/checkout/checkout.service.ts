import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { Prisma, payment_status } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuthUser } from '../../common/security/auth-user.interface';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { LedgerService } from '../wallets/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService
  ) {}

  // Giống hàm sortObject() trong demo chính thức của VNPAY
  // Keys + Values được encode bằng encodeURIComponent, %20 đổi thành +
  private sortObject(params: Record<string, string | number>): Record<string, string> {
    const sorted: Record<string, string> = {};
    // Sort theo encoded key
    const encodedKeys = Object.keys(params)
      .map((k) => encodeURIComponent(k))
      .sort();
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
    const secretKey = this.config.getOrThrow<string>('VNPAY_HASH_SECRET');
    return createHmac('sha512', secretKey).update(Buffer.from(data, 'utf-8')).digest('hex');
  }

  private genOrderCode() {
    const suffix = Math.floor(Math.random() * 900000 + 100000);
    return `ORD-${Date.now()}-${suffix}`;
  }

  async createOrder(user: AuthUser, dto: CreateCheckoutDto) {
    if (!user.customerId) {
      throw new ForbiddenException('Tai khoan nay khong co quyen mua hang.');
    }

    const previousOrder = await this.prisma.orders.findUnique({
      where: {
        buyer_id_idempotency_key: {
          buyer_id: user.customerId,
          idempotency_key: dto.idempotencyKey
        }
      }
    });
    if (previousOrder) {
      return {
        orderId: previousOrder.order_id.toString(),
        status: previousOrder.status,
        message: 'Yêu cầu thanh toán này đã được xử lý.',
        idempotent: true
      };
    }

    const docIds = dto.documentIds.map((id) => Number(id));

    const docs = await this.prisma.documents.findMany({
      where: {
        document_id: { in: docIds },
        status: 'APPROVED'
      },
      select: {
        document_id: true,
        seller_id: true,
        price: true,
        title: true,
        customer_profiles: { select: { account_id: true } }
      }
    });

    if (docs.length !== docIds.length) {
      throw new BadRequestException('Mot hoac nhieu tai lieu khong hop le de mua.');
    }

    // Chặn seller tự mua tài liệu của chính mình
    const selfOwned = docs.find((doc) => doc.seller_id === user.customerId);
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
        status: 'PAID'
      }
    });
    if (alreadyBought) {
      throw new BadRequestException('Ban da mua tai lieu nay roi. Khong can mua lai.');
    }

    const totalAmount = docs.reduce((sum, doc) => sum.add(doc.price), new Prisma.Decimal(0));

    const commissionConfig = await this.prisma.configs.findUnique({
      where: { config_key: 'COMMISSION_RATE' }
    });
    const commissionRate = new Prisma.Decimal(commissionConfig?.config_value ?? '0.5');

    const paymentWallet = await this.prisma.wallets.findUnique({
      where: {
        customer_id_wallet_type: { customer_id: user.customerId, wallet_type: 'PAYMENT' }
      }
    });

    if (!paymentWallet || paymentWallet.balance.lt(totalAmount)) {
      throw new BadRequestException('Số dư ví thanh toán không đủ. Vui lòng nạp thêm.');
    }

    let order;
    try {
      order = await this.prisma.$transaction(
        async (tx) => {
          const { systemRevenue } = await this.ledger.getSystemWallets(tx);

          const boughtInsideTransaction = await tx.order_items.findFirst({
            where: {
              document_id: { in: docIds },
              orders: { buyer_id: user.customerId!, status: 'PAID' },
              status: 'PAID'
            }
          });
          if (boughtInsideTransaction) {
            throw new BadRequestException('Bạn đã mua tài liệu này rồi. Không cần mua lại.');
          }

          // 1. Tru tien vi PAYMENT cua Buyer
          await tx.wallets.update({
            where: { wallet_id: paymentWallet.wallet_id },
            data: { balance: { decrement: totalAmount } }
          });

          // 2. Tao order PAID
          const createdOrder = await tx.orders.create({
            data: {
              buyer_id: user.customerId!,
              idempotency_key: dto.idempotencyKey,
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

            // 3. Tạo order item PAID: thanh toán hoàn tất và ghi nhận doanh thu ngay.
            await tx.order_items.create({
              data: {
                order_id: createdOrder.order_id,
                document_id: doc.document_id,
                seller_id: doc.seller_id,
                unit_price: doc.price,
                commission_fee: commissionFee,
                seller_earning: sellerEarning,
                status: 'PAID'
              }
            });

            // 4. Cong tien vao Balance vi REVENUE cua Seller (ngay lap tuc)
            const sellerWallet = await tx.wallets.upsert({
              where: {
                customer_id_wallet_type: { customer_id: doc.seller_id, wallet_type: 'REVENUE' }
              },
              create: {
                customer_id: doc.seller_id,
                wallet_type: 'REVENUE',
                balance: sellerEarning
              },
              update: {
                balance: { increment: sellerEarning }
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
            {
              wallet_id: systemRevenue.wallet_id,
              debit_amount: 0,
              credit_amount: totalCommissionFee
            }
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
          timeout: 30000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrentOrder = await this.prisma.orders.findUnique({
          where: {
            buyer_id_idempotency_key: {
              buyer_id: user.customerId,
              idempotency_key: dto.idempotencyKey
            }
          }
        });
        if (concurrentOrder) {
          return {
            orderId: concurrentOrder.order_id.toString(),
            status: concurrentOrder.status,
            message: 'Yêu cầu thanh toán này đã được xử lý.',
            idempotent: true
          };
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException(
          'Có giao dịch đồng thời. Vui lòng tải lại giỏ hàng trước khi thử lại.'
        );
      }
      throw error;
    }

    // ── Notification (SAU transaction commit) ──
    // Notify từng seller có tài liệu được mua
    const sellerAccountMap = new Map<number, string[]>();
    for (const doc of docs) {
      const sellerAccountId = doc.customer_profiles.account_id;
      const existing = sellerAccountMap.get(sellerAccountId) || [];
      existing.push(doc.title);
      sellerAccountMap.set(sellerAccountId, existing);
    }
    for (const [sellerAccountId, titles] of sellerAccountMap) {
      void this.notifications
        .notify({
          accountId: sellerAccountId,
          type: 'ORDER_NEW',
          title: 'Có đơn hàng mới',
          message: `Tài liệu "${titles.join(', ')}" vừa được mua. Đơn hàng #${order.order_id}.`,
          referenceId: order.order_id,
          referenceType: 'ORDER'
        })
        .catch((error) =>
          this.logger.error(
            'Không thể tạo thông báo đơn hàng.',
            error instanceof Error ? error.stack : undefined
          )
        );
      // Notify seller of wallet change
      void this.notifications.notifyAccountWalletChange(sellerAccountId);
    }

    // Notify buyer of wallet change
    void this.notifications.notifyAccountWalletChange(Number(user.accountId));

    return {
      orderId: order.order_id.toString(),
      status: order.status,
      message: 'Thanh toán đơn hàng thành công bằng ví PAYMENT.'
    };
  }

  // ──────────────────────────────────────────────
  // VN-PAY: TOP-UP WALLET LOGIC
  // ──────────────────────────────────────────────

  async createTopup(user: AuthUser, amount: number) {
    if (!user.customerId) throw new ForbiddenException('Không thể nạp tiền vào tài khoản này.');

    if (amount < 10000) throw new BadRequestException('Số tiền nạp tối thiểu là 10,000 VND.');

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

    const tmnCode = this.config.getOrThrow<string>('VNPAY_TMN_CODE');
    const vnpUrl = this.config.get<string>(
      'VNPAY_URL',
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
    );
    const returnUrl = `${this.config.getOrThrow<string>('FRONTEND_URL').split(',')[0].trim()}/payment/vnpay-return`;

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
  async handlePaymentWebhook({
    providerTxnId,
    status,
    payload,
    eventId: _eventId
  }: PaymentWebhookDto) {
    const paymentId = Number(payload!['vnp_TxnRef']); // Vnp_TxnRef mapping voi payment_id

    const payment = await this.prisma.payments.findUnique({
      where: { payment_id: paymentId }
    });

    if (!payment) throw new NotFoundException('Khong tim thay giao dich nap tien.');
    if (payment.status === 'COMPLETED') return { message: 'Da xu ly roi.', idempotent: true };

    const mappedStatus: payment_status = status === 'SUCCESS' ? 'COMPLETED' : 'FAILED';

    const processed = await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.payments.updateMany({
          where: { payment_id: paymentId, status: 'PENDING' },
          data: {
            status: mappedStatus,
            provider_txn_id: providerTxnId,
            callback_payload: payload as Prisma.InputJsonValue
          }
        });
        if (claimed.count !== 1) return false;

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
              balance: payment.amount
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
        return true;
      },
      {
        maxWait: 5000,
        timeout: 30000
      }
    );

    if (!processed) return { message: 'Đã xử lý rồi.', idempotent: true };

    // ── Notification: Nạp tiền thành công ──
    if (mappedStatus === 'COMPLETED') {
      const reqPayload = payment.request_payload as any;
      const profile = await this.prisma.customer_profiles.findUnique({
        where: { customer_id: reqPayload.customerId },
        select: { account_id: true }
      });
      if (profile) {
        void this.notifications
          .notify({
            accountId: profile.account_id,
            type: 'TOPUP_SUCCESS',
            title: 'Nạp tiền thành công',
            message: `Bạn đã nạp thành công ${Number(payment.amount).toLocaleString('vi-VN')}đ vào ví thanh toán.`,
            referenceId: payment.payment_id,
            referenceType: 'PAYMENT'
          })
          .catch((error) =>
            this.logger.error(
              'Không thể tạo thông báo nạp tiền.',
              error instanceof Error ? error.stack : undefined
            )
          );
        // Notify customer wallet update
        this.notifications.notifyAccountWalletChange(profile.account_id);
      }
    }

    return { message: 'Nap tien Wallet thanh cong.' };
  }

  async getOrderStatus(user: AuthUser, id: number) {
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
      createdAt: order.created_at,
      paymentStatus: payment?.status ?? null,
      items: order.order_items.map((item) => ({
        id: item.order_item_id,
        status: item.status,
        unitPrice: item.unit_price,
        document: item.documents
      }))
    });
  }

  async getPaymentStatus(user: AuthUser, paymentId: number) {
    const payment = await this.prisma.payments.findUnique({
      where: { payment_id: paymentId },
      select: {
        payment_id: true,
        purpose: true,
        amount: true,
        status: true,
        request_payload: true,
        created_at: true
      }
    });
    if (!payment || payment.purpose !== 'WALLET_TOPUP') {
      throw new NotFoundException('Không tìm thấy giao dịch.');
    }

    const requestPayload = payment.request_payload as Prisma.JsonObject | null;
    const ownerId = Number(requestPayload?.customerId);
    const isInternal = user.roleNames.some((role) => ['admin', 'accountant'].includes(role));
    if (!isInternal && (!user.customerId || ownerId !== user.customerId)) {
      throw new ForbiddenException('Bạn không có quyền xem giao dịch này.');
    }

    return toJsonSafe({
      paymentId: payment.payment_id,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.created_at
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
    const secureHash = rawQuery['vnp_SecureHash'];
    const vnpParams: Record<string, string> = { ...rawQuery };
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnpParams);
    const signData = this.buildSignData(sortedParams);
    const signed = this.signHmac(signData);

    const providedHash = Buffer.from(secureHash || '', 'utf8');
    const expectedHash = Buffer.from(signed, 'utf8');
    if (
      providedHash.length !== expectedHash.length ||
      !timingSafeEqual(providedHash, expectedHash)
    ) {
      this.logger.warn('VNPay IPN checksum failed.');
      return { RspCode: '97', Message: 'Checksum failed' };
    }

    const paymentId = Number(rawQuery['vnp_TxnRef']);
    const vnpAmount = Number(rawQuery['vnp_Amount']) / 100;
    const responseCode = rawQuery['vnp_ResponseCode'];
    const transactionStatus = rawQuery['vnp_TransactionStatus'];

    if (
      !Number.isSafeInteger(paymentId) ||
      paymentId <= 0 ||
      !Number.isFinite(vnpAmount) ||
      vnpAmount <= 0
    ) {
      return { RspCode: '01', Message: 'Invalid request' };
    }

    try {
      const payment = await this.prisma.payments.findUnique({
        where: { payment_id: paymentId }
      });

      if (!payment) {
        return { RspCode: '01', Message: 'Order not found' };
      }

      if (Number(payment.amount) !== vnpAmount) {
        return { RspCode: '04', Message: 'Invalid amount' };
      }

      if (payment.status === 'COMPLETED' || payment.status === 'FAILED') {
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

      return { RspCode: '00', Message: 'Confirm Success' };
    } catch (error) {
      this.logger.error(
        'VNPay IPN processing failed.',
        error instanceof Error ? error.stack : undefined
      );
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }
}
