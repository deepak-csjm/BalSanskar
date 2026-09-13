# Why a teacher would open this, rather than resent it

## The failure to avoid

A state rolls out an app for teachers. Teachers read it as surveillance and a
league table, and as unpaid work on top of the paperwork they already carry. The
union objects. The rollout is withdrawn or quietly ignored. Uttar Pradesh has
already paused one teacher-facing mandate for exactly this reason, and it was
right to.

Everything below exists because a platform that teachers resent does not fail
gracefully — it fails completely, and it takes the good intentions with it.

## The order that actually matters

Not the order a product plan would guess. Time first.

### 1. It removes work rather than adding it

The strongest claim this platform can make is that a teacher who logs their work
has thereby done a chore they already owed somebody, instead of acquiring a new
one.

A block education officer compiles a monthly scheme-wise return — how much work
went towards NIPUN Bharat, which schools did anything for Kayakalp, how many
children were reached — by hand, from a register and a WhatsApp album, against a
deadline. `/v1/reports/schemes` is that return, assembled from work teachers
have already logged, and `/v1/reports/schemes.csv` is the file the officer
actually forwards.

That is why an activity carries up to three programme tags, why tagging is three
taps on a form the teacher is filling in anyway, and why untagged work still
appears under NONE rather than vanishing — a report that disagrees with the
overview screen is a report nobody trusts.

**It is also why the officer wants the platform used**, which is the mechanism
by which it actually gets used. A showcase gives nobody in the chain a reason to
open it twice.

The register form is the same idea. It replaced a roster of two hundred named
children, kept current by hand, with nine numbers entered once a term.

### 2. Recognition comes from a named person

An appreciation is given by an officer with oversight, it carries their name,
and they can be asked why. That is worth more in a staffroom than any badge, and
it cannot be farmed.

### 3. The record is theirs and it travels

A teacher's work, verified and dated, is currency for a transfer application, a
promotion file or a state teacher award nomination. It should belong to the
teacher, be exportable, and not evaporate when they move schools.

### 4. What worked at the school down the road

Teachers copy other teachers. A library of practices, in enough detail to
actually repeat, with the originating teacher credited when their idea is
adopted elsewhere, is the difference between a reporting tool and something a
teacher opens on purpose.

## The rules, enforced in code

`RECOGNITION_RULES` in `packages/shared/src/schemes.ts`, and listed in
`docs/data-protection.md` as changes that need a conversation rather than a pull
request:

- **No ranking of teachers against each other. Anywhere. For anyone.** Schools
  may be ordered, because a district officer has to be able to find the schools
  that need support, and that report is deliberately framed as a support list
  rather than a shame list. Individuals may not, ever.
- **No public counter of one teacher's output.** A private "twelve this term" is
  a record. The same number on a screen an officer can sort is a target, and a
  target produces twelve thin write-ups.
- **Recognition names its source.**
- **A teacher can take their record with them.**

## Honest status

Built and tested: the scheme-wise return and its CSV, programme tagging on the
activity form, named appreciation from officers, and the register form that
replaced the roster.

Designed and not yet built: the exportable teacher portfolio, and the practice
library with adoption credit. Both are additive and neither changes the data
model. They are the next thing worth building, and until they exist the "record
that travels" and "what worked down the road" arguments above are intentions
rather than features — recorded here as such so nobody mistakes them for
shipped.
