import { z } from 'zod';
import { cleanMultilineText, cleanText, dateOnlySchema, idSchema } from '../primitives.js';

/**
 * Teaching days consumed by work that is not teaching.
 *
 * This is the feature the teachers' associations themselves asked for. When the
 * state's committee on digital attendance met on 13 November 2025, the unions
 * tabled twelve conditions; the one they put first was release from non-academic
 * work. Eleven of the twelve were about workload and entitlement, not about
 * technology. Nothing in the whole exchange was about children's learning, and
 * that tells you where the unmet need actually sits.
 *
 * The scale is not anecdotal. NIEPA's 2018 national study found government
 * teachers spending 19.1% of annual school hours on teaching, 42.6% on
 * non-teaching core activities, 31.8% on other school-related work and 6.5% on
 * departmental duties. In Uttar Pradesh the load is currently the Special
 * Intensive Revision of electoral rolls, the SHARDA household survey, Census
 * 2027 houselisting, DBT and Aadhaar seeding — against a cadre already short by
 * about 2.17 lakh teachers.
 *
 * Four design decisions carry the whole thing, and each one exists because the
 * obvious version of this feature would be dangerous:
 *
 * **It is not a new instrument.** UDISE+ already collects exactly this, as Data
 * Capture Format field 3.3.25, "Working days spent on NON-Teaching Assignments",
 * in Part C of every teacher's profile. It is self-declared once a year,
 * aggregated to nothing and published nowhere. This makes a statutory field
 * timely and legible. That is a far safer thing to put in front of a Basic
 * Shiksha Adhikari than a novel measurement of their department.
 *
 * **It does not accuse anybody.** Section 27 of the Right to Education Act
 * permits exactly three non-educational deployments — census, disaster relief,
 * and elections. Recording which of the three a duty falls under is a statement
 * of law, not a complaint, and the residue that fits none of them becomes
 * visible as a by-product of ordinary record-keeping rather than as an
 * allegation somebody has to make. The platform never names the officer who
 * issued the order: a district officer asked to publish an accusation against
 * their own department will simply refuse, and the feature dies with them.
 *
 * **It also pays.** A BLO's honorarium is roughly ₹12,000 a cycle, with a
 * further ₹6,000 sanctioned for the Special Intensive Revision, and non-payment
 * has been a live dispute. The same rows that count the days owed also count
 * the money owed. This is the rare instrument that returns something to the
 * person filling it in, which is the exact complaint every other portal has
 * earned.
 *
 * **It is never punitive.** A record of days lost reads, in the wrong hands, as
 * a record of absence — and Uttar Pradesh enforces deployment by withholding
 * salaries. So it is the teacher's own record, attested by their head teacher,
 * and above the school it aggregates to a school total with no name attached.
 * See packages/shared/src/guarantees.ts.
 */

/**
 * The three purposes the Right to Education Act allows, named exactly as the
 * Act names them, and then everything else.
 *
 * Section 27: "No teacher shall be deployed for any non-educational purposes
 * other than the decennial population census, disaster relief duties or duties
 * relating to elections to the local authority or the State Legislature or
 * Parliament."
 */
export const DUTY_CATEGORIES = [
  /** Decennial population census, including houselisting. Permitted by s.27. */
  'CENSUS',
  /** Election and electoral-roll work, including BLO duty. Permitted by s.27. */
  'ELECTION',
  /** Disaster relief. Permitted by s.27. */
  'DISASTER_RELIEF',
  /** Household and enrolment surveys — SHARDA, School Chalo and the like. */
  'SURVEY',
  /** DBT, Aadhaar and APAAR seeding, portal data entry, certification drives. */
  'DATA_ENTRY',
  /** Departmental training, and the travel to reach it. */
  'TRAINING',
  /** Block and district meetings, and the travel to reach them. */
  'MEETING',
  /** Mid-day meal procurement, cooking supervision, and material distribution. */
  'PROVISIONING',
  /** Public-health drives such as pulse polio, and anything else. */
  'OTHER',
] as const;
export type DutyCategory = (typeof DUTY_CATEGORIES)[number];

/** The three the Act names. Everything else is simply not among them. */
export const SECTION_27_PURPOSES: readonly DutyCategory[] = [
  'CENSUS',
  'ELECTION',
  'DISASTER_RELIEF',
];

/**
 * Whether the Act lists this purpose.
 *
 * Deliberately not called `isLawful`. Training and departmental meetings are
 * educational purposes and s.27 does not touch them; a mid-day meal duty may be
 * lawful under an entirely different provision. The only question this answers
 * is the narrow one the Act answers, and the naming has to say so or the number
 * will be quoted as something it is not.
 */
export function isSection27Purpose(category: DutyCategory): boolean {
  return SECTION_27_PURPOSES.includes(category);
}

export const recordDutySchema = z.object({
  category: z.enum(DUTY_CATEGORIES),
  /**
   * What the duty actually was, in the teacher's words.
   *
   * "SIR booth level officer, booth 142" rather than a code. The order number
   * goes in `orderReference`; the officer who signed it is deliberately not
   * recorded anywhere — see the note at the top of this file.
   */
  description: cleanText(4, 200),
  /** The order that assigned it, if the teacher has it. Never the officer. */
  orderReference: cleanText(2, 120).optional(),
  fromDate: dateOnlySchema,
  toDate: dateOnlySchema,
  /**
   * Of that span, how many were days the school was open.
   *
   * The number that matters, and not the same as the length of the span: a
   * duty over a fortnight that included two Sundays and a holiday cost eleven
   * teaching days, not fourteen. Asking for it directly is more honest than
   * computing it from a calendar the platform does not have.
   */
  teachingDaysLost: z.number().int().min(0).max(200),
  /**
   * Whether any of it fell inside school hours.
   *
   * The legally decisive fact, and the one nothing records today. An Allahabad
   * High Court Division Bench, resolving contradictory single-judge orders, held
   * that teachers may be deployed on election work — including electoral-roll
   * revision, before any poll notification — but not on teaching days or during
   * teaching hours. That distinction turns on this field.
   */
  duringSchoolHours: z.boolean(),
  /** What the order says is payable, if anything. Rupees, never paise. */
  honorariumDueRupees: z.number().int().min(0).max(1_000_000).optional(),
  /** What actually arrived. The gap between the two is the point. */
  honorariumReceivedRupees: z.number().int().min(0).max(1_000_000).optional(),
  note: cleanMultilineText(0, 600).optional(),
});
export type RecordDutyInput = z.infer<typeof recordDutySchema>;

export const dutyRecordSchema = z.object({
  id: z.string(),
  category: z.enum(DUTY_CATEGORIES),
  section27: z.boolean(),
  description: z.string(),
  orderReference: z.string().nullable(),
  fromDate: z.string(),
  toDate: z.string(),
  teachingDaysLost: z.number().int(),
  duringSchoolHours: z.boolean(),
  honorariumDueRupees: z.number().int().nullable(),
  honorariumReceivedRupees: z.number().int().nullable(),
  note: z.string().nullable(),
  /**
   * Whose days these were.
   *
   * Present inside the school, where the head teacher already knows and needs
   * to see how the load is distributed — districts exempted head teachers from
   * Census 2027 duty, which simply pushed it onto assistant teachers, and
   * nobody can currently see that happen. Absent from everything above the
   * school.
   */
  teacherName: z.string().nullable(),
  attestedByName: z.string().nullable(),
  attestedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type DutyRecord = z.infer<typeof dutyRecordSchema>;

export const listDutiesQuerySchema = z.object({
  schoolId: idSchema.optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
  category: z.enum(DUTY_CATEGORIES).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type ListDutiesQuery = z.infer<typeof listDutiesQuerySchema>;

/**
 * The roll-up an officer sees. Never a person, at any level above the school.
 */
export const dutySummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  /** Teaching days consumed, all categories. */
  teachingDaysLost: z.number().int(),
  /** Of those, days spent on the three purposes the Act names. */
  section27Days: z.number().int(),
  /** And the residue, which the Act does not list. Stated, never alleged. */
  otherDays: z.number().int(),
  /** Days that fell inside school hours, which is the fact courts turn on. */
  duringSchoolHoursDays: z.number().int(),
  byCategory: z.array(
    z.object({
      category: z.enum(DUTY_CATEGORIES),
      section27: z.boolean(),
      days: z.number().int(),
      records: z.number().int(),
    }),
  ),
  honorarium: z.object({
    dueRupees: z.number().int(),
    receivedRupees: z.number().int(),
    outstandingRupees: z.number().int(),
  }),
  /** How many schools the roll-up covers, so a total can be read per school. */
  schools: z.number().int(),
});
export type DutySummary = z.infer<typeof dutySummarySchema>;
