import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { Throttle } from '@nestjs/throttler';
import { ReportListQueryDto } from './dto/report-list-query.dto';

@ApiTags('Interactions (Reviews, Reports)')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createReport(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reportsService.createReport(user, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('mod', 'admin')
  listReports(@Query() query: ReportListQueryDto) {
    return this.reportsService.listReports(query);
  }

  @Put(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('mod', 'admin')
  resolveReport(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveReportDto
  ) {
    return this.reportsService.resolveReport(user, id, dto.status);
  }
}
