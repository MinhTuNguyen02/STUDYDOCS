import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) { }

  // 1. Sửa lại hàm create để nhận object chứa tag_name và slug
  async create(dto: { tag_name: string; slug: string }) {
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

    return toJsonSafe(created);
  }

  // 2. Bổ sung thêm hàm update mà FE đang gọi
  async update(id: number, dto: { tag_name: string; slug: string }) {
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

  async remove(id: number) {
    return this.prisma.tags.delete({
      where: { tag_id: id }
    });
  }
}