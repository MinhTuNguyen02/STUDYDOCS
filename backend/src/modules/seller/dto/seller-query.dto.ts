import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DateRangeQueryDto, PaginationQueryDto } from '../../../common/dto/query.dto';

export class SellerDateRangeQueryDto extends DateRangeQueryDto {}

export class SellerTrendQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class SellerDocumentListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'PENDING', 'APPROVED', 'REJECTED'])
  status?: string;
}

export class SellerSalesListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'PENDING', 'PAID'])
  status?: string;
}
