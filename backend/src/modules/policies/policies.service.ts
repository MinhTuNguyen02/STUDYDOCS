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
    return { message: 'Cập nhật điều khoản thành công.', data: result };
  }

  async deletePolicy(id: number) {
    await this.prisma.policies.delete({ where: { policy_id: id } });
    return { message: 'Xóa điều khoản vĩnh viễn thành công.' };
  }
}
