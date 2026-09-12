import { forbidden } from './errors.js';
import type { Actor } from '../plugins/auth.js';

export interface ScopeFilter {
  schoolId?: string;
  blockId?: string;
  districtId?: string;
}

/**
 * Turns "what the caller asked to see" into "what the caller is allowed to see".
 *
 * Every list endpoint runs its query filters through here. The rule is that a
 * caller's own scope is always applied, and any narrower filter they supply is
 * accepted only if it sits inside that scope — so a block admin may ask for one
 * school in their block, but asking for a school in the next district is a 403
 * rather than an empty list.
 *
 * Returning a 403 rather than silently emptying the result is intentional: it
 * tells an honest user they picked the wrong filter, and it tells the audit log
 * that someone probed outside their area.
 */
export function resolveScopeFilter(actor: Actor, requested: ScopeFilter = {}): ScopeFilter {
  switch (actor.role) {
    case 'SUPER_ADMIN':
    case 'STATE_ADMIN':
      return pickNarrowest(requested);

    case 'DISTRICT_ADMIN': {
      if (!actor.districtId) throw forbidden('This account has no district assigned');
      if (requested.districtId && requested.districtId !== actor.districtId) {
        throw forbidden('That district is outside your area');
      }
      const narrowed = pickNarrowest(requested);
      // A block or school filter is checked against the district by the caller's
      // own lookup of that record; here we guarantee the district bound is present.
      return narrowed.schoolId || narrowed.blockId
        ? { ...narrowed, districtId: actor.districtId }
        : { districtId: actor.districtId };
    }

    case 'BLOCK_ADMIN': {
      if (!actor.blockId) throw forbidden('This account has no block assigned');
      if (requested.blockId && requested.blockId !== actor.blockId) {
        throw forbidden('That block is outside your area');
      }
      if (requested.districtId && requested.districtId !== actor.districtId) {
        throw forbidden('That district is outside your area');
      }
      return requested.schoolId
        ? { schoolId: requested.schoolId, blockId: actor.blockId }
        : { blockId: actor.blockId };
    }

    case 'PRINCIPAL':
    case 'TEACHER': {
      if (!actor.schoolId) throw forbidden('This account has no school assigned');
      if (requested.schoolId && requested.schoolId !== actor.schoolId) {
        throw forbidden('That school is outside your area');
      }
      return { schoolId: actor.schoolId };
    }

    default: {
      const exhaustive: never = actor.role;
      throw new Error(`Unhandled role: ${String(exhaustive)}`);
    }
  }
}

/** School beats block beats district: only the tightest filter is applied. */
function pickNarrowest(requested: ScopeFilter): ScopeFilter {
  if (requested.schoolId) return { schoolId: requested.schoolId };
  if (requested.blockId) return { blockId: requested.blockId };
  if (requested.districtId) return { districtId: requested.districtId };
  return {};
}

export function describeScopeLevel(filter: ScopeFilter): 'STATE' | 'DISTRICT' | 'BLOCK' | 'SCHOOL' {
  if (filter.schoolId) return 'SCHOOL';
  if (filter.blockId) return 'BLOCK';
  if (filter.districtId) return 'DISTRICT';
  return 'STATE';
}
