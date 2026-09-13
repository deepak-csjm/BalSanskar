# What this costs to run, and how that stays true

The concern this document answers: a platform that succeeds must not bankrupt
whoever is hosting it. A design whose cost compounds with use is one that
quietly becomes unaffordable in its second year, usually just as it starts to
matter.

Every number here comes from constants in `packages/shared/src/retention.ts`,
and `retention.test.ts` asserts the resulting figures. Raising a cap or a
retention window therefore shows up as a failing test rather than as an invoice
six months later.

## Where the money actually goes

In order, and it is not close:

1. **Object storage and egress for photographs.** Everything else is rounding.
2. **SMS for one-time codes.** A per-message cost against half a million
   teachers.
3. **Database and compute.** A Fastify process and a PostgreSQL instance;
   cheap, and the least of the three by a wide margin.

## Storage: made to plateau

Uploads grow the store and expiry shrinks it, so after one retention window the
two cancel and the total stops climbing. That property is the whole point.

| Schools                   | Expected | If every school hit its cap |
| ------------------------- | -------- | --------------------------- |
| 1,000 (a pilot district)  | ~17 GB   | ~110 GB                     |
| 10,000                    | ~170 GB  | ~1.1 TB                     |
| 130,000 (the whole state) | ~2.2 TB  | ~15 TB                      |

The levers behind those numbers:

- **Photographs are deleted 400 days after their activity is archived.** Long
  enough to review last year's work and assemble an annual report; not an
  indefinite archive of images nobody has opened since. The activity, its
  write-up and its clearance trail all survive — only the picture goes.
- **Compressed to about 150 KB on the handset** (1280px, quality 0.75). This
  halved the bill against the previous 1600px setting, and nobody can tell the
  two apart on a phone or a dashboard panel, which are the only screens these
  images are ever seen on. It also halves the data out of a teacher's own
  pocket on the way up.
- **Six photographs per activity, sixty per school per month.** The monthly
  figure is a guard against a runaway script, not a ration: an active school
  filing three or four write-ups a month lands near nine.
- **Abandoned uploads are swept within a day**, which is a child-safety rule
  first and a cost rule second.

## SMS: fewer codes, which is also kinder

Each sign-in is a billed message, and it is also a teacher standing in a
classroom waiting for a text to arrive on a bad signal. A trusted session lasts
a term rather than a week, so a teacher signs in a handful of times a year
instead of weekly — at half a million teachers that is the difference between
millions of messages a year and hundreds of thousands.

The security trade is acceptable and deliberate: refresh tokens rotate, reuse
revokes the whole family, and suspending an account takes effect on the very
next request rather than when a token expires.

## What is deliberately not done to save money

- **No advertising, ever.** Beyond the obvious, the DPDP Act prohibits
  advertising directed at children outright, and a platform about schools that
  carried advertising would deserve everything that followed.
- **No selling or sharing data.** There is nothing about a child to sell, which
  is one of the quieter benefits of holding none; and the teachers' data is
  theirs and the department's.
- **No charging teachers.** They are being asked to record their work; charging
  them for the privilege would be the fastest way to empty the platform.
- **No cheaper storage that gives up deletion.** Retention is a data-protection
  commitment before it is a cost measure, and the two happen to agree.

## Who pays

Left open here on purpose, because it is a decision rather than an
implementation, but the shape the cost model supports:

- A **pilot district costs almost nothing** to host, which is what makes an
  unfunded pilot possible at all.
- **Per-district sponsorship** works because the cost is legible per district
  and the numbers above can be quoted honestly to a sponsor.
- **The department paying per school per year** works because the platform's
  cost per school is small, knowable and does not grow with time.

What the cost model rules out is the version where usage grows, the bill grows
faster, and somebody has to choose between switching it off and paying for it
personally.
