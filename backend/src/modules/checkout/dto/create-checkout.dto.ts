import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ example: 'order_550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @MaxLength(100)
  @Matches(/^order_[A-Za-z0-9-]+$/)
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Type(() => String)
  @IsString({ each: true })
  @Matches(/^\d+$/, { each: true })
  documentIds!: string[];
}
