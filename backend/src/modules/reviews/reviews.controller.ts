import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { PhoneVerifiedGuard } from '../../common/security/phone-verified.guard';
import { ReviewsService } from './reviews.service';
import { UpsertReviewDto } from './dto/upsert-review.dto';

@ApiTags('Interactions (Reviews, Reports, Disputes)')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

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
}
