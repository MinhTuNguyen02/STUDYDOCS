import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { report_status } from '@prisma/client';

@ApiTags('Interactions (Reviews, Reports, Disputes)')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  createReport(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReportDto
  ) {
    return this.reportsService.createReport(user, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('mod', 'admin')
  listReports() {
    return this.reportsService.listReports();
  }

  @Put(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('mod', 'admin')
  resolveReport(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: report_status
  ) {
    return this.reportsService.resolveReport(user, id, status);
  }
}
