import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID', 'placeholder'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', 'placeholder'),
      callbackURL: `${configService.get<string>('BACKEND_URL', 'http://localhost:4000')}/api/auth/google/callback`,
      scope: ['email', 'profile']
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): void {
    const { id, emails, displayName } = profile;

    const email = emails?.[0]?.value;
    if (!email) {
      return done(new Error('Google account does not expose a verified email address'), false);
    }

    const user = {
      providerAccountId: id,
      email,
      fullName: displayName
    };

    done(null, user);
  }
}
