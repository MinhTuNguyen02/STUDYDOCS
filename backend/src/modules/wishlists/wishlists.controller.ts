import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WishlistsService } from './wishlists.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { IsInt, Min } from 'class-validator';

export class ToggleWishlistDto {
  @IsInt()
  @Min(1)
  documentId!: number;
}

@ApiTags('Shop & Order')
@Controller('wishlists')
@UseGuards(JwtAuthGuard)
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Get()
  getWishlists(@CurrentUser() user: AuthUser) {
    return this.wishlistsService.getWishlists(user);
  }

  @Post('toggle')
  toggleWishlist(@CurrentUser() user: AuthUser, @Body() dto: ToggleWishlistDto) {
    return this.wishlistsService.toggleWishlist(user, dto.documentId);
  }
}
