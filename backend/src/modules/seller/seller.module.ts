import { Module } from '@nestjs/common';
import { SellerController } from './seller.controller';
import { SellerService } from './seller.service';
import { DocumentUploadService } from './document-upload.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  controllers: [SellerController],
  providers: [SellerService, DocumentUploadService]
})
export class SellerModule {}
