import { ApiProperty } from '@nestjs/swagger';
﻿import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSellerDocumentDto {
  @ApiProperty({ example: 'Mẫu tài liệu/Sản phẩm' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Mô tả chi tiết về lý do hoặc nội dung' })
  @IsOptional()
  @IsString()
  @MinLength(200)
  description?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'PENDING';
}
