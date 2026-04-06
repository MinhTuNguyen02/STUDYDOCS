import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from './auth-user.interface';

type JwtPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  private extractBearerToken(authorization?: string) {
    if (!authorization) return null;
    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) return null;
    return token;
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Thiếu access token.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret')
      });
    } catch {
      throw new UnauthorizedException('Access token không hợp lệ hoặc đã hết hạn.');
    }

    const accountId = Number(payload.sub);
    const account = await this.prisma.accounts.findUnique({
      where: { account_id: accountId },
      include: {
        customer_profiles: {
          select: {
            customer_id: true
          }
        },
        staff_profiles: {
          select: {
            staff_id: true
          }
        },
        roles: {
          select: {
            name: true
          }
        }
      }
    });

    if (!account) {
      throw new UnauthorizedException('Tài khoản không tồn tại.');
    }

    if (account.status === 'BANNED') {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa.');
    }

    request.user = {
      accountId: account.account_id,
      email: account.email,
      status: account.status,
      customerId: account.customer_profiles?.customer_id ?? null,
      staffId: account.staff_profiles?.staff_id ?? null,
      roleNames: [account.roles.name.toLowerCase()]
    };

    return true;
  }
}
