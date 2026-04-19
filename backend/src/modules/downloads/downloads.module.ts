import { Module, forwardRef } from '@nestjs/common';
import { DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';
import { StorageModule } from '../storage/storage.module';
import { PackagesModule } from '../packages/packages.module';

@Module({
  imports: [
    StorageModule,
    forwardRef(() => PackagesModule)
  ],
  controllers: [DownloadsController],
  providers: [DownloadsService],
  exports: [DownloadsService]
})
export class DownloadsModule {}
