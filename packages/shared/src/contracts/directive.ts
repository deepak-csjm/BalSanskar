import { z } from 'zod';
import { SCHOOL_TYPES } from '../enums.js';
import {
  cleanMultilineText,
  cleanText,
  dateOnlySchema,
  idSchema,
  pastOrTodaySchema,
} from '../primitives.js';

/**
 * What the state has actually asked of this school, and whether the letter in
 * your hand is real.
 *
 * A Uttar Pradesh basic education order is issued in Lucknow, addressed to
 * District Basic Shiksha Adhikaris and DIET principals — never to a school. It
 * reaches the classroom through a chain of WhatsApp groups that the state
 * project office itself instituted. That channel has no addressing, no
 * versioning, no acknowledgement and no audit trail, and the consequences are
 * not hypothetical:
 *
 * **Forgeries travel the same pipe as real orders.** Fake closure orders and
 * fake leave sanctions bearing officers' signatures circulate, and a head
 * teacher has no way to tell them apart. Authenticity, not availability, is the
 * acute failure — the state runs at least three order repositories and not one
 * of them can answer "is this letter real" for a photograph in a WhatsApp
 * group.
 *
 * **Orders arrive with no rank.** A constitutional court direction and a block
 * officer's improvisation look identical on a phone screen. A Block Education
 * Officer in Bareilly once ordered every school to supply 46 kg of fodder,
 * enforceable by departmental action; the correction mechanism was viral
 * outrage, after which the Basic Shiksha Adhikari confirmed no government order
 * existed and the officer lost their charge.
 *
 * **Nothing is ever marked superseded.** Three versions of an instruction
 * circulate and the school cannot tell which governs it today.
 *
 * **And the state cannot tell "not done" from "never received."** Compliance is
 * reported upward by block officers filling forms. The only time the state has
 * accidentally learned the truth was July 2024, when a portal counter showed
 * 2 per cent participation.
 *
 * Two rules bound everything in this file.
 *
 * It **verifies and never originates.** This is not an order channel. Every
 * record here points at a document some office actually issued, and a lookup
 * that finds nothing says so honestly rather than declaring a forgery — the
 * register holds what has been published to it and nothing else. A platform
 * that let an order start here would be read by the Directorate as a rival
 * authority, and would deserve to be.
 *
 * And a school's answer is an **acknowledgement, never a compliance score**.
 * See {@link BLOCKED_REASONS} for the part that matters most.
 */

/**
 * Where an instruction came from, and therefore what weight it carries.
 *
 * Recorded because orders currently arrive with no rank at all, and because
 * this is information the officer publishing already has. It costs them
 * nothing and it is the difference between a school treating a court direction
 * and a block improvisation as the same thing.
 */
export const DIRECTIVE_SOURCES = [
  /** A direction of the High Court or Supreme Court, routed through the department. */
  'COURT_DIRECTION',
  /** A shasanadesh or Directorate order: state-wide. */
  'STATE_ORDER',
  /** Issued by the district office under its own authority. */
  'DISTRICT_ORDER',
  /** Issued by the block office under its own authority. */
  'BLOCK_INSTRUCTION',
] as const;
export type DirectiveSource = (typeof DIRECTIVE_SOURCES)[number];

export const DIRECTIVE_STATUSES = ['ACTIVE', 'SUPERSEDED', 'WITHDRAWN'] as const;
export type DirectiveStatus = (typeof DIRECTIVE_STATUSES)[number];

/**
 * What a school can say back.
 *
 * Five answers, and the shape of the list is the whole argument. A system whose
 * only acceptable answer is "done" does not learn that the money never arrived
 * — it learns that the teacher failed.
 */
export const RESPONSE_STATES = [
  /** Read. The minimum useful signal, and the one nothing collects today. */
  'SEEN',
  'IN_PROGRESS',
  'DONE',
  /** Could not, for a reason that is not the school's to fix. */
  'BLOCKED',
  /** This school is not what the order is about. */
  'NOT_APPLICABLE',
] as const;
export type ResponseState = (typeof RESPONSE_STATES)[number];

/**
 * Why it could not be done — and every entry names something outside the
 * school's control.
 *
 * There is deliberately no option that means "we did not get round to it", and
 * that absence is load-bearing rather than an oversight. When the state
 * conceded a thirty-minute grace period on digital attendance in July 2024, it
 * made the concession conditional on the teacher typing a reason for lateness
 * into the system that was judging them. The protest continued and the system
 * was withdrawn days later. A justification field an officer reads is not
 * relief; it is a confession field, and teachers recognised it immediately.
 *
 * So this list is not "why did you fail". It is "what is missing", and every
 * answer points upward at whoever owes the thing. A school that simply has not
 * done something says IN_PROGRESS and is asked for nothing further.
 */
export const BLOCKED_REASONS = [
  'FUNDS_NOT_RECEIVED',
  'MATERIAL_NOT_RECEIVED',
  /** Sanctioned posts unfilled, or staff away on duty the department assigned. */
  'STAFF_SHORTAGE',
  'BUILDING_OR_FACILITY_UNUSABLE',
  /** The order names something the school never received instructions for. */
  'NO_INSTRUCTION_RECEIVED',
  /** It contradicts another order that is also in force. */
  'CONFLICTS_WITH_ANOTHER_ORDER',
  'OTHER',
] as const;
export type BlockedReason = (typeof BLOCKED_REASONS)[number];

export const publishDirectiveSchema = z.object({
  source: z.enum(DIRECTIVE_SOURCES),
  /** The पत्रांक, exactly as printed. This is what a lookup matches on. */
  letterNumber: cleanText(3, 120),
  issuedOn: pastOrTodaySchema,
  /** The office that signed it, as an office. Never an individual's name. */
  issuingOffice: cleanText(3, 160),
  title: cleanText(6, 200),
  /**
   * What the school must actually do, in plain Hindi, as an instruction.
   *
   * Mandatory and separate from the order's own text, because a shasanadesh is
   * drafted as a legal instrument for an officer and not as a task for a head
   * teacher. Roughly 4,400 academic support staff cover about 1.33 lakh
   * schools — one person per thirty-odd schools — so anything the state wants
   * understood in a classroom has to arrive already readable. It will not be
   * explained.
   */
  plainSummary: cleanMultilineText(20, 1200),
  /** Where the authoritative scan lives, if it is online. */
  documentUrl: z.string().trim().url().max(500).optional(),
  dueBy: dateOnlySchema.optional(),
  /** The order this replaces, so a school always sees exactly one current one. */
  supersedesId: idSchema.optional(),
  /** Narrow it to the school types it is about. Empty means all of them. */
  schoolTypes: z.array(z.enum(SCHOOL_TYPES)).max(SCHOOL_TYPES.length).default([]),
});
export type PublishDirectiveInput = z.infer<typeof publishDirectiveSchema>;

export const directiveSchema = z.object({
  id: z.string(),
  source: z.enum(DIRECTIVE_SOURCES),
  status: z.enum(DIRECTIVE_STATUSES),
  letterNumber: z.string(),
  issuedOn: z.string(),
  issuingOffice: z.string(),
  title: z.string(),
  plainSummary: z.string(),
  documentUrl: z.string().nullable(),
  dueBy: z.string().nullable(),
  schoolTypes: z.array(z.enum(SCHOOL_TYPES)),
  /** Set when a later order replaced this one. */
  supersededById: z.string().nullable(),
  supersedesId: z.string().nullable(),
  /** Which office put it on the register, so the entry itself is accountable. */
  publishedByOffice: z.string(),
  publishedAt: z.string(),
  /** The calling school's own answer, when there is a calling school. */
  myResponse: z
    .object({
      state: z.enum(RESPONSE_STATES),
      blockedReason: z.enum(BLOCKED_REASONS).nullable(),
      note: z.string().nullable(),
      respondedByName: z.string(),
      respondedAt: z.string(),
    })
    .nullable(),
});
export type Directive = z.infer<typeof directiveSchema>;

export const respondToDirectiveSchema = z
  .object({
    state: z.enum(RESPONSE_STATES),
    blockedReason: z.enum(BLOCKED_REASONS).optional(),
    note: cleanMultilineText(0, 600).optional(),
  })
  .refine((value) => value.state !== 'BLOCKED' || value.blockedReason !== undefined, {
    message: 'Say what is missing',
    path: ['blockedReason'],
  })
  // The mirror of the rule above: a reason only means something against a
  // blocked answer, and accepting one anywhere else would let the field drift
  // into a general-purpose explanation box.
  .refine((value) => value.state === 'BLOCKED' || value.blockedReason === undefined, {
    message: 'A reason belongs only to a blocked answer',
    path: ['blockedReason'],
  });
export type RespondToDirectiveInput = z.infer<typeof respondToDirectiveSchema>;

/**
 * The answer to "is this letter real".
 *
 * `found: false` is deliberately not phrased as a forgery. The register holds
 * what has been published to it, which is a subset of what exists, and a
 * platform that told a head teacher a genuine order was fake would do more harm
 * in one afternoon than the feature saves in a year.
 */
export const authenticityResultSchema = z.object({
  letterNumber: z.string(),
  found: z.boolean(),
  matches: z.array(
    z.object({
      id: z.string(),
      source: z.enum(DIRECTIVE_SOURCES),
      status: z.enum(DIRECTIVE_STATUSES),
      title: z.string(),
      issuingOffice: z.string(),
      issuedOn: z.string(),
      supersededById: z.string().nullable(),
    }),
  ),
});
export type AuthenticityResult = z.infer<typeof authenticityResultSchema>;

/**
 * What an office learns from the answers.
 *
 * Note what is absent: there is no per-school completion figure and no ranking.
 * A red/amber/green on which schools completed a drive renders undelivered
 * money as teacher failure, and in this state that is not an abstraction —
 * salaries are withheld in bulk from head teachers over data-compliance
 * failures no individual caused. So the blocked reasons travel with the
 * counts, always, and the headline an officer sees is what is missing rather
 * than who is behind.
 */
export const directiveUptakeSchema = z.object({
  directiveId: z.string(),
  title: z.string(),
  schoolsInScope: z.number().int(),
  responded: z.number().int(),
  byState: z.array(z.object({ state: z.enum(RESPONSE_STATES), schools: z.number().int() })),
  /** Ordered by frequency: the first row is what the department should fix. */
  blockedBy: z.array(z.object({ reason: z.enum(BLOCKED_REASONS), schools: z.number().int() })),
});
export type DirectiveUptake = z.infer<typeof directiveUptakeSchema>;

export const listDirectivesQuerySchema = z.object({
  /** Superseded and withdrawn orders are hidden unless explicitly asked for. */
  includeInactive: z.coerce.boolean().default(false),
  source: z.enum(DIRECTIVE_SOURCES).optional(),
  /** Only those this school has not answered yet. */
  unanswered: z.coerce.boolean().default(false),
});
export type ListDirectivesQuery = z.infer<typeof listDirectivesQuerySchema>;
