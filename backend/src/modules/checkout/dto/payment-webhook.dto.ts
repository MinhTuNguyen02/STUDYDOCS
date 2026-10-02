import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PaymentWebhookDto {
  @ApiProperty({ example: 'evt_123' })
  @IsString()
  @MaxLength(100)
  eventId!: string;

  @ApiProperty({ example: '0' })
  @IsString()
  @MaxLength(100)
  orderId!: string;

  @ApiProperty({ example: 'provider-transaction-id' })
  @IsString()
  @MaxLength(100)
  providerTxnId!: string;

  @IsString()
  @IsIn(['SUCCESS', 'FAILED'])
  status!: 'SUCCESS' | 'FAILED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
