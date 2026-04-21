import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminService } from './firebase.service';
import { TwoFactorAuthService } from './two-factor.service';
import { GoogleStrategy } from './google.strategy';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret'),
        signOptions: { expiresIn: '2h' }
      })
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAdminService, TwoFactorAuthService, GoogleStrategy],
  exports: [AuthService, FirebaseAdminService, TwoFactorAuthService]
})
export class AuthModule {}
