import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';

@ApiTags('Metadata')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('hierarchy')
  getHierarchy() {
    return this.categoriesService.getHierarchy();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.categoriesService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.categoriesService.update(+id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.categoriesService.remove(+id, user);
  }
}
