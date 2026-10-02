const requiredTestEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required for E2E tests. Tests are intentionally blocked from using backend/.env.`
    );
  }
  return value;
};

const databaseUrl = requiredTestEnv('TEST_DATABASE_URL');
const databaseHost = new URL(databaseUrl).hostname;
const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseHost);

if (!isLocalDatabase && process.env.ALLOW_REMOTE_TEST_DATABASE !== 'true') {
  throw new Error(
    'Remote E2E database blocked. Set ALLOW_REMOTE_TEST_DATABASE=true only for a dedicated staging/test database.'
  );
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL?.trim() || databaseUrl;
process.env.SUPABASE_URL = requiredTestEnv('TEST_SUPABASE_URL');
process.env.SUPABASE_SERVICE_ROLE_KEY = requiredTestEnv('TEST_SUPABASE_SERVICE_ROLE_KEY');
process.env.SUPABASE_STORAGE_BUCKET = requiredTestEnv('TEST_SUPABASE_STORAGE_BUCKET');
process.env.FRONTEND_URL ||= 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET ||= 'test-only-jwt-secret-with-at-least-32-characters';
process.env.ENABLE_MOCK_OTP = 'true';
