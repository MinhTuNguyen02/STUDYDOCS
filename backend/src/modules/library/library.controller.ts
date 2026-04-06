import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { PhoneVerifiedGuard } from '../../common/security/phone-verified.guard';
import { LibraryService } from './library.service';

@ApiTags('Documents / Library')
@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('documents')
  listMyDocuments(@CurrentUser() user: AuthUser) {
    return this.libraryService.listAccessibleDocuments(user);
  }

  @Post('documents/:id/download-link')
  @UseGuards(JwtAuthGuard, PhoneVerifiedGuard)
  createDownloadLink(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: { ip?: string; socket?: { remoteAddress?: string } }
  ) {
    const ipAddress = req.ip ?? req.socket?.remoteAddress ?? null;
    return this.libraryService.createDownloadLink(user, id, ipAddress ?? undefined);
  }
}

