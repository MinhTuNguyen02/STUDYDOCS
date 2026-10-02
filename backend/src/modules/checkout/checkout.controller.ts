import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { Roles } from '../../common/security/roles.decorator';
import { RolesGuard } from '../../common/security/roles.guard';
import { PhoneVerifiedGuard } from '../../common/security/phone-verified.guard';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { CreateTopupDto } from './dto/create-topup.dto';

@ApiTags('Shop & Order')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.checkoutService.createOrder(user, dto);
  }

  @Post('wallet/topup')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  createTopup(@CurrentUser() user: AuthUser, @Body() dto: CreateTopupDto) {
    return this.checkoutService.createTopup(user, dto.amount);
  }

  @Get('orders/:id/status')
  @UseGuards(JwtAuthGuard)
  getOrderStatus(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.checkoutService.getOrderStatus(user, id);
  }

  @Get('payments/:id/status')
  @UseGuards(JwtAuthGuard)
  getPaymentStatus(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.checkoutService.getPaymentStatus(user, id);
  }

  @Post('webhooks/payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'accountant')
  handlePaymentWebhook(@Body() dto: PaymentWebhookDto) {
    return this.checkoutService.handlePaymentWebhook(dto);
  }

  @Get('vnpay-ipn')
  vnpayIpn(@Query() query: Record<string, string>) {
    return this.checkoutService.vnpayIpn(query);
  }
}
