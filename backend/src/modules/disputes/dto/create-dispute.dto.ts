import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  orderItemId!: number;

  @ApiProperty({ example: 'Mô tả chi tiết về lý do hoặc nội dung' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;

  @ApiProperty({ example: 'Mô tả chi tiết về lý do hoặc nội dung' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}
