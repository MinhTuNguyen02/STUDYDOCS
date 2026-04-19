import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [WalletsModule],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService]
})
export class PackagesModule {}
