# Trust walkthrough (demo)

`trust-walkthrough.html` is a single-file, self-contained demonstration of the
two things the platform has to get right, built so that teachers and education
officers can try it on their own phones and say what is wrong with it.

Published as a Claude Artifact:
<https://claude.ai/code/artifact/c0bba4e0-599d-4aa6-938a-55eeb84b72aa>

## What it is

Two tracks, each with its own numbered steps and its own set of roles.

**How a school joins.** A head teacher enters their school's UDISE code and
raises a claim; nothing is created. They discover that an unconfirmed school
holds nothing at all. The block education officer — the level at which somebody
actually knows the head teachers by name — confirms it, and only then does the
school exist.

**How work gets out.** A teacher sends an activity to the head teacher. The head
teacher finds they can publish it inside the school on their own authority, but
that sending it further needs a named, dated attestation. Once attested it is
still visible only inside the school, because the block has not looked yet. The
block officer opens a queue ordered by risk — one activity carries a photograph
another school has already used — and clears or returns it. Returning it puts
the school under watch. Then the familiar consent story: the open web refuses
until a guardian's consent is on file, the showcase prints a given name and
nothing more, and withdrawing consent pulls it straight back off.

A panel beside the phone explains what each rule did and why, because the point
is to collect judgement, not clicks.

## What it is deliberately not

- **Not the real system.** Every rule here runs in the browser. In the platform
  they are enforced in the API and in the database, which is the copy that
  counts. Nothing here should be cited as evidence that the platform is secure.
- **Not connected to anything.** No network calls, no analytics, no account.
  State lives in `localStorage` on the tester's own device.
- **Not proof that anything is secure.** It demonstrates the workflow. The real
  enforcement lives in the API and the database, and only that copy counts.
- **Not a claim that fraud is impossible.** Two colleagues who stage a real
  activity and photograph it are undetectable by any software. What the design
  aims at is making fabrication cost more than doing the work, and making
  systematic fabrication visible. See `../docs/integrity.md`.
- **Not a place for real data.** The school, teachers and children are invented,
  and there is no photograph upload at all — the illustrations are inline SVG.
  A demo that invites someone to upload a picture of a real child is a bad idea
  even when the file never leaves the phone.

## Editing it

It is one HTML file with no build step: open it in a browser to work on it. To
update the published version, republish that same URL rather than creating a
second artifact.

Keep the four rules the demo exists to convey intact:

1. a school is claimed and confirmed, never created by whoever asks;
2. work leaving the school carries a named attestation, and the block clears it;
3. consent gates public publication, and withdrawal takes effect at once;
4. a child appears publicly by given name only.

If a change makes any of them less obvious to a first-time tester, the change is
wrong.
