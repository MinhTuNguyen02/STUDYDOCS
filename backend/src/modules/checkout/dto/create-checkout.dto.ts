import { ApiProperty } from '@nestjs/swagger';
﻿import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ example: 'example value' })
  @IsString()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => String)
  documentIds!: string[];
}
