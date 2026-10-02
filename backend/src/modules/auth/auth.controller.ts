import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';

const REFRESH_COOKIE = 'studydocs_refresh';
const CSRF_COOKIE = 'studydocs_csrf';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService
  ) {}

  private cookieOptions(): CookieOptions {
    const production = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: production,
      sameSite: production ? 'none' : 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000
    };
  }

  private readRefreshCookie(request: Request): string {
    const rawCookie = this.readCookie(request, REFRESH_COOKIE);

    if (!rawCookie) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }

    return rawCookie;
  }

  private readCookie(request: Request, name: string): string | null {
    const rawCookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1);

    if (!rawCookie) return null;

    try {
      return decodeURIComponent(rawCookie);
    } catch {
      return null;
    }
  }

  private assertCsrf(request: Request) {
    const cookieToken = this.readCookie(request, CSRF_COOKIE);
    const headerToken = request.header('x-csrf-token');
    if (!cookieToken || !headerToken) {
      throw new UnauthorizedException('CSRF token không hợp lệ.');
    }
    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);
    if (
      cookieBuffer.length !== headerBuffer.length ||
      !timingSafeEqual(cookieBuffer, headerBuffer)
    ) {
      throw new UnauthorizedException('CSRF token không hợp lệ.');
    }
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
  }

  private clearRefreshCookie(response: Response) {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    response.clearCookie(REFRESH_COOKIE, options);
    response.clearCookie(CSRF_COOKIE, options);
  }

  @Get('csrf')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  csrf(@Res({ passthrough: true }) response: Response) {
    const csrfToken = randomBytes(32).toString('base64url');
    response.cookie(CSRF_COOKIE, csrfToken, this.cookieOptions());
    return { csrfToken };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...payload } = await this.authService.login(dto);
    this.setRefreshCookie(response, refreshToken);
    return payload;
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertCsrf(request);
    const result = await this.authService.refresh(this.readRefreshCookie(request));
    const { refreshToken, ...payload } = result;
    this.setRefreshCookie(response, refreshToken);
    return payload;
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      this.assertCsrf(request);
      return await this.authService.logout(this.readRefreshCookie(request));
    } finally {
      this.clearRefreshCookie(response);
    }
  }

  @Post('send-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  sendOtp(@CurrentUser() user: AuthUser, @Body() dto: SendOtpDto) {
    return this.authService.sendOtp(user, dto);
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  verifyOtp(@CurrentUser() user: AuthUser, @Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(user, dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() _req: Request) {
    // Initiate Google OAuth
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const tokens = await this.authService.googleLogin(req);
    this.setRefreshCookie(res, tokens.refreshToken);
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL').split(',')[0].trim();
    return res.redirect(`${frontendUrl}/login?oauth=success`);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
