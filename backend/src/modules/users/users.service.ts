import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { AuthUser } from '../../common/security/auth-user.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { compare, hash } from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async getProfile(user: AuthUser) {
    if (!user.customerId) {
      // Must be staff or admin
      const staff = await this.prisma.staff_profiles.findUnique({
        where: { account_id: Number(user.accountId) },
        include: { accounts: { include: { roles: true } } }
      });
      if (!staff) throw new NotFoundException('Profile not found.');
      return toJsonSafe(staff);
    }

    const customer = await this.prisma.customer_profiles.findUnique({
      where: { customer_id: user.customerId },
      include: {
        accounts: { include: { roles: true } },
        wallets: true,
        user_packages: {
          where: { status: 'ACTIVE', expires_at: { gt: new Date() } },
          include: { packages: true },
          orderBy: [
            { purchased_at: 'desc' },
            { expires_at: 'desc' }
          ]
        }
      }
    });

    if (!customer) throw new NotFoundException('Profile not found.');
    return toJsonSafe(customer);
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    if (!user.customerId) throw new BadRequestException('Không thể cập nhật hồ sơ staff từ endpoint này.');

    const updated = await this.prisma.customer_profiles.update({
      where: { customer_id: user.customerId },
      data: {
        full_name: dto.fullName ?? undefined,
        avatar_url: dto.avatarUrl ?? undefined
      }
    });

    return toJsonSafe(updated);
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const account = await this.prisma.accounts.findUnique({
      where: { account_id: Number(user.accountId) }
    });

    if (!account || !account.password_hash) {
      throw new BadRequestException('Không thể đổi mật khẩu cho tài khoản này.');
    }

    const { currentPassword, newPassword } = dto;
    const isMatched = account.password_hash.startsWith('$2')
      ? await compare(currentPassword, account.password_hash)
      : account.password_hash === currentPassword;

    if (!isMatched) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    }

    const newHash = await hash(newPassword, 10);
    await this.prisma.accounts.update({
      where: { account_id: account.account_id },
      data: { password_hash: newHash }
    });

    return { message: 'Đổi mật khẩu thành công.' };
  }
}
