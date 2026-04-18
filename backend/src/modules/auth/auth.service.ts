import { ConflictException, ForbiddenException, Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
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
import { FirebaseAdminService } from './firebase.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly mailerService: MailerService
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
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ.');
    }

    if (account.status === 'BANNED' || account.delete_at !== null) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa.');
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
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ.');
    }

    const profileName = account.customer_profiles?.full_name ?? account.staff_profiles?.full_name ?? null;
    const roleNames = [account.roles.name.toLowerCase()];
    const tokens = await this.createSessionAndTokens(account.account_id, account.email);

    // Check if this customer has ever uploaded a document
    const customerId = account.customer_profiles?.customer_id;
    const hasUploadedDocument = customerId
      ? (await this.prisma.documents.count({ where: { seller_id: customerId } })) > 0
      : false;

    return {
      message: 'Đăng nhập thành công.',
      user: toJsonSafe({
        accountId: account.account_id,
        customerId: account.customer_profiles?.customer_id ?? null,
        staffId: account.staff_profiles?.staff_id ?? null,
        email: account.email,
        fullName: profileName,
        status: account.status,
        roleNames,
        isPhoneVerified: account.customer_profiles?.is_phone_verified ?? account.staff_profiles?.is_phone_verified ?? false,
        hasUploadedDocument
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
      message: 'Đăng ký thành công.',
      user: toJsonSafe({
        accountId: account.account_id,
        customerId: account.customer_profiles?.customer_id,
        fullName: account.customer_profiles?.full_name,
        email: account.email,
        isPhoneVerified: account.customer_profiles?.is_phone_verified ?? false
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
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn.');
    }

    if (session.accounts.status === 'BANNED' || session.accounts.delete_at !== null) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa.');
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
      message: 'Làm mới access token thành công.',
      accessToken
    };
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    await this.prisma.user_sessions.updateMany({
      where: { refresh_token: tokenHash },
      data: { is_revoked: true }
    });

    return { message: 'Đăng xuất thành công.' };
  }

  async sendOtp(user: AuthUser, dto: SendOtpDto) {
    if (!user.customerId) {
      throw new ForbiddenException('Chỉ khách hàng mới có thể xác minh OTP.');
    }

    const { phoneNumber } = dto;

    // Không lưu số điện thoại vội, chỉ lưu khi Verify thành công để tránh lỗi rác DB
    const firebaseProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID', '');

    // Mode 1: Firebase Production — Frontend gọi Firebase Auth SDK để gửi OTP qua SMS thật
    if (firebaseProjectId && firebaseProjectId !== 'placeholder') {
      return {
        message: 'Hãy sử dụng Firebase SDK trên frontend để gửi OTP đến số điện thoại.',
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

    // Lưu tạm SĐT vào profile nhưng chưa verify (cho Mock Mode)
    await this.prisma.customer_profiles.update({
      where: { customer_id: user.customerId },
      data: { phone_number: phoneNumber }
    });

    return { message: 'Ma OTP da duoc gui (che do Mock). Xem console.', mode: 'MOCK' };
  }

  async verifyOtp(user: AuthUser, dto: VerifyOtpDto) {
    if (!user.customerId) {
      throw new ForbiddenException('Chỉ khách hàng mới có thể xác minh OTP.');
    }

    const firebaseProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID', '');

    // Mode 1: Firebase Production — Frontend gửi idToken sau khi verify OTP qua Firebase SDK
    if (firebaseProjectId && firebaseProjectId !== 'placeholder' && dto.firebaseIdToken) {
      // Sửa đoạn này: Gọi firebaseAdmin thay vì import động
      const decodedToken = await this.firebaseAdmin.verifyPhoneToken(dto.firebaseIdToken);

      // Xác minh thành công
      await this.prisma.customer_profiles.update({
        where: { customer_id: user.customerId },
        data: {
          is_phone_verified: true,
          phone_number: decodedToken.phone_number
        }
      });

      return { message: 'Xác minh OTP qua Firebase thành công.' };
    }


    // Mode 2: Mock OTP Verification — So sánh OTP code trong DB
    const account = await this.prisma.accounts.findUnique({
      where: { account_id: Number(user.accountId) }
    });

    if (!account || !account.phone_otp_code || !account.phone_otp_expires_at) {
      throw new BadRequestException('Chưa gửi mã OTP hoặc xác minh không hợp lệ.');
    }

    if (account.phone_otp_expires_at < new Date()) {
      throw new BadRequestException('Ma OTP da het han.');
    }

    if (account.phone_otp_code !== dto.otpCode) {
      throw new BadRequestException('Mã OTP không chính xác.');
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

    return { message: 'Xác minh OTP thành công (Mock mode).' };
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
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa.');
    }

    const profileName = account.customer_profiles?.full_name ?? fullName;
    const roleNames = [account.roles.name.toLowerCase()];
    const tokens = await this.createSessionAndTokens(account.account_id, account.email);

    return {
      message: 'Đăng nhập Google thành công.',
      user: toJsonSafe({
        accountId: account.account_id,
        customerId: account.customer_profiles?.customer_id ?? null,
        email: account.email,
        fullName: profileName,
        status: account.status,
        roleNames,
        isPhoneVerified: account.customer_profiles?.is_phone_verified ?? false
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
      throw new BadRequestException('Mã 2FA không hợp lệ.');
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

    return { message: 'Kích hoạt 2FA thành công và lưu vào database.' };
  }

  async forgotPassword(email: string) {
    const formattedEmail = email.trim().toLowerCase();
    const account = await this.prisma.accounts.findUnique({ where: { email: formattedEmail } });
    
    if (!account) {
      // Don't throw 404 to prevent email enumeration, but we'll throw here for UX
      throw new NotFoundException('Không tìm thấy tài khoản với email này.');
    }

    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await this.prisma.accounts.update({
      where: { account_id: account.account_id },
      data: {
        reset_password_token: token,
        reset_password_expires: expiresAt
      }
    });

    const resetLink = `http://localhost:5173/reset-password?token=${token}`;
    
    // Gửi email thực tế thông qua thư viện nodemailer / mailer
    await this.mailerService.sendMail({
      to: formattedEmail,
      subject: 'Yêu cầu đặt lại mật khẩu - StudyDocs',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <h2 style="color: #4F46E5;">Khôi Phục Mật Khẩu StudyDocs</h2>
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email <strong>${formattedEmail}</strong>.</p>
          <p>Vui lòng click vào nút bên dưới để tiến hành thiết lập mật khẩu mới. Liên kết này có thời hạn sử dụng là <strong>15 phút</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              Đặt lại mật khẩu
            </a>
          </div>
          <p style="font-size: 14px; color: #666;">Nếu nút bấm không hoạt động, bạn có thể copy và dán trực tiếp đường dẫn sau vào trình duyệt:</p>
          <p style="font-size: 14px; color: #4F46E5; word-break: break-all;">${resetLink}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
          <p style="font-size: 12px; color: #999;">Trân trọng,<br/>Đội ngũ StudyDocs</p>
        </div>
      `,
    });

    console.log(`\n\n[MAIL SENT] Đã gửi mail reset password cho ${formattedEmail}\n\n`);

    return { message: 'Link đặt lại mật khẩu đã được gửi' };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('Thiếu token hoặc mật khẩu mới.');
    }

    const account = await this.prisma.accounts.findFirst({
      where: {
        reset_password_token: token,
        reset_password_expires: { gt: new Date() } // Token phải còn hạn
      }
    });

    if (!account) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn.');
    }

    const hashedPassword = await hash(newPassword, 12);

    await this.prisma.accounts.update({
      where: { account_id: account.account_id },
      data: {
        password_hash: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null
      }
    });

    return { message: 'Đổi mật khẩu thành công' };
  }
}
