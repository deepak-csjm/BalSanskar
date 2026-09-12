# Child safety and data protection

**Read this before changing anything that touches a student record, a
photograph, or the public showcase.**

Every user of this platform who matters most is a child who did not choose to be
on it. That fact, rather than any engineering preference, drove the design
described here.

## The principles

### 1. Collect the minimum that does the job

The complete set of personal data held about a child is:

| Field                       | Why it is needed                                    |
| --------------------------- | --------------------------------------------------- |
| Name                        | To recognise the child's work                       |
| Class, section, roll number | To find them on the school's own register           |
| Gender                      | Aggregate reporting the department already requires |
| Year of birth (optional)    | To sanity-check the class. Year only — never a date |
| Guardian name               | To record who gave consent                          |
| Guardian phone (optional)   | To contact the family about consent                 |

Deliberately **not** collected, and not to be added without a very specific
justification: Aadhaar or any national identifier, address, caste, religion,
disability status, date of birth, biometrics, marks, attendance, health records,
or a photograph attached to the child's own record.

Several of these would be easy to add and would look like useful features. Each
one increases what a breach would cost by more than it increases what the
platform can do. The measure to apply is not "would this be useful" but "is this
worth the harm if the database leaks".

### 2. Consent is a record, not a checkbox

`MediaConsent` is append-only. A new decision supersedes the previous one and is
marked current; the old row stays. The history is queryable.

Each record carries who gave consent, their relationship to the child, how it
was captured, which member of staff recorded it, when, and optionally a scan of
the signed slip.

The reason is simple: if a family or an inquiry ever asks "who said you could
publish this photograph, and when", the answer has to be evidence rather than
assurance. A boolean column that was flipped at some point by someone cannot
answer that question.

`PAPER_FORM` is the realistic default. Schools already send slips home; the
platform records the slip rather than pretending a digital consent flow will
reach a guardian without a smartphone.

Exactly one decision is in force per child at a time. This is enforced by a
partial unique index in the database, not only in the service — there is a test
that writes directly to the table to prove it.

### 3. Consent gates the open web, and only the open web

Inside the platform, every viewer is a named, accountable government employee
whose access is scoped to their own area and whose every action is audited.
Publishing at `SCHOOL`, `BLOCK`, `DISTRICT` or `STATE` visibility does not
require media consent.

Publishing at `PUBLIC` does, and requires all of:

1. Every child named on the activity has consent currently `GRANTED`.
2. Every photograph has been individually confirmed by a moderator as covered by
   a consent slip (`ActivityMedia.consentVerified`).
3. The moderator holds `DISTRICT_ADMIN` or above. A head teacher cannot put a
   child's photograph on the open web.
4. The activity was submitted for review and is being approved by someone other
   than its author.

The consent check is re-run **inside the publish transaction**, not just at the
start of the request. A guardian could withdraw consent between the two, and
that is the one race where losing puts a child's photograph on the open web.

### 4. Withdrawal takes effect immediately

`POST /v1/students/:id/consent/revoke` does three things in a single
transaction:

1. Supersedes the current consent with a `REVOKED` record carrying the reason.
2. Finds every `PUBLISHED` + `PUBLIC` activity naming that child and pulls it
   back to `DISTRICT` visibility.
3. Writes an audit event per affected activity.

Not queued. Not flagged for a moderator. Not "reviewed within 48 hours". The
endpoint returns how many activities were affected so the teacher can tell the
family a specific number.

The activity itself is not deleted — it remains as the school's record and as
evidence — but it stops being visible outside the department.

**The residual gap, stated honestly:** a signed media URL issued before the
withdrawal stays valid for the remainder of its lifetime
(`SIGNED_URL_TTL_SECONDS`, 15 minutes by default). Anyone who had already loaded
the page keeps a working link for that long. Shortening the TTL narrows the
window. Closing it entirely requires a per-object authorisation check on every
read, which the local storage driver could do and S3 cannot without proxying.
This is a known limitation, not an oversight.

### 5. The public showcase is built up, not filtered down

A child appears publicly as **given name and class**. Nothing else.

`publicDisplayName` takes the first whitespace-separated token of the full name.
"अंजलि कुमारी, Class 5, Primary School Rampur, Shravasti" is enough for a
stranger to find a specific child. "अंजलि, Class 5" is enough for her village to
recognise her, which is the point.

The public endpoints construct their own response objects field by field. They
do not take an internal type and remove fields from it. This matters because the
two approaches fail in opposite directions: filtering leaks anything added
later; building up omits anything added later.

There is a test that asserts against the **raw response body** — not the parsed
object — that the surname, the guardian's name, the teacher's phone number, the
roll number and the student's internal id do not appear anywhere in it.

The aggregate statistics endpoint returns counts only, and names no school, so
it cannot be used to work out which villages have children on the platform.

### 6. Nobody publishes their own work

Every publication requires a second person:

- an activity may not be moderated by its author;
- an achievement may not be verified by whoever recorded it;
- higher-level claims need higher-level sign-off — a head teacher can confirm a
  school sports day, a claimed state prize needs the district office.

This is a child-safety control as much as an integrity one. The second pair of
eyes is what catches the photograph that should not go out.

### 7. Everything is audited

Every state change writes an `AuditEvent` in the same transaction as the change
itself: who, what, which record, which school, block and district, from which
address, when.

Audit records are scoped on read — a district officer sees their own district —
and are not readable by teachers.

## Access to a child's record

A student record is readable by:

- staff at that child's own school (teachers and the head teacher);
- the block officer for that block;
- the district officer for that district;
- state-level roles.

It is not readable by a teacher at a neighbouring school, by an officer in
another district, or by anyone unauthenticated. Attempting to read across a
boundary returns 403 and lands in the audit log, rather than returning an empty
result that a probe could not distinguish from "no such child".

`apps/api/test/rbac.test.ts` covers each of these boundaries explicitly.

## Retention

Not yet implemented, and the most significant gap in this document. See
[`roadmap.md`](roadmap.md).

The intended policy, for whoever builds it:

- a student record should be deletable on a guardian's request, taking its
  consent history and activity links with it;
- a student record should be archived some fixed period after the child leaves
  class 8;
- photographs of a child who has left should not remain on the public showcase
  indefinitely;
- audit records should outlive the personal data they refer to, holding
  identifiers rather than names.

Until that exists, the platform accumulates. Anyone deploying it at scale should
treat a retention policy as a launch requirement, not a later improvement.

## For reviewers

If a change does any of the following, it needs a deliberate conversation and
not just an approving review:

- adds a field to `Student` or `MediaConsent`;
- adds a field to any response under `/v1/public/`;
- relaxes any condition in `evaluatePublishBlockers`;
- changes who may approve `PUBLIC` visibility;
- changes what `revokeConsent` does;
- weakens `publicDisplayName`;
- removes or loosens a test in `activity.test.ts` under "consent gate", or in
  `report.test.ts` under "public showcase".

These are the tests that encode the policy. If one of them fails, the default
assumption should be that the change is wrong, not the test.
