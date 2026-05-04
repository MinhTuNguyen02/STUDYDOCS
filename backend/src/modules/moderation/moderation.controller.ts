import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { Roles } from '../../common/security/roles.decorator';
import { RolesGuard } from '../../common/security/roles.guard';
import { ModerationService } from './moderation.service';
import { CreateReportDto } from './dto/create-report.dto';
import { HandleReportDto } from './dto/handle-report.dto';

@ApiTags('Interactions (Reviews, Reports)')
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  createReport(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.moderationService.createReport(user, dto);
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('mod', 'admin')
  listReports() {
    return this.moderationService.listReports();
  }

  @Patch('reports/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('mod', 'admin')
  handleReport(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: HandleReportDto) {
    return this.moderationService.handleReport(user, id, dto);
  }
}
