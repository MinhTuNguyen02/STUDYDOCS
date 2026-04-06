import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartActionDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';

@ApiTags('Shop & Order')
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: AuthUser) {
    return this.cartService.getCart(user);
  }

  @Post('add')
  addToCart(@CurrentUser() user: AuthUser, @Body() dto: CartActionDto) {
    return this.cartService.addToCart(user, dto);
  }

  @Delete('remove/:documentId')
  removeFromCart(
    @CurrentUser() user: AuthUser, 
    @Param('documentId', ParseIntPipe) documentId: number
  ) {
    return this.cartService.removeFromCart(user, documentId);
  }

  @Delete('clear')
  clearCart(@CurrentUser() user: AuthUser) {
    return this.cartService.clearCart(user);
  }
}
