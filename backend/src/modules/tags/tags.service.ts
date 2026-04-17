import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { AuthUser } from '../../common/security/auth-user.interface';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) { }

  // 1. Sửa lại hàm create để nhận object chứa tag_name và slug
  async create(dto: { tag_name: string; slug: string }, actor: AuthUser) {
    if (!dto.tag_name || !dto.slug) {
      throw new BadRequestException('Tên tag và slug không được để trống.');
    }

    const tagName = dto.tag_name.trim();
    const slug = dto.slug.trim();

    // Kiểm tra trùng lặp dựa trên slug (chính xác hơn tên)
    const existing = await this.prisma.tags.findFirst({
      where: { slug: slug }
    });

    if (existing) {
      throw new BadRequestException('Tag này đã tồn tại.');
    }

    const created = await this.prisma.tags.create({
      data: { tag_name: tagName, slug: slug }
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_CREATE_TAG',
        target_table: 'tags',
        target_id: created.tag_id,
        new_value: { tag_name: created.tag_name }
      }
    });

    return toJsonSafe(created);
  }

  // 2. Bổ sung thêm hàm update mà FE đang gọi
  async update(id: number, dto: { tag_name: string; slug: string }, actor: AuthUser) {
    if (!dto.tag_name || !dto.slug) {
      throw new BadRequestException('Tên tag và slug không được để trống.');
    }

    const existing = await this.prisma.tags.findUnique({
      where: { tag_id: id }
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy tag cần sửa.');
    }

    // Kiểm tra xem slug mới có bị trùng với tag khác không
    const duplicate = await this.prisma.tags.findFirst({
      where: {
        slug: dto.slug.trim(),
        NOT: { tag_id: id } // Loại trừ tag hiện tại đang sửa
      }
    });

    if (duplicate) {
      throw new BadRequestException('Slug này đã được sử dụng cho tag khác.');
    }

    const updated = await this.prisma.tags.update({
      where: { tag_id: id },
      data: {
        tag_name: dto.tag_name.trim(),
        slug: dto.slug.trim()
      }
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_UPDATE_TAG',
        target_table: 'tags',
        target_id: id,
        old_value: { tag_name: existing.tag_name, slug: existing.slug },
        new_value: { tag_name: updated.tag_name, slug: updated.slug }
      }
    });

    return toJsonSafe(updated);
  }

  async findAll(search?: string) {
    const tags = await this.prisma.tags.findMany({
      where: {
        tag_name: search ? { contains: search.toLowerCase(), mode: 'insensitive' } : undefined
      },
      orderBy: { tag_name: 'asc' },
      take: 50
    });
    return toJsonSafe(tags);
  }

  async remove(id: number, actor: AuthUser) {
    try {
      const removed = await this.prisma.tags.delete({
        where: { tag_id: id }
      });

      await this.prisma.audit_logs.create({
        data: {
          account_id: actor.accountId,
          action: 'ADMIN_DELETE_TAG',
          target_table: 'tags',
          target_id: id,
          old_value: { tag_name: removed.tag_name }
        }
      });

      return removed;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException('Không thể xóa thẻ này. Hiện trạng đang có tài liệu sử dụng thẻ này.');
      }
      throw error;
    }
  }
}