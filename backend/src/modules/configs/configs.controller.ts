import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ConfigsService } from './configs.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { IsOptional, IsString } from 'class-validator';

export class UpdateConfigDto {
  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@ApiTags('System & Admin')
@Controller('configs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigsController {
  constructor(private readonly configsService: ConfigsService) {}

  @Get()
  @Roles('admin', 'mod')
  findAll() {
    return this.configsService.findAll();
  }

  @Get(':key')
  @Roles('admin', 'mod')
  findByKey(@Param('key') key: string) {
    return this.configsService.findByKey(key);
  }

  @Put(':key')
  @Roles('admin')
  updateConfig(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: UpdateConfigDto) {
    return this.configsService.updateConfig(user, key, dto.value, dto.description);
  }
}
