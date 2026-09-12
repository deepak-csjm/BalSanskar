# Getting on the platform, and earning the right to leave the school

Two questions this document answers:

1. How do 130,000 schools get onto the platform without anyone typing them in,
   and without letting a stranger claim a school they have nothing to do with?
2. What has to be true before a school's work is seen outside that school?

The second is the harder one and the more important one.

---

## Part one: how a school gets on

### The problem

Uttar Pradesh has roughly 130,000 Basic Shiksha schools. Nobody is creating
those one API call at a time, and waiting for a complete departmental data
export before a single teacher can use the platform means the platform launches
in a year rather than a month.

The opposite failure is worse: if anyone with a phone can type a name and create
a school, the platform acquires fake schools, and fake schools acquire
photographs of children.

### The shape of the answer: claim, don't create

A school is never _created_ by a user. It is **claimed**.

The anchor is the UDISE+ code — eleven digits, nationally unique, already
printed on every school board and already known to every head teacher. It is the
one identifier that exists before the platform does.

```
                      Head teacher enters an 11-digit UDISE code
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
        Code is in the register              Code is not in the register
        (loaded from the UDISE export)       (no import has reached this block yet)
                    │                                   │
        School exists, unclaimed             A claim is raised carrying the code,
                    │                        the proposed name and the block
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                        A claim sits with the BLOCK OFFICE
                        (the officer who knows these schools by name)
                                      │
                    ┌─────────────────┴─────────────────┐
              Verified                              Rejected
                    │                                   │
      School becomes ACTIVE, claimant           Claimant told why;
      becomes its head teacher, trust           the code is free to claim again
      tier NEW
```

### Why the block office is the verification point

Because it is the level at which someone actually knows the answer. A Block
Education Officer administers on the order of a hundred to a few hundred
schools, has visited most of them, and knows who the head teachers are. A
district officer with three thousand schools does not, and a state officer
certainly does not.

This is not a novel piece of process design — it is where the department already
places this kind of confirmation. The platform should follow the administrative
reality rather than invent a parallel one.

### What the claimant provides

| Field                                         | Why                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| UDISE code                                    | The anchor. Checked for format and for an existing claim.                                                            |
| School name, as they would write it           | Compared against the register when there is one; becomes the record when there is not.                               |
| Block (and district)                          | Routes the claim to the right officer.                                                                               |
| Their name, designation, employee code        | What the officer recognises them by.                                                                                 |
| Their phone                                   | Already verified by one-time code before the claim is raised.                                                        |
| A photograph of the school board _(optional)_ | The board carries the name and code. Cheap for a genuine head teacher, awkward for someone who has never been there. |

### Anti-abuse

- **One live claim per UDISE code.** A second claimant is told the school is
  already being claimed and by whom (first name and designation only) — enough
  to sort out an honest collision inside the school, not enough to be a
  directory.
- **The phone is verified before the claim exists.** A claim always traces to a
  number.
- **A claim expires** after a set period and frees the code, so an abandoned
  claim does not lock a school out.
- **Claims are rate-limited per number and per address.**
- **Every claim, verification and rejection is audited** with the officer's name.
- **A school in `PENDING_VERIFICATION` can hold nothing.** No students, no
  activities, no uploads. There is nothing to gain by claiming a school and
  waiting.

### Bulk import stays the primary path

Where the department can supply a UDISE export for a district, importing it is
strictly better: the schools exist before anyone asks, and claiming becomes
recognition rather than creation. The claim flow is the fallback that lets a
block start using the platform on a Monday instead of after the data-sharing
agreement is signed.

---

## Part two: earning the right to leave the school

### The flaw this fixes

The first version of the platform required an activity to be approved by
somebody other than its author, and treated the head teacher as that somebody.

In a school with three teachers, the author and the head teacher sit in the same
room, are judged by the same inspection, and both benefit from the school
looking active. In a school with two teachers, one of them _is_ the head
teacher. A signature from a colleague who shares your incentive is a formality,
not a control.

That is fine for work that stays inside the school. It is not sufficient for
work that goes to the block, the district, or the open web — which is precisely
where the platform's value and its risk both sit.

### What "fool proof" can and cannot mean

It cannot mean "impossible to fake". Two colleagues who want their school to
look good can stage a genuine activity, photograph it, and describe it
truthfully-but-generously. No amount of software detects that, and a design that
claims otherwise is lying to the department.

What it can mean:

- **Fabrication costs more than the real thing.** If faking an activity requires
  staging it with real children and a real camera, the cheapest way to produce a
  convincing record is to actually teach the lesson. That is a win.
- **Recycling is caught.** Reusing last year's photograph, or a colleague's, or
  one from the internet, is the fraud that actually happens at scale because it
  is nearly free. It should be nearly impossible.
- **Patterns are visible.** One fabricated activity is undetectable. Forty
  activities uploaded the night before a review meeting is a pattern, and the
  officer with oversight should see it without going looking.
- **Someone's name is on it.** An approval that carries a personal, dated
  attestation behaves differently from a button that says "publish".

### The gate

Nothing changes for work that stays inside the school. A head teacher publishes
at `SCHOOL` visibility on their own authority; that is the internal validation
you already have, and it is appropriate.

Everything above `SCHOOL` passes through a clearance step:

```
Teacher records ─▶ Head teacher ATTESTS ─▶ risk assessment ─▶ ┬─ auto-cleared
                   (named, dated,          (automatic)        │
                    specific claim)                           └─ block officer
                                                                 confirms
                                                                      │
                                                   visibility rises to what
                                                   was asked for, and no higher
```

An activity is never visible above the level that has actually been cleared. The
record carries what it has been _granted_, not what it has been _asked_ for.

### 1. Attestation, not approval

Before an activity can leave the school, the head teacher records a specific,
dated statement in their own name:

> I confirm this activity took place at this school on the date stated, that I
> have seen it or verified it with the teacher, and that a signed consent slip
> is on file for every child named.

This is stored, attributed, and shown to the block officer alongside the
activity. It costs one extra screen. It converts a click into a claim a named
government employee has made — which is a different act, and people treat it
differently.

It is also what makes a later problem attributable. "Who said this happened?"
has an answer.

### 2. Duplicate photograph detection

Every uploaded image gets a **perceptual hash** — a 64-bit fingerprint of its
visual structure, computed in the browser before upload, that survives
re-compression, resizing and minor cropping.

The server compares each new image against the hashes it already holds, by
Hamming distance. A near-identical image raises a flag naming where it was seen
before:

- the **same school** re-using a photograph on a later activity;
- a **different school** using the same photograph — which is either sharing or
  something worse, and either way the block should know;
- an image already seen anywhere on the platform.

This is the single highest-value integrity check, because photo recycling is the
cheap fraud and therefore the common one. It also catches innocent mistakes —
the teacher who attaches the wrong file.

A perceptual hash is not a cryptographic one: it is designed to match _similar_
images, which is the point, and it will occasionally match two genuinely
different photographs of the same classroom wall. So it **flags for a human**;
it never rejects on its own.

**The comparison happens in PostgreSQL, and this is a correctness decision
before it is a performance one.** `bit_count(a # b)` gives the Hamming distance
between two bit strings with no extension required, against a `bit(64)` column
generated from the hex so the two representations cannot drift.

The first implementation read a capped page of rows and compared them in the
application. That is wrong in a way that would never have produced a bug report:
an unordered `LIMIT` returns an arbitrary page, so past the cap the check
examined a lottery rather than the record — and at 130,000 schools that page is
a rounding error against the table. The flag would have gone on reporting "no
duplicates" while detecting essentially nothing, and an officer who trusts a
control that has quietly stopped working is worse off than one who never had it.
`integrity.test.ts` buries a reused photograph behind six thousand unrelated
ones for exactly this reason.

The scan is sequential, because no stock index can accelerate an arbitrary
Hamming distance. If it ever becomes the bottleneck the answer is a band index
or a `bktree` extension, not a smaller cap.

### 3. Sanity against the school's own records

Cheap checks that catch carelessness and inflation:

| Check                                                                    | Flag                    |
| ------------------------------------------------------------------------ | ----------------------- |
| Participants exceed the school's active roster                           | `COUNT_EXCEEDS_ROSTER`  |
| Participants exceed the roster for the classes named                     | `COUNT_EXCEEDS_CLASSES` |
| Activity dated on a Sunday or a gazetted holiday                         | `NON_WORKING_DAY`       |
| Activity dated more than 90 days before it was recorded                  | `LONG_BACKDATED`        |
| Description closely matches another recent activity from the same school | `TEXT_REUSED`           |
| A burst — more activities in 24 hours than the school's usual month      | `BURST`                 |
| The school's first submission                                            | `FIRST_SUBMISSION`      |

None of these is proof of anything. A Sunday activity is often a genuine
community event. Each one is a reason for a human to look, and the ranked queue
below is how that attention gets allocated.

### 4. Risk-based clearance, because 100% review is not real

A Block Education Officer with two hundred schools cannot review every activity,
and a design that assumes they will is a design that gets ignored in month two.

So clearance is sampled, and the sampling rate is driven by what the platform
knows about the school:

| Trust tier | How a school gets there                                       | Share of escalations reviewed |
| ---------- | ------------------------------------------------------------- | ----------------------------- |
| `NEW`      | Just verified, or fewer than five cleared activities          | **100%**                      |
| `STANDARD` | A clean record, some history                                  | **30%**                       |
| `TRUSTED`  | Twenty-plus cleared, none returned in six months              | **10%**                       |
| `WATCH`    | Anything returned by the block, or a confirmed integrity flag | **100%**, until it recovers   |

On top of the sample, **any activity carrying a risk flag is always reviewed**,
whatever the tier. Sampling decides how much _unflagged_ work gets a second
look; flags are never sampled away.

The effect is that an honest school earns lighter oversight and a school that has
been caught gets more of it — and the officer's limited attention lands on the
items most likely to deserve it.

A district may set the sampling to 100% for every tier if it prefers. The
platform should make the tractable option the default and the strict option
available, not the other way round.

### 5. The officer sees a ranked queue, not a chronological one

The block clearance queue is ordered by risk score, not by arrival. The first
screen shows what is most likely to be wrong. Each item states plainly why it is
in the queue: "sampled", or "same photograph as an activity from another school
in July", or "participants exceed the roster".

An officer who opens this and finds the top three items are genuinely worth
looking at will open it again. An officer who finds a chronological list of two
hundred things will not.

### What this does not do

Stated plainly, because a control nobody understands the limits of is worse than
no control:

- It does not detect a staged activity that really happened.
- It does not verify that the described learning actually occurred.
- It does not verify a consent slip exists — only that a named person attested
  that it does. The slip itself lives in the school's file. Scanning it is
  supported and should be encouraged, but is not compelled.
- It does not stop a block officer who is themselves complicit.
- Perceptual hashing is defeated by re-photographing a printed photograph, or by
  a heavy edit. It is not meant to stop a determined adversary; it is meant to
  make the lazy fraud stop being lazy.

The honest summary: this raises the cost of faking to roughly the cost of doing
the work, and it makes systematic faking visible. That is a reasonable place for
a system like this to sit. Claiming more would be dishonest, and would invite
exactly the misplaced confidence that gets a platform like this into the
newspapers.

---

## Where this lives in the interface

The rules above are enforced by the API and are useless if a screen cannot
express them. Four places in `apps/web` carry the design:

| Screen                                          | Path                  | Who sees it                              |
| ----------------------------------------------- | --------------------- | ---------------------------------------- |
| `pages/ClaimSchool.tsx`                         | `/claim`              | Anyone. No account exists yet.           |
| `pages/Claims.tsx`                              | `/app/claims`         | `school:verify_claim` — the block office |
| `pages/Clearance.tsx`                           | `/app/clearance`      | `activity:clear` — the block office      |
| `ModerationPanel` in `pages/ActivityDetail.tsx` | `/app/activities/:id` | `activity:moderate` — the head teacher   |

Three decisions in those screens are load-bearing rather than cosmetic:

**The moderation panel offers two buttons, not one button and a dropdown.**
"Publish within the school" and "Attest and send on" are different acts with
different consequences, and a dropdown makes them look like settings on one act.
The attestation statement is rendered in full above the checkbox, in the head
teacher's own language, because they are putting their name to those words.

**The publish checklist is split by what each button actually needs.** The
server evaluates blockers against one visibility — the one the teacher requested
— while the screen offers two. `UNCONDITIONAL_PUBLISH_BLOCKERS` in
`packages/shared/src/policy.ts` says which blockers hold everywhere. Getting
this wrong in the apparently-safe direction is the harmful one: treating a
consent gap computed for a PUBLIC request as a reason the school cannot keep its
own internal record would grey out the head teacher's only legal action with no
way to discover why.

**A head teacher never sees the clearance queue.** Not hidden as a nicety — the
`activity:clear` permission is deliberately absent from `PRINCIPAL_PERMISSIONS`,
so the API refuses it too. If the tab ever appears for a head teacher, that is a
permissions bug, not a navigation bug.

## Housekeeping that has to happen on a clock

Two jobs run from `apps/api/src/maintenance.ts`, hourly, as a separate process:

**Abandoned uploads are deleted.** This one is a child-safety matter rather than
tidiness. Every activity form somebody starts and does not finish leaves a
photograph in the bucket, attached to nothing and shown in no interface where
anybody would notice it was there. Without the sweep it stays for the life of
the deployment. Files attached to a record are never touched, and a file
uploaded in the last day is left alone because the teacher may still be typing.

**Unanswered claims are expired**, so the block officer's queue does not fill
with claims nobody can usefully act on any more.

Neither is a timer inside the API process: a timer runs once per replica, only
while that process happens to be up, and cannot be invoked by an operator who
needs it to have run now. A command that exits with a status is something a cron
table, a systemd timer or a Kubernetes CronJob can own.

The claim expiry is deliberately **not** load-bearing. A partial unique index
allows one live claim per UDISE code, so a claim left `PENDING` for ever would
lock that school out of the platform permanently — no journey in the product can
clear it, and the next head teacher to try sees only a stranger's given name.
`createSchoolClaim` therefore retires a stale claim on the way past. A school
must not stay locked out because somebody forgot a cron entry.

The fingerprint is computed in the browser (`apps/web/src/lib/phash.ts`) because
uploads go straight to storage and the API never receives the bytes. Its bit
layout is therefore a wire format compared against fingerprints computed months
earlier on other people's phones: `phash.test.ts` pins it, because a silent
change there would stop every duplicate matching without failing anything else.
