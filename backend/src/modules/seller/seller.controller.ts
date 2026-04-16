import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { Roles } from '../../common/security/roles.decorator';
import { RolesGuard } from '../../common/security/roles.guard';
import { PhoneVerifiedGuard } from '../../common/security/phone-verified.guard';
import { SellerService } from './seller.service';
import { DocumentUploadService } from './document-upload.service';
import { CreateSellerDocumentDto } from './dto/create-seller-document.dto';
import { UpdateSellerDocumentDto } from './dto/update-seller-document.dto';

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
  getDashboardStats(@CurrentUser() user: AuthUser, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.sellerService.getDashboardStats(user, startDate, endDate);
  }

  @Get('dashboard/trend')
  getMonthlyTrend(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    return this.sellerService.getMonthlyTrend(user, year);
  }

  @Get('dashboard/daily-trend')
  getDailyTrend(
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.sellerService.getDailyTrend(user, startDate, endDate);
  }

  @Get('documents')
  listMyDocuments(
    @CurrentUser() user: AuthUser, 
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.sellerService.listMyDocuments(user, status, search, page, limit);
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard, RolesGuard, PhoneVerifiedGuard)
  @UseInterceptors(FileInterceptor('file'))
  async createDocument(
    @CurrentUser() user: AuthUser, 
    @Body() dto: CreateSellerDocumentDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('Phai upload kem file.');
    
    // Process and push to MinIO
    const uploadResult = await this.documentUploadService.processAndUploadDocument(file, dto.slug, dto.fileExtension);
    
    // Map processed values to DB logic
    const mergedDto = {
        ...dto,
        pageCount: uploadResult.pageCount || dto.pageCount,
        fileHash: uploadResult.fileHash,
        fileSizeMb: uploadResult.fileSize / (1024 * 1024),
        fileExtension: dto.fileExtension || uploadResult.extension,
        storageKey: uploadResult.fileKey,
        previewKey: uploadResult.previewKey,
        reviewKey: uploadResult.reviewKey   // full-page review PDF for staff
    };

    return this.sellerService.createDocument(user, mergedDto);
  }

  @Patch('documents/:id')
  updateDocument(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSellerDocumentDto) {
    return this.sellerService.updateDocument(user, id, dto);
  }

  @Get('sales/order-items')
  listSales(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.sellerService.listSales(user, status, search, page, limit);
  }
}
