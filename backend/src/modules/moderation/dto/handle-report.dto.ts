import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class HandleReportDto {
  @IsString()
  @IsIn(['RESOLVED', 'REJECTED'])
  status!: 'RESOLVED' | 'REJECTED';

  @IsString()
  @IsIn(['DELETE_DOCUMENT', 'BAN_USER', 'IGNORE'])
  action!: 'DELETE_DOCUMENT' | 'BAN_USER' | 'IGNORE';

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  note?: string;
}
