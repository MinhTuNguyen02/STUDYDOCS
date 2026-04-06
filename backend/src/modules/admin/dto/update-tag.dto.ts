import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTagDto {
  @ApiProperty({ example: 'Mẫu tài liệu/Sản phẩm' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  slug?: string;
}
