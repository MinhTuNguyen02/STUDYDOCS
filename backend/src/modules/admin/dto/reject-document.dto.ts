import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectDocumentDto {
  @ApiProperty({ example: 'Mô tả chi tiết về lý do hoặc nội dung' })
  @IsOptional()
  @IsString()
  reason?: string;
}
