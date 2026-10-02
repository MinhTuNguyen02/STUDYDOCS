import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { CreateStaffAccountDto, PayTaxDto, ToggleUserActiveDto } from './dto/admin-actions.dto';
import {
  AdminDocumentQueryDto,
  AdminUserQueryDto,
  AuditLogQueryDto,
  DashboardQueryDto,
  PendingDocumentQueryDto,
  RequiredDateRangeQueryDto,
  WithdrawalListQueryDto
} from './dto/admin-query.dto';
import { DateRangeQueryDto, SearchQueryDto } from '../../common/dto/query.dto';
import { assertChronologicalDateRange } from '../../common/utils/date-range.util';

@ApiTags('System & Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @Roles('admin', 'accountant')
  dashboard(@Query() query: DashboardQueryDto) {
    assertChronologicalDateRange(query.startDate, query.endDate);
    return this.adminService.getDashboard(query);
  }

  @Get('reconciliation')
  @Roles('admin', 'accountant')
  getReconciliation() {
    return this.adminService.getReconciliation();
  }

  @Get('approvals/documents')
  @Roles('admin', 'mod')
  pendingDocuments(@Query() query: PendingDocumentQueryDto) {
    return this.adminService.getPendingDocuments(query);
  }

  @Patch('approvals/documents/:id/approve')
  @Roles('admin', 'mod')
  approveDocument(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.adminService.approveDocument(id, user);
  }

  @Patch('approvals/documents/:id/reject')
  @Roles('admin', 'mod')
  rejectDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectDocumentDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.adminService.rejectDocument(id, dto, user);
  }

  /** Staff-only: get a short-lived signed URL to review the full original file.
   * All accesses are logged in audit_logs for accountability. */
  @Get('approvals/documents/:id/review-url')
  @Roles('admin', 'mod')
  getDocumentReviewUrl(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.adminService.getDocumentReviewUrl(id, user);
  }

  @Get('withdrawals')
  @Roles('admin', 'accountant')
  getWithdrawals(@Query() query: WithdrawalListQueryDto) {
    return this.adminService.getWithdrawals(query);
  }

  @Get('documents')
  @Roles('admin', 'mod')
  getDocuments(@Query() query: AdminDocumentQueryDto) {
    return this.adminService.getDocuments({
      status: query.status,
      categoryId: query.categoryId?.toString(),
      search: query.search,
      page: query.page,
      limit: query.limit
    });
  }

  @Patch('documents/:id/soft-delete')
  @Roles('admin', 'mod')
  softDeleteDocument(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.adminService.softDeleteDocument(id, user);
  }

  @Patch('documents/:id/restore')
  @Roles('admin', 'mod')
  restoreDocument(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.adminService.restoreDocument(id, user);
  }

  @Get('users')
  @Roles('admin', 'mod')
  getUsers(@Query() query: AdminUserQueryDto, @CurrentUser() user: AuthUser) {
    return this.adminService.getUsers(query, user);
  }

  @Post('users/staff')
  @Roles('admin')
  createStaffAccount(@Body() dto: CreateStaffAccountDto, @CurrentUser() user: AuthUser) {
    return this.adminService.createStaffAccount(dto, user);
  }

  @Patch('users/:id/toggle-active')
  @Roles('admin', 'mod')
  toggleUserActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleUserActiveDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.adminService.toggleUserActive(id, dto.durationDays ?? null, user);
  }

  @Get('categories')
  @Roles('admin', 'mod')
  getCategories(@Query() query: SearchQueryDto) {
    return this.adminService.getCategories(query.search);
  }

  @Get('tags')
  @Roles('admin', 'mod')
  getTags(@Query() query: SearchQueryDto) {
    return this.adminService.getTags(query.search);
  }

  @Get('audit-logs')
  @Roles('admin')
  getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.adminService.getAuditLogs(query);
  }

  @Get('reports/revenue')
  @Roles('admin', 'accountant')
  exportRevenueReport(@Query() query: RequiredDateRangeQueryDto) {
    assertChronologicalDateRange(query.startDate, query.endDate);
    return this.adminService.exportRevenueReport(query.startDate, query.endDate);
  }

  @Get('wallets/gateway')
  @Roles('admin', 'accountant')
  getGatewayWallet(@Query() query: DateRangeQueryDto) {
    assertChronologicalDateRange(query.startDate, query.endDate);
    const today = new Date().toISOString().slice(0, 10);
    return this.adminService.getGatewayWalletReport(
      query.startDate || today,
      query.endDate || today
    );
  }

  @Get('wallets/tax')
  @Roles('admin', 'accountant')
  getTaxWallet(@Query() query: DateRangeQueryDto) {
    assertChronologicalDateRange(query.startDate, query.endDate);
    const today = new Date().toISOString().slice(0, 10);
    return this.adminService.getTaxWalletReport(query.startDate || today, query.endDate || today);
  }

  @Post('wallets/tax/pay')
  @Roles('admin', 'accountant')
  payTax(@CurrentUser() user: AuthUser, @Body() body: PayTaxDto) {
    return this.adminService.payTax(user, body.amount, body.note);
  }
}
