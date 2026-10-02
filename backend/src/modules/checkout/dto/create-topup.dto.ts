import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CreateTopupDto {
  @Type(() => Number)
  @IsInt()
  @Min(10_000)
  @Max(100_000_000)
  amount!: number;
}
