import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';
import sanitizeHtml from 'sanitize-html';

interface PolicyInput {
  title: string;
  slug: string;
  content: string;
  isActive?: boolean;
}

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizePolicyContent(content: string) {
    return sanitizeHtml(content, {
      allowedTags: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        's',
        'blockquote',
        'pre',
        'code',
        'h1',
        'h2',
        'h3',
        'h4',
        'ol',
        'ul',
        'li',
        'a',
        'img',
        'span'
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        span: ['class'],
        p: ['class']
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: { img: ['http', 'https'] },
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: { ...attribs, rel: 'noopener noreferrer' }
        })
      }
    });
  }

  private sanitizePolicy<T extends { content: string }>(policy: T): T {
    return { ...policy, content: this.sanitizePolicyContent(policy.content) };
  }

  async findAll(onlyActive: boolean = true) {
    const filter = onlyActive ? { is_active: true } : {};
    const docs = await this.prisma.policies.findMany({
      where: filter,
      orderBy: { updated_at: 'desc' }
    });
    return { data: docs.map((document) => this.sanitizePolicy(document)) };
  }

  async findBySlug(slug: string) {
    const policy = await this.prisma.policies.findUnique({
      where: { slug, is_active: true }
    });
    if (!policy) throw new NotFoundException('Điều khoản không tồn tại hoặc đã gỡ bỏ.');
    return { data: this.sanitizePolicy(policy) };
  }

  async createPolicy(user: AuthUser, dto: PolicyInput) {
    const result = await this.prisma.policies.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        content: this.sanitizePolicyContent(dto.content),
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

  async updatePolicy(id: number, user: AuthUser, dto: PolicyInput) {
    const existing = await this.prisma.policies.findUnique({ where: { policy_id: id } });
    if (!existing) throw new NotFoundException('Không tìm thấy điều khoản.');

    const result = await this.prisma.policies.update({
      where: { policy_id: id },
      data: {
        title: dto.title,
        slug: dto.slug,
        content: this.sanitizePolicyContent(dto.content),
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
