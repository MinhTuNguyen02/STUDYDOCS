import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(onlyActive: boolean = true) {
    const filter = onlyActive ? { is_active: true } : {};
    const docs = await this.prisma.policies.findMany({
      where: filter,
      orderBy: { updated_at: 'desc' }
    });
    return { data: docs };
  }

  async findBySlug(slug: string) {
    const policy = await this.prisma.policies.findUnique({
      where: { slug, is_active: true }
    });
    if (!policy) throw new NotFoundException('Điều khoản không tồn tại hoặc đã gỡ bỏ.');
    return { data: policy };
  }

  async createPolicy(user: AuthUser, dto: any) {
    const result = await this.prisma.policies.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        content: dto.content,
        is_active: dto.isActive ?? true,
        updated_by: user.staffId ? Number(user.staffId) : undefined
      }
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: user.accountId,
        action: 'ADMIN_CREATE_POLICY',
        target_table: 'policies',
        target_id: result.policy_id,
        new_value: { title: result.title, is_active: result.is_active }
      }
    });

    return { message: 'Tạo điều khoản thành công.', data: result };
  }

  async updatePolicy(id: number, user: AuthUser, dto: any) {
    const existing = await this.prisma.policies.findUnique({ where: { policy_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy điều khoản.');

    const result = await this.prisma.policies.update({
      where: { policy_id: id },
      data: {
        title: dto.title,
        slug: dto.slug,
        content: dto.content,
        is_active: dto.isActive,
        updated_at: new Date(),
        updated_by: user.staffId ? Number(user.staffId) : undefined
      }
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: user.accountId,
        action: 'ADMIN_UPDATE_POLICY',
        target_table: 'policies',
        target_id: id,
        old_value: { title: existing.title, is_active: existing.is_active },
        new_value: { title: result.title, is_active: result.is_active }
      }
    });

    return { message: 'Cập nhật điều khoản thành công.', data: result };
  }

  async deletePolicy(id: number, user: AuthUser) {
    const policy = await this.prisma.policies.findUnique({ where: { policy_id: id } });
    await this.prisma.policies.delete({ where: { policy_id: id } });
    
    if (policy) {
      await this.prisma.audit_logs.create({
        data: {
          account_id: user.accountId,
          action: 'ADMIN_DELETE_POLICY',
          target_table: 'policies',
          target_id: id,
          old_value: { title: policy.title }
        }
      });
    }

    return { message: 'Xóa điều khoản vĩnh viễn thành công.' };
  }
}
