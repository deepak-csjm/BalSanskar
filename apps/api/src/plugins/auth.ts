import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  can,
  isWithinScope,
  type ActorScope,
  type Permission,
  type TargetScope,
  type UserRole,
  type UserStatus,
} from '@balsanskar/shared';
import { AppError, ERROR_CODES, forbidden, unauthenticated } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { getPrisma } from '../lib/prisma.js';
import type { AuditContext } from '../lib/audit.js';

export interface Actor extends ActorScope {
  id: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by `requireAuth`. Reading it on an unauthenticated route throws. */
    actor?: Actor;
    auditContext(): AuditContext;
    currentActor(): Actor;
    /** Throws unless the caller's role carries the permission. */
    requirePermission(permission: Permission): Actor;
    /** Throws unless the caller's role carries the permission *and* the target is in their patch. */
    requireScopedPermission(permission: Permission, target: TargetScope): Actor;
  }

  interface FastifyInstance {
    requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

/**
 * Loads the caller from the access token, then re-reads the account.
 *
 * The database read on every authenticated request is deliberate. A stateless
 * token alone would keep a suspended teacher — or one moved to another school
 * during an investigation — working for up to fifteen minutes. For a system
 * holding children's photographs that window is not acceptable, and one
 * primary-key lookup is a price worth paying.
 */
async function loadActor(request: FastifyRequest): Promise<Actor> {
  const token = bearerToken(request);
  if (!token) throw unauthenticated();

  const claims = await verifyAccessToken(token);
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      role: true,
      status: true,
      fullName: true,
      districtId: true,
      blockId: true,
      schoolId: true,
    },
  });

  if (!user) throw unauthenticated('This account no longer exists');
  if (user.status === 'SUSPENDED') {
    throw new AppError(403, ERROR_CODES.ACCOUNT_SUSPENDED, 'This account has been suspended');
  }
  if (user.status === 'PENDING_APPROVAL') {
    throw new AppError(
      403,
      ERROR_CODES.ACCOUNT_PENDING,
      'Your account is waiting for approval by your head teacher or block office',
    );
  }
  if (user.status === 'REJECTED') {
    throw new AppError(403, ERROR_CODES.ACCOUNT_SUSPENDED, 'This registration was not approved');
  }

  return {
    id: user.id,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    districtId: user.districtId,
    blockId: user.blockId,
    schoolId: user.schoolId,
    sessionId: claims.sid,
  };
}

export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('actor', undefined);

  app.decorateRequest('currentActor', function currentActor(this: FastifyRequest): Actor {
    if (!this.actor) throw unauthenticated();
    return this.actor;
  });

  app.decorateRequest('auditContext', function auditContext(this: FastifyRequest): AuditContext {
    return {
      actorId: this.actor?.id ?? null,
      actorRole: this.actor?.role ?? null,
      ip: this.ip ?? null,
      userAgent: typeof this.headers['user-agent'] === 'string' ? this.headers['user-agent'] : null,
    };
  });

  app.decorateRequest(
    'requirePermission',
    function requirePermission(this: FastifyRequest, permission: Permission): Actor {
      const actor = this.currentActor();
      if (!can(actor.role, permission)) {
        throw forbidden('Your role does not allow this action', { permission, role: actor.role });
      }
      return actor;
    },
  );

  app.decorateRequest(
    'requireScopedPermission',
    function requireScopedPermission(
      this: FastifyRequest,
      permission: Permission,
      target: TargetScope,
    ): Actor {
      const actor = this.requirePermission(permission);
      if (!isWithinScope(actor, target)) {
        throw forbidden('This record belongs to a school outside your area', {
          permission,
          role: actor.role,
        });
      }
      return actor;
    },
  );

  app.decorate('requireAuth', async function requireAuth(request: FastifyRequest) {
    request.actor = await loadActor(request);
  });

  /**
   * For endpoints that behave differently when signed in but do not require it —
   * the public showcase, which shows moderation state to officers.
   */
  app.decorate('optionalAuth', async function optionalAuth(request: FastifyRequest) {
    if (!bearerToken(request)) return;
    try {
      request.actor = await loadActor(request);
    } catch {
      request.actor = undefined;
    }
  });
});
