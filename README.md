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
- **For a guardian** — a real say in whether their child's photograph is ever
  shown publicly, and the ability to withdraw it at any time and have that take
  effect immediately.

It is deliberately **not** a social network. There is no feed ranking, no
follower count, no public like button and no comment box. Recognition comes from
a named officer with oversight, and it is recorded as such.

---

## What is built

| Area                                                                                                                                         | State                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Domain contracts, RBAC and child-safety policy (`packages/shared`)                                                                           | Complete, 38 unit tests                                |
| Data model with database-level constraints (`apps/api/prisma`)                                                                               | Complete, 2 migrations                                 |
| API: auth, schools, people, students, consent, activities, moderation, achievements, reporting, public showcase, uploads, audit (`apps/api`) | Complete, 79 integration tests against real PostgreSQL |
| Web PWA: Hindi-first, offline capture, moderation console, dashboards, showcase (`apps/web`)                                                 | Complete, 15 tests                                     |
| Containers, compose stack, CI, seed data for all 75 districts                                                                                | Complete                                               |
| End-to-end smoke test of the full teacher-to-showcase journey                                                                                | Complete, passing                                      |

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

### Checks

```bash
pnpm ci     # format, lint, typecheck, and every test suite
```

The API suite needs a PostgreSQL at `DATABASE_URL` (defaulting to a
`balsanskar_test` database). It runs migrations itself, then truncates between
files.

To walk the whole journey against a running server:

```bash
BALSANSKAR_URL=http://127.0.0.1:4000 python3 scripts/smoke-test.py
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
