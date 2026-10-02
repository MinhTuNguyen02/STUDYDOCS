import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password@123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ example: 'Password@123' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Mat khau moi phai co it nhat 8 ky tu' })
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường, chữ số và ký tự đặc biệt'
  })
  newPassword!: string;
}
