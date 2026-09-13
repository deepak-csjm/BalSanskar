# Data protection: what this platform refuses to hold

## The decision

**BalSanskar holds no personal data about any child.** Not a name, not a
photograph, not a guardian's phone number, not a roll number. Not with consent,
not with a signed slip, not "only the given name".

This is a change of direction. An earlier version of this platform held a class
roster, guardian contact details, scanned consent slips and photographs of
children, protected by a consent workflow that was carefully built and genuinely
good. It has been removed. This document explains why, because the reasoning
matters more than the rule and somebody will eventually propose putting it back.

## Why not "consent, done properly"

The Digital Personal Data Protection Act 2023 treats anyone under eighteen as a
child, and section 9 is the strictest part of the Act. A Data Fiduciary must
obtain **verifiable** consent from a parent or lawful guardian before processing
a child's personal data. It may not undertake tracking, behavioural monitoring
or targeted advertising directed at children **at all** — that prohibition is
not something consent can unlock. Penalties for breaching the children's-data
obligations run to ₹200 crore.

A consent-based design can be made lawful. Ours very nearly was. The problem is
not legality, it is the shape of the risk:

- **"Verifiable" is doing enormous work in that sentence.** A signed paper slip
  filed in a school almirah is evidence that a teacher wrote something down. At
  130,000 schools, across half a million teachers, with no way to check a
  guardian's identity, verifiability is aspirational. The platform would be
  asserting a standard it cannot actually meet.
- **The blast radius is unbounded and permanent.** One misconfigured bucket, one
  stolen laptop, one departing contractor with database access, and the incident
  involves photographs of identifiable rural children. There is no version of
  that story that ends well, for the children least of all.
- **It costs the thing it was built for.** Chasing consent slips is unpaid work
  for teachers who already resent the paperwork. The single loudest objection to
  a platform like this is "more forms". Consent collection _was_ the forms.
- **It makes the project unfundable and unsellable in the same stroke.** No
  department wants to be the one that authorised a private database of
  children's photographs, and no funder wants their name on it.

Set against that, ask what the children's data was actually _for_. It let the
showcase print "Anjali, class 5" under a photograph. That is the entire benefit,
and it is not worth any of the above.

## What replaces it

| Removed                           | Replacement                                                                                                                    | Consequence                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named student roster              | Class-level enrolment **counts** per school                                                                                    | No child PII. Teachers stop maintaining a roster they hated. The over-counting risk check works exactly as before, against counts instead of names.                                                            |
| Named participants on an activity | Participant count and class levels, which already existed                                                                      | No child PII. Nothing the reporting needed is lost.                                                                                                                                                            |
| Achievement tied to a named child | Achievement tied to school, class level and category                                                                           | The school and the teacher still get the credit. The child's name stays in the school's own register, where it always belonged and where the department already holds it lawfully.                             |
| Guardian name and phone           | —                                                                                                                              | Deleted. The platform has no business contacting a parent.                                                                                                                                                     |
| Scanned consent slips             | —                                                                                                                              | Deleted. A scanned slip is a document containing a child's name _and_ a guardian's signature — the most sensitive artefact the platform held, kept in order to prove permission for something we no longer do. |
| Photographs of children           | Photographs of the **work**: the reading corner, the kitchen garden, the science model, the wall chart, the repaired classroom | The one that matters most. See below.                                                                                                                                                                          |

## Photograph the work, not the faces

Every upload carries a confirmation that no child's face is identifiable in the
frame, the head teacher attests to it again before the work leaves the school,
and the block officer sees the photograph before it goes any further. Three
people, each of whom knows the school, look at every image that travels.

This is an honour system backed by three humans rather than a technical control,
and it is stated as such. Face detection on the handset was considered and
rejected: it fails quietly on exactly the images that matter — a child at the
edge of frame, in poor light, at a distance — and a control that fails quietly
is worse than a rule people understand. The rule is easy to follow, easy to
check, and a photograph of a kitchen garden is a better photograph of a kitchen
garden than one with a class of children lined up in front of it.

If an identifiable child does reach the platform, any of the three can remove it
in one action, and there is no consent record to reconcile because there is no
consent.

## What the platform does hold

Adults, doing their jobs, in a professional capacity:

- **Teachers and officers**: name, mobile number, designation, employee code,
  school or administrative posting.
- **Their work**: activity write-ups, photographs of that work, the review and
  clearance trail, appreciations given and received.
- **Schools**: UDISE code, name, type, location, enrolment counts by class.

Lawful basis is consent under section 6, taken at registration with a notice in
Hindi that says what is held, why, for how long, and who sees it. A teacher can
see everything held about them, correct it, and ask for erasure; erasure removes
their personal details and leaves the school's work in place, attributed to
"a teacher at this school", because the record belongs to the school and the
department, not to the individual.

A grievance officer is named in the notice and in the application. Any personal
data breach is reported to the Data Protection Board and to affected people,
without waiting to establish how bad it is.

## Retention

Nothing is kept because deleting it was never scheduled.

- **Photographs** are deleted a fixed period after the activity they belong to
  is archived. The department's need is to see the work at the time and to count
  it afterwards; the counts survive, the images do not.
- **Unattached uploads** are swept within a day — a form somebody abandoned must
  not leave a photograph behind.
- **Claims** that nobody answered expire.
- **Audit records** are kept longer than everything else, deliberately, because
  the trail of who decided what is the accountability the platform exists to
  provide, and it names officers rather than children.

Retention is also the largest single lever on running cost. Data minimisation
and affordability point the same way here, which is a good sign that the design
is right.

## For reviewers

Changes that need a deliberate conversation before they are made, not a pull
request:

- Adding **any** field that identifies a child, however innocuous, however
  consented, however temporarily.
- Adding a way to upload a photograph in which a child is identifiable.
- Adding guardian contact details for any purpose, including "just for
  notifications".
- Retaining media indefinitely, or removing a retention sweep.
- Any feature that tracks or profiles an individual child's progress over time.
  Aggregate class-level learning outcomes are fine and are the point; a
  per-child record is exactly what section 9 forbids.
- Sharing anything with a third party for advertising, analytics or "product
  improvement".

The test for all of these: if the database leaked tomorrow and the whole of it
were printed in a newspaper, would a child be harmed? Today the answer is no.
Keep it that way.
