import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Query, Post } from '@nestjs/common';
import { DocumentSearchDto } from './dto/document-search.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(@Query() query: DocumentSearchDto) {
    return this.documentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post(':id/view')
  incrementView(@Param('id') id: string) {
    return this.documentsService.incrementViewCount(id);
  }
}
