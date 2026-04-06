import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tagName: string) {
    if (!tagName) throw new BadRequestException('Tag name khong hop le.');
    const tag = tagName.trim().toLowerCase();
    
    let existing = await this.prisma.tags.findFirst({
      where: { tag_name: tag }
    });
    
    if (existing) {
      return toJsonSafe(existing);
    }

    const slug = tag.replace(/\\s+/g, '-');
    const created = await this.prisma.tags.create({
      data: { tag_name: tag, slug }
    });
    return toJsonSafe(created);
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
