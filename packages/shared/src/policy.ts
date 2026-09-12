import {
  VISIBILITY_RANK,
  type ActivityStatus,
  type ConsentStatus,
  type UserRole,
  type VisibilityLevel,
} from './enums.js';
import { canApproveVisibility } from './rbac.js';

/**
 * Child-safety and workflow rules that both the server and the browser need to
 * agree on.
 *
 * They live in shared code so that a teacher sees "two guardians have not
 * signed the consent slip" on the screen *before* submitting, and the server
 * re-checks exactly the same rules before publishing. The browser copy is a
 * courtesy; the server copy is the control.
 */

export interface PublishCandidate {
  status: ActivityStatus;
  hasMedia: boolean;
  /** Consent state of every student named on the activity. */
  recognisedStudentConsents: ConsentStatus[];
  /** Media the school has not confirmed a consent slip for. */
  mediaWithoutConsentCount: number;
  descriptionLength: number;
}

export const PUBLISH_BLOCKERS = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  DESCRIPTION_TOO_SHORT: 'DESCRIPTION_TOO_SHORT',
  STUDENT_CONSENT_MISSING: 'STUDENT_CONSENT_MISSING',
  MEDIA_CONSENT_MISSING: 'MEDIA_CONSENT_MISSING',
  VISIBILITY_ABOVE_ROLE: 'VISIBILITY_ABOVE_ROLE',
  VISIBILITY_ABOVE_REQUEST: 'VISIBILITY_ABOVE_REQUEST',
} as const;
export type PublishBlocker = (typeof PUBLISH_BLOCKERS)[keyof typeof PUBLISH_BLOCKERS];

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

  // Consent gates apply only when the work leaves the department's own systems.
  // Inside the platform every viewer is an accountable, named government
  // employee; on the open web they are not.
  if (visibility === 'PUBLIC') {
    if (activity.recognisedStudentConsents.some((consent) => consent !== 'GRANTED')) {
      blockers.push(PUBLISH_BLOCKERS.STUDENT_CONSENT_MISSING);
    }
    if (activity.hasMedia && activity.mediaWithoutConsentCount > 0) {
      blockers.push(PUBLISH_BLOCKERS.MEDIA_CONSENT_MISSING);
    }
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

/**
 * The public display name for a child: given name only.
 *
 * Deliberately lossy. "Anjali" celebrated in her village is recognition;
 * "Anjali Kumari, Class 5, Primary School Rampur, Shravasti" indexed by a
 * search engine is a safeguarding incident.
 */
export function publicDisplayName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first;
}
