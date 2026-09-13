import { z } from 'zod';
import { cleanMultilineText } from '../primitives.js';

/**
 * Who is holding this, and for how long.
 *
 * The recurring grievance of Uttar Pradesh basic school teachers is not that
 * they are measured. It is that the measurement runs one way. The state has
 * built precise instruments for the lowest-status actor in the chain — a
 * fifteen-minute attendance window enforced by face recognition, an
 * un-appealable absence, a leave portal that closes at nine in the morning —
 * and nothing at all for the offices above. When the unions listed their
 * conditions in November 2025, the objection they put first was that the
 * instrument was aimed at teachers alone.
 *
 * This platform already puts a head teacher, a block officer and a district
 * officer in the path of a teacher's work. If it timed the teacher and not
 * them, it would reproduce exactly the asymmetry that produced a statewide
 * boycott, and it would deserve the same reception.
 *
 * So every stage of the gate carries a visible age, and the age belongs to
 * whoever owes the answer. A teacher can see that their work has been with the
 * block office for eleven days. An officer opening the same screen sees their
 * own backlog first.
 *
 * Two things this deliberately is not:
 *
 * It is not a per-officer performance score. The office is named, the
 * individual is not, and nothing here aggregates upward into a ranking of
 * people — the same rule that protects teachers protects the block officer,
 * for the same reason. See packages/shared/src/guarantees.ts.
 *
 * And being late is late, not delinquent. `RESPONSE_EXPECTATION_DAYS` marks an
 * item as waiting longer than it should; it triggers no penalty, no report and
 * no notice. The instrument that failed in July 2024 turned a missed window
 * into an absence with a salary deduction, and the concession that followed —
 * a grace period conditional on typing a justification into the system judging
 * you — failed too. Nothing here converts a delay into a finding against
 * anyone.
 */

/** The offices a piece of work can be sitting with. */
export const WAITING_STAGES = [
  /** Submitted by a teacher, not yet moderated or attested by the head teacher. */
  'HEAD_TEACHER',
  /** Attested and sent up; the block office has not yet cleared or returned it. */
  'BLOCK_OFFICE',
  /** Cleared by the block; the district has not yet decided on the open web. */
  'DISTRICT_OFFICE',
] as const;
export type WaitingStage = (typeof WAITING_STAGES)[number];

/** What kinds of thing can be waiting. Each is something somebody asked for. */
export const WAITING_KINDS = [
  'ACTIVITY',
  /** A head teacher's claim on a school, which blocks the school entirely. */
  'SCHOOL_CLAIM',
  /** Something the School Management Committee asked the block for. */
  'SMC_REQUEST',
] as const;
export type WaitingKind = (typeof WAITING_KINDS)[number];

/**
 * How long each office should take, in days.
 *
 * Soft targets, chosen to be generous rather than tight. A block officer
 * covers dozens of schools and spends most of their week on upward reporting;
 * an expectation they cannot meet would be a lie, and a lie in this direction
 * discredits the whole idea. These exist so a teacher knows what normal looks
 * like, not so anybody can be held to them.
 */
export const RESPONSE_EXPECTATION_DAYS: Record<WaitingStage, number> = {
  HEAD_TEACHER: 3,
  BLOCK_OFFICE: 7,
  DISTRICT_OFFICE: 10,
};

export const waitingItemSchema = z.object({
  id: z.string(),
  kind: z.enum(WAITING_KINDS),
  title: z.string(),
  schoolId: z.string(),
  schoolName: z.string(),
  udiseCode: z.string(),
  /** Which office it is sitting with now. */
  stage: z.enum(WAITING_STAGES),
  /**
   * The office, named as a place rather than a person.
   *
   * "Block office, Nanpara" and not "Ram Prasad". The point is that somebody
   * owes an answer, not that a particular official is being singled out — and
   * an officer who is themselves measured by name will start clearing work
   * without reading it, which is the failure this is meant to prevent.
   */
  holder: z.string(),
  /** When it started waiting at this stage. */
  waitingSince: z.string(),
  waitingDays: z.number().int(),
  /** Past `RESPONSE_EXPECTATION_DAYS`. Informational, never a penalty. */
  overdue: z.boolean(),
});
export type WaitingItem = z.infer<typeof waitingItemSchema>;

export const waitingBoardSchema = z.object({
  /**
   * Everything the caller can see that is waiting on somebody, oldest first.
   *
   * Oldest first rather than newest, deliberately: a queue ordered by arrival
   * buries the thing that has been ignored longest, which is the one item on
   * the screen that actually needs a decision.
   */
  items: z.array(waitingItemSchema),
  /**
   * Of those, the ones waiting on the caller's own office.
   *
   * An officer opening this screen is shown their own debt before anybody
   * else's. For a teacher this is zero, and the field is what makes the screen
   * mean the same thing to both of them.
   */
  owedByYou: z.number().int(),
  oldestDays: z.number().int(),
  total: z.number().int(),
});
export type WaitingBoard = z.infer<typeof waitingBoardSchema>;

// ---------------------------------------------------------------------------
// The mirror: how long each office actually takes
// ---------------------------------------------------------------------------

/**
 * Turnaround by office, over a window.
 *
 * The counterpart to the school reports an officer already reads. Grouped by
 * office and never by person, exactly as the school reports are grouped by
 * school and never by teacher — a district officer sees their blocks, the
 * state sees districts, and nobody anywhere sees an individual.
 */
export const responseTimeRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.enum(WAITING_STAGES),
  /** Decisions taken in the window. */
  decided: z.number().int(),
  /** Median days to decide. Median rather than mean: one forgotten item should
   *  not make a responsive office look negligent, and twenty forgotten ones
   *  should not be hidden by a hundred quick ones. */
  medianDays: z.number(),
  slowestDays: z.number().int(),
  /** Still waiting at the end of the window, and the age of the oldest. */
  pending: z.number().int(),
  oldestPendingDays: z.number().int(),
});
export type ResponseTimeRow = z.infer<typeof responseTimeRowSchema>;

export const responseTimesSchema = z.object({
  from: z.string(),
  to: z.string(),
  rows: z.array(responseTimeRowSchema),
});
export type ResponseTimes = z.infer<typeof responseTimesSchema>;

/**
 * The block office's answer to what a committee asked for.
 *
 * Free text with a floor rather than a fixed set of outcomes. A committee that
 * asked for a boundary wall is owed a sentence, not a status code, and an
 * officer forced to pick from a dropdown picks the first option.
 */
export const answerSmcRequestSchema = z.object({
  answer: cleanMultilineText(10, 1000),
});
export type AnswerSmcRequestInput = z.infer<typeof answerSmcRequestSchema>;
