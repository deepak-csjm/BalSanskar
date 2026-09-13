/**
 * Role-based access control.
 *
 * Two independent questions are answered here and both must pass before an
 * action is allowed:
 *
 *   1. Capability — "may this role ever do this?"        -> {@link can}
 *   2. Scope      — "may this user do it *here*?"        -> {@link isWithinScope}
 *
 * Keeping them separate is deliberate: a DISTRICT_ADMIN and a BLOCK_ADMIN share
 * most capabilities and differ only in reach, while a TEACHER and a PRINCIPAL
 * share reach (one school) and differ only in capability.
 */

import { ROLE_RANK, VISIBILITY_RANK, type UserRole, type VisibilityLevel } from './enums.js';

export const PERMISSIONS = [
  // Organisation
  'school:read',
  'school:create',
  'school:update',
  /**
   * Confirm a head teacher's claim on a school, bringing it into the register.
   *
   * Deliberately separate from `school:create`: the block officer is the person
   * who knows whether a claimant really is the head teacher of that school, but
   * giving them a free hand to invent schools is a different and larger power.
   * This permission only ever resolves a claim someone else raised.
   */
  'school:verify_claim',

  // People
  'user:read',
  'user:invite',
  'user:approve',
  'user:suspend',
  'user:assign_role',

  /**
   * How many children the school teaches, by class. Not who they are — there is
   * no child record in this platform and there will not be one. See
   * docs/data-protection.md.
   */
  'enrolment:write',

  /**
   * The village's side of the school: what it needs, whether its committee
   * met, and which hamlets have been walked looking for children who are not
   * in school. Held by school staff, because these are the school's own
   * records — the village reads them without an account at all.
   */
  'village:write',

  /**
   * Teaching days the state's own demands consumed.
   *
   * Held by every teacher for their own days, because it is their record and
   * their honorarium claim. Attesting somebody else's is the head teacher's
   * job and rides on `activity:moderate`, which they already hold — a separate
   * permission would suggest this is a separate kind of authority, and it is
   * not: it is the same act of saying "yes, this happened here".
   */
  'duty:write',

  // Work of the school
  'activity:create',
  'activity:read',
  'activity:update_own',
  'activity:update_any',
  'activity:submit',
  'activity:moderate',
  'activity:archive',
  /**
   * Clear a school's work for the block and above, or send it back.
   *
   * Deliberately withheld from the head teacher. They already moderate and
   * attest; letting the same office also clear its own work would put the
   * whole chain inside one school, which is the failure this permission exists
   * to prevent.
   */
  'activity:clear',

  'achievement:read',
  'achievement:create',
  'achievement:verify',

  'appreciation:give',

  // Oversight
  'report:read',
  'report:export',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const TEACHER_PERMISSIONS: Permission[] = [
  'school:read',
  'user:read',
  'activity:create',
  'activity:read',
  'activity:update_own',
  'activity:submit',
  'village:write',
  'duty:write',
  'achievement:read',
  'achievement:create',
  'report:read',
];

const PRINCIPAL_PERMISSIONS: Permission[] = [
  ...TEACHER_PERMISSIONS,
  'school:update',
  // The register is a number the whole block is measured against, so it
  // carries the head teacher's name rather than any teacher's.
  'enrolment:write',
  'user:invite',
  'user:approve',
  'activity:update_any',
  'activity:moderate',
  'activity:archive',
  'achievement:verify',
  'appreciation:give',
  'report:export',
];

const BLOCK_ADMIN_PERMISSIONS: Permission[] = [
  ...PRINCIPAL_PERMISSIONS,
  'user:suspend',
  'audit:read',
  // The two powers that make the block office the real check on a school:
  // confirming that a school and its head teacher exist, and deciding whether
  // that school's work may be seen outside it.
  'school:verify_claim',
  'activity:clear',
];

const DISTRICT_ADMIN_PERMISSIONS: Permission[] = [
  ...BLOCK_ADMIN_PERMISSIONS,
  'school:create',
  'user:assign_role',
];

const STATE_ADMIN_PERMISSIONS: Permission[] = [...DISTRICT_ADMIN_PERMISSIONS];

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  TEACHER: new Set(TEACHER_PERMISSIONS),
  PRINCIPAL: new Set(PRINCIPAL_PERMISSIONS),
  BLOCK_ADMIN: new Set(BLOCK_ADMIN_PERMISSIONS),
  DISTRICT_ADMIN: new Set(DISTRICT_ADMIN_PERMISSIONS),
  STATE_ADMIN: new Set(STATE_ADMIN_PERMISSIONS),
  SUPER_ADMIN: new Set(PERMISSIONS),
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsFor(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]].sort();
}

export function hasAtLeastRole(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * The administrative reach of a principal. `schoolId` is set for school-level
 * roles, `blockId` for block admins, `districtId` for district admins, and all
 * three are null for state-wide roles.
 */
export interface ActorScope {
  role: UserRole;
  districtId: string | null;
  blockId: string | null;
  schoolId: string | null;
}

/** The location of the thing being acted upon. */
export interface TargetScope {
  districtId?: string | null;
  blockId?: string | null;
  schoolId?: string | null;
}

/**
 * True when `actor` administers the place `target` sits in.
 *
 * State-wide roles match everything. Narrower roles must match on their own
 * level, and a target that does not carry the identifier the actor is scoped by
 * never matches — a missing identifier is treated as "elsewhere", never as
 * "anywhere".
 */
export function isWithinScope(actor: ActorScope, target: TargetScope): boolean {
  switch (actor.role) {
    case 'SUPER_ADMIN':
    case 'STATE_ADMIN':
      return true;
    case 'DISTRICT_ADMIN':
      return actor.districtId != null && target.districtId === actor.districtId;
    case 'BLOCK_ADMIN':
      return actor.blockId != null && target.blockId === actor.blockId;
    case 'PRINCIPAL':
    case 'TEACHER':
      return actor.schoolId != null && target.schoolId === actor.schoolId;
    default: {
      const exhaustive: never = actor.role;
      throw new Error(`Unhandled role: ${String(exhaustive)}`);
    }
  }
}

/**
 * The highest visibility a role may approve content up to.
 *
 * Everything below PUBLIC stays inside the authenticated platform and is seen
 * only by other educators, so school leadership can grant it. PUBLIC pushes a
 * school's work onto the open showcase and is reserved for district level and
 * above — it is the point at which children's photographs could leave the
 * department's control.
 */
export function maxApprovableVisibility(role: UserRole): VisibilityLevel | null {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'STATE_ADMIN':
    case 'DISTRICT_ADMIN':
      return 'PUBLIC';
    case 'BLOCK_ADMIN':
    case 'PRINCIPAL':
      return 'DISTRICT';
    case 'TEACHER':
      return null;
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled role: ${String(exhaustive)}`);
    }
  }
}

export function canApproveVisibility(role: UserRole, visibility: VisibilityLevel): boolean {
  const ceiling = maxApprovableVisibility(role);
  if (ceiling === null) return false;
  return VISIBILITY_RANK[visibility] <= VISIBILITY_RANK[ceiling];
}

/**
 * Which roles a given actor may hand out. Nobody may create a peer or a
 * superior, which stops a compromised district account from minting a state
 * admin.
 */
export function assignableRoles(role: UserRole): UserRole[] {
  const ceiling = ROLE_RANK[role];
  return (Object.keys(ROLE_RANK) as UserRole[])
    .filter((candidate) => ROLE_RANK[candidate] < ceiling)
    .sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
}

/**
 * The scope fields a role is required to carry. Used to validate accounts at
 * creation time so that no user can exist with an ambiguous reach.
 */
export function requiredScopeFields(role: UserRole): Array<'districtId' | 'blockId' | 'schoolId'> {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'STATE_ADMIN':
      return [];
    case 'DISTRICT_ADMIN':
      return ['districtId'];
    case 'BLOCK_ADMIN':
      return ['districtId', 'blockId'];
    case 'PRINCIPAL':
    case 'TEACHER':
      return ['districtId', 'blockId', 'schoolId'];
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled role: ${String(exhaustive)}`);
    }
  }
}
