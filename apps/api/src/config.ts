import { z } from 'zod';

/**
 * Configuration is read once, validated once, and then frozen.
 *
 * A misconfigured deployment should fail loudly at boot rather than quietly at
 * 11pm on the night before a department demonstration. In particular the
 * production branch below refuses to start on a default secret.
 */

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no'])])
  .transform((value) => value === true || value === 'true' || value === '1' || value === 'yes');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    /** Signing key for access tokens. Rotate by restarting with a new value. */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ISSUER: z.string().default('balsanskar'),
    JWT_AUDIENCE: z.string().default('balsanskar-app'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),

    OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(0).max(900).default(60),
    /** `console` prints the code to the log for local work; `msg91` sends a real SMS. */
    SMS_PROVIDER: z.enum(['console', 'msg91']).default('console'),
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),
    MSG91_SENDER_ID: z.string().optional(),

    /** Absolute base URL this API is reachable at, used to build upload URLs. */
    PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000'),

    /** `local` writes under STORAGE_LOCAL_DIR; `s3` targets any S3-compatible store. */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    /** Absolute base the browser should use to reach locally stored files. */
    STORAGE_PUBLIC_BASE_URL: z.string().default('http://localhost:4000/files'),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanish.default(false),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),

    /** Comma-separated exact origins. Never a wildcard in production. */
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    TRUST_PROXY: booleanish.default(false),
    RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(300),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(60),
    /**
     * Ceiling for the credential endpoints, per source address.
     *
     * Kept well above one person's needs on purpose: a block office, a cyber
     * cafe or a school sharing one connection all appear as a single address,
     * and locking them out is a worse failure than a slow brute force. The real
     * defence against guessing is per-number: a resend cooldown, an hourly cap
     * and a five-attempt limit on each code, all enforced in the auth service.
     */
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(5).default(60),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).default(600),

    /** Bootstrap account, created by the seed script only when both are present. */
    SEED_SUPER_ADMIN_PHONE: z.string().optional(),
    SEED_SUPER_ADMIN_PASSWORD: z.string().optional(),

    PUBLIC_SHOWCASE_ENABLED: booleanish.default(true),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }
    if (env.SMS_PROVIDER === 'console') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMS_PROVIDER'],
        message: 'Refusing to run in production with the console SMS provider: one-time codes would be written to the log',
      });
    }
    if (env.SMS_PROVIDER === 'msg91' && (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MSG91_AUTH_KEY'],
        message: 'MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required when SMS_PROVIDER=msg91',
      });
    }
    if (env.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'A wildcard CORS origin is not allowed in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface AppConfig extends Env {
  isProduction: boolean;
  isTest: boolean;
  corsOrigins: string[];
}

let cached: AppConfig | null = null;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  const env = parsed.data;
  return Object.freeze({
    ...env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
}

export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

/** Test helper: forget the memoised config so a fresh environment can be loaded. */
export function resetConfigCache(): void {
  cached = null;
}
