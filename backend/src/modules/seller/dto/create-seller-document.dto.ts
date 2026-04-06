import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSellerDocumentDto {
  @ApiProperty({ example: 'Mẫu tài liệu/Sản phẩm' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  slug!: string;

  @ApiProperty({ example: 'Mô tả chi tiết về lý do hoặc nội dung' })
  @IsString()
  @MinLength(200)
  description!: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  categoryId!: string;

  @ApiProperty({ example: '1,2,3' })
  @IsOptional()
  @IsString()
  tagIds?: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  fileExtension!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  fileSizeMb!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageCount!: number;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  storageKey?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  previewKey?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  fileHash?: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  price!: string;
}
