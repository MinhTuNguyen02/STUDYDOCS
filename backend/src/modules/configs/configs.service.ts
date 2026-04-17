import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../common/security/auth-user.interface';

@Injectable()
export class ConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const configs = await this.prisma.configs.findMany({
      orderBy: { config_key: 'asc' }
    });
    return { data: configs };
  }

  async findByKey(key: string) {
    const config = await this.prisma.configs.findUnique({
      where: { config_key: key.toUpperCase() }
    });
    if (!config) throw new NotFoundException('Không tìm thấy cấu hình.');
    return { data: config };
  }

  async updateConfig(user: AuthUser, key: string, value: string, description?: string) {
    const upperKey = key.toUpperCase();
    
    const existing = await this.prisma.configs.findUnique({ where: { config_key: upperKey } });

    const config = await this.prisma.configs.upsert({
      where: { config_key: upperKey },
      create: { config_key: upperKey, config_value: value, description },
      update: { config_value: value, description, updated_at: new Date() }
    });
    
    await this.prisma.audit_logs.create({
      data: {
        account_id: user.accountId,
        action: 'ADMIN_UPDATE_CONFIG',
        target_table: 'configs',
        target_id: 0,
        old_value: existing ? { config_value: existing.config_value } : undefined,
        new_value: { config_key: upperKey, config_value: value, description }
      }
    });

    return { message: 'Cập nhật cấu hình thành công.', data: config };
  }
}
