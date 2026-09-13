/**
 * What this platform will never do.
 *
 * Every digital instrument handed to a Uttar Pradesh basic school teacher so
 * far has measured them and returned nothing. Online attendance with a selfie
 * and a geotag was ordered in July 2024 and withdrawn inside a fortnight, not
 * because teachers cannot use a phone but because they read the instrument
 * correctly: it existed to catch them. A teacher meeting this platform for the
 * first time has no reason to believe it is different, and no reason to take
 * our word for it.
 *
 * So the promises are written down here, in one file, in code — not in a
 * prospectus that nobody reads and nothing enforces. Three things follow from
 * that:
 *
 *   1. Each guarantee has a test. A guarantee that only lives in a reviewer's
 *      head is not a guarantee, it is an intention, and intentions lose to the
 *      first officer who asks for teacher-wise data.
 *   2. Each guarantee is shown to the teacher, in Hindi, on a screen they can
 *      reach without signing in. A promise made only to ourselves is worthless
 *      as reassurance.
 *   3. Changing one is a conversation, not a pull request. `docs/promises.md`
 *      says so, and so does this comment.
 *
 * The distinction running through all of it: **this platform may measure
 * systems, and may not measure people.** A district officer must be able to
 * find the school with no functioning toilet and the block where grants stall.
 * Nobody, at any level, may obtain a list of teachers ordered by output. Those
 * two sentences are not in tension — they are the whole design.
 */

/**
 * The promises, as flags a test can assert on.
 *
 * Every one is `true` and none may be flipped to `false` to make a feature
 * work. If a feature cannot be built under these, the feature is wrong.
 */
export const PLATFORM_GUARANTEES = {
  /**
   * No personal data about any child. Not a name, not a photograph tied to
   * one, not a guardian's number, not a roll number. Not with consent either:
   * the DPDP Act's prohibition on tracking and behavioural monitoring of
   * children admits no consent, and the school already holds the register it
   * has always lawfully held. See docs/data-protection.md.
   */
  noChildPersonalData: true,

  /**
   * No ordering of teachers by output, anywhere, for anyone, ever.
   *
   * Schools may be ordered — an officer has to be able to find the school that
   * needs help. Individuals may not. The moment a sortable teacher column
   * exists it becomes a target, and a target produces thin write-ups rather
   * than better teaching.
   */
  noTeacherRanking: true,

  /**
   * Nothing above the school ever sees a per-teacher number.
   *
   * Stronger than the rule above and the one that actually bites. A block
   * officer may see that a school recorded eleven activities. They may not see
   * that nine came from one teacher and two from another. Inside the school,
   * where the head teacher already knows who did what, the distinction is
   * meaningless; outside it, it is a performance file nobody consented to.
   */
  noIndividualTeacherMetricsAboveSchool: true,

  /**
   * No attendance, no location, no timestamp of a person's presence.
   *
   * The platform records what a school did, dated to the day. It does not
   * record that a teacher was at a place at a time. No geotag, no check-in, no
   * selfie, no "last active", no working-hours signal — including as a
   * by-product of some other feature, which is how this normally arrives.
   */
  noAttendanceOrLocationTracking: true,

  /**
   * "We could not, and here is why" is a first-class answer.
   *
   * An instruction from the state can be answered with *blocked*, with a
   * structured reason, and that answer is as complete a response as *done*. A
   * system in which the only acceptable answer is compliance does not learn
   * that money never arrived; it learns that the teacher failed.
   */
  blockedIsAFirstClassAnswer: true,

  /**
   * A school's constraints travel wherever its achievements travel.
   *
   * No report shows what a school produced without also carrying what it was
   * missing while it produced it. Three sanctioned posts and two filled, no
   * running water since March, forty children in one room — an output number
   * read without those is a judgement of the teacher rather than a description
   * of the school.
   */
  constraintsTravelWithAchievements: true,

  /**
   * A teacher's record belongs to the teacher.
   *
   * Exportable in full, on demand, without asking anyone's permission, in a
   * form they can hand to an inquiry, a transfer board or an award committee.
   * Erasable too: a teacher who leaves takes their personal details with them
   * and the school's work stays, attributed to "a teacher at this school".
   */
  teacherOwnsTheirRecord: true,

  /**
   * When a school escalates, the clock runs on the office, not the school.
   *
   * Every raised need, grievance and blocked instruction carries a visible age
   * from the moment it is raised. The measured party is whoever owes the
   * answer. This is the single mechanism that makes the platform something
   * other than a reporting duty.
   */
  everyEscalationHasAClock: true,

  /**
   * Recognition comes from a named human being who can be asked why.
   *
   * No automated badge, no computed score, no algorithmic "teacher of the
   * month". An officer's written appreciation carries that officer's name, and
   * it is worth something precisely because a person put their name to it.
   */
  recognitionIsNamedAndHuman: true,

  /**
   * No advertising, no tracking pixel, no third-party analytics, no sale or
   * brokerage of anything held here, at any price, to anyone.
   */
  noAdvertisingNoDataSale: true,

  /**
   * Nothing is charged to a teacher, a school, a parent or a village. Ever.
   *
   * If this platform cannot be paid for by the institutions that benefit from
   * it at scale, it fails honestly rather than by billing the people it exists
   * to serve. See docs/running-cost.md.
   */
  freeForTeachersAndFamilies: true,
} as const;

export type Guarantee = keyof typeof PLATFORM_GUARANTEES;

/**
 * The promises in the words a teacher would use, ordered by what a sceptical
 * teacher asks first.
 *
 * English here because this file is also read by officials, auditors and
 * whoever reviews the code; the Hindi a teacher actually reads lives in the web
 * client's strings, keyed by the same identifiers so the two cannot drift
 * apart without a test noticing.
 */
export const GUARANTEE_STATEMENTS: readonly {
  readonly id: Guarantee;
  readonly statement: string;
  readonly because: string;
}[] = [
  {
    id: 'noAttendanceOrLocationTracking',
    statement: 'This platform never records where you are or when you arrived.',
    because:
      'No location, no selfie, no check-in and no "last seen". It records what the school did, not where you were.',
  },
  {
    id: 'noTeacherRanking',
    statement: 'No one is ever ranked against another teacher.',
    because: 'There is no league table of teachers in this platform, for anybody, at any level.',
  },
  {
    id: 'noIndividualTeacherMetricsAboveSchool',
    statement: 'Nobody outside your school ever sees a number attached to your name.',
    because:
      'Officers see what the school did. How that divides between the people in it does not leave the school.',
  },
  {
    id: 'blockedIsAFirstClassAnswer',
    statement: 'You can answer an instruction with "we could not, and here is why".',
    because:
      'Money that did not arrive and material that was never delivered are recorded as what they are, against whoever owed them.',
  },
  {
    id: 'constraintsTravelWithAchievements',
    statement: 'What your school is missing is shown beside what your school achieved.',
    because:
      'A result read without the vacant posts and the broken hand pump is a judgement of you rather than a description of the school.',
  },
  {
    id: 'everyEscalationHasAClock',
    statement: 'When you raise something, the clock runs on the office that owes you an answer.',
    because:
      'Every escalation carries its age in the open, and the age is the officer’s to explain.',
  },
  {
    id: 'teacherOwnsTheirRecord',
    statement: 'Your record is yours. Take it with you, or take it away.',
    because:
      'Export everything you have done, whenever you want, without asking. Leave, and your personal details go with you.',
  },
  {
    id: 'recognitionIsNamedAndHuman',
    statement: 'Appreciation comes from a person who signed it, never from a machine.',
    because: 'No automatic badges and no scores. An officer wrote it and their name is on it.',
  },
  {
    id: 'noChildPersonalData',
    statement: 'No child’s name, photograph or details are held here at all.',
    because:
      'Not with consent either. The platform counts children; it does not know a single one of them.',
  },
  {
    id: 'noAdvertisingNoDataSale',
    statement: 'No advertising, and nothing here is ever sold to anyone.',
    because: 'No trackers, no third-party analytics, no data brokerage, at any price.',
  },
  {
    id: 'freeForTeachersAndFamilies',
    statement: 'Free for you, for your school, and for every family. Always.',
    because:
      'Nothing on this platform is ever charged to a teacher, a school, a parent or a village.',
  },
];

/**
 * Features that must never be built, and why.
 *
 * A denial list rather than a permission list, because the failure mode is not
 * somebody proposing an obviously wrong feature — it is somebody proposing a
 * reasonable-sounding one whose second-order effect is a surveillance
 * instrument. Each entry names the plausible-sounding request that leads to it,
 * so a reviewer recognises it on the way in rather than after it ships.
 */
export const FORBIDDEN_FEATURES: readonly {
  readonly feature: string;
  readonly arrivesAs: string;
  readonly why: string;
  readonly guarantee: Guarantee;
}[] = [
  {
    feature: 'Teacher attendance, in any form',
    arrivesAs: '"Can we just record who was present when the activity happened?"',
    why: 'This is the instrument UP ordered in July 2024 and withdrew in nine days. Building it here forfeits every other promise on this list.',
    guarantee: 'noAttendanceOrLocationTracking',
  },
  {
    feature: 'Geotagging a photograph or a submission',
    arrivesAs: '"Location would prove the photo is really from that school."',
    why: 'It would also place a named person at a place and time, permanently. Provenance is already handled by perceptual hashing and a head teacher who signs an attestation with their name.',
    guarantee: 'noAttendanceOrLocationTracking',
  },
  {
    feature: 'A teacher leaderboard, or any sortable per-teacher column',
    arrivesAs: '"The district wants to recognise the top ten teachers."',
    why: 'Recognition that requires a ranking produces gaming, not teaching. Named appreciation from a named officer does the same job without the ordering.',
    guarantee: 'noTeacherRanking',
  },
  {
    feature: 'Teacher-wise activity counts in any report above the school',
    arrivesAs: '"Just for monitoring — we will not display it publicly."',
    why: 'An unpublished performance file is still a performance file, and it is one nobody agreed to. The school is the unit of reporting.',
    guarantee: 'noIndividualTeacherMetricsAboveSchool',
  },
  {
    feature: 'A compliance percentage per school with no reason attached',
    arrivesAs: '"A simple red/amber/green on which schools completed the drive."',
    why: 'It renders undelivered money as teacher failure. Completion is only ever reported alongside the blocked reasons, or not at all.',
    guarantee: 'blockedIsAFirstClassAnswer',
  },
  {
    feature: 'Classroom observation scoring',
    arrivesAs: '"The ARP already visits — let them record a rating while they are there."',
    why: 'A visiting officer scoring a named teacher is an appraisal system. Support visits may record what support was given, never a grade.',
    guarantee: 'noTeacherRanking',
  },
  {
    feature: 'A wellbeing or morale survey that can be traced to a respondent',
    arrivesAs: '"An anonymous pulse survey so we know how teachers are feeling."',
    why: 'A survey an officer can de-anonymise is worse than no survey: it collects candour and then exposes it. Unless unlinkability is provable, do not ask.',
    guarantee: 'noIndividualTeacherMetricsAboveSchool',
  },
  {
    feature: 'Automatic scoring, badges or streaks',
    arrivesAs: '"Gamification would improve engagement."',
    why: 'A streak is a daily obligation wearing a friendly costume, and it punishes exactly the teacher whose week went badly.',
    guarantee: 'recognitionIsNamedAndHuman',
  },
  {
    feature: 'Any charge to a teacher, school, parent or village',
    arrivesAs: '"A small premium tier for schools that want more storage."',
    why: 'The moment a school pays, the platform serves the schools that can pay. Cost recovery comes from the institutions that benefit at scale.',
    guarantee: 'freeForTeachersAndFamilies',
  },
  {
    feature: 'Third-party analytics, advertising or an embedded social SDK',
    arrivesAs: '"We need to understand usage" or "a share widget would help reach."',
    why: 'Every one of these is a tracker on a page a parent may open, and each one fails the cybersecurity requirements this platform must pass anyway.',
    guarantee: 'noAdvertisingNoDataSale',
  },
];

/**
 * The one sentence to read if you read nothing else in this file.
 *
 * Written as a test-visible constant because it is quoted in the privacy
 * notice, in the launch dossier and on the screen a teacher sees before they
 * sign up, and those three must say the same thing.
 */
export const GUARANTEE_HEADLINE =
  'This platform measures systems, never people. It can show you the school that has no water and the block where grants stall. It cannot show anyone a list of teachers ranked by anything.';
