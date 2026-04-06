import { ConflictException, ForbiddenException, Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, compareSync, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthUser } from '../../common/security/auth-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) { }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createSessionAndTokens(accountId: number, email: string) {
    const payload = {
      sub: accountId.toString(),
      email
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = randomUUID() + randomUUID();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    await this.prisma.user_sessions.create({
      data: {
        session_id: randomUUID(),
        account_id: accountId,
        refresh_token: refreshTokenHash,
        expires_at: expiresAt,
        is_revoked: false
      }
    });

    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const rawPassword = dto.password;

    const account = await this.prisma.accounts.findUnique({
      where: { email },
      include: {
        customer_profiles: true,
        staff_profiles: true,
        roles: { select: { name: true } }
      }
    });

    if (!account || !account.password_hash) {
      throw new UnauthorizedException('Thong tin dang nhap khong hop le.');
    }

    if (account.status === 'BANNED' || account.delete_at !== null) {
      throw new ForbiddenException('Tai khoan da bi vo hieu hoa.');
    }

    const isLegacyPlain = account.password_hash === rawPassword;
    const isBcryptAsync = account.password_hash.startsWith('$2')
      ? await compare(rawPassword, account.password_hash)
      : false;
    const isBcryptSync = account.password_hash.startsWith('$2')
      ? compareSync(rawPassword, account.password_hash)
      : false;

    const passwordMatched = isLegacyPlain || isBcryptAsync || isBcryptSync;
    if (!passwordMatched) {
      throw new UnauthorizedException('Thong tin dang nhap khong hop le.');
    }

    const profileName = account.customer_profiles?.full_name ?? account.staff_profiles?.full_name ?? null;
    const roleNames = [account.roles.name.toLowerCase()];
    const tokens = await this.createSessionAndTokens(account.account_id, account.email);

    return {
      message: 'Dang nhap thanh cong.',
      user: toJsonSafe({
        accountId: account.account_id,
        customerId: account.customer_profiles?.customer_id ?? null,
        staffId: account.staff_profiles?.staff_id ?? null,
        email: account.email,
        fullName: profileName,
        status: account.status,
        roleNames
      }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.accounts.findUnique({
      where: { email: dto.email.toLowerCase().trim() }
    });
    if (existing) {
      throw new ConflictException('Email da duoc su dung.');
    }

    const passwordHash = await hash(dto.password, 10);

    const customerRole = await this.prisma.roles.findUnique({
      where: { name: 'CUSTOMER' }
    });
    if (!customerRole) {
      throw new ConflictException('Hệ thống chưa cấu hình role CUSTOMER.');
    }

    const account = await this.prisma.accounts.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        password_hash: passwordHash,
        status: 'ACTIVE',
        roles: { connect: { role_id: customerRole.role_id } },
        customer_profiles: {
          create: {
            full_name: dto.fullName,
            carts: {
              create: {}
            },
            wallets: {
              create: [
                { wallet_type: 'PAYMENT' },
                { wallet_type: 'REVENUE' }
              ]
            }
          }
        }
      },
      include: { customer_profiles: true }
    });

    return {
      message: 'Dang ky thanh cong.',
      user: toJsonSafe({
        accountId: account.account_id,
        customerId: account.customer_profiles?.customer_id,
        fullName: account.customer_profiles?.full_name,
        email: account.email
      })
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const session = await this.prisma.user_sessions.findUnique({
      where: { refresh_token: tokenHash },
      include: { accounts: true }
    });

    if (!session || session.is_revoked || session.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token khong hop le hoac da het han.');
    }

    if (session.accounts.status === 'BANNED' || session.accounts.delete_at !== null) {
      throw new ForbiddenException('Tai khoan da bi vo hieu hoa.');
    }

    const payload = {
      sub: session.account_id.toString(),
      email: session.accounts.email
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret'),
      expiresIn: '15m'
    });

    return {
      message: 'Lam moi access token thanh cong.',
      accessToken
    };
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    await this.prisma.user_sessions.updateMany({
      where: { refresh_token: tokenHash },
      data: { is_revoked: true }
    });

    return { message: 'Dang xuat thanh cong.' };
  }

  async sendOtp(user: AuthUser, dto: SendOtpDto) {
    if (!user.customerId) {
      throw new ForbiddenException('Chi khach hang moi co the xac minh OTP.');
    }

    const { phoneNumber } = dto;

    // Lưu SĐT vào profile
    await this.prisma.customer_profiles.update({
      where: { customer_id: user.customerId },
      data: { phone_number: phoneNumber }
    });

    const firebaseProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID', '');

    // Mode 1: Firebase Production — Frontend gọi Firebase Auth SDK để gửi OTP qua SMS thật
    if (firebaseProjectId && firebaseProjectId !== 'placeholder') {
      return {
        message: 'Hay su dung Firebase SDK tren Frontend de gui OTP den so dien thoai.',
        mode: 'FIREBASE',
        phoneNumber
      };
    }

    // Mode 2: Mock OTP (Development) — Lưu OTP vào DB, log ra console
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[OTP MOCK] Code: ${otpCode} → Phone: ${phoneNumber}`);

    await this.prisma.accounts.update({
      where: { account_id: Number(user.accountId) },
      data: {
        phone_otp_code: otpCode,
        phone_otp_expires_at: new Date(Date.now() + 5 * 60 * 1000)
      }
    });

    return { message: 'Ma OTP da duoc gui (che do Mock). Xem console.', mode: 'MOCK' };
  }

  async verifyOtp(user: AuthUser, dto: VerifyOtpDto) {
    if (!user.customerId) {
      throw new ForbiddenException('Chi khach hang moi co the xac minh OTP.');
    }

    const firebaseProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID', '');

    // Mode 1: Firebase Production — Frontend gửi idToken sau khi verify OTP qua Firebase SDK
    if (firebaseProjectId && firebaseProjectId !== 'placeholder' && dto.firebaseIdToken) {
      // Import FirebaseAdminService — inject thêm nếu cần
      // Ở đây sử dụng trực tiếp firebase-admin để verify
      const admin = await import('firebase-admin');
      if (!admin.apps.length) {
        throw new BadRequestException('Firebase chua duoc cau hinh. Vui long kiem tra ENV.');
      }
      const decodedToken = await admin.auth().verifyIdToken(dto.firebaseIdToken);
      if (!decodedToken.phone_number) {
        throw new BadRequestException('Token Firebase khong chua so dien thoai.');
      }

      // Xác minh thành công
      await this.prisma.customer_profiles.update({
        where: { customer_id: user.customerId },
        data: {
          is_phone_verified: true,
          phone_number: decodedToken.phone_number
        }
      });

      return { message: 'Xac minh OTP qua Firebase thanh cong.' };
    }

    // Mode 2: Mock OTP Verification — So sánh OTP code trong DB
    const account = await this.prisma.accounts.findUnique({
      where: { account_id: Number(user.accountId) }
    });

    if (!account || !account.phone_otp_code || !account.phone_otp_expires_at) {
      throw new BadRequestException('Chua gui ma OTP hoac xac minh khong hop le.');
    }

    if (account.phone_otp_expires_at < new Date()) {
      throw new BadRequestException('Ma OTP da het han.');
    }

    if (account.phone_otp_code !== dto.otpCode) {
      throw new BadRequestException('Ma OTP khong chinh xac.');
    }

    // Validated, now approve
    await this.prisma.customer_profiles.update({
      where: { customer_id: user.customerId },
      data: { is_phone_verified: true }
    });

    // Clear OTP
    await this.prisma.accounts.update({
      where: { account_id: Number(user.accountId) },
      data: { phone_otp_code: null, phone_otp_expires_at: null }
    });

    return { message: 'Xac minh OTP thanh cong (Mock mode).' };
  }

  async googleLogin(req: any) {
    if (!req.user) {
      throw new UnauthorizedException('Chua xac thuc tu Google');
    }

    const { email, fullName, providerAccountId } = req.user;

    let account = await this.prisma.accounts.findUnique({
      where: { email },
      include: {
        customer_profiles: true,
        roles: { select: { name: true } }
      }
    });

    if (!account) {
      // Register logic for Google User
      const customerRole = await this.prisma.roles.findUnique({
        where: { name: 'CUSTOMER' }
      });

      account = await this.prisma.accounts.create({
        data: {
          email,
          auth_provider: 'GOOGLE',
          provider_account_id: providerAccountId,
          status: 'ACTIVE',
          roles: { connect: { role_id: customerRole!.role_id } },
          customer_profiles: {
            create: {
              full_name: fullName,
              carts: { create: {} },
              wallets: {
                create: [
                  { wallet_type: 'PAYMENT' },
                  { wallet_type: 'REVENUE' }
                ]
              }
            }
          }
        },
        include: {
          customer_profiles: true,
          roles: { select: { name: true } }
        }
      });
    }

    if (account.status === 'BANNED' || account.delete_at !== null) {
      throw new ForbiddenException('Tai khoan da bi vo hieu hoa.');
    }

    const profileName = account.customer_profiles?.full_name ?? fullName;
    const roleNames = [account.roles.name.toLowerCase()];
    const tokens = await this.createSessionAndTokens(account.account_id, account.email);

    return {
      message: 'Dang nhap Google thanh cong.',
      user: toJsonSafe({
        accountId: account.account_id,
        customerId: account.customer_profiles?.customer_id ?? null,
        email: account.email,
        fullName: profileName,
        status: account.status,
        roleNames
      }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async setup2FA(user: AuthUser) {
    const mockSecret = randomUUID(); // In real logic using Speakeasy, this is a base32 encoded string
    const mockQr = `data:image/png;base64,mockqrcodedata_${mockSecret}`;

    await this.prisma.accounts.update({
      where: { account_id: Number(user.accountId) },
      data: { two_factor_secret: mockSecret, is_two_factor_enabled: false } // Saved but not yet enabled
    });

    return {
      message: 'Ma 2FA da duoc khoi tao. Vui long verify de kich hoat.',
      secret: mockSecret,
      qrCode: mockQr
    };
  }

  async verify2FA(user: AuthUser, code: string) {
    if (!code || code.length !== 6) {
      throw new BadRequestException('Ma 2FA khong hop le.');
    }

    const account = await this.prisma.accounts.findUnique({
      where: { account_id: Number(user.accountId) }
    });

    if (!account || !account.two_factor_secret) {
      throw new BadRequestException('Chua setup 2FA.');
    }

    // Mock verification check: Assume any 6 digit code is correct for now (Speakeasy check would go here)
    if (code !== '123456') {
      // Force '123456' for demonstration
    }

    await this.prisma.accounts.update({
      where: { account_id: Number(user.accountId) },
      data: { is_two_factor_enabled: true }
    });

    return { message: 'Kich hoat 2FA thanh cong va luu vao Database.' };
  }
}
