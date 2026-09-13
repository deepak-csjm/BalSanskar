import { z } from 'zod';
import { CLASS_LEVELS } from '../enums.js';
import { cleanMultilineText, cleanText, idSchema, pastOrTodaySchema } from '../primitives.js';

/**
 * The village's side of the school.
 *
 * Everything above this file serves a chain that runs teacher → head teacher →
 * block → district. That chain is necessary and it is not sufficient, because
 * it contains nobody who lives in the village. A school works when the parents,
 * the pradhan, the retired master down the road and the local volunteer are
 * involved, and the Right to Education Act already says so: it mandates a
 * School Management Committee that is three-quarters parents and half women.
 *
 * In practice most SMCs are dormant, and the reason is mundane — the committee
 * has authority on paper and no information in fact. Nobody outside the school
 * building can see what the school has been doing, what it needs, or what was
 * decided at the last meeting. This file is the smallest set of things that
 * changes that.
 *
 * Two design constraints, both load-bearing:
 *
 * The village side needs **no account**. A parent will not register to look at
 * their child's school. A QR code on the school wall opens a page; that is the
 * whole flow. It is also the safest possible design — a surface with no login
 * has no credentials to lose and no personal data to hold.
 *
 * And it holds **nothing about any child**, exactly like the rest of the
 * platform. See docs/data-protection.md.
 */

// ---------------------------------------------------------------------------
// What the school needs
// ---------------------------------------------------------------------------

/**
 * The kinds of help a village can actually give a school.
 *
 * Deliberately mundane. The things that hold a rural school back are a broken
 * hand pump, no fan in June, nobody to take a reading class, and a boundary
 * wall the cattle walk through — not anything a policy document would list.
 */
export const NEED_KINDS = [
  /** Books, slates, chalk, sports equipment, a globe. */
  'MATERIAL',
  /** A fan, a bulb, a hand pump, a door, a boundary wall, a toilet. */
  'REPAIR',
  /** Somebody to teach, coach, read with children, or run a session. */
  'VOLUNTEER_TIME',
  /** A one-off event: a science fair, a sports day, a health camp. */
  'EVENT_SUPPORT',
  /** Getting a particular hamlet's children back into school. */
  'ENROLMENT_HELP',
  'OTHER',
] as const;
export type NeedKind = (typeof NEED_KINDS)[number];

export const NEED_STATUSES = ['OPEN', 'PROMISED', 'MET', 'WITHDRAWN'] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

/**
 * A need the head teacher publishes to the village.
 *
 * There is no money in this. Nobody pays through the platform and nobody
 * pledges an amount: a need is met when the head teacher says a person turned
 * up and did the thing. Handling money would bring in payment regulation, an
 * audit obligation and — far worse for a school — the suspicion that somebody
 * is collecting. A village gives in kind and in person, and the record of who
 * helped is the entire reward.
 *
 * The formal route for corporate and organised volunteering already exists at
 * the Ministry of Education's Vidyanjali portal, and the school page links
 * there rather than reimplementing it. This is for the person who lives
 * fifteen minutes away.
 */
export const createNeedSchema = z.object({
  kind: z.enum(NEED_KINDS),
  title: cleanText(5, 120),
  detail: cleanMultilineText(0, 800).optional(),
  /** Roughly how many, where a count means something. Never a rupee value. */
  quantity: z.number().int().min(1).max(1000).optional(),
  /** Classes it would help, so a volunteer knows what they are walking into. */
  classLevels: z.array(z.enum(CLASS_LEVELS)).max(CLASS_LEVELS.length).default([]),
});
export type CreateNeedInput = z.infer<typeof createNeedSchema>;

export const needSchema = z.object({
  id: z.string(),
  kind: z.enum(NEED_KINDS),
  status: z.enum(NEED_STATUSES),
  title: z.string(),
  detail: z.string().nullable(),
  quantity: z.number().int().nullable(),
  classLevels: z.array(z.enum(CLASS_LEVELS)),
  /**
   * Who said they would help, as they chose to be named.
   *
   * Free text the head teacher types after a conversation, not an account and
   * not a contact detail. "Ram Prasad ji, Rampur" is the whole record. The
   * platform is not a directory of villagers and must not become one.
   */
  helperCredit: z.string().nullable(),
  metOn: z.string().nullable(),
  createdAt: z.string(),
});
export type Need = z.infer<typeof needSchema>;

export const resolveNeedSchema = z.object({
  status: z.enum(['PROMISED', 'MET', 'WITHDRAWN']),
  /** How the person wishes to be named, or left empty if they would rather not be. */
  helperCredit: cleanText(2, 120).optional(),
  metOn: pastOrTodaySchema.optional(),
});
export type ResolveNeedInput = z.infer<typeof resolveNeedSchema>;

// ---------------------------------------------------------------------------
// The School Management Committee
// ---------------------------------------------------------------------------

/**
 * A record that the committee met, and what it decided.
 *
 * The RTE Act requires the SMC to meet and to keep minutes, and those minutes
 * are a public record. Almost nowhere are they visible to the parents the
 * committee is made of. Publishing the fact of the meeting, the count present
 * and the decisions taken is a small thing that makes the committee real: a
 * parent can see whether it met, and a block officer can see which schools have
 * a committee in name only.
 *
 * Attendance is a count and office-bearers are named because those are already
 * public positions. No other member is named, and no parent's contact details
 * are held anywhere.
 */
export const recordSmcMeetingSchema = z.object({
  heldOn: pastOrTodaySchema,
  membersPresent: z.number().int().min(0).max(50),
  /** Of those present, how many were parents. The Act says most should be. */
  parentsPresent: z.number().int().min(0).max(50),
  /** Of those present, how many were women. The Act says half should be. */
  womenPresent: z.number().int().min(0).max(50),
  decisions: cleanMultilineText(10, 2000),
  /** What the committee is asking the block or the panchayat for. */
  raisedWithBlock: cleanMultilineText(0, 800).optional(),
});
export type RecordSmcMeetingInput = z.infer<typeof recordSmcMeetingSchema>;

export const smcMeetingSchema = z.object({
  id: z.string(),
  heldOn: z.string(),
  membersPresent: z.number().int(),
  parentsPresent: z.number().int(),
  womenPresent: z.number().int(),
  decisions: z.string(),
  raisedWithBlock: z.string().nullable(),
  recordedByName: z.string(),
  createdAt: z.string(),
});
export type SmcMeeting = z.infer<typeof smcMeetingSchema>;

// ---------------------------------------------------------------------------
// Children who are not in school
// ---------------------------------------------------------------------------

/**
 * The survey of a hamlet, as counts.
 *
 * Uttar Pradesh has more out-of-school children than any other state — roughly
 * 784,000 at the last count — and already runs a household survey to find them,
 * carried out by school teams alongside Shiksha Mitras, trainees and local
 * volunteers, covering brick kilns, slums and migrant settlements. It runs on
 * paper and WhatsApp.
 *
 * This coordinates that effort and deliberately does not do the thing it would
 * be most tempting to do. It holds **no child**. Not a name, not an age, not a
 * household. The DPDP Act forbids tracking or monitoring a child outright, and
 * no consent unlocks that; and the school already holds the names lawfully,
 * under a statutory duty, in the register it has always kept.
 *
 * What is missing is not the names. It is knowing which hamlets have been
 * walked, what was found, and whether anybody went back — which is exactly what
 * a count answers, and exactly what nobody can see today.
 */
export const HABITATION_KINDS = [
  'VILLAGE',
  'HAMLET',
  'WARD',
  /** Brick kilns, construction sites and the settlements around them. */
  'WORKSITE',
  'MIGRANT_SETTLEMENT',
  'OTHER',
] as const;
export type HabitationKind = (typeof HABITATION_KINDS)[number];

export const recordSurveySchema = z.object({
  /** What the place is called locally. A place, never a household. */
  habitationName: cleanText(2, 120),
  kind: z.enum(HABITATION_KINDS).default('HAMLET'),
  surveyedOn: pastOrTodaySchema,
  householdsVisited: z.number().int().min(0).max(10_000),
  /** Children aged six to fourteen found not attending any school. */
  childrenFound: z.number().int().min(0).max(2000),
  /** Of those, how many have since been enrolled somewhere. */
  childrenEnrolled: z.number().int().min(0).max(2000),
  /**
   * Who walked it. Named because they are volunteering their afternoon and the
   * credit is the point, and because a hamlet nobody will own is a hamlet
   * nobody surveys.
   */
  surveyedBy: cleanText(2, 160),
  /** Why the remaining children are not back yet, in the surveyor's words. */
  note: cleanMultilineText(0, 800).optional(),
});
export type RecordSurveyInput = z.infer<typeof recordSurveySchema>;

export const habitationSurveySchema = z.object({
  id: z.string(),
  habitationName: z.string(),
  kind: z.enum(HABITATION_KINDS),
  surveyedOn: z.string(),
  householdsVisited: z.number().int(),
  childrenFound: z.number().int(),
  childrenEnrolled: z.number().int(),
  /** Found but not yet back. The number the whole exercise is about. */
  stillOut: z.number().int(),
  surveyedBy: z.string(),
  note: z.string().nullable(),
  schoolId: z.string(),
  schoolName: z.string(),
  createdAt: z.string(),
});
export type HabitationSurvey = z.infer<typeof habitationSurveySchema>;

/** Rolled up for a block or district officer, and for the village page. */
export const surveySummarySchema = z.object({
  habitationsSurveyed: z.number().int(),
  householdsVisited: z.number().int(),
  childrenFound: z.number().int(),
  childrenEnrolled: z.number().int(),
  stillOut: z.number().int(),
  lastSurveyedOn: z.string().nullable(),
});
export type SurveySummary = z.infer<typeof surveySummarySchema>;

// ---------------------------------------------------------------------------
// The page on the school wall
// ---------------------------------------------------------------------------

/**
 * Everything a villager sees when they scan the code by the door.
 *
 * No account, no personal data, and nothing that has not already been cleared
 * by a block officer. It is assembled from records that exist for other reasons
 * rather than asking anybody for anything new, because a page that needs
 * feeding is a page that goes stale and a stale page is worse than none.
 */
export const villageSchoolPageSchema = z.object({
  udiseCode: z.string(),
  schoolName: z.string(),
  blockName: z.string(),
  districtName: z.string(),
  villageOrWard: z.string().nullable(),
  /** Children on the register, by class. Counts only. */
  enrolment: z.object({
    total: z.number().int(),
    classes: z.array(z.object({ classLevel: z.enum(CLASS_LEVELS), enrolled: z.number().int() })),
    asOn: z.string().nullable(),
  }),
  /** Work the block office has cleared. Never anything still under review. */
  recentWork: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      occurredOn: z.string(),
      category: z.string(),
      schemes: z.array(z.string()),
    }),
  ),
  openNeeds: z.array(needSchema),
  recentlyMet: z.array(needSchema),
  lastSmcMeeting: smcMeetingSchema.nullable(),
  outOfSchool: surveySummarySchema,
});
export type VillageSchoolPage = z.infer<typeof villageSchoolPageSchema>;

export const listNeedsQuerySchema = z.object({
  schoolId: idSchema.optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
  status: z.enum(NEED_STATUSES).optional(),
  kind: z.enum(NEED_KINDS).optional(),
});
export type ListNeedsQuery = z.infer<typeof listNeedsQuerySchema>;
