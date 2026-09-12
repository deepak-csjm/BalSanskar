/**
 * Test environment.
 *
 * Defaults are set before any module reads `process.env`, so a developer can run
 * `pnpm test` with nothing configured beyond a reachable Postgres.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://balsanskar:balsanskar@127.0.0.1:5432/balsanskar_test?schema=public';
process.env.JWT_SECRET ??= 'test-secret-value-that-is-long-enough-32ch';
process.env.SMS_PROVIDER = 'console';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR ??= './.test-storage';
process.env.PUBLIC_API_BASE_URL ??= 'http://localhost:4000';
process.env.LOG_LEVEL = 'silent';
// The suite exercises many endpoints in quick succession; the production
// limiter would trip on that and mask the assertions it is meant to protect.
process.env.RATE_LIMIT_MAX ??= '100000';
process.env.OTP_RESEND_COOLDOWN_SECONDS ??= '0';
process.env.AUTH_RATE_LIMIT_MAX ??= '100000';
