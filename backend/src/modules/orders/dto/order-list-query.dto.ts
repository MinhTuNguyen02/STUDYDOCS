import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/query.dto';

export class OrderListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'PENDING_PAYMENT', 'PAID', 'CANCELLED'])
  status?: string;
}
