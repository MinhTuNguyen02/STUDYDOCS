import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Query, Post, UseGuards, ParseIntPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DocumentSearchDto } from './dto/document-search.dto';
import { DocumentsService } from './documents.service';
import { OptionalJwtAuthGuard } from '../../common/security/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(@Query() query: DocumentSearchDto) {
    return this.documentsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user?: AuthUser) {
    return this.documentsService.findOne(id, user);
  }

  @Post(':id/view')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  incrementView(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.incrementViewCount(id);
  }
}
