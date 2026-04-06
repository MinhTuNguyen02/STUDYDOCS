import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { StorageService } from '../storage/storage.service';
import { FilesController } from './files.controller';

@Module({
  controllers: [LibraryController, FilesController],
  providers: [LibraryService, StorageService]
})
export class LibraryModule {}
