import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    const gotenbergUrl = this.config.get<string>('GOTENBERG_URL');
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.storage.healthCheck(),
      gotenbergUrl
        ? axios.get(`${gotenbergUrl.replace(/\/$/, '')}/health`, { timeout: 2_000 })
        : Promise.reject(new Error('GOTENBERG_URL is not configured'))
    ]);

    const readiness = {
      database: checks[0].status === 'fulfilled',
      storage: checks[1].status === 'fulfilled' && checks[1].value === true,
      gotenberg: checks[2].status === 'fulfilled'
    };
    if (Object.values(readiness).some((ready) => !ready)) {
      throw new ServiceUnavailableException({ status: 'not_ready', ...readiness });
    }
    return { status: 'ready', ...readiness, timestamp: new Date().toISOString() };
  }
}
