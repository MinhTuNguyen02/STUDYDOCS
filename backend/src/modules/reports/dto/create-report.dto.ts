import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  documentId!: number;

  @ApiProperty({ example: 'example value' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type!: string;

  @ApiProperty({ example: 'Mô tả chi tiết về lý do hoặc nội dung' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
