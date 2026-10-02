import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { PhoneVerifiedGuard } from '../../common/security/phone-verified.guard';
import { ReviewsService } from './reviews.service';
import { UpsertReviewDto } from './dto/upsert-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';

@ApiTags('Interactions (Reviews, Reports)')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('documents/:documentId')
  listByDocument(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.reviewsService.listByDocument(documentId);
  }

  @Post('documents/:documentId')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  upsertMyReview(
    @CurrentUser() user: AuthUser,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() dto: UpsertReviewDto
  ) {
    return this.reviewsService.upsertMyReview(user, documentId, dto);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  replyToReview(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyReviewDto
  ) {
    return this.reviewsService.replyToReview(user, id, dto.reply);
  }

  /** Xóa review: buyer xóa của mình HOẶC admin/mod xóa bất kỳ */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  deleteReview(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.deleteReview(user, id);
  }

  /** Xóa reply seller: seller xóa reply của mình HOẶC admin/mod xóa bất kỳ */
  @Delete(':id/reply')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  deleteReply(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.deleteReply(user, id);
  }
}
