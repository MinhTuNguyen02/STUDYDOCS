import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { Roles } from '../../common/security/roles.decorator';
import { RolesGuard } from '../../common/security/roles.guard';
import { PhoneVerifiedGuard } from '../../common/security/phone-verified.guard';
import { WalletsService } from './wallets.service';
import { RequestWithdrawalDto, ProcessWithdrawalDto } from './wallets.service';

@ApiTags('Financial & Wallets')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  getMyWallets(@CurrentUser() user: AuthUser) {
    return this.walletsService.getMyWallets(user);
  }

  @Get('transactions/me')
  getMyTransactions(@CurrentUser() user: AuthUser) {
    return this.walletsService.getLedgerHistory(user);
  }

  @Post('withdrawals')
  @UseGuards(PhoneVerifiedGuard)
  createWithdrawal(@CurrentUser() user: AuthUser, @Body() dto: RequestWithdrawalDto) {
    return this.walletsService.requestWithdrawal(user, dto);
  }

  @Get('withdrawals/me')
  listMyWithdrawals(@CurrentUser() user: AuthUser) {
    return this.walletsService.getMyWithdrawals(user);
  }

  @Patch('withdrawals/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('accountant', 'admin')
  processWithdrawal(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProcessWithdrawalDto) {
    return this.walletsService.processWithdrawal(user, id, dto);
  }

  @Post('jobs/release-held-funds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('accountant', 'admin')
  releaseHeldFunds() {
    return this.walletsService.releaseHeldFunds();
  }
}
