import { ApiProperty } from '@nestjs/swagger';
﻿import { IsIn, IsOptional, IsString } from 'class-validator';

export class ProcessWithdrawalDto {
  @IsString()
  @IsIn(['PAID', 'PAID', 'REJECTED'])
  status!: 'PAID' | 'PAID' | 'REJECTED';

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  note?: string;
}
