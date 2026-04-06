import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'OTP bao gom 6 chu so' })
  otpCode!: string;

  @ApiProperty({ example: 'example value' })
  @IsOptional()
  @IsString()
  firebaseIdToken?: string;
}
