import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from './auth-user.interface';

@Injectable()
export class PhoneVerifiedGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      throw new UnauthorizedException('Chưa đăng nhập.');
    }

    if (!user.customerId) {
      // If staff, we might want to check staff_profiles, but usually this guard is for customers
      return true; 
    }

    const profile = await this.prisma.customer_profiles.findUnique({
      where: { customer_id: user.customerId }
    });

    if (!profile || !profile.is_phone_verified) {
      throw new ForbiddenException('Vui lòng xác minh số điện thoại để thực hiện chức năng này.');
    }

    return true;
  }
}
