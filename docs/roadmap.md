# What is missing, and what could go wrong

An honest account of the gaps. A platform presented to a government as
"complete" when it is not is worse than one presented accurately, because the
first version to disappoint is the one that gets cancelled.

## Blocking a real pilot

These should be done before the first school uses this with real children.

### Data retention and deletion

The single biggest gap. There is currently no way to delete a student record, no
archival when a child leaves class 8, and no expiry on public photographs. The
platform only accumulates.

Needs: a deletion path that takes the consent history and activity links with it,
an archival job, and an audit trail that outlives the personal data by holding
identifiers rather than names. Sketched in
[`child-safety.md`](child-safety.md#retention).

### Bulk UDISE import

Schools and blocks must currently be created one API call at a time. A district
has 1,500–3,000 schools; a state has 130,000. Nobody is doing that by hand.

Needs: a CSV importer that validates against the department's UDISE export,
reports what it would change before changing it, and is re-runnable.

### Scheduling the orphan sweeper

`sweepOrphanedUploads` exists and nothing calls it. Until it is scheduled, every
abandoned form leaves a photograph of a child in the bucket permanently. This is
a cron entry, not a project.

### A penetration test

Nothing in this codebase has been reviewed by anyone outside the team that wrote
it. For a system holding children's photographs, an external review should be a
launch requirement and its findings should block.

### A signed data-protection position

The technical controls are in place. What does not exist is a decision, on
paper, from the department: who is the data controller, what is the lawful
basis, how long is data kept, who answers a guardian's request. Engineering
cannot supply those answers.

## Wanted, and deliberately deferred

### Notifications

Nothing tells a teacher their activity was published or rejected, and nothing
tells a head teacher something is waiting for review. Today they have to open
the app and look.

This matters for adoption and is the highest-value feature not built. It needs
SMS templates (each costing money per message), an in-app inbox, and a digest
rather than a per-event blast — nobody wants twelve texts a day.

### Attendance

Frequently requested and deliberately excluded. Daily attendance for 500,000
teachers is a different system with a different write pattern, a different
offline story and different politics. Bolting it on would risk the thing this
platform is actually good at.

If it is ever added, it should be a separate service sharing the identity and
school register, not another table here.

### Face blurring

Genuinely valuable: a blurred group photograph could be published without
per-child consent. Needs a model running in the browser (WASM, adds megabytes to
the bundle) or on the server (a GPU, or slow CPU inference), plus somebody who
owns the false-negative rate. A missed face is a child published without
consent, so it cannot be "mostly works".

### Server rendering for the public showcase

The authenticated app gains nothing from SSR. The showcase would: it is the page
a department shares, and it is currently a client-rendered React app that a
search engine or a social preview sees as empty. Prerendering the showcase
routes at build time is the cheap version and is probably enough.

### Achievement certificates

A generated, verifiable certificate for a child's verified achievement — the
thing a family would actually keep. Straightforward, and would do more for
adoption than most of the engineering above.

### Offline reading

The service worker caches the shell but no API responses, on purpose: a teacher
acting on a stale roster or a stale moderation queue is worse than one who knows
they are offline. A read-only cached view, clearly marked as stale, would still
be useful. It needs care about what it caches — a cached student roster on a
lost phone is a data exposure.

### Two-factor authentication for officers

A district officer can publish children's photographs to the open web. That role
deserves more than a password.

## Scaling work, when it is needed

Not needed for a pilot; needed before a state rollout.

- **Rate limiting on Redis** — required before running more than one API
  container. Currently in-memory and per-process.
- **Ordering the school leaderboard in SQL** — it currently takes up to 2,000
  rows and sorts in memory, which is fine for a district and not for a state.
- **Batched signed URLs** — a 100-row page computes 100 signatures. Local
  computation, no network, but it will show up in a profile eventually.
- **Read replicas for reporting** — the state dashboard and a teacher's upload
  should not contend for the same connection pool.
- **Partitioning `audit_events`** — the fastest-growing table by far. Monthly
  partitions before it reaches tens of millions of rows.

## Risks to the project, not the code

Worth writing down because they are more likely to kill this than a bug.

**Teachers will not use it if it is slower than Instagram.** Instagram is one
tap. This is a form with a review queue. The offline outbox, the 84 KB bundle
and the Hindi-first interface are all attempts to close that gap, but the gap is
real. The counter-argument has to come from the platform giving teachers
something Instagram cannot: recognition that counts officially. That depends on
the department actually using the reports, which is a political commitment, not
a feature.

**Moderation is unpaid work for head teachers.** Every activity needs a second
person. In a school with three teachers and no head teacher registered, that
person may not exist. The block-office fallback exists, but a block officer with
two hundred schools will not review two hundred activities a week. This may need
auto-approval at school visibility with sampled review — a real weakening of the
current guarantee, and a decision for the department rather than for engineering.

**A single bad incident would end it.** One photograph of a child on the open
web without consent, in the press, and the platform is finished regardless of
how well the other million records were handled. This is why the consent gate is
strict to the point of being annoying, and why it should stay that way when
somebody asks for it to be relaxed for a demonstration.

**Reports that show poor participation are politically unwelcome.** Measuring
against the full register means the first state dashboard will show a low
number. There will be pressure to measure against registered schools instead,
which would make the number meaningless. That pressure should be anticipated and
refused, and the reason should be explained before the first dashboard is shown,
not after.
