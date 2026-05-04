import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Delete, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { PhoneVerifiedGuard } from '../../common/security/phone-verified.guard';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { ReviewsService } from './reviews.service';
import { UpsertReviewDto } from './dto/upsert-review.dto';

@ApiTags('Interactions (Reviews, Reports)')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) { }

  @Get('documents/:documentId')
  listByDocument(@Param('documentId') documentId: string) {
    return this.reviewsService.listByDocument(documentId);
  }

  @Post('documents/:documentId')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  upsertMyReview(@CurrentUser() user: AuthUser, @Param('documentId') documentId: string, @Body() dto: UpsertReviewDto) {
    return this.reviewsService.upsertMyReview(user, documentId, dto);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  replyToReview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('reply') reply: string
  ) {
    return this.reviewsService.replyToReview(user, Number(id), reply);
  }

  /** Xóa review: buyer xóa của mình HOẶC admin/mod xóa bất kỳ */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  deleteReview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reviewsService.deleteReview(user, Number(id));
  }

  /** Xóa reply seller: seller xóa reply của mình HOẶC admin/mod xóa bất kỳ */
  @Delete(':id/reply')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  deleteReply(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reviewsService.deleteReply(user, Number(id));
  }
}

