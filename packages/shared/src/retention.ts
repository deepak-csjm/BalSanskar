/**
 * How long things are kept, and how much a school may store.
 *
 * Data minimisation and running cost point the same way here, which is a good
 * sign the numbers are right. Every month a photograph is kept is a month of
 * object storage billed and a month of exposure carried, and the department's
 * need — see the work at the time, count it afterwards — is satisfied by
 * keeping the count and dropping the image.
 *
 * The arithmetic that decided these numbers, at full state scale: roughly
 * 130,000 schools, each filing a handful of activities a month with a few
 * photographs each. Uncapped and unexpired that is tens of terabytes inside two
 * years, and object storage plus egress is by a wide margin the largest line in
 * the bill. Capped and expired as below it settles at a roughly constant
 * working set, because deletions catch up with uploads. A platform whose
 * storage cost stops growing is one whose owner can predict the bill.
 */

/**
 * How long a photograph outlives the activity it belongs to.
 *
 * Long enough that a block officer reviewing last term's work still sees it,
 * and that an annual report can be assembled with the evidence to hand. Not so
 * long that the platform becomes an indefinite archive of images nobody has
 * looked at since.
 */
export const MEDIA_RETENTION_DAYS = 400;

/**
 * How long an upload nobody attached to anything survives.
 *
 * Short, because this is the child-safety one rather than the cost one: an
 * activity form somebody started and abandoned must not leave a photograph
 * sitting in a bucket, referenced by nothing and shown in no interface where
 * anybody would notice it. A day is enough for a teacher to finish a form they
 * are still filling in on a slow connection.
 */
export const ORPHAN_UPLOAD_HOURS = 24;

/**
 * How long the record of who decided what is kept.
 *
 * Deliberately far longer than everything else. The audit trail is the
 * accountability this platform exists to provide, it names officers rather than
 * children, and it is text — the cheapest thing in the system to store.
 */
export const AUDIT_RETENTION_DAYS = 2555;

/** Photographs on one activity. A write-up is not an album. */
export const MAX_MEDIA_PER_ACTIVITY = 6;

/**
 * Photographs one school may add in a month.
 *
 * A ceiling rather than a target, at roughly six times what an active school
 * genuinely files, so a school running an unusually big month never notices it.
 * It exists so that one misconfigured script cannot put a district's storage
 * bill on the platform in an afternoon.
 *
 * Not set higher, because the ceiling is also the worst case somebody has to be
 * able to pay: see `worstCaseSteadyStateGb`.
 */
export const MAX_MEDIA_PER_SCHOOL_PER_MONTH = 60;

/**
 * How long a signed-in session lasts before a fresh one-time code is needed.
 *
 * The second-largest running cost after storage, and the one users feel. Each
 * sign-in is a billed SMS; at half a million teachers, a weekly sign-in is
 * millions of messages a year, and every one of them is also a teacher standing
 * in a classroom waiting for a text to arrive on a bad signal. A term-length
 * trusted session costs less and is kinder, and the security trade is
 * acceptable because refresh tokens rotate, reuse revokes the whole family, and
 * suspending an account takes effect on the very next request.
 */
export const TRUSTED_SESSION_DAYS = 120;

/** Bytes a compressed photograph may be, after the browser has shrunk it. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * What a photograph costs to keep, once the browser has shrunk it.
 *
 * Measured rather than guessed: 1280px at quality 0.75, which is what
 * `compressImage` targets, lands around here for a classroom photograph.
 */
export const TYPICAL_PHOTO_BYTES = 150 * 1024;

/**
 * What an active school realistically files in a month.
 *
 * Three or four write-ups with two or three photographs each. Far below the
 * ceiling above, which is deliberate: the cap is a guard against a runaway
 * script, and planning against a guard rather than against behaviour produces a
 * number nobody believes and therefore nobody uses.
 */
export const EXPECTED_PHOTOS_PER_SCHOOL_PER_MONTH = 9;

/**
 * Steady-state storage in gigabytes, which is the figure that decides whether
 * this is affordable.
 *
 * Uploads grow the store and expiry shrinks it, so after one retention window
 * the two cancel and the total stops climbing. A platform whose storage cost
 * plateaus is one whose owner can plan; a platform whose cost compounds is one
 * that quietly becomes unaffordable in its second year.
 *
 * Both figures are worth knowing and they are far apart, so both are available:
 * this one for the bill to expect, `worstCaseSteadyStateGb` for the bill if
 * every school pushed against the cap on the same day.
 */
export function steadyStateGb(
  activeSchools: number,
  photosPerSchoolPerMonth = EXPECTED_PHOTOS_PER_SCHOOL_PER_MONTH,
  photoBytes = TYPICAL_PHOTO_BYTES,
): number {
  const months = MEDIA_RETENTION_DAYS / 30;
  const bytes = activeSchools * photosPerSchoolPerMonth * months * photoBytes;
  return Math.round(bytes / 1024 ** 3);
}

/** The same figure with every school at its monthly ceiling. */
export function worstCaseSteadyStateGb(activeSchools: number): number {
  return steadyStateGb(activeSchools, MAX_MEDIA_PER_SCHOOL_PER_MONTH);
}
