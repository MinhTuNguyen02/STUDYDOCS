import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { TagDto } from './dto/tag.dto';
import { SearchQueryDto } from '../../common/dto/query.dto';

@ApiTags('Metadata')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(@Query() query: SearchQueryDto) {
    return this.tagsService.findAll(query.search);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  create(@Body() dto: TagDto, @CurrentUser() user: AuthUser) {
    return this.tagsService.create(dto, user);
  }

  // BỔ SUNG: Endpoint để Frontend có thể gọi API cập nhật Tag
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TagDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.tagsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.tagsService.remove(id, user);
  }
}
