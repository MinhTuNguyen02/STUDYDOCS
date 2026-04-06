import { ApiProperty } from '@nestjs/swagger';
﻿import { IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ example: 'example value' })
  @IsString()
  documentId!: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  type!: string;

  @ApiProperty({ example: 'Mô tả chi tiết về lý do hoặc nội dung' })
  @IsOptional()
  @IsString()
  reason?: string;
}
