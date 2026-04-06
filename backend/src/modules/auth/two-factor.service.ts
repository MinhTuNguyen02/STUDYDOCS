import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as otplib from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorAuthService {
  private authenticator: any;
  constructor() {
    const otp: any = otplib;
    this.authenticator = otp.authenticator || otp.default?.authenticator;
    if (this.authenticator) {
      this.authenticator.options = { window: 1 };
    }
  }

  generateSecret(email: string) {
    const secret = this.authenticator.generateSecret();
    const otpauthUrl = this.authenticator.keyuri(email, 'StudyDocs.Admin', secret);
    return {
      secret,
      otpauthUrl
    };
  }

  async generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  verifyTwoFactorAuthCode(code: string, secret: string): boolean {
    if (!secret || !code) throw new UnauthorizedException('Khong duoc bo thieu 2FA Code/Secret.');
    const isCodeValid = this.authenticator.verify({
      token: code,
      secret: secret
    });
    if (!isCodeValid) throw new UnauthorizedException('Ma 2FA khong dung thao tac that bai.');
    return true;
  }
}
