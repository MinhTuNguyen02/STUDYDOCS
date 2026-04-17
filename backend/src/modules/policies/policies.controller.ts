import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('System & Admin')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  getListPublic() {
    return this.policiesService.findAll(true);
  }

  @Get(':slug')
  getDetail(@Param('slug') slug: string) {
    return this.policiesService.findBySlug(slug);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'mod')
  getListAdmin() {
    return this.policiesService.findAll(false);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePolicyDto) {
    return this.policiesService.createPolicy(user, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePolicyDto
  ) {
    return this.policiesService.updatePolicy(id, user, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.policiesService.deletePolicy(id, user);
  }
}
