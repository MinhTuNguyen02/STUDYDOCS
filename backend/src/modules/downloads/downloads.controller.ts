import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { Request } from 'express';

@ApiTags('Documents / Downloads')
@Controller('downloads')
@UseGuards(JwtAuthGuard)
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Get(':id')
  requestDownload(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.downloadsService.requestDownload(user, id, req.ip || '127.0.0.1');
  }
}
