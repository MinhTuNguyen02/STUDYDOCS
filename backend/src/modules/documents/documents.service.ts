import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DocumentSearchDto } from './dto/document-search.dto';
import { toJsonSafe } from '../../common/utils/to-json-safe.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: DocumentSearchDto) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;
    
    // Build query
    const where: Prisma.documentsWhereInput = {
      status: 'APPROVED',
      delete_at: null
    };

    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: 'insensitive' } },
        { description: { contains: query.keyword, mode: 'insensitive' } }
      ];
    }
    
    if (query.categoryId) {
      where.category_id = query.categoryId;
    }

    if (query.tagId) {
      where.document_tags = {
        some: { tag_id: query.tagId }
      };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }

    let orderBy: Prisma.documentsOrderByWithRelationInput = { published_at: 'desc' };
    if (query.sortBy === 'popular') orderBy = { download_count: 'desc' };
    if (query.sortBy === 'price_asc') orderBy = { price: 'asc' };
    if (query.sortBy === 'price_desc') orderBy = { price: 'desc' };

    const [total, documents] = await Promise.all([
      this.prisma.documents.count({ where }),
      this.prisma.documents.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          customer_profiles: true,
          categories: true
        }
      })
    ]);

    return {
      meta: { page, limit, total },
      data: toJsonSafe(
        documents.map((doc) => ({
          id: doc.document_id,
          title: doc.title,
          slug: doc.slug,
          status: doc.status,
          price: doc.price,
          sellerName: doc.customer_profiles.full_name,
          categoryName: doc.categories?.name,
          rating: doc.average_rating,
          downloadCount: doc.download_count,
          fileExtension: doc.file_extension,
          previewUrl: doc.preview_url,
          createdAt: doc.created_at,
          publishedAt: doc.published_at
        }))
      )
    };
  }

  async findOne(id: string) {
    const documentId = Number(id);
    const document = await this.prisma.documents.findFirst({
      where: {
        document_id: documentId,
        status: 'APPROVED',
        delete_at: null
      },
      include: {
        customer_profiles: true,
        categories: true,
        document_tags: {
          include: { tags: true }
        }
      }
    });

    if (!document) {
      throw new NotFoundException('Khong tim thay tai lieu.');
    }

    return toJsonSafe({
      id: document.document_id,
      title: document.title,
      slug: document.slug,
      description: document.description,
      price: document.price,
      rating: document.average_rating,
      reviewCount: 0,
      viewCount: document.view_count,
      downloadCount: document.download_count,
      pageCount: document.page_count,
      fileExtension: document.file_extension,
      fileSize: document.file_size,
      categoryName: document.categories?.name,
      sellerId: document.customer_profiles?.customer_id,
      sellerName: document.customer_profiles?.full_name,
      tags: document.document_tags.map(t => t.tags.tag_name),
      previewUrl: document.preview_url,
      createdAt: document.created_at,
      publishedAt: document.published_at
    });
  }

  async incrementViewCount(id: string) {
    await this.prisma.documents.update({
      where: { document_id: Number(id) },
      data: { view_count: { increment: 1 } }
    });
    return { success: true };
  }
}
