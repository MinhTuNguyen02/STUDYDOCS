import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: any) {
    const category = await this.prisma.categories.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        parent_id: dto.parent_id ? Number(dto.parent_id) : null
      }
    });
    return toJsonSafe(category);
  }

  async findAll() {
    const categories = await this.prisma.categories.findMany({
      orderBy: { name: 'asc' }
    });
    return toJsonSafe(categories);
  }

  async getHierarchy() {
    const categories = await this.prisma.categories.findMany({
      orderBy: { name: 'asc' }
    });

    // Build tree
    const map = new Map();
    const roots: any[] = [];

    categories.forEach(cat => {
      map.set(cat.category_id, { ...cat, children: [] });
    });

    categories.forEach(cat => {
      if (cat.parent_id) {
        const parent = map.get(cat.parent_id);
        if (parent) parent.children.push(map.get(cat.category_id));
      } else {
        roots.push(map.get(cat.category_id));
      }
    });

    return toJsonSafe(roots);
  }

  async update(id: number, dto: any) {
    const exists = await this.prisma.categories.findUnique({ where: { category_id: id } });
    if (!exists) throw new NotFoundException('Danh mục không tồn tại');

    // Mở rộng thêm: Nếu FE gửi parent_id là null để gỡ cha của 1 danh mục
    // Chúng ta cần xử lý việc FE có thể gửi parent_id = null thay vì chỉ undefined
    const parentIdToUpdate = dto.parent_id !== undefined
      ? (dto.parent_id ? Number(dto.parent_id) : null)
      : exists.parent_id;

    const updated = await this.prisma.categories.update({
      where: { category_id: id },
      data: {
        name: dto.name,
        slug: dto.slug,
        // SỬA Ở ĐÂY: Dùng biến parentIdToUpdate đã tính toán ở trên
        parent_id: parentIdToUpdate
      }
    });
    return toJsonSafe(updated);
  }

  async remove(id: number) {
    return this.prisma.categories.delete({
      where: { category_id: id }
    });
  }
}
