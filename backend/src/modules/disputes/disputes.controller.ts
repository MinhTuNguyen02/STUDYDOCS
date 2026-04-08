import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Param, ParseIntPipe, Post, Put, Get, UseGuards } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { RolesGuard } from '../../common/security/roles.guard';
import { Roles } from '../../common/security/roles.decorator';
import { dispute_status } from '@prisma/client';

@ApiTags('Interactions (Reviews, Reports, Disputes)')
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  createDispute(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDisputeDto
  ) {
    return this.disputesService.createDispute(user, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('mod', 'admin')
  getAllDisputes() {
    return this.disputesService.getAllDisputes();
  }

  @Put(':id/analyze')
  @UseGuards(RolesGuard)
  @Roles('mod', 'admin')
  analyzeDispute(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.disputesService.analyzeDispute(user, id);
  }

  @Put(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('mod', 'admin')
  resolveDispute(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { status: dispute_status; resolution: string }
  ) {
    return this.disputesService.resolveDispute(user, id, dto);
  }
}
