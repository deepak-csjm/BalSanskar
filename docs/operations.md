# Operations

Written for whoever has to keep this running, who may not be whoever wrote it.

## Deployment shapes

### One VM (a district pilot)

`compose.yaml` is this shape: PostgreSQL, MinIO and the two application
containers on one machine behind a TLS-terminating reverse proxy.

Adequate for a district — a few thousand teachers, a few hundred activities a
day. A 4 vCPU / 8 GB machine with 200 GB of disk is comfortable, and disk is the
constraint that will bite first, because photographs accumulate.

### Split (a state rollout)

- API containers behind a load balancer, two or more.
- Managed PostgreSQL, or a dedicated instance with streaming replication.
- The department's object store, or S3, in place of MinIO.
- The web bundle on a CDN or a plain static host.

**Before running more than one API container**, move rate limiting to a shared
store. `@fastify/rate-limit` is in-memory, so N replicas means N times the
configured limit. This is the single change that must happen before scaling out.

## Configuration

Every variable is documented in `apps/api/.env.example` and validated at boot.
The process refuses to start on an unsafe combination rather than starting and
misbehaving.

The ones that must be set deliberately in production:

| Variable              | Note                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `JWT_SECRET`          | `openssl rand -base64 48`. Rotating it signs everyone out and invalidates outstanding codes and file links.                                |
| `DATABASE_URL`        | Use a role that owns the schema, not a superuser.                                                                                          |
| `CORS_ORIGINS`        | Exact origins, comma separated. A wildcard is refused.                                                                                     |
| `SMS_PROVIDER`        | `console` is refused in production; it would log live credentials.                                                                         |
| `PUBLIC_API_BASE_URL` | Must match how the browser actually reaches the API, or upload and download URLs will be wrong.                                            |
| `TRUST_PROXY`         | Only `true` when behind a proxy you control, or `X-Forwarded-For` becomes attacker-controlled and poisons rate limiting and the audit log. |
| `STORAGE_DRIVER`      | `s3` for anything beyond one machine.                                                                                                      |

## First run

```bash
pnpm --filter @balsanskar/api exec prisma migrate deploy

# Reference data: all 75 districts. Idempotent, safe on every deploy.
cd apps/api && pnpm db:seed
```

To create the first administrator, set `SEED_SUPER_ADMIN_PHONE` and
`SEED_SUPER_ADMIN_PASSWORD` for that one run and unset them afterwards. The
account is flagged `mustSetPassword`; make sure the holder acts on it.

Never set `SEED_DEMO=true` on a real deployment — it creates fictional schools.

Blocks and schools are then loaded from the department's own UDISE export. There
is no bulk importer yet (see [`roadmap.md`](roadmap.md)); until there is, use
`POST /v1/schools` from a script, or write directly to the database inside a
transaction and let the application own everything afterwards.

## Migrations

`prisma migrate deploy` is what runs in production — it applies pending
migrations and never generates or resets. The compose file runs it before the
server starts; it is safe to repeat.

Migrations are forward-only and there is no automated rollback. For a change
that could lose data, take a backup first and write the reverse migration by
hand before applying the forward one.

Two of the constraints in `20260912141600_domain_constraints` will fail to apply
if existing data violates them. That is intended. If it happens, fix the data
rather than dropping the constraint.

## Health and monitoring

| Endpoint         | Meaning                                         | Use for                  |
| ---------------- | ----------------------------------------------- | ------------------------ |
| `GET /v1/health` | The process is up. Does not touch the database. | Liveness                 |
| `GET /v1/ready`  | The database is reachable.                      | Readiness, load balancer |

Liveness deliberately does not check the database: a database blip should not
cause an orchestrator to kill healthy containers and turn a degradation into an
outage.

Worth alerting on:

- `/v1/ready` failing for more than a minute;
- 5xx rate above a small baseline — every one is a bug, since expected failures
  are 4xx;
- p95 latency on `POST /v1/activities` and `POST /v1/uploads`, the two paths a
  teacher waits on;
- SMS gateway failures, which are invisible to the user beyond "the code never
  arrived";
- disk usage on the object store.

Logs are JSON (pino). Every line carries a request id, echoed to the client in
the error envelope, so a teacher can read out a code and an operator can find
the request.

## Backups

**Database.** Nightly `pg_dump` at minimum; point-in-time recovery via WAL
archiving if the deployment supports it. This holds every student record,
consent record and audit trail — a lost day is a lost day of consent decisions.

**Object store.** Versioning on, lifecycle rules off for anything referenced by
a live record. Photographs cannot be regenerated.

**Test the restore.** A backup nobody has restored is a hypothesis. Restore into
a scratch database quarterly and run
`BALSANSKAR_URL=... python3 scripts/smoke-test.py` against it.

**Do not back up `JWT_SECRET` alongside the database dump.** Together they are a
complete compromise; separately neither is.

## Routine tasks

**Orphaned uploads.** `sweepOrphanedUploads` deletes assets that were never
attached to a record. It is written but **not yet scheduled** — wire it to a
daily cron or a scheduled container. Without it, every abandoned form leaves a
photograph of a child in the bucket indefinitely.

**Expired OTP challenges** accumulate in `otp_challenges`. Rows older than a
week can be deleted; keep them long enough to investigate abuse.

**Revoked refresh tokens** accumulate similarly. Anything past `expiresAt` plus
a margin can go.

Both are small tables at pilot scale and worth a monthly job at state scale.

## Key rotation

Rotating `JWT_SECRET` invalidates, all at once: every access token, every
refresh token, every outstanding one-time code, and every signed file URL.
Everyone signs in again. Do it during a quiet window, and know that a rotation
in the middle of a school day will be noticed.

There is no key-versioning scheme. If overlapping validity becomes necessary,
that is a change to `lib/tokens.ts` and `lib/storage.ts`.

## When something breaks

**Teachers cannot sign in.** Check the SMS gateway first — it is the most
frequent cause and the least visible. `SMS_PROVIDER`, `MSG91_AUTH_KEY`,
`MSG91_TEMPLATE_ID`, and the account balance. The API logs a gateway rejection
at error level without logging the code.

**"Your session was ended for security reasons."** Refresh-token reuse was
detected. Usually one of: two tabs racing (the client shares one refresh, so
this should not happen — investigate if it does), a restored browser session
replaying an old token, or genuine theft. The `refresh_tokens` table shows the
family, the addresses and the user agents.

**A photograph is visible that should not be.** Withdrawing consent unpublishes
immediately, but a signed URL issued beforehand stays valid for up to
`SIGNED_URL_TTL_SECONDS`. To close it now, rotate `JWT_SECRET` (local driver) or
delete the object (S3). Then check the audit trail for `CONSENT_REVOKED` and
`ACTIVITY_UPDATED` to confirm the unpublish ran.

**Reports look wrong.** They count only `PUBLISHED` activities and `VERIFIED`
achievements within the window, and participation is measured against every
school on the register — including schools that have never signed up. A low
number is usually correct and is the point.

**Slow queries.** The indexes assume filtering by school, block or district plus
status and date. A new report that filters on something else will need its own
index; check `pg_stat_statements` before adding one.

## Restoring a deployment from nothing

1. Provision PostgreSQL and the object store; restore both backups.
2. Set the environment, including the **same** `JWT_SECRET` if you want existing
   sessions and file links to survive.
3. `prisma migrate deploy`.
4. Start the API; confirm `/v1/ready`.
5. Run the smoke test against it.
6. Start the web container.

Step 5 is not optional. It is the only check that proves the pieces are wired
together rather than merely running.
