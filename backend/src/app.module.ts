import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from './common/security/security.module';
import { PrismaModule } from './database/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { LibraryModule } from './modules/library/library.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SellerModule } from './modules/seller/seller.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { CartModule } from './modules/cart/cart.module';
import { ConfigsModule } from './modules/configs/configs.module';
import { PackagesModule } from './modules/packages/packages.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { WishlistsModule } from './modules/wishlists/wishlists.module';
import { StorageModule } from './modules/storage/storage.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TagsModule } from './modules/tags/tags.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DownloadsModule } from './modules/downloads/downloads.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DisputesModule } from './modules/disputes/disputes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SecurityModule,
    PrismaModule,
    AuthModule,
    CheckoutModule,
    LibraryModule,
    ReviewsModule,
    SellerModule,
    WalletsModule,
    ModerationModule,
    UsersModule,
    DocumentsModule,
    OrdersModule,
    AdminModule,
    CartModule,
    ConfigsModule,
    PackagesModule,
    PoliciesModule,
    WishlistsModule,
    StorageModule,
    CategoriesModule,
    TagsModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // 100 requests per minute max per IP
    }]),
    DownloadsModule,
    ReportsModule,
    DisputesModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
