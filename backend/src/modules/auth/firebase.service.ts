import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseAdminService {
  constructor(private readonly config: ConfigService) {
    if (!admin.apps.length) {
      const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY', '').replace(/\\n/g, '\n');
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID', 'placeholder');
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL', 'placeholder');

      if (privateKey && projectId && clientEmail) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey
          })
        });
      }
    }
  }

  async verifyPhoneToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!admin.apps.length) throw new UnauthorizedException('Firebase chua duoc config. Hay dien ENV.');
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      if (!decodedToken.phone_number) {
        throw new UnauthorizedException('Token không chứa số điện thoại.');
      }
      return decodedToken;
    } catch (e: any) {
      throw new UnauthorizedException('Xac thuc OTP Firebase that bai: ' + e.message);
    }
  }
}
