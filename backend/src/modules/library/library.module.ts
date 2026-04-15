import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService, StorageService]
})
export class LibraryModule { }
