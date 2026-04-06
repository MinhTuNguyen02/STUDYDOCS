import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Post, Put, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { RolesGuard } from '../../common/security/roles.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { Roles } from '../../common/security/roles.decorator';

@ApiTags('Financial & Packages')
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  getActivePackages() {
    return this.packagesService.getActivePackages();
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  getAllAdmin() {
    return this.packagesService.getAllPackages();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createPackage(@Body() dto: any) {
    return this.packagesService.createPackage(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updatePackage(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.packagesService.updatePackage(id, dto);
  }

  @Post(':id/buy')
  @UseGuards(JwtAuthGuard)
  buyPackage(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.packagesService.buyPackage(user, id);
  }

  @Put(':id/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deletePackage(@Param('id', ParseIntPipe) id: number) {
    return this.packagesService.deletePackage(id);
  }
}
