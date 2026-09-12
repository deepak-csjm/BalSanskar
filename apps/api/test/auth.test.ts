import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  auth,
  createTestApp,
  createUser,
  prisma,
  resetDatabase,
  seedGeography,
  teardown,
  type Geography,
} from './helpers.js';

describe('authentication', () => {
  let app: FastifyInstance;
  let geo: Geography;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    geo = await seedGeography();
  });

  afterAll(async () => {
    await teardown(app);
  });

  describe('one-time code login', () => {
    it('issues a code and signs a teacher in with it', async () => {
      const teacher = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });

      const request = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone: teacher.phone, purpose: 'LOGIN' },
      });
      expect(request.statusCode).toBe(200);
      const { devCode } = request.json() as { devCode: string };
      expect(devCode).toMatch(/^\d{6}$/);

      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/login',
        payload: { phone: teacher.phone, code: devCode },
      });
      expect(login.statusCode).toBe(200);
      const session = login.json() as { user: { role: string }; tokens: { accessToken: string } };
      expect(session.user.role).toBe('TEACHER');
      expect(session.tokens.accessToken).toBeTruthy();
    });

    it('does not reveal whether a number is registered', async () => {
      const unknown = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone: '+919000000009', purpose: 'LOGIN' },
      });
      expect(unknown.statusCode).toBe(200);
      expect(unknown.json()).toHaveProperty('expiresInSeconds');
    });

    it('rejects a wrong code and burns an attempt', async () => {
      const teacher = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });
      await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone: teacher.phone },
      });

      const bad = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/login',
        payload: { phone: teacher.phone, code: '000000' },
      });
      expect(bad.statusCode).toBe(400);
      expect((bad.json() as { error: { code: string } }).error.code).toBe('OTP_INVALID');

      const challenge = await prisma().otpChallenge.findFirst({ where: { phone: teacher.phone } });
      expect(challenge?.attempts).toBe(1);
    });

    it('refuses to reuse a code', async () => {
      const teacher = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });
      const request = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone: teacher.phone },
      });
      const { devCode } = request.json() as { devCode: string };

      const first = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/login',
        payload: { phone: teacher.phone, code: devCode },
      });
      expect(first.statusCode).toBe(200);

      const second = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/login',
        payload: { phone: teacher.phone, code: devCode },
      });
      expect(second.statusCode).toBe(400);
    });

    it('stores only a hash of the code', async () => {
      const teacher = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });
      const request = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone: teacher.phone },
      });
      const { devCode } = request.json() as { devCode: string };
      const challenge = await prisma().otpChallenge.findFirstOrThrow({
        where: { phone: teacher.phone },
      });
      expect(challenge.codeHash).not.toContain(devCode);
    });
  });

  describe('registration', () => {
    it('creates a pending account against a UDISE code', async () => {
      const phone = '+919812345678';
      const otp = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone, purpose: 'REGISTRATION' },
      });
      const { devCode } = otp.json() as { devCode: string };

      const registration = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          phone,
          code: devCode,
          fullName: 'सुनीता देवी',
          udiseCode: '10000000001',
          designation: 'Assistant Teacher',
        },
      });
      expect(registration.statusCode).toBe(201);
      expect(registration.json()).toMatchObject({ status: 'PENDING_APPROVAL' });

      const created = await prisma().user.findUniqueOrThrow({ where: { phone } });
      expect(created.status).toBe('PENDING_APPROVAL');
      expect(created.schoolId).toBe(geo.schoolA1);
      // The geography is copied from the school, never taken from the client.
      expect(created.blockId).toBe(geo.blockA1);
      expect(created.districtId).toBe(geo.districtA);
    });

    it('refuses to sign in a pending account', async () => {
      const pending = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
        status: 'PENDING_APPROVAL',
      });
      const otp = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone: pending.phone },
      });
      const { devCode } = otp.json() as { devCode: string };
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/login',
        payload: { phone: pending.phone, code: devCode },
      });
      expect(login.statusCode).toBe(403);
      expect((login.json() as { error: { code: string } }).error.code).toBe('ACCOUNT_PENDING');
    });

    it('rejects an unknown UDISE code', async () => {
      const phone = '+919812345679';
      const otp = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone, purpose: 'REGISTRATION' },
      });
      const { devCode } = otp.json() as { devCode: string };
      const registration = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { phone, code: devCode, fullName: 'Test Teacher', udiseCode: '99999999999' },
      });
      expect(registration.statusCode).toBe(404);
    });
  });

  describe('password login', () => {
    it('returns the same error for an unknown account and a wrong password', async () => {
      const admin = await createUser(app, { role: 'STATE_ADMIN' });

      const wrongPassword = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/login',
        payload: { identifier: admin.phone, password: 'NotThePassword1' },
      });
      const unknownAccount = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/login',
        payload: { identifier: '+919000000001', password: 'NotThePassword1' },
      });

      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownAccount.statusCode).toBe(401);
      expect(wrongPassword.json()).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
        }),
      );
      expect((unknownAccount.json() as { error: { message: string } }).error.message).toBe(
        (wrongPassword.json() as { error: { message: string } }).error.message,
      );
    });
  });

  describe('refresh tokens', () => {
    it('rotates the token and invalidates the old one', async () => {
      const admin = await createUser(app, { role: 'STATE_ADMIN' });
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/login',
        payload: { identifier: admin.phone, password: 'TestPassword123' },
      });
      const first = (login.json() as { tokens: { refreshToken: string } }).tokens.refreshToken;

      const refreshed = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: first },
      });
      expect(refreshed.statusCode).toBe(200);
      const second = (refreshed.json() as { tokens: { refreshToken: string } }).tokens.refreshToken;
      expect(second).not.toBe(first);

      const replayed = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: first },
      });
      expect(replayed.statusCode).toBe(401);
    });

    it('revokes the whole device family when a rotated token is replayed', async () => {
      const admin = await createUser(app, { role: 'STATE_ADMIN' });
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/login',
        payload: { identifier: admin.phone, password: 'TestPassword123' },
      });
      const first = (login.json() as { tokens: { refreshToken: string } }).tokens.refreshToken;
      const refreshed = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: first },
      });
      const second = (refreshed.json() as { tokens: { refreshToken: string } }).tokens.refreshToken;

      // An attacker replays the stolen, already-rotated token...
      await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: first } });

      // ...and the legitimate device is signed out too, which is the point.
      const legitimate = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: second },
      });
      expect(legitimate.statusCode).toBe(401);
    });
  });

  describe('session enforcement', () => {
    it('rejects a request with no token', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/auth/me' });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a tampered token', async () => {
      const admin = await createUser(app, { role: 'STATE_ADMIN' });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: `Bearer ${admin.token}tampered` },
      });
      expect(response.statusCode).toBe(401);
    });

    it('stops a suspended account immediately, without waiting for the token to expire', async () => {
      const teacher = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });
      const before = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: auth(teacher) });
      expect(before.statusCode).toBe(200);

      await prisma().user.update({ where: { id: teacher.id }, data: { status: 'SUSPENDED' } });

      const after = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: auth(teacher) });
      expect(after.statusCode).toBe(403);
      expect((after.json() as { error: { code: string } }).error.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('password change', () => {
    it('requires the current password and ends other sessions', async () => {
      const admin = await createUser(app, { role: 'STATE_ADMIN' });
      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/login',
        payload: { identifier: admin.phone, password: 'TestPassword123' },
      });
      const refreshToken = (login.json() as { tokens: { refreshToken: string } }).tokens.refreshToken;

      const withoutCurrent = await app.inject({
        method: 'POST',
        url: '/v1/auth/password',
        headers: auth(admin),
        payload: { newPassword: 'BrandNewPassword9' },
      });
      expect(withoutCurrent.statusCode).toBe(403);

      const changed = await app.inject({
        method: 'POST',
        url: '/v1/auth/password',
        headers: auth(admin),
        payload: { currentPassword: 'TestPassword123', newPassword: 'BrandNewPassword9' },
      });
      expect(changed.statusCode).toBe(204);

      const staleRefresh = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken },
      });
      expect(staleRefresh.statusCode).toBe(401);
    });

    it('rejects a weak password', async () => {
      const admin = await createUser(app, { role: 'STATE_ADMIN' });
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/password',
        headers: auth(admin),
        payload: { currentPassword: 'TestPassword123', newPassword: 'short' },
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
