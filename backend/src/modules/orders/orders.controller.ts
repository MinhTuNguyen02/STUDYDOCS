import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/security/current-user.decorator';
import { AuthUser } from '../../common/security/auth-user.interface';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { OrderListQueryDto } from './dto/order-list-query.dto';

@ApiTags('Shop & Order')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: OrderListQueryDto) {
    return this.ordersService.findAll(user, query.status, query.page, query.limit);
  }
}
