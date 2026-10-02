import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseIntPipe
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { Roles } from '../../common/security/roles.decorator';
import { RolesGuard } from '../../common/security/roles.guard';
import { PhoneVerifiedGuard } from '../../common/security/phone-verified.guard';
import { assertChronologicalDateRange } from '../../common/utils/date-range.util';
import { SellerService } from './seller.service';
import { DocumentUploadService } from './document-upload.service';
import { CreateSellerDocumentDto } from './dto/create-seller-document.dto';
import { UpdateSellerDocumentDto } from './dto/update-seller-document.dto';
import { Throttle } from '@nestjs/throttler';
import { ToggleVisibilityDto } from './dto/toggle-visibility.dto';
import {
  SellerDateRangeQueryDto,
  SellerDocumentListQueryDto,
  SellerSalesListQueryDto,
  SellerTrendQueryDto
} from './dto/seller-query.dto';

@ApiTags('Seller Actions')
@Controller('seller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer', 'admin') // Customer vừa là buyer vừa là seller
export class SellerController {
  constructor(
    private readonly sellerService: SellerService,
    private readonly documentUploadService: DocumentUploadService
  ) {}

  @Get('dashboard')
  getDashboardStats(@CurrentUser() user: AuthUser, @Query() query: SellerDateRangeQueryDto) {
    assertChronologicalDateRange(query.startDate, query.endDate);
    return this.sellerService.getDashboardStats(user, query.startDate, query.endDate);
  }

  @Get('dashboard/trend')
  getMonthlyTrend(@CurrentUser() user: AuthUser, @Query() query: SellerTrendQueryDto) {
    return this.sellerService.getMonthlyTrend(user, query.year?.toString());
  }

  @Get('dashboard/daily-trend')
  getDailyTrend(@CurrentUser() user: AuthUser, @Query() query: SellerDateRangeQueryDto) {
    assertChronologicalDateRange(query.startDate, query.endDate);
    return this.sellerService.getDailyTrend(user, query.startDate, query.endDate);
  }

  @Get('documents')
  listMyDocuments(@CurrentUser() user: AuthUser, @Query() query: SellerDocumentListQueryDto) {
    return this.sellerService.listMyDocuments(
      user,
      query.status,
      query.search,
      query.page,
      query.limit
    );
  }

  @Post('documents')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard, PhoneVerifiedGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024, files: 1 }
    })
  )
  async createDocument(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSellerDocumentDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('Phai upload kem file.');

    // Process and upload to the configured object storage.
    const uploadResult = await this.documentUploadService.processAndUploadDocument(
      file,
      dto.slug,
      dto.fileExtension
    );

    // Map processed values to DB logic
    const mergedDto = {
      ...dto,
      pageCount: uploadResult.pageCount,
      fileHash: uploadResult.fileHash,
      fileSizeMb: uploadResult.fileSize / (1024 * 1024),
      fileExtension: uploadResult.extension,
      storageKey: uploadResult.fileKey,
      previewKey: uploadResult.previewKey,
      reviewKey: uploadResult.reviewKey // full-page review PDF for staff
    };

    try {
      return await this.sellerService.createDocument(user, mergedDto);
    } catch (error) {
      await this.documentUploadService.cleanupUpload(uploadResult);
      throw error;
    }
  }

  @Patch('documents/:id')
  updateDocument(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSellerDocumentDto
  ) {
    return this.sellerService.updateDocument(user, id, dto);
  }

  @Patch('documents/:id/toggle-visibility')
  toggleVisibility(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleVisibilityDto
  ) {
    return this.sellerService.toggleVisibility(user, id, dto.isHidden);
  }

  @Get('sales/order-items')
  listSales(@CurrentUser() user: AuthUser, @Query() query: SellerSalesListQueryDto) {
    return this.sellerService.listSales(user, query.status, query.search, query.page, query.limit);
  }
}
