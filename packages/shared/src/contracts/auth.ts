import { z } from 'zod';
import { OTP_PURPOSES, USER_ROLES, USER_STATUSES } from '../enums.js';
import {
  cleanText,
  otpCodeSchema,
  passwordSchema,
  phoneSchema,
  udiseSchema,
} from '../primitives.js';

/**
 * Step one of the teacher login: ask for a one-time code.
 *
 * The response deliberately looks identical whether or not the number belongs to
 * an account, so the endpoint cannot be used to discover who is registered.
 */
export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(OTP_PURPOSES).default('LOGIN'),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const requestOtpResponseSchema = z.object({
  /** Seconds the code stays valid. */
  expiresInSeconds: z.number().int().positive(),
  /** Seconds before another code may be requested for this number. */
  resendAfterSeconds: z.number().int().nonnegative(),
  /** Only ever populated outside production, so local development needs no SMS gateway. */
  devCode: z.string().optional(),
});
export type RequestOtpResponse = z.infer<typeof requestOtpResponseSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  purpose: z.enum(OTP_PURPOSES).default('LOGIN'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/** Administrators use a password rather than an OTP: they log in from desks, often on shared numbers. */
export const passwordLoginSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(128),
});
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;

/**
 * Self-registration for a teacher.
 *
 * The account is created in PENDING_APPROVAL and can do nothing until the head
 * teacher or the block office approves it. Anchoring on the UDISE code means a
 * teacher never has to hunt through a dropdown of 130,000 schools.
 */
export const registerTeacherSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  fullName: cleanText(2, 120),
  udiseCode: udiseSchema,
  designation: cleanText(2, 80).optional(),
  employeeCode: cleanText(2, 40).optional(),
  email: z.string().trim().email().max(160).optional(),
});
export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const setPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: passwordSchema,
});
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  designation: z.string().nullable(),
  districtId: z.string().nullable(),
  districtName: z.string().nullable(),
  blockId: z.string().nullable(),
  blockName: z.string().nullable(),
  schoolId: z.string().nullable(),
  schoolName: z.string().nullable(),
  permissions: z.array(z.string()),
  mustSetPassword: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresInSeconds: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authSessionSchema = z.object({
  tokens: authTokensSchema,
  user: sessionUserSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

/** Shape of the signed access token payload. */
export interface AccessTokenClaims {
  sub: string;
  role: (typeof USER_ROLES)[number];
  districtId: string | null;
  blockId: string | null;
  schoolId: string | null;
  /** Session family, so a single device can be revoked without logging out the rest. */
  sid: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}
