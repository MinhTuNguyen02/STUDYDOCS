// import { BadRequestException, Controller, Get, Param, Query, Redirect } from '@nestjs/common';
// import { LibraryService } from './library.service';
// import { StorageService } from '../storage/storage.service';

// /**
//  * Route: GET /api/files/download/:storageKey
//  * Validate signed token rồi redirect sang Supabase presigned URL.
//  * Không yêu cầu JWT - bảo mật thông qua signed token có TTL.
//  */
// @Controller('files')
// export class FilesController {
//   constructor(
//     private readonly libraryService: LibraryService,
//     private readonly storageService: StorageService
//   ) {}

//   @Get('download/:storageKey(*)')
//   @Redirect()
//   async downloadFile(
//     @Param('storageKey') storageKey: string,
//     @Query('token') token: string,
//     @Query('exp') exp: string
//   ) {
//     if (!token || !exp) throw new BadRequestException('Thiếu token hoặc thời hạn.');

//     const isValid = this.libraryService.validateDownloadToken(storageKey, token, exp);
//     if (!isValid) throw new BadRequestException('Link tải xuống không hợp lệ hoặc đã hết hạn.');

//     const presignedUrl = await this.storageService.getPresignedUrl(storageKey, 60);
//     return { url: presignedUrl, statusCode: 302 };
//   }
// }
