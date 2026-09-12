# Architecture

This document records what the system is, and — more usefully — why it is that
and not something else. Decisions are grouped by the constraint that drove them.

## The constraints that actually shaped it

Every significant choice here traces back to one of five facts about the
setting. They are worth stating plainly, because a reviewer who does not hold
them will find several decisions look wrong.

1. **The primary user is a teacher on a cheap Android phone, on 2G, on metered
   data, standing in a school yard.** Not an officer at a desk.
2. **The subject matter is children.** Names, faces, and the fact of which
   village a particular child attends school in.
3. **The deployment target is a government data centre**, where "install this
   native dependency" and "add this managed service" are not free actions, and
   where the operator may be a contractor rather than the team that wrote it.
4. **The scale is 75 districts, ~130,000 schools, ~500,000 teachers** — large
   enough that a naive query plan matters, small enough that it fits on one
   PostgreSQL instance for years.
5. **Adoption is the real risk, not load.** A teacher who loses a write-up once
   never comes back. A block officer who cannot get a number out of the system
   goes back to WhatsApp.

## Shape

```
                    ┌────────────────────────────┐
   Teacher's phone  │  apps/web                  │
   (PWA, offline)   │  React + Vite, 84 KB gz    │
                    └──────────────┬─────────────┘
                                   │ HTTPS, JSON, bearer token
                    ┌──────────────▼─────────────┐
                    │  apps/api                  │
                    │  Fastify + Prisma          │
                    │  ┌──────────────────────┐  │
                    │  │ plugins: auth, RBAC  │  │
                    │  │ lib: scope, audit,   │  │
                    │  │      storage, crypto │  │
                    │  │ modules: auth, org,  │  │
                    │  │   student, activity, │  │
                    │  │   report, public     │  │
                    │  └──────────────────────┘  │
                    └────┬──────────────────┬────┘
                         │                  │ presigned PUT / GET
              ┌──────────▼───────┐  ┌───────▼──────────┐
              │ PostgreSQL 16    │  │ S3-compatible    │
              │ (or one VM)      │  │ store (or disk)  │
              └──────────────────┘  └──────────────────┘

                    packages/shared
                    Zod contracts · RBAC matrix · child-safety policy
                    imported by both the API and the browser
```

## Decisions

### A shared contracts package, not code generation

`packages/shared` holds the Zod schemas, the domain enums, the RBAC matrix and
the publish rules. Both sides import it.

The alternative — generating a client from an OpenAPI document — was rejected
because the interesting logic is not the wire shape, it is the _rules_: which
role may approve which visibility, what blocks a publish. Those need to run in
the browser (so a teacher sees the problem before submitting) and on the server
(so it is actually enforced). Generating types would have duplicated the rules
in prose on one side and code on the other, which is exactly how the two drift.

The browser copy is a courtesy. The server copy is the control. Every rule is
re-evaluated server-side, and `moderateActivity` re-reads consent _inside_ the
publish transaction rather than trusting the row it loaded at the start of the
request.

### PostgreSQL, and constraints in the database

One relational database, no cache tier, no queue, no search cluster.

At 130,000 schools the whole register is a few hundred megabytes. The reporting
queries are indexed group-bys. Adding Redis and Elasticsearch on day one would
triple the operational surface a district IT contractor has to keep alive, in
exchange for latency nobody has complained about.

More importantly, the rules that must not break are expressed as database
constraints, not only as application checks:

- exactly one consent decision in force per child (partial unique index);
- a published activity always names its reviewer and its publication time;
- a rejected activity always carries a reason;
- phone numbers are always E.164, UDISE codes always eleven digits.

The application checks all of these too, with better error messages. The
database copy is what holds when two requests race, when a migration script
misbehaves, or when somebody runs an ad-hoc `UPDATE` against production at
eleven at night. `apps/api/test/activity.test.ts` asserts on the database
constraint directly, bypassing the service, for exactly that reason.

### Denormalised `blockId` and `districtId`

Activities and achievements carry the block and district of their school, even
though both are reachable through the school row.

This is denormalisation with a specific justification: a state-level report
groups by district over the activity table. Joining through `schools` for every
such query, across 130,000 schools, turns an index scan into a hash join for no
benefit — the block a school sits in changes approximately never, and when it
does it is an administrative event that can rewrite the affected rows.

The application is the only writer, and it always copies the values from the
school (see `createActivity`, `resolveInviteScope`), so a caller cannot claim to
be in a district they are not in. `apps/api/test/rbac.test.ts` has a test for
precisely that.

### Two separate questions for access control

`packages/shared/src/rbac.ts` answers _capability_ ("may this role ever do
this?") and _scope_ ("may this user do it here?") separately, and both must
pass.

The reason is that the two dimensions are genuinely independent. A district
officer and a block officer share almost all capabilities and differ only in
reach; a teacher and a head teacher share reach — one school — and differ only
in capability. Collapsing them into a single list of role-to-endpoint rules
produces a matrix that nobody can reason about and that grows quadratically.

A third rule sits on top for anything acting on a person: you may not manage an
account at or above your own level. Without it, a head teacher could suspend the
block education officer who happens to be attached to their school.

Scope violations return **403, not an empty list**. An honest user has picked
the wrong filter and needs to be told; a dishonest one has just written a line
in the audit log.

### Phone/OTP for teachers, passwords for officers

Two authentication paths, because the two populations are different.

A teacher has a phone number the department already holds, often shares or
changes the handset, and will not remember a twelve-character password. A
one-time code to that number is both the most usable option and a reasonable
identity claim.

An officer can act on other people's accounts, approve public publication of
children's photographs, and export school-level performance data. A credential
recoverable by anyone holding a SIM is not sufficient for that, so officers get
a password — used from an office machine.

Rate limiting follows the same reasoning. The per-address ceiling on the auth
endpoints is deliberately generous (60 per 10 minutes by default) because in
rural UP one address is routinely a whole block office or a shared connection,
and locking out a building is a worse failure than a slow brute force. Guessing
is bounded per _phone number_ instead: a resend cooldown, an hourly cap, and
five attempts per code.

### Refresh token rotation with theft detection

Every refresh mints a new token and revokes the old one. Presenting a token that
has already been rotated revokes the whole device family.

This is the standard pattern and it has a specific consequence worth
understanding: if the client ever issues two concurrent refreshes, the second
looks like theft and signs the user out. The web client therefore shares a
single in-flight refresh promise across all callers, and
`apps/web/src/api/client.test.ts` asserts that three parallel 401s produce
exactly one refresh call.

### Access tokens are short, and re-checked against the database

The access token is stateless and fifteen minutes long, but `loadActor` reads
the user row on every authenticated request.

That is one primary-key lookup per request, and it buys immediate effect for
suspension and role changes. For a system holding photographs of children, a
fifteen-minute window in which a suspended account keeps working is not
acceptable. `apps/api/test/auth.test.ts` covers it.

### scrypt rather than argon2 or bcrypt

Both of the usual choices are native addons. This system must be installable on
whatever hardware a state data centre provides, sometimes without a compiler,
sometimes by a contractor following a runbook. `crypto.scrypt` is memory-hard,
is already in Node, and removes a whole class of deployment failure.

The cost parameters are stored inside each hash, so they can be raised later
without invalidating existing passwords. The test environment lowers them,
because the suite creates dozens of accounts per file and the cost would
dominate the run without testing anything.

### Two-phase uploads, and compression in the browser

The client asks for an upload ticket, sends the bytes straight to storage, and
then attaches the returned key to a record.

Proxying file bytes through the API would put a teacher's thirty-second 2G
upload on the event loop — and that is the traffic profile this platform will
have. The `MediaAsset` row is created when the ticket is issued, so an abandoned
upload is a visible, sweepable row rather than an untracked object in a bucket
nobody audits.

Photographs are resized in the browser before they are sent. A phone camera
produces 4–6 MB; the app sends 150–300 KB. The saving has to happen before the
bytes leave the phone, because the upload is the expensive part — and it keeps
`sharp`, another native dependency, off the server.

Uploaded bytes are checked against their declared type by magic bytes on
arrival. An HTML document renamed to `.jpg` is the classic stored-XSS vector.

### No CSS framework, no component library, no data-fetching library

The web client is React, React Router, and about 700 lines of hand-written CSS.

React Query is excellent and costs roughly 13 KB gzipped; Tailwind adds a build
step; a component library adds hundreds of kilobytes for widgets this app does
not need. On a 2G connection each of those is measured in seconds of a teacher
staring at a blank screen. What was kept from React Query — abort on unmount,
explicit reload, a distinguishable network error — is forty lines in
`src/lib/useApi.ts`.

The budget is enforced by `scripts/check-bundle-size.mjs` in CI: 120 KB gzipped
for everything downloaded before the sign-in screen appears. It currently sits
at 84 KB.

### The offline outbox

An activity that cannot be sent is written to IndexedDB with its photographs and
drained when the network returns. `ActivityNew` catches `NetworkError`
specifically and queues rather than showing an error.

This is the single feature that decides whether the platform is usable. Teachers
write activities up in the school yard where there is no signal. IndexedDB
rather than localStorage because photographs are Blobs and because localStorage
is synchronous and would jank a slow phone.

A network failure does not consume a retry — it is not the teacher's mistake and
the whole queue is simply tried again later. A _rejection_ does consume one, and
after five the item is left visible but stops counting as pending, because an
item failing for a reason the network will not fix should be surfaced, not
retried forever in silence.

### A separate response type for the public showcase

`apps/api/src/modules/public/public.routes.ts` constructs its own narrow object
rather than filtering an `ActivityDetail` down.

Filtering is fragile in the direction that matters: a field added to the
internal model in six months appears on the open web unless someone remembers to
exclude it. Building up from nothing fails safe. The test in
`apps/api/test/report.test.ts` asserts against the raw response body that no
surname, guardian name, phone number or roll number appears.

### Reporting counts only moderated work

Activities must be `PUBLISHED`, achievements must be `VERIFIED`, and the
achievement must be verified by someone other than the person who entered it,
at a level appropriate to the claim (a state prize needs the district office).

Participation is measured against every school on the register in scope, not
against the schools that have signed up. Otherwise participation reads as 100%
from the first day and tells the department nothing.

The dormant-schools list sits beside the leaderboard on purpose. The
operationally useful question for a district officer is not "who is winning" but
"who needs a visit".

## Things that were considered and rejected

| Considered                            | Why not                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Microservices                         | One team, one database, one deployment. Splitting this would add network failure modes to solve an organisational problem that does not exist.                                                |
| GraphQL                               | The clients are known and the queries are fixed. REST with shared Zod contracts gives the same type safety with a fraction of the operational surface.                                        |
| Server-side rendering (Next.js/Remix) | The authenticated app is not content and gains nothing from SSR. The public showcase would benefit, and is the one place worth revisiting — see the roadmap.                                  |
| A managed BaaS (Firebase/Supabase)    | Children's data belonging to a state government, on infrastructure the department cannot audit or repatriate. Non-starter regardless of the engineering merits.                               |
| Face blurring on upload               | Genuinely valuable, and needs a model, GPU or WASM, and a false-negative rate somebody has to own. Recorded in the roadmap rather than half-done.                                             |
| Comments and likes                    | Would turn a professional record into the thing it was built to replace, and create an unmoderated channel adjacent to photographs of children.                                               |
| pg_trgm for name search               | Needs `CREATE EXTENSION`, which needs privileges a managed database may not grant. Prefix search on a `lower()` index covers "type the first few letters", which is how the pickers are used. |

## Where the bodies are buried

Honest notes for whoever works on this next.

- **Tokens are in `localStorage`.** Readable by script, so an XSS bug would
  expose a session. The mitigations are a 15-minute access token, rotation with
  theft detection, and a strict CSP on the static host. The reason is that the
  API and the app are on different origins in the pilot. If the deployment is
  ever collapsed behind one origin, move to `Secure; HttpOnly; SameSite=Strict`
  cookies. The trade-off is written down at the top of `apps/web/src/api/client.ts`.
- **Rate limiting is per-process and in-memory.** Correct for one API container.
  Behind more than one, the effective limit multiplies by the replica count.
  Move `@fastify/rate-limit` onto a Redis store before scaling out.
- **The orphaned-upload sweeper exists but is not scheduled.**
  `sweepOrphanedUploads` is written and tested by construction; nothing calls it
  yet. It needs a cron or a scheduled container.
- **Signed media URLs do not survive an unpublish for their remaining TTL.** A
  URL already issued stays valid for up to `SIGNED_URL_TTL_SECONDS` (15 minutes
  by default) after consent is withdrawn. Shortening the TTL narrows the window;
  closing it entirely needs a per-object check on read, which the local driver
  could do and S3 cannot without a proxy.
- **`toSummary` signs a cover URL per row.** For the local driver that is an
  HMAC; for S3 it is a presign, also local computation. Neither hits the
  network, but a 100-row page does 100 of them. Fine now; worth batching if list
  latency ever shows up in a profile.
- **No pagination on the leaderboard's school mode.** It takes up to 2,000
  schools and sorts in memory. Correct for a district; a state-wide
  `groupBy=SCHOOL` query would need to move the ordering into SQL.
