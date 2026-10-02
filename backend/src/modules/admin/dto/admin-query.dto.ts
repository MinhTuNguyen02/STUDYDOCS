import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { DateRangeQueryDto, PaginationQueryDto } from '../../../common/dto/query.dto';

export class DashboardQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy?: 'day' | 'month';
}

export class AdminDocumentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;
}

export class AuditLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AdminUserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'BANNED'])
  status?: 'ALL' | 'ACTIVE' | 'BANNED';

  @IsOptional()
  @IsIn(['CUSTOMER', 'STAFF'])
  role?: 'CUSTOMER' | 'STAFF';

  @IsOptional()
  @IsIn(['NEWEST', 'DOCS_DESC', 'SALES_DESC'])
  sort?: 'NEWEST' | 'DOCS_DESC' | 'SALES_DESC';
}

export class PendingDocumentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class WithdrawalListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'PENDING', 'PAID', 'REJECTED'])
  status?: 'ALL' | 'PENDING' | 'PAID' | 'REJECTED';
}

export class RequiredDateRangeQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate!: string;
}
