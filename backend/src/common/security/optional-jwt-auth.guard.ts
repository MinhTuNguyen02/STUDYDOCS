import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
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
export class OptionalJwtAuthGuard implements CanActivate {
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
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret')
      });

      const accountId = Number(payload.sub);
      const account = await this.prisma.accounts.findUnique({
        where: { account_id: accountId },
        include: {
          customer_profiles: { select: { customer_id: true } },
          staff_profiles: { select: { staff_id: true } },
          roles: { select: { name: true } }
        }
      });

      if (account && account.status !== 'BANNED') {
        request.user = {
          accountId: account.account_id,
          email: account.email,
          status: account.status,
          customerId: account.customer_profiles?.customer_id ?? null,
          staffId: account.staff_profiles?.staff_id ?? null,
          roleNames: [account.roles.name.toLowerCase()]
        };
      }
    } catch {
      // ignore token errors for optional auth
    }

    return true;
  }
}
