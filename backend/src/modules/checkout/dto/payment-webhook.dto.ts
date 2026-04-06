import { ApiProperty } from '@nestjs/swagger';
﻿import { IsIn, IsOptional, IsString } from 'class-validator';

export class PaymentWebhookDto {
  @ApiProperty({ example: 'example value' })
  @IsString()
  eventId!: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  orderId!: string;

  @ApiProperty({ example: 'example value' })
  @IsString()
  providerTxnId!: string;

  @IsString()
  @IsIn(['SUCCESS', 'FAILED', 'FAILED'])
  status!: 'SUCCESS' | 'FAILED' | 'FAILED';

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  payload?: Record<string, unknown>;
}
