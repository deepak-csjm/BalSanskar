# The promises

This document exists because of a specific, documented failure.

On 8 July 2024 the Uttar Pradesh Basic Education department ordered digital
attendance for teachers. It was withdrawn about nine days later after statewide
protest. The teachers who refused it were not refusing technology; they were
reading the instrument correctly. It measured them, it returned nothing to
them, and it created a new way to be found deficient on a morning when the road
was flooded.

Every digital system these teachers have been handed works the same way. They
are the sensor and never the beneficiary. A teacher meeting this platform for
the first time has excellent reasons for suspicion and no reason at all to take
our assurances on faith.

So the promises are written in three places that cannot quietly drift apart:

| Where                                                                          | What it is                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `packages/shared/src/guarantees.ts`                                            | The promises as flags a test can assert on, plus the words a teacher reads |
| `packages/shared/src/guarantees.test.ts` and `apps/api/test/integrity.test.ts` | The tests that fail when one is broken                                     |
| `/vachan`                                                                      | The screen, in Hindi, with no account required                             |

## The one sentence

**This platform measures systems, never people.**

It can show you the school with no water and the block where grants stall. It
cannot show anyone a list of teachers ranked by anything.

Those two sentences are not in tension. Almost every difficult product decision
here resolves by asking which side of that line a proposal sits on.

## The promises

1. **No personal data about any child.** Not a name, not a photograph tied to
   one, not a guardian's number. Not with consent either. See
   [data-protection.md](./data-protection.md).
2. **No ranking of teachers.** Schools may be ordered so an officer can find
   the one that needs help. People may not.
3. **No per-teacher number above the school.** The stronger rule, and the one
   that actually bites. A block officer sees what a school did, never how it
   divided between the people inside it.
4. **No attendance, no location, no record of a person's presence.** Including
   as a by-product of some other feature, which is how it normally arrives.
5. **"We could not, and here is why" is a complete answer.** A system whose
   only acceptable answer is compliance never learns that money did not arrive.
   It learns that the teacher failed.
6. **Constraints travel with achievements.** No report shows what a school
   produced without what it was missing while it produced it.
7. **A teacher's record belongs to the teacher.** Exportable in full on demand.
   Erasable — the person's details go, the school's work stays, attributed to
   "a teacher at this school".
8. **Every escalation has a clock, and it runs on the office.** The measured
   party is whoever owes the answer.
9. **Recognition is named and human.** No computed score, no algorithmic
   teacher of the month. An officer put their name to it and can be asked why.
10. **No advertising, no trackers, no sale of anything held here.**
11. **Never charged to a teacher, a school, a parent or a village.**

## What will never be built

The failure mode is not somebody proposing an obviously wrong feature. It is
somebody reasonable proposing a reasonable-sounding one whose second-order
effect is a surveillance instrument. `FORBIDDEN_FEATURES` therefore records the
sentence each request actually arrives as, so it is recognisable on the way in
rather than after it ships:

- _"Can we just record who was present when the activity happened?"_ — teacher
  attendance.
- _"Location would prove the photo is really from that school."_ — geotagging.
  Provenance is already handled by perceptual hashing and a head teacher who
  signs an attestation with their name.
- _"The district wants to recognise the top ten teachers."_ — a leaderboard.
- _"Just for monitoring — we will not display it publicly."_ — an unpublished
  performance file is still a performance file.
- _"A simple red/amber/green on which schools completed the drive."_ — renders
  undelivered money as teacher failure.
- _"The ARP already visits, let them record a rating."_ — an appraisal system.
- _"An anonymous pulse survey so we know how teachers are feeling."_ — a survey
  an officer can de-anonymise collects candour and then exposes it.
- _"Gamification would improve engagement."_ — a streak is a daily obligation
  in a friendly costume, and it punishes the teacher whose week went badly.
- _"A small premium tier for schools that want more storage."_
- _"We need to understand usage" / "a share widget would help reach."_

## Changing one of these

Not a pull request. A conversation, and then a change to this document, the
guarantee, its test and the Hindi on the screen — in that order, so that
nothing is promised on `/vachan` that the code no longer enforces.

The one that will be pushed on hardest is promise 3, and the request will be
reasonable, internal and well-intentioned. That is the point of writing it down
before anyone asks.
