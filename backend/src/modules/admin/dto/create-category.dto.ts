import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Mẫu tài liệu/Sản phẩm' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
