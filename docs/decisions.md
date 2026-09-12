# Decisions

Short record of the choices that are not obvious from the code, so that
picking this up again after a gap does not mean re-deriving them.

## 1. No personal data about children

**Decision.** The app stores no child names, no roster, no attendance, nothing
identifying a minor. The only personal data is the teachers' own accounts.

**Why.** The obvious first feature for a class tool is an attendance register.
It would put the group under India's DPDP Act 2023 — which requires verifiable
parental consent to process the personal data of anyone under 18 and prohibits
behavioural tracking of children — and under GDPR Article 8 for anyone in the
EU. A volunteer-run weekly class cannot operate consent collection, retention
schedules and subject-access requests. Meanwhile attendance data is almost
never read after the class ends.

High compliance cost, near-zero value, so it is out. This also removed a table,
a screen and a whole class of privacy risk from v1.

**What this rules out later.** Per-child progress, individual certificates,
absence follow-up. If any of those ever becomes genuinely necessary, it is a
deliberate re-opening of this decision with a consent mechanism attached — not
a quiet schema addition.

## 2. The parent message, not the journal, is the product

Logging a session has a delayed payoff: a reusable plan bank, months away.
Nobody sustains a habit on a delayed payoff. The generated WhatsApp message
pays off the same minute, so it is the reason a teacher opens the app at all —
and the journal accumulates as a by-product.

Consequence: `RecapBuilder` is the most important code in the repository and
the most heavily tested.

## 3. The teacher note never reaches parents

`ClassSession.TeacherNote` is candid feedback for the next volunteer — "the
younger ones lost interest after ten minutes". It is deliberately excluded from
the recap, and there is a test asserting it never leaks. Without a private
field the notes would be diplomatic and useless.

## 4. Not a content library

The tempting version of this app is a library of stories, shlokas and lesson
content. That is a CMS: content types, taxonomy, an editor, publishing. Such
content is already abundant and free, and building it would be a project
without an end. The scarce thing is the record of what *this* class actually
did. The plan bank here is written by the group's own teachers as a side effect
of the write-up.

## 5. Razor Pages over Blazor

Blazor Server needs a persistent WebSocket circuit. The user is on a phone on
classroom or temple wifi. A dropped circuit mid-write-up loses the work and
shows a reconnect modal. Plain server-rendered forms post once and survive bad
connectivity. Blazor would have been the more interesting choice and the worse
one.

## 6. Invite code, failing shut

Registration is open only for the very first account, which bootstraps the
class. Every later account needs a shared invite code, compared in constant
time. If no code is configured, registration **closes** rather than falling
open — a misconfiguration should not put an open sign-up form on the internet.

## 7. Length over character classes for passwords

Minimum 12 characters, no required digits, uppercase or symbols, per
NIST SP 800-63B. Composition rules produce `Balvihar1!`; a length floor
produces a passphrase. Volunteers sign in rarely, so the cookie lasts 60 days.

## 8. The container runs as root

Fly mounts volumes root-owned, so a non-root process cannot write the SQLite
file at `/data`. The standard fix is an entrypoint that chowns the mount and
drops privileges with `gosu`/`su-exec`, neither of which is in the .NET base
image. Since every Fly app already runs inside its own Firecracker microVM,
container-root is not host-root and the exposure is small.

Revisit this if the app ever moves to shared container infrastructure
(Kubernetes, ECS, a shared Docker host) — there, add a privilege-dropping
entrypoint and set `USER`.

**Not verified.** The `Dockerfile` and `fly.toml` were written without a
container runtime available, so unlike the rest of the app they have not been
run. Expect to iterate once on the first `fly deploy`.
