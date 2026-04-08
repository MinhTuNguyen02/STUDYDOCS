import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Query, Post, UseGuards } from '@nestjs/common';
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
  findOne(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.documentsService.findOne(id, user);
  }

  @Post(':id/view')
  incrementView(@Param('id') id: string) {
    return this.documentsService.incrementViewCount(id);
  }
}
