import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { TagsService } from './tags.service';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';

@ApiTags('Metadata')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) { }

  @Get()
  findAll(@Query('search') search: string) {
    return this.tagsService.findAll(search);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  create(@Body() dto: { tag_name: string; slug: string }, @CurrentUser() user: AuthUser) {
    return this.tagsService.create(dto, user);
  }

  // BỔ SUNG: Endpoint để Frontend có thể gọi API cập nhật Tag
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  update(
    @Param('id') id: string,
    @Body() dto: { tag_name: string; slug: string },
    @CurrentUser() user: AuthUser
  ) {
    return this.tagsService.update(+id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tagsService.remove(+id, user);
  }
}