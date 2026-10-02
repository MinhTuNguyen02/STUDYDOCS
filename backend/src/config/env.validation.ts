type Environment = Record<string, string | undefined>;

const required = (env: Environment, key: string) => {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const validUrl = (env: Environment, key: string) => {
  const value = required(env, key);
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error(`${key} must be a valid HTTP or HTTPS URL`);
  }
  return value;
};

const validUrlList = (env: Environment, key: string) => {
  const values = required(env, key)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) throw new Error(`${key} must contain at least one URL`);
  for (const value of values) {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new Error(`${key} must contain only valid HTTP or HTTPS URLs`);
    }
  }
  return values;
};

export function validateEnvironment(config: Environment) {
  const env = { ...config };
  const nodeEnv = env.NODE_ENV || 'development';

  required(env, 'DATABASE_URL');
  required(env, 'DIRECT_URL');
  validUrlList(env, 'FRONTEND_URL');
  validUrl(env, 'SUPABASE_URL');
  required(env, 'SUPABASE_SERVICE_ROLE_KEY');
  required(env, 'SUPABASE_STORAGE_BUCKET');

  const jwtSecret = required(env, 'JWT_ACCESS_SECRET');
  if (jwtSecret.length < 32 || /^dev[_-]/i.test(jwtSecret)) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 non-development characters');
  }

  if (env.GOTENBERG_URL) validUrl(env, 'GOTENBERG_URL');

  if (nodeEnv === 'production') {
    validUrl(env, 'BACKEND_URL');
    required(env, 'MAIL_USER');
    required(env, 'MAIL_PASS');
    required(env, 'FIREBASE_PROJECT_ID');
    required(env, 'FIREBASE_CLIENT_EMAIL');
    required(env, 'FIREBASE_PRIVATE_KEY');
    required(env, 'VNPAY_TMN_CODE');
    required(env, 'VNPAY_HASH_SECRET');
    validUrl(env, 'VNPAY_URL');
    required(env, 'GOOGLE_CLIENT_ID');
    required(env, 'GOOGLE_CLIENT_SECRET');
    if (env.ENABLE_MOCK_OTP === 'true') {
      throw new Error('ENABLE_MOCK_OTP cannot be enabled in production');
    }
  }

  return env;
}
