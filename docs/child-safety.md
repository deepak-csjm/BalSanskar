# Child safety

**Read this before changing anything that touches a photograph, the escalation
gate, or a public surface.**

Every person this platform exists for is a child who did not choose to be on
it. That fact drove the design described here — and it drove the decision, made
partway through and applied destructively, to remove children from the platform
altogether.

> **An earlier version of this document described a guardian-consent ledger, a
> `Student` record and a revocation endpoint. None of those exist.** They were
> deleted by migration `20260913090000_remove_child_personal_data`, along with
> the tables behind them. If you have read the old version, discard it.

## The control that replaced all the others

**This platform holds no personal data about any child.** Not a name, not a
class-and-roll-number, not a guardian's phone number, not a year of birth. Not
with consent, not with a signed slip, not "only the given name".

The reasoning is in [`data-protection.md`](./data-protection.md). The short
version is that the strongest child-safety control available to a system is not
to hold the child. Consent architecture, revocation races, breach blast radius,
the DPDP Act's Rule 10 verifiable parental consent and its outright prohibition
on tracking or profiling a child — every one of those problems is answered at
once by a database that has nowhere to put a child.

It is enforced, not asserted. `apps/api/test/integrity.test.ts` queries
`information_schema` and fails if any column anywhere in the schema could hold a
guardian, a student, a consent, a gender, a birth year or a roll number. The
migration was verified by populating a database with children, guardians and
consents, running it, and grepping a `pg_dump`: all eleven names and numbers
gone, the teacher's record intact.

What the platform holds instead is **counts**. `ClassEnrolment` says a school
teaches 31 children in class 4. `Activity.participantCount` says 40 children
took part. An achievement records a class level and how many children were
recognised, credited to the teacher rather than to any child.

## What risk is left

One, and it is real: **a photograph in which a child can be recognised.**

A teacher photographing a science fair is not photographing a database record.
The image is the last place a child can still enter this platform, so it is the
only place child-safety machinery still lives.

### The check

`ActivityMedia.noIdentifiableChild` is a confirmation that no child's face is
identifiable in that frame. It is asserted three times by three different
people:

1. by the teacher, at upload;
2. by the head teacher, when they attest the activity with their name;
3. and it is visible to the block officer, who is reviewing before it leaves
   the school at all.

Until every photograph on an activity carries it, `evaluatePublishBlockers`
returns `CHILD_VISIBLE_CHECK_MISSING`.

### It fires below the open web, deliberately

Unlike the consent rule it replaced, the check does not wait for `PUBLIC`. It
applies at **every visibility above `SCHOOL`**. An identifiable child reaching a
district dashboard is the same failure as one reaching the open web, just with a
smaller audience and a longer time before anybody notices.

A school may still file the activity as its own internal record — that is what
`UNCONDITIONAL_PUBLISH_BLOCKERS` exists for. A gap that stops work escalating
must not also stop the school keeping its own register, or the head teacher is
left with no lawful action and no explanation.

### Reaching the open web needs more

`PUBLIC` additionally requires:

- the head teacher's named attestation (`ATTESTATION_REQUIRED`);
- a block officer to have actually cleared it (`BLOCK_CLEARANCE_REQUIRED`) —
  auto-clearance is never enough for the open web;
- a moderator holding `DISTRICT_ADMIN` or above;
- a moderator who is not the author.

Four separate people, by design.

## Photographs do not live forever

A photograph of a child that outlives its purpose is a safeguarding problem
whatever the consent position, and there is no consent position here.

| Rule                                           | Value    | Where                  |
| ---------------------------------------------- | -------- | ---------------------- |
| An upload nobody attached to a record is swept | 24 hours | `ORPHAN_UPLOAD_HOURS`  |
| A photograph expires                           | 400 days | `MEDIA_RETENTION_DAYS` |
| The audit trail outlives the pictures          | 7 years  | `AUDIT_RETENTION_DAYS` |

The first of these is the child-safety one: a form somebody started and
abandoned must not leave a photograph in a bucket that no interface will ever
show anyone.

These jobs are executed hourly by `apps/api/src/maintenance.ts`, wired into
`compose.yaml` as a sidecar. That entry point exists because both sweeps were
previously written and never called from anywhere — dead code, while abandoned
photographs accumulated indefinitely. If you add a retention rule, add it to the
maintenance entry point in the same change, and check it actually runs.

## Public surfaces are built up, not filtered down

Every endpoint under `/v1/public/` and the village page at
`/vidyalaya/:udiseCode` construct their own response objects field by field.
They never take an internal record and remove fields from it.

The two approaches fail in opposite directions, which is the whole argument:
filtering leaks anything added later, building up omits anything added later.

The village page shows only work with clearance `CLEARED` or `AUTO_CLEARED`,
and refuses schools that are not `ACTIVE`.

## The residual gap, stated honestly

A signed media URL issued before a photograph is withdrawn or expires stays
valid for the remainder of its lifetime (`SIGNED_URL_TTL_SECONDS`, 15 minutes by
default). Anyone who had already loaded the page keeps a working link for that
long.

Shortening the TTL narrows the window. Closing it entirely requires a per-object
authorisation check on every read, which the local storage driver could do and
S3 cannot without proxying every image. This is a known limitation, not an
oversight.

## Nobody publishes their own work

Every publication requires a second person, and leaving the school requires a
third and fourth:

- an activity may not be moderated by its author;
- an achievement may not be verified by whoever recorded it;
- a head teacher may not clear their own school's work — `activity:clear` is
  deliberately withheld from `PRINCIPAL`, because a chain that runs entirely
  inside one school is not a chain.

This is a child-safety control as much as an integrity one. The second pair of
eyes is what catches the photograph that should not go out.

## Everything is audited

Every state change writes an `AuditEvent` in the same transaction as the change
itself: who, what, which record, which school, block and district, from which
address, when. Audit reads are scoped — a district officer sees their own
district — and teachers cannot read them at all.

## For reviewers

If a change does any of the following, it needs a deliberate conversation and
not just an approving review:

- adds any column that could hold something about an individual child —
  including a name field on a record that is "not really about children";
- relaxes any condition in `evaluatePublishBlockers`, or moves a blocker into
  `UNCONDITIONAL_PUBLISH_BLOCKERS`;
- changes who may approve `PUBLIC` visibility, or lets auto-clearance reach it;
- adds a field to any response under `/v1/public/` or to the village page;
- lengthens `MEDIA_RETENTION_DAYS` or `ORPHAN_UPLOAD_HOURS`, or removes a job
  from the maintenance entry point;
- reintroduces a helper for displaying a child's name. One existed
  (`publicDisplayName`), was dead, was tested, and was deleted precisely
  because a blessed and tested helper is an invitation.

These tests encode the policy. If one fails, the default assumption should be
that the change is wrong, not the test.
