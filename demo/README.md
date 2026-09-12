# Consent walkthrough (demo)

`consent-walkthrough.html` is a single-file, self-contained demonstration of the
moderation and guardian-consent workflow, built so that teachers and education
officers can try it on their own phones and say what is wrong with it.

Published as a Claude Artifact:
<https://claude.ai/code/artifact/c0bba4e0-599d-4aa6-938a-55eeb84b72aa>

## What it is

A tester picks a role — teacher, head teacher, district officer — and walks
seven steps: submit an activity for public view, discover the head teacher has
no public option, watch the district officer be refused for want of guardian
consent, record the consent, publish, see the showcase print a given name and
nothing more, then withdraw consent and watch it come straight back off.

A panel beside the phone explains what each rule did and why, because the point
is to collect judgement, not clicks.

## What it is deliberately not

- **Not the real system.** Every rule here runs in the browser. In the platform
  they are enforced in the API and in the database, which is the copy that
  counts. Nothing here should be cited as evidence that the platform is secure.
- **Not connected to anything.** No network calls, no analytics, no account.
  State lives in `localStorage` on the tester's own device.
- **Not a place for real data.** The school, teachers and children are invented,
  and there is no photograph upload at all — the illustrations are inline SVG.
  A demo that invites someone to upload a picture of a real child is a bad idea
  even when the file never leaves the phone.

## Editing it

It is one HTML file with no build step: open it in a browser to work on it. To
update the published version, republish that same URL rather than creating a
second artifact.

Keep the two rules the demo exists to convey intact — consent gates public
publication, and a child appears publicly by given name only. If a change makes
either less obvious to a first-time tester, the change is wrong.
