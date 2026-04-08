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
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      this.prisma.customer_profiles.count(),
      this.prisma.customer_profiles.findMany({
        skip,
        take: limit,
        orderBy: { customer_id: 'desc' },
        include: { accounts: true }
      })
    ]);

    return {
      meta: {
        page,
        limit,
        total
      },
      data: toJsonSafe(
        users.map((user) => ({
          id: user.customer_id,
          fullName: user.full_name,
          email: user.accounts.email,
          status: user.accounts.status,
          createdAt: user.created_at
        }))
      )
    };
  }

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
          include: { packages: true }
        }
      }
    });

    if (!customer) throw new NotFoundException('Profile not found.');
    return toJsonSafe(customer);
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    if (!user.customerId) throw new BadRequestException('Khong the cap nhat hobo staff tu endpoint nay.');
    
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
      throw new BadRequestException('Khong the doi mat khau cho tai khoan nay.');
    }

    const { currentPassword, newPassword } = dto;
    const isMatched = account.password_hash.startsWith('$2') 
      ? await compare(currentPassword, account.password_hash)
      : account.password_hash === currentPassword;

    if (!isMatched) {
      throw new BadRequestException('Mat khau hien tai khong xac.');
    }

    const newHash = await hash(newPassword, 10);
    await this.prisma.accounts.update({
      where: { account_id: account.account_id },
      data: { password_hash: newHash }
    });

    return { message: 'Doi mat khau thanh cong.' };
  }

  async setAccountStatus(accountId: number, status: 'ACTIVE' | 'BANNED') {
    const acc = await this.prisma.accounts.findUnique({ where: { account_id: accountId } });
    if (!acc) throw new NotFoundException('Không tìm thấy tài khoản.');

    await this.prisma.accounts.update({
      where: { account_id: accountId },
      data: { status }
    });

    return { message: `Đã đổi trạng thái tài khoản thành ${status}` };
  }
}
