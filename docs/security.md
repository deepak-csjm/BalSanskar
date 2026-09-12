# Security

The threat model and what is done about it. Written to be argued with — if a
control below looks insufficient for your deployment, it probably is, and the
gaps are listed at the end rather than hidden.

## What is being protected

In rough order of how much harm a breach would cause:

1. **Photographs and names of children**, tied to a specific school and village.
2. **Guardian contact details.**
3. **Teacher identity and contact details** — a state-wide directory of half a
   million government employees is valuable to a fraudster on its own.
4. **The integrity of departmental reporting** — a manipulated dashboard leads
   to misdirected budgets and unearned recognition.
5. **Availability**, mainly because a platform that is down when a teacher has
   five minutes free stops being used at all.

## Who might attack it

| Actor                                            | Motivation                                | Realistic capability                                                                |
| ------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Opportunistic scanner                            | Commodity credential stuffing, known CVEs | Automated, high volume, low sophistication                                          |
| A person who wants images of children            | Predatory                                 | Will register as a teacher if registration is open; will scrape the public showcase |
| A teacher or officer inflating their own numbers | Recognition, promotion                    | Authenticated, patient, knows the workflow                                          |
| A disgruntled insider with an account            | Retaliation                               | Authenticated, understands the hierarchy                                            |
| A journalist or activist                         | Legitimate scrutiny                       | Will scrape everything public and correlate it                                      |

The second and third are the ones this design worries about most, because they
are the ones a generic web security checklist does not cover.

## Controls

### Authentication

- Teachers: six-digit one-time code by SMS, generated with `crypto.randomInt`
  (not `Math.random` — an SMS code is a credential and a predictable one is an
  account takeover for anyone who knows a phone number). Stored only as a
  peppered SHA-256 hash. Five minutes, five attempts, single use, burned inside
  a conditional update so two racing requests cannot both succeed.
- Officers: passwords hashed with scrypt (N=2^15, r=8, p=1), parameters stored
  in the hash so they can be raised later.
- Unknown accounts get a dummy verification so the response time does not
  distinguish "no such account" from "wrong password", and both return the same
  message.
- `POST /auth/otp/request` returns an identical response whether or not the
  number is registered, so it cannot be used as a directory of teachers.

### Sessions

- Access token: HS256 JWT via `jose`, 15 minutes, carrying role and scope.
- Refresh token: 48 random bytes, stored as a peppered hash, rotated on every
  use. Presenting an already-rotated token revokes the entire device family — an
  attacker who copied a token cannot ride along silently.
- The user row is re-read on every authenticated request, so suspension, role
  change and deletion take effect immediately rather than at token expiry.
- Changing a password revokes every session.

### Authorisation

Capability and scope are answered separately and both must pass; see
[`architecture.md`](architecture.md). On top of those, nobody may act on an
account at or above their own level, and nobody may grant a role they do not
outrank.

Scope violations return 403 rather than an empty result, so a probe is visible
in the audit log.

### Rate limiting

| Surface               | Default                                             |
| --------------------- | --------------------------------------------------- |
| Global, authenticated | 300 per minute, keyed on the account                |
| Global, anonymous     | 300 per minute, keyed on the address                |
| Auth endpoints        | 60 per 10 minutes, keyed on the address             |
| Public showcase       | 60 per minute                                       |
| School lookup         | 30 per 10 minutes                                   |
| OTP per phone number  | 60-second cooldown, 8 per hour, 5 attempts per code |

Authenticated requests are keyed on the account, not the address, so a whole
school behind one NAT gateway is not throttled by one busy colleague. The
per-address ceiling on auth is deliberately loose for the same reason; the real
defence against code guessing is the per-number limits, which no amount of
address rotation evades.

### Input handling

- Every body, query and parameter is parsed through a Zod schema. Nothing
  reaches a service function as `unknown` or as an unchecked cast.
- Free text is stripped of C0/C1 control characters, zero-width characters, and
  bidirectional overrides (the "Trojan Source" class, where displayed text
  differs from stored text).
- Prisma parameterises everything. The two raw SQL queries in the reporting
  module use `Prisma.sql` with bound parameters; no string concatenation.
- CSV exports quote every field and prefix anything starting with `=`, `+`, `-`
  or `@` — a formula injection in a file that lands on a government officer's
  machine is a real attack.
- Request bodies are capped at 1 MB; file bytes never travel as JSON.

### File handling

- Storage keys are generated server-side and validated against a strict pattern;
  the local driver additionally resolves and checks the path stays under the
  storage root.
- Uploaded bytes are checked against their declared content type by magic bytes.
  An HTML document renamed to `.jpg` is rejected with 415.
- Declared size is enforced against the actual body.
- Only `image/jpeg`, `image/png`, `image/webp` and `application/pdf` are
  accepted; SVG is not, because it is a script container.
- Nothing is served from a permanent public URL. Reads go through short-lived
  signed URLs.
- The local download route sets `X-Content-Type-Options: nosniff` and
  `Content-Security-Policy: default-src 'none'; sandbox`.
- An asset can only be attached to a record by the account that uploaded it, so
  one school cannot reference another's photographs by guessing a key.

### Transport and headers

- `@fastify/helmet` on the API, with HSTS in production.
- CORS is an exact-origin allowlist; a wildcard is refused at boot in production.
- The static host sets a strict CSP (`script-src 'self'`, `frame-ancestors
'none'`), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a
  `Permissions-Policy` that denies geolocation and microphone while allowing the
  camera the app needs.

### Logging

Phone numbers, one-time codes, passwords, guardian phone numbers and
`Authorization` headers are redacted at the logger, not at each call site. The
remote address is kept, because abuse investigation needs it.

Unhandled errors are logged in full with a stack trace and returned to the
caller as an opaque 500 with a request id. A database error message never
becomes part of an HTTP response.

### Configuration

`loadConfig` validates the environment at boot and refuses to start on an unsafe
combination. In production it rejects: a `JWT_SECRET` under 32 characters, the
console SMS provider (which would write live credentials to the log), a wildcard
CORS origin, and `STORAGE_DRIVER=s3` without complete credentials.

There is no default administrator. The seed script creates one only when both
`SEED_SUPER_ADMIN_PHONE` and `SEED_SUPER_ADMIN_PASSWORD` are set, and flags the
account `mustSetPassword`.

### Supply chain

Runtime dependencies are deliberately few: Fastify and four of its official
plugins, Prisma, `jose`, `zod`, and the AWS S3 client. No native addons —
password hashing and image resizing were both solved without one.

`pnpm-lock.yaml` is committed and CI installs with `--frozen-lockfile`. Build
scripts are explicitly allowlisted in `package.json` under `pnpm.onlyBuiltDependencies`,
so a transitive dependency cannot run a postinstall script unnoticed.

## Known gaps

Listed because a threat model that claims completeness is not a threat model.

1. **Tokens in `localStorage`.** An XSS bug would expose a session. Mitigated by
   a 15-minute access token, rotation with theft detection, and a strict CSP.
   Cookies are the better answer once the API and the app share an origin; the
   reasoning is recorded in `apps/web/src/api/client.ts`.
2. **Rate limiting is in-memory and per-process.** Behind more than one API
   container the effective limit multiplies by the replica count. Needs a Redis
   store before scaling out.
3. **A signed media URL survives an unpublish for its remaining TTL** (15
   minutes by default). See [`child-safety.md`](child-safety.md).
4. **No malware scanning on uploads.** Magic bytes confirm the format; they do
   not confirm the file is harmless. A scanner in front of the bucket is worth
   adding before opening the platform to a whole state.
5. **No automated image classification.** A moderator confirming that every
   child in a photograph is covered by a consent slip is doing it by eye. That
   is a human control, and it will occasionally fail.
6. **No account lockout after repeated password failures.** Only the per-address
   rate limit applies. A targeted, slow, distributed attack against one known
   officer account is not currently detected.
7. **No 2FA for officer accounts.** For a role that can publish children's
   photographs to the open web, this should exist.
8. **No data retention or deletion.** The platform accumulates. See
   [`roadmap.md`](roadmap.md).
9. **No penetration test.** Nothing here has been reviewed by anyone outside the
   team that wrote it. That should happen before a state-wide rollout, and the
   findings should be treated as blocking.

## Reporting a vulnerability

Do not open a public issue. Contact the platform owner directly with enough
detail to reproduce. If the finding involves a child's data being exposed,
say so in the first line so it is triaged accordingly.
