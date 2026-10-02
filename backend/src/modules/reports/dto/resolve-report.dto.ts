import { ApiProperty } from '@nestjs/swagger';
import { report_status } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ResolveReportDto {
  @ApiProperty({ enum: report_status })
  @IsEnum(report_status)
  status!: report_status;
}
