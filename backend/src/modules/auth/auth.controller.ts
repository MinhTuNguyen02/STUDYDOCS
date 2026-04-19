import { Body, Controller, Post, UseGuards, Get, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Post('send-otp')
  @UseGuards(JwtAuthGuard)
  sendOtp(@CurrentUser() user: AuthUser, @Body() dto: SendOtpDto) {
    return this.authService.sendOtp(user, dto);
  }

  @Post('verify-otp')
  @UseGuards(JwtAuthGuard)
  verifyOtp(@CurrentUser() user: AuthUser, @Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(user, dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {
    // Initiate Google OAuth
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    const tokens = await this.authService.googleLogin(req);
    // Redirect back to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&user=${encodeURIComponent(JSON.stringify(tokens.user))}`);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  setup2FA(@CurrentUser() user: AuthUser) {
    return this.authService.setup2FA(user);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  verify2FA(@CurrentUser() user: AuthUser, @Body('code') code: string) {
    return this.authService.verify2FA(user, code);
  }

  @Post('forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: any) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
