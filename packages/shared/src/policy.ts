import {
  VISIBILITY_RANK,
  type ActivityStatus,
  type UserRole,
  type VisibilityLevel,
} from './enums.js';
import { canApproveVisibility } from './rbac.js';
import { needsClearance, type ClearanceState } from './integrity.js';

/**
 * Child-safety and workflow rules that both the server and the browser need to
 * agree on.
 *
 * They live in shared code so that a teacher sees what is missing on the screen
 * *before* submitting, and the server re-checks exactly the same rules before
 * publishing. The browser copy is a courtesy; the server copy is the control.
 */

export interface PublishCandidate {
  status: ActivityStatus;
  hasMedia: boolean;
  /**
   * Photographs nobody has confirmed are free of an identifiable child.
   *
   * This replaced a pair of guardian-consent checks. The platform no longer
   * holds a child's name, so there is no consent to be missing — the only
   * question left about a photograph is whether a child can be recognised in
   * it, and that question is answered by three people who know the school.
   * See docs/data-protection.md.
   */
  mediaWithoutChildCheckCount: number;
  descriptionLength: number;
  /** How far the activity has got through the gate out of its school. */
  clearance?: ClearanceState;
  /** Whether the caller is supplying the head teacher's attestation now. */
  attestingNow?: boolean;
}

export const PUBLISH_BLOCKERS = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  DESCRIPTION_TOO_SHORT: 'DESCRIPTION_TOO_SHORT',
  /** A photograph nobody has confirmed is free of an identifiable child. */
  CHILD_VISIBLE_CHECK_MISSING: 'CHILD_VISIBLE_CHECK_MISSING',
  VISIBILITY_ABOVE_ROLE: 'VISIBILITY_ABOVE_ROLE',
  VISIBILITY_ABOVE_REQUEST: 'VISIBILITY_ABOVE_REQUEST',
  /** Leaving the school needs the head teacher's named statement. */
  ATTESTATION_REQUIRED: 'ATTESTATION_REQUIRED',
  /** The open web additionally needs a block officer to have actually looked. */
  BLOCK_CLEARANCE_REQUIRED: 'BLOCK_CLEARANCE_REQUIRED',
} as const;
export type PublishBlocker = (typeof PUBLISH_BLOCKERS)[keyof typeof PUBLISH_BLOCKERS];

/**
 * The blockers that hold at every visibility, including the school's own record.
 *
 * Everything else on the list is a reason the work cannot leave the school, not
 * a reason it cannot be recorded at all. The distinction is what lets a head
 * teacher file a lesson with a consent gap as an internal record while the API
 * still refuses to publish it to the open web.
 *
 * This exists because `evaluatePublishBlockers` is necessarily evaluated
 * against one visibility, and the interface offers two. Without a way to tell
 * the two kinds apart, a consent gap computed for a PUBLIC request would grey
 * out the school-only button as well and leave the head teacher with no legal
 * action and no explanation.
 */
export const UNCONDITIONAL_PUBLISH_BLOCKERS: readonly PublishBlocker[] = [
  PUBLISH_BLOCKERS.NOT_SUBMITTED,
  PUBLISH_BLOCKERS.DESCRIPTION_TOO_SHORT,
];

const MINIMUM_PUBLISHED_DESCRIPTION = 20;

/**
 * Every reason the activity cannot be published at `visibility` right now.
 *
 * Returning the whole list rather than the first failure matters in practice: a
 * head teacher on a slow connection should be told all four things to fix in
 * one round trip, not made to discover them one at a time.
 */
export function evaluatePublishBlockers(
  activity: PublishCandidate,
  visibility: VisibilityLevel,
  moderatorRole: UserRole,
  requestedVisibility?: VisibilityLevel | null,
): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];

  if (activity.status !== 'PENDING_REVIEW' && activity.status !== 'PUBLISHED') {
    blockers.push(PUBLISH_BLOCKERS.NOT_SUBMITTED);
  }

  if (activity.descriptionLength < MINIMUM_PUBLISHED_DESCRIPTION) {
    blockers.push(PUBLISH_BLOCKERS.DESCRIPTION_TOO_SHORT);
  }

  if (!canApproveVisibility(moderatorRole, visibility)) {
    blockers.push(PUBLISH_BLOCKERS.VISIBILITY_ABOVE_ROLE);
  }

  if (requestedVisibility && VISIBILITY_RANK[visibility] > VISIBILITY_RANK[requestedVisibility]) {
    blockers.push(PUBLISH_BLOCKERS.VISIBILITY_ABOVE_REQUEST);
  }

  // Leaving the school at all needs the head teacher's named statement — a
  // colleague's click is not an independent check on a colleague's work.
  if (needsClearance(visibility)) {
    const alreadyAttested =
      activity.clearance === 'AWAITING_BLOCK' ||
      activity.clearance === 'AUTO_CLEARED' ||
      activity.clearance === 'CLEARED';
    if (!alreadyAttested && !activity.attestingNow) {
      blockers.push(PUBLISH_BLOCKERS.ATTESTATION_REQUIRED);
    }
  }

  // The open web is the one destination that always costs a block officer's
  // actual attention. Auto-clearing on a school's own record is enough to reach
  // other educators; it is not enough to reach everyone.
  if (visibility === 'PUBLIC' && activity.clearance !== 'CLEARED') {
    blockers.push(PUBLISH_BLOCKERS.BLOCK_CLEARANCE_REQUIRED);
  }

  // Every photograph leaving the school must have been looked at, whatever the
  // destination. Unlike the consent rule this replaced, it does not wait for
  // PUBLIC: an identifiable child reaching a district dashboard is the same
  // failure as one reaching the open web, just with a smaller audience.
  if (needsClearance(visibility) && activity.hasMedia && activity.mediaWithoutChildCheckCount > 0) {
    blockers.push(PUBLISH_BLOCKERS.CHILD_VISIBLE_CHECK_MISSING);
  }

  return blockers;
}

/** Allowed activity state transitions. Anything not listed here is rejected. */
const ACTIVITY_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['PUBLISHED', 'REJECTED', 'DRAFT', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED', 'PENDING_REVIEW'],
  REJECTED: ['DRAFT', 'PENDING_REVIEW', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export function canTransitionActivity(from: ActivityStatus, to: ActivityStatus): boolean {
  return ACTIVITY_TRANSITIONS[from].includes(to);
}

/**
 * Who may edit an activity's content.
 *
 * The author keeps control until it is published; after that only a moderator
 * may change it, and the change is recorded. Published records are evidence and
 * must not be quietly rewritten.
 */
export function canEditActivity(
  status: ActivityStatus,
  isAuthor: boolean,
  role: UserRole,
): boolean {
  if (status === 'ARCHIVED') return false;
  if (status === 'PUBLISHED') {
    return role !== 'TEACHER';
  }
  if (isAuthor) return true;
  return role !== 'TEACHER';
}
