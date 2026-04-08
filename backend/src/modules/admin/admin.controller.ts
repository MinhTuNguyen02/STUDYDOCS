import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';

@ApiTags('System & Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'mod', 'accountant')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.getDashboard();
  }

  @Get('reconciliation')
  getReconciliation() {
    return this.adminService.getReconciliation();
  }

  @Get('approvals/documents')
  pendingDocuments() {
    return this.adminService.getPendingDocuments();
  }

  @Patch('approvals/documents/:id/approve')
  approveDocument(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.approveDocument(id, user);
  }

  @Patch('approvals/documents/:id/reject')
  rejectDocument(@Param('id') id: string, @Body() dto: RejectDocumentDto, @CurrentUser() user: AuthUser) {
    return this.adminService.rejectDocument(id, dto, user);
  }

  /** Staff-only: get a short-lived signed URL to review the full original file.
   * All accesses are logged in audit_logs for accountability. */
  @Get('approvals/documents/:id/review-url')
  getDocumentReviewUrl(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.getDocumentReviewUrl(id, user);
  }

  @Get('withdrawals')
  getWithdrawals() {
    return this.adminService.getWithdrawals();
  }

  @Get('documents')
  getDocuments(
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string
  ) {
    return this.adminService.getDocuments({ status, categoryId, search });
  }

  @Patch('documents/:id/soft-delete')
  softDeleteDocument(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.softDeleteDocument(id, user);
  }

  @Patch('documents/:id/restore')
  restoreDocument(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.restoreDocument(id, user);
  }

  @Get('users')
  getUsers(@Query('search') search?: string) {
    return this.adminService.getUsers(search);
  }

  @Patch('users/:id/toggle-active')
  toggleUserActive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.toggleUserActive(id, user);
  }

  @Get('categories')
  getCategories(@Query('search') search?: string) {
    return this.adminService.getCategories(search);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  @Get('tags')
  getTags(@Query('search') search?: string) {
    return this.adminService.getTags(search);
  }

  @Post('tags')
  createTag(@Body() dto: CreateTagDto) {
    return this.adminService.createTag(dto);
  }

  @Patch('tags/:id')
  updateTag(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.adminService.updateTag(id, dto);
  }

  @Delete('tags/:id')
  deleteTag(@Param('id') id: string) {
    return this.adminService.deleteTag(id);
  }

  @Get('audit-logs')
  getAuditLogs(@Query('userId') userId?: string, @Query('action') action?: string, @Query('limit') limit?: string) {
    return this.adminService.getAuditLogs(userId, action, limit ? Number(limit) : 50);
  }

  @Get('reports/revenue')
  exportRevenueReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    if (!startDate || !endDate) return [];
    return this.adminService.exportRevenueReport(startDate, endDate);
  }
}
