import { validateEnvironment } from './env.validation';

const validEnvironment = () => ({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/studydocs',
  DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/studydocs',
  FRONTEND_URL: 'http://localhost:5173',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  SUPABASE_STORAGE_BUCKET: 'studydocs-test',
  JWT_ACCESS_SECRET: 'a-secure-test-secret-with-at-least-32-characters',
  GOTENBERG_URL: 'http://localhost:3000'
});

describe('validateEnvironment', () => {
  it('accepts a comma-separated frontend origin allowlist', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment(),
        FRONTEND_URL: 'http://localhost:5173,https://studydocs.example.com'
      })
    ).not.toThrow();
  });

  it('rejects weak JWT secrets', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment(),
        JWT_ACCESS_SECRET: 'dev_secret'
      })
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects mock OTP in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment(),
        NODE_ENV: 'production',
        BACKEND_URL: 'https://api.studydocs.example.com',
        MAIL_USER: 'mailer@example.com',
        MAIL_PASS: 'mail-password',
        FIREBASE_PROJECT_ID: 'firebase-project',
        FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
        FIREBASE_PRIVATE_KEY: 'private-key',
        VNPAY_TMN_CODE: 'tmn-code',
        VNPAY_HASH_SECRET: 'hash-secret',
        VNPAY_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        ENABLE_MOCK_OTP: 'true'
      })
    ).toThrow(/ENABLE_MOCK_OTP/);
  });
});
