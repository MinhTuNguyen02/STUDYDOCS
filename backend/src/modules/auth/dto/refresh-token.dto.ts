import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'example value' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
