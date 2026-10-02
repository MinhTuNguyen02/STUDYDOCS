import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminService } from './firebase.service';
import { GoogleStrategy } from './google.strategy';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '2h' }
      })
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAdminService, GoogleStrategy],
  exports: [AuthService, FirebaseAdminService]
})
export class AuthModule {}
