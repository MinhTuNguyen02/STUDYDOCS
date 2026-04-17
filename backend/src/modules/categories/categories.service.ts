import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { AuthUser } from '../../common/security/auth-user.interface';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: any, actor: AuthUser) {
    const category = await this.prisma.categories.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        parent_id: dto.parent_id ? Number(dto.parent_id) : null
      }
    });

    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_CREATE_CATEGORY',
        target_table: 'categories',
        target_id: category.category_id,
        new_value: { name: category.name, parent_id: category.parent_id }
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

  async update(id: number, dto: any, actor: AuthUser) {
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

    let oldParentName = null;
    if (exists.parent_id) {
      const oldParent = await this.prisma.categories.findUnique({ where: { category_id: exists.parent_id } });
      oldParentName = oldParent?.name;
    }

    let newParentName = null;
    if (updated.parent_id) {
      const newParent = await this.prisma.categories.findUnique({ where: { category_id: updated.parent_id } });
      newParentName = newParent?.name;
    }

    await this.prisma.audit_logs.create({
      data: {
        account_id: actor.accountId,
        action: 'ADMIN_UPDATE_CATEGORY',
        target_table: 'categories',
        target_id: id,
        old_value: { name: exists.name, parent_name: oldParentName },
        new_value: { name: updated.name, parent_name: newParentName }
      }
    });

    return toJsonSafe(updated);
  }

  async remove(id: number, actor: AuthUser) {
    try {
      const removed = await this.prisma.categories.delete({
        where: { category_id: id }
      });

      await this.prisma.audit_logs.create({
        data: {
          account_id: actor.accountId,
          action: 'ADMIN_DELETE_CATEGORY',
          target_table: 'categories',
          target_id: id,
          old_value: { name: removed.name }
        }
      });

      return removed;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException('Không thể xóa danh mục. Hiện đang có danh mục con hoặc tài liệu thuộc danh mục này.');
      }
      throw error;
    }
  }
}
