import { ApiProperty } from '@nestjs/swagger';
﻿import { IsObject, IsString } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 'example value' })
  @IsString()
  amount!: string;

  @ApiProperty({ example: 'example value' })
  @IsObject()
  bankInfo!: Record<string, unknown>;
}
