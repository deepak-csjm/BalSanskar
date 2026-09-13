# BalSanskar — बालसंस्कार

**A dedicated platform for the schools of the Uttar Pradesh Basic Shiksha Parishad.**

Teachers in UP's basic schools are doing remarkable work with very little. Right
now, when they want to record it or show it to anyone, their only option is a
personal Instagram or Facebook account — a consumer social network, owned by
someone else, with no consent controls for photographs of children, no way for a
block officer to verify anything, and no way for the department to see the
picture across 75 districts.

BalSanskar replaces that with something the department owns:

- **For a teacher** — one place to record what happened in the classroom, in
  Hindi, on the phone in their pocket, and have it count.
- **For a head teacher and a block officer** — a review queue, so what leaves
  the school is accurate and safe, and a roster of who is doing what.
- **For a district and the state** — evidence: how many schools are actually
  active, in which categories, trending which way, with every number tracing
  back to a moderated record.
- **For a guardian** — the certainty that this platform holds nothing about
  their child. No name, no photograph, no phone number. See
  [`docs/data-protection.md`](docs/data-protection.md).

It is deliberately **not** a social network. There is no feed ranking, no
follower count, no public like button and no comment box. Recognition comes from
a named officer with oversight, and it is recorded as such.

---

## Who this is for

A school works when more than the teachers are involved, and the Right to
Education Act already says so — it puts a committee in charge of every
government school that is three-quarters parents and half women. So the platform
has two sides.

**Inside the department**, a chain that runs teacher → head teacher → block →
district, with a real gate on work leaving a school and a monthly scheme-wise
return that assembles itself instead of being typed up.

**In the village**, a page behind a QR code on the school wall at
`/vidyalaya/<UDISE code>` that needs no account at all: what the school has been
doing, how many children it teaches, what it needs that somebody nearby could
give, whether its committee actually met, and how many children in the
surrounding hamlets are still not in school. A parent will not register to look
at their child's school; asking them to is the difference between a noticeboard
the village reads and one nobody opens.

[`docs/launch-readiness.md`](docs/launch-readiness.md) is the checklist against
everyone who could refuse this — the Data Protection Board, MeitY, a teachers'
association, a block officer, a parent — with what is done and what is not.

## The one rule that shapes everything else

**This platform holds no personal data about any child.** Not a name, not a
photograph, not a guardian's phone number — not with consent, not with a signed
slip, not "only the given name".

It once did, behind a careful consent workflow, and that has been removed. The
Digital Personal Data Protection Act treats anyone under eighteen as a child and
its children's provisions are the strictest part of the Act; "verifiable"
parental consent is not a standard anyone can honestly meet across 130,000
schools; and the entire benefit purchased by that risk was printing a given name
under a photograph.

What replaced it is smaller and better. A count of children per class instead of
a roster. An achievement recorded against a school and a class instead of a
named pupil. Photographs of the **work** — the reading corner, the kitchen
garden, the science model — rather than of faces, confirmed by three people who
know the school before anything leaves it.

The reasoning, the trade-offs, and the list of changes that need a conversation
rather than a pull request are in
[`docs/data-protection.md`](docs/data-protection.md).

## What is built

| Area                                                                                                                                         | State                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Domain contracts, RBAC and data-protection policy (`packages/shared`)                                                                        | Complete, 71 unit tests                                 |
| Data model with database-level constraints (`apps/api/prisma`)                                                                               | Complete, 4 migrations                                  |
| API: auth, schools, people, students, consent, activities, moderation, achievements, reporting, public showcase, uploads, audit (`apps/api`) | Complete, 109 integration tests against real PostgreSQL |
| School onboarding at scale: claim a UDISE code, block office confirms it                                                                     | Complete — see [`docs/integrity.md`](docs/integrity.md) |
| The gate out of the school: head teacher attests, block office clears, risk-ranked queue                                                     | Complete — see [`docs/integrity.md`](docs/integrity.md) |
| Web PWA: Hindi-first, offline capture, moderation console, dashboards, showcase (`apps/web`)                                                 | Complete, 22 tests, 88.6 KB gzipped first load          |
| Containers, compose stack, CI, seed data for all 75 districts                                                                                | Complete                                                |
| End-to-end scripts for both journeys, run against a live server                                                                              | Complete, passing                                       |

Deliberately **not** built yet, and why — see [`docs/roadmap.md`](docs/roadmap.md):
attendance, notifications, a native app, offline media capture beyond the
outbox, and bulk UDISE import.

---

## Running it

### With Docker (closest to a real deployment)

```bash
cp apps/api/.env.example .env
# Edit .env: set JWT_SECRET (openssl rand -base64 48), POSTGRES_PASSWORD,
# S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.
docker compose up --build
```

The web client is then on <http://localhost:8080> and the API on
<http://localhost:4000>.

### Locally, for development

Requires Node 22, pnpm 10 and a PostgreSQL 16 you can reach.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # edit DATABASE_URL and JWT_SECRET

pnpm --filter @balsanskar/shared build
pnpm --filter @balsanskar/api exec prisma migrate deploy
pnpm --filter @balsanskar/api exec prisma generate

# Reference data (all 75 districts), a bootstrap administrator and a small
# demonstration district. Never set SEED_DEMO on a real deployment.
cd apps/api
SEED_SUPER_ADMIN_PHONE=9999900001 \
SEED_SUPER_ADMIN_PASSWORD='ChangeThisPassword1' \
SEED_DEMO=true pnpm db:seed
cd ../..

pnpm dev        # API on :4000, web on :5173
```

Outside production the SMS provider prints the one-time code to the log and
returns it in the response, so no gateway is needed to sign in.

### Who exists after seeding

| Sign in as                  | Number       | How                              |
| --------------------------- | ------------ | -------------------------------- |
| Platform administrator      | `9999900001` | password, whatever you set above |
| District officer, Shravasti | `9999900010` | one-time code                    |
| Block officer, Gilaula      | `9999900011` | one-time code                    |

Those three, and deliberately nobody else. An officer cannot arrive through any
journey in the product — somebody with more authority has to appoint them — so
without them the claim queue and the clearance queue are unreachable. Everyone
below that level is left out on purpose: a head teacher arrives by claiming a
school at `/claim` and a teacher by registering against one at `/register`, and
those are the two journeys most worth walking yourself.

Two limits will interrupt you before they interrupt a real user, and both are
working as intended: one code per number per minute, and eight per number per
hour.

### Housekeeping

Two jobs run on a clock, and one of them matters for child safety: every
activity form a teacher starts and abandons leaves a photograph in the bucket,
attached to nothing and visible in no interface. `docker compose up` runs them
hourly in a `maintenance` container. Anywhere else, schedule:

```bash
pnpm --filter @balsanskar/api maintenance        # from source
node apps/api/dist/maintenance.js                # from a build
```

Both jobs are idempotent and only touch rows already past their deadline, so a
run overlapping the previous one is harmless.

### Looking at it without running it

Every screen is captured and committed under
[`docs/screens/`](docs/screens/) — Hindi at phone width, which is the real
product, and English at desktop width, which is what goes in a slide. Open the
folder and you have reviewed the whole application.

```bash
pnpm exec playwright install chromium   # once
pnpm dev                                # in another terminal
pnpm shots                              # regenerates docs/screens/
```

The script signs in as each role, creates something for every screen to show
through the real endpoints, and photographs the lot. Because the images are
committed, a change that moves something appears in a diff.

### Checks

```bash
pnpm ci     # format, lint, typecheck, and every test suite
```

The API suite needs a PostgreSQL at `DATABASE_URL` (defaulting to a
`balsanskar_test` database). It runs migrations itself, then truncates between
files.

Two scripts walk the whole product against a running server. Both need the
demo seed, both write to the database they point at, and neither should ever be
aimed at a real deployment:

```bash
# A teacher's work, from writing it up to the open web and back off again:
# consent refused, consent given, published, withdrawn, gone.
BALSANSKAR_URL=http://127.0.0.1:4000 python3 scripts/smoke-test.py

# How a school gets on, and what it takes for its work to leave it:
# claim, collision, confirm, register, attest, clear, promote, return.
BALSANSKAR_URL=http://127.0.0.1:4000 python3 scripts/gate-check.py
```

---

## How it is put together

```
packages/shared     Zod schemas, domain enums, the RBAC matrix and the
                    child-safety policy. Imported by both sides, so a rule
                    cannot drift between the server and the browser.

apps/api            Fastify + Prisma + PostgreSQL. Feature modules under
                    src/modules, platform concerns under src/lib and
                    src/plugins.

apps/web            React + Vite PWA. No CSS framework and no component
                    library: 84 KB gzipped on first load, because the target
                    device is a cheap Android phone on 2G.
```

Further reading:

- [`docs/architecture.md`](docs/architecture.md) — the shape of the system and
  the decisions behind it, including the ones that were rejected.
- [`docs/child-safety.md`](docs/child-safety.md) — how children's data and
  photographs are handled. **Read this before changing anything that touches a
  student record.**
- [`docs/security.md`](docs/security.md) — the threat model and the controls.
- [`docs/operations.md`](docs/operations.md) — deployment, backups, key
  rotation, and what to do when something breaks.
- [`docs/roadmap.md`](docs/roadmap.md) — what is deliberately missing, and the
  honest risks to the project.

---

## The four rules this codebase does not bend

1. **A child's photograph does not reach the open web without a recorded
   guardian consent** that is still in force at the moment of publication, and
   without a district-level officer approving it. Withdrawing consent pulls
   published work back in the same database transaction.
2. **Nothing is published by the person who wrote it.** Moderation is always by
   a second person, and every decision is attributed and audited.
3. **Reports count only moderated work**, measured against every school on the
   register — not only the ones that signed up. A dashboard that flatters the
   department is worse than no dashboard.
4. **The public showcase builds its own narrow response type.** It never filters
   an internal record down, so a field added to the model in six months cannot
   quietly appear on the open web.

If a change would weaken one of these, it needs a conversation, not a pull
request.

---

## Contributing

The tests are the specification. In particular
`apps/api/test/rbac.test.ts`, `apps/api/test/activity.test.ts` and
`packages/shared/src/domain.test.ts` encode the rules above; if a change makes
one of them fail, the change is almost certainly wrong.

## Licence

AGPL-3.0-or-later. This is public-interest software built for a public
institution: anyone may run it, adapt it for another state, and must share their
improvements back.
