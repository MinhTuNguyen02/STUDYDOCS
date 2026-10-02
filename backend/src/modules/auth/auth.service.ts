import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import { compare, hash } from 'bcryptjs';
import { createHash, randomInt, randomUUID } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthUser } from '../../common/security/auth-user.interface';
import { FirebaseAdminService } from './firebase.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly mailerService: MailerService
  ) {}

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
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

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

    if (account.delete_at !== null) {
      throw new ForbiddenException('Tài khoản này đã bị xóa khỏi hệ thống.');
    }

    if (account.status === 'BANNED') {
      if (account.banned_until) {
        const until = account.banned_until.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Ho_Chi_Minh'
        });
        throw new ForbiddenException(
          `Tài khoản của bạn đang bị khóa tạm thời đến ngày ${until}. Nếu cần hỗ trợ, vui lòng liên hệ dịch vụ khách hàng.`
        );
      }
      throw new ForbiddenException(
        'Tài khoản của bạn đã bị khóa vĩnh viễn do vi phạm quy định. Vui lòng liên hệ bộ phận hỗ trợ để biết thêm chi tiết.'
      );
    }

    const passwordMatched = account.password_hash.startsWith('$2')
      ? await compare(rawPassword, account.password_hash)
      : false;
    if (!passwordMatched) {
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ.');
    }

    const profileName =
      account.customer_profiles?.full_name ?? account.staff_profiles?.full_name ?? null;
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
        isPhoneVerified:
          account.customer_profiles?.is_phone_verified ??
          account.staff_profiles?.is_phone_verified ??
          false,
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
      throw new ConflictException('Email đã được sử dụng.');
    }

    const passwordHash = await hash(dto.password, 12);

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
              create: [{ wallet_type: 'PAYMENT' }, { wallet_type: 'REVENUE' }]
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
        isPhoneVerified: account.customer_profiles?.is_phone_verified ?? false,
        hasUploadedDocument: false
      })
    };
  }

  async refresh(refreshTokenValue: string) {
    const tokenHash = this.hashRefreshToken(refreshTokenValue);
    const session = await this.prisma.user_sessions.findUnique({
      where: { refresh_token: tokenHash },
      include: {
        accounts: {
          include: {
            customer_profiles: true,
            staff_profiles: true,
            roles: { select: { name: true } }
          }
        }
      }
    });

    if (!session || session.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn.');
    }

    if (session.is_revoked) {
      await this.prisma.user_sessions.updateMany({
        where: { account_id: session.account_id, is_revoked: false },
        data: { is_revoked: true }
      });
      throw new UnauthorizedException(
        'Refresh token đã được sử dụng lại; mọi phiên đã bị thu hồi.'
      );
    }

    if (session.accounts.status === 'BANNED' || session.accounts.delete_at !== null) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa.');
    }

    const payload = {
      sub: session.account_id.toString(),
      email: session.accounts.email
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '2h'
    });

    const refreshToken = randomUUID() + randomUUID();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.user_sessions.updateMany({
        where: { session_id: session.session_id, is_revoked: false },
        data: { is_revoked: true }
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedException('Refresh token đã được sử dụng.');
      }
      await tx.user_sessions.create({
        data: {
          session_id: randomUUID(),
          account_id: session.account_id,
          refresh_token: refreshTokenHash,
          expires_at: expiresAt,
          is_revoked: false
        }
      });
    });

    const account = session.accounts;
    const customerId = account.customer_profiles?.customer_id;
    const hasUploadedDocument = customerId
      ? (await this.prisma.documents.count({ where: { seller_id: customerId } })) > 0
      : false;

    return {
      message: 'Lam moi access token thanh cong.',
      accessToken,
      refreshToken,
      user: toJsonSafe({
        accountId: account.account_id,
        customerId: account.customer_profiles?.customer_id ?? null,
        staffId: account.staff_profiles?.staff_id ?? null,
        email: account.email,
        fullName: account.customer_profiles?.full_name ?? account.staff_profiles?.full_name ?? null,
        status: account.status,
        roleNames: [account.roles.name.toLowerCase()],
        isPhoneVerified:
          account.customer_profiles?.is_phone_verified ??
          account.staff_profiles?.is_phone_verified ??
          false,
        hasUploadedDocument
      })
    };
  }

  async logout(refreshTokenValue: string) {
    const tokenHash = this.hashRefreshToken(refreshTokenValue);
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
        message: 'Hay su dung Firebase SDK tren Frontend de gui OTP den so dien thoai.',
        mode: 'FIREBASE',
        phoneNumber
      };
    }

    // Mock OTP must be an explicit local-development choice and is never allowed in production.
    const mockOtpEnabled = this.configService.get<string>('ENABLE_MOCK_OTP') === 'true';
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (!mockOtpEnabled || nodeEnv === 'production') {
      throw new ServiceUnavailableException('Dịch vụ xác minh số điện thoại chưa được cấu hình.');
    }

    const otpCode = randomInt(100000, 1000000).toString();

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

    return {
      message: 'Mã OTP đã được tạo cho môi trường phát triển.',
      mode: 'MOCK',
      mockOtpCode: otpCode
    };
  }

  async verifyOtp(user: AuthUser, dto: VerifyOtpDto) {
    if (!user.customerId) {
      throw new ForbiddenException('Chi khach hang moi co the xac minh OTP.');
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

      return { message: 'Xac minh OTP qua Firebase thanh cong.' };
    }

    const mockOtpEnabled = this.configService.get<string>('ENABLE_MOCK_OTP') === 'true';
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (!mockOtpEnabled || nodeEnv === 'production') {
      throw new ServiceUnavailableException('Dịch vụ xác minh số điện thoại chưa được cấu hình.');
    }

    // Mode 2: explicit development-only OTP verification.
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
                create: [{ wallet_type: 'PAYMENT' }, { wallet_type: 'REVENUE' }]
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

    const customerId = account.customer_profiles?.customer_id;
    const hasUploadedDocument = customerId
      ? (await this.prisma.documents.count({ where: { seller_id: customerId } })) > 0
      : false;

    return {
      message: 'Dang nhap Google thanh cong.',
      user: toJsonSafe({
        accountId: account.account_id,
        customerId: account.customer_profiles?.customer_id ?? null,
        email: account.email,
        fullName: profileName,
        status: account.status,
        roleNames,
        isPhoneVerified: account.customer_profiles?.is_phone_verified ?? false,
        hasUploadedDocument
      }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async forgotPassword(email: string) {
    const formattedEmail = email.trim().toLowerCase();
    const account = await this.prisma.accounts.findUnique({ where: { email: formattedEmail } });

    const genericMessage = 'Nếu email tồn tại, liên kết đặt lại mật khẩu sẽ được gửi.';
    if (!account) return { message: genericMessage };

    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const tokenHash = this.hashRefreshToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.accounts.update({
      where: { account_id: account.account_id },
      data: {
        reset_password_token: tokenHash,
        reset_password_expires: expiresAt
      }
    });

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL').split(',')[0].trim();
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // Gửi email thực tế thông qua thư viện nodemailer / mailer
    try {
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
        `
      });
    } catch (error) {
      // Keep the public response indistinguishable to prevent account enumeration.
      this.logger.error(
        'Không thể gửi email đặt lại mật khẩu.',
        error instanceof Error ? error.stack : undefined
      );
    }

    return { message: genericMessage };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('Thiếu token hoặc mật khẩu mới.');
    }

    const tokenHash = this.hashRefreshToken(token);
    const account = await this.prisma.accounts.findFirst({
      where: {
        reset_password_token: tokenHash,
        reset_password_expires: { gt: new Date() } // Token phải còn hạn
      }
    });

    if (!account) {
      throw new BadRequestException('Token khong hop le hoac da het han.');
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

    await this.prisma.user_sessions.updateMany({
      where: { account_id: account.account_id, is_revoked: false },
      data: { is_revoked: true }
    });

    return { message: 'Đổi mật khẩu thành công.' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredAuthData() {
    const now = new Date();
    const revokedRetention = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.user_sessions.deleteMany({
        where: {
          OR: [
            { expires_at: { lt: now } },
            { is_revoked: true, created_at: { lt: revokedRetention } }
          ]
        }
      }),
      this.prisma.accounts.updateMany({
        where: { phone_otp_expires_at: { lt: now } },
        data: { phone_otp_code: null, phone_otp_expires_at: null }
      }),
      this.prisma.accounts.updateMany({
        where: { reset_password_expires: { lt: now } },
        data: { reset_password_token: null, reset_password_expires: null }
      })
    ]);
  }
}
