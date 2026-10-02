import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/query.dto';

export class ReportListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'])
  status?: 'ALL' | 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
