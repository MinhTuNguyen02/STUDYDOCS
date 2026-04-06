import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CartActionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  documentId!: number;
}
