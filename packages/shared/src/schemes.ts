/**
 * The government programmes a school's work can count towards.
 *
 * This is the hinge the whole adoption argument turns on. A block education
 * officer already reports upward on NIPUN Bharat, on Kayakalp parameters, on
 * mid-day meal compliance, on Mission Shakti activities — by hand, from
 * WhatsApp photographs and a register, at the end of every month. If a
 * teacher's write-up already carries the tag, that report assembles itself.
 *
 * Which means the officer wants the platform used, and a teacher who logs
 * something has done their monthly reporting rather than added to it. Neither
 * of those is true of a platform that only showcases.
 *
 * Deliberately a small list of programmes that actually run in UP basic
 * schools. A long taxonomy nobody can navigate gets one option picked at
 * random, which is worse than no taxonomy at all.
 */
export const SCHEMES = [
  /** Foundational literacy and numeracy — the state's headline priority. */
  'NIPUN_BHARAT',
  /** Reading, libraries and language beyond the FLN targets. */
  'READING_CAMPAIGN',
  /** Mid-day meal: kitchen gardens, nutrition education, meal quality. */
  'PM_POSHAN',
  /** School infrastructure and upkeep — UP's Operation Kayakalp parameters. */
  'KAYAKALP',
  /** Girls' safety, confidence and participation. */
  'MISSION_SHAKTI',
  /** Cleanliness, water, sanitation and handwashing. */
  'SWACHH_VIDYALAYA',
  /** Enrolment drives and bringing out-of-school children back. */
  'SCHOOL_CHALO',
  /** Digital teaching, DIKSHA content, smart classrooms. */
  'DIGITAL_LEARNING',
  /** Sports, health check-ups and physical wellbeing. */
  'KHELO_AND_HEALTH',
  /** Science, mathematics and exhibitions. */
  'SCIENCE_AND_MATH',
  /** Community and parent participation, SMC meetings. */
  'COMMUNITY_PARTICIPATION',
  /** Teacher training and professional development. */
  'TEACHER_DEVELOPMENT',
  /** Work that advances no particular programme, which is allowed. */
  'NONE',
] as const;
export type Scheme = (typeof SCHEMES)[number];

/**
 * How many programmes one activity may be tagged with.
 *
 * Capped, because a teacher who can tick everything will tick everything, and
 * a scheme report where every activity counts towards every scheme tells the
 * department nothing.
 */
export const MAX_SCHEMES_PER_ACTIVITY = 3;

// ---------------------------------------------------------------------------
// Recognition
// ---------------------------------------------------------------------------

/**
 * What the platform is allowed to do with a teacher's record, and what it is
 * not.
 *
 * The failure this guards against is specific and well documented: a state
 * rolls out an app, teachers read it as surveillance and a league table, the
 * union objects, and the rollout is withdrawn. UP has already paused one
 * teacher-facing mandate for exactly this reason. A platform that ranks
 * teachers against each other will be resisted, and it will deserve to be.
 *
 * So the rules below are enforced in code rather than left to good intentions,
 * and `docs/data-protection.md` lists changing them as something that needs a
 * conversation rather than a pull request.
 */
export const RECOGNITION_RULES = {
  /**
   * No ordering of teachers by output, anywhere, for anyone.
   *
   * Schools may be ordered — a district officer has to be able to find the
   * schools that need help, and the existing report deliberately surfaces the
   * quiet ones as a support list rather than a shame list. Individuals may not.
   */
  rankTeachers: false,
  /**
   * No counter that goes up and is visible to anyone but its owner.
   *
   * A private "twelve activities this term" is a record. The same number on a
   * screen an officer can sort turns into a target, and a target turns into
   * twelve thin write-ups.
   */
  publicActivityCounts: false,
  /** Recognition comes from a named person who can be asked why. */
  appreciationRequiresNamedOfficer: true,
  /** A teacher's own record is theirs to take with them. */
  portfolioExportable: true,
} as const;

/**
 * The reasons a teacher opens this application at all.
 *
 * Ordered by what actually moves a teacher in a UP basic school, which is not
 * the order a product manager would guess. Time comes first: the platform's
 * strongest claim is that it removes work rather than adding it.
 */
export const TEACHER_VALUE = [
  /** The monthly report to the block office assembles itself from what is logged. */
  'REPORT_WRITES_ITSELF',
  /** A named officer's written appreciation, which is worth more than a badge. */
  'NAMED_APPRECIATION',
  /** A verified record of their work, exportable, for awards and transfers. */
  'PORTABLE_PORTFOLIO',
  /** What worked at the school down the road, in enough detail to copy. */
  'PRACTICE_LIBRARY',
  /** Their name on their own idea when another school adopts it. */
  'CREDIT_FOR_IDEAS',
] as const;
export type TeacherValue = (typeof TEACHER_VALUE)[number];
