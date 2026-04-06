import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '0901234567' })
  @IsNotEmpty()
  @IsString()
  @Matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, { message: 'So dien thoai khong hop le' })
  phoneNumber!: string;
}
