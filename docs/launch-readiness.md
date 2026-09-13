# Launch readiness: what it takes not to be rejected

A platform for government schools can be refused by any of five different
people, each for their own reason, and each refusal is fatal on its own:

| Who                         | Refuses because                                                |
| --------------------------- | -------------------------------------------------------------- |
| The Data Protection Board   | it holds children's data without verifiable parental consent   |
| MeitY / STQC                | it fails GIGW 3.0 or has no safe-to-host certificate           |
| A teachers' association     | it is surveillance, or unpaid work, or can dock somebody's pay |
| A block or district officer | it is one more thing to log into that gives them nothing       |
| A parent or a journalist    | a photograph of a child leaked out of it                       |

This is the checklist against each, with what is done and what is not. It is
written to be worked, not quoted.

---

## 1. Data protection — the DPDP Act 2023 and Rules 2025

The Rules were notified on **13 November 2025**, starting an eighteen-month
runway; enforcement lands around **May 2027**. That is the date to build back
from.

### The provision that would have sunk this

Section 9 and Rule 10 govern anyone under eighteen. A Data Fiduciary must obtain
**verifiable** parental consent — Rule 10 contemplates checking a parent's
identity against a government-backed credential such as DigiLocker — and may
**not** track, monitor, profile or behaviourally target a child at all. That
last prohibition is absolute; no consent unlocks it. Penalties reach ₹200 crore.

**This platform holds no personal data about any child**, so Section 9 and Rule
10 do not apply to it. That is not a mitigation, it is the removal of the
category. The reasoning is in [`data-protection.md`](data-protection.md), and
`integrity.test.ts` asserts against `information_schema` that no column anywhere
can hold a guardian, a student, a consent, a gender, a birth year or a roll
number — checked where it cannot be quietly undone.

Two consequences worth stating to a reviewer:

- There is no DigiLocker parental-consent integration to build, no age gate, and
  no consent artefact to store, produce on demand or defend in an audit.
- The out-of-school children work — the thing most tempting to build as a
  per-child tracker — is counted by hamlet precisely because a per-child tracker
  is what Section 9 forbids. The school keeps the names, lawfully, in the
  register it has always kept.

### What still applies, because teachers are adults

| Obligation                                                         | Status                                                                                                                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notice at collection, in plain language, in Hindi                  | **To write.** Content settled; the screen is not built.                                                                                                                     |
| Lawful basis (consent, s.6) for teacher and officer data           | Done in substance — registration is voluntary and explicit. Needs the notice above to be complete.                                                                          |
| Right to access, correct, erase                                    | **Not built.** Erasure is designed: remove the person's details, keep the school's work attributed to "a teacher at this school", because the record belongs to the school. |
| Grievance officer, named and reachable                             | **To appoint.** A name and an address, not a form.                                                                                                                          |
| Breach: notify the Board within 72 hours                           | Runbook below.                                                                                                                                                              |
| Breach: notify affected people within 72 hours                     | Runbook below.                                                                                                                                                              |
| Retention limits                                                   | Done — [`running-cost.md`](running-cost.md).                                                                                                                                |
| Significant Data Fiduciary duties (annual DPIA, independent audit) | Not designated today. At state scale, assume it and budget for it.                                                                                                          |

### The 72-hour breach runbook

The clock starts when the team concludes a personal data breach happened — not
when the investigation finishes. It runs through weekends.

1. **Contain.** Revoke the credential or close the hole. `revokeAllSessions`
   exists for the account case.
2. **Establish scope from the audit trail**, which is retained for seven years
   and names officers rather than children.
3. **Notify the Board without delay**, then file the detailed report inside 72
   hours: nature, extent, timing, location, likely impact.
4. **Notify affected people inside 72 hours**, in Hindi: what happened, what of
   theirs was exposed, what they should do, and who to contact.
5. **Record it.** The Board can ask later.

The single largest thing reducing the size of any such notice is that the
database contains no child. The worst realistic breach exposes teachers' names,
mobile numbers and their work — serious, and survivable.

---

## 2. Government acceptance — GIGW 3.0, STQC, CERT-In

GIGW 3.0 was written jointly by MeitY's STQC Directorate and CERT-In and is the
bar a government-facing platform is measured against: **25 quality
requirements, 50 accessibility, 3 cybersecurity, 10 lifecycle**.

| Requirement                                           | Status                                                                                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WCAG 2.1 Level AA, evidenced page by page             | **Partly.** Semantic HTML, labelled controls, visible focus, a skip link, reduced-motion support and a theme-aware palette are in. Not yet audited page by page, and there is no evidence pack. |
| Hindi as the primary language                         | Done. Hindi is the source language, not a translation.                                                                                                                                          |
| Works on a low-end device and a slow connection       | Done, and enforced: 88.8 KB gzipped first load against a 120 KB budget checked in CI.                                                                                                           |
| STQC "Certified Quality Website"                      | **Not started.** Needs an empanelled lab.                                                                                                                                                       |
| CERT-In / STQC safe-to-host certificate               | **Not started.** Needs a VAPT by an empanelled auditor. Budget six to ten weeks.                                                                                                                |
| Lifecycle: named owner, review cycle, archival policy | Partly — retention is defined, ownership is not.                                                                                                                                                |

**The honest read:** the engineering is in good shape and the certificates are
not started. Neither can be self-issued, both take weeks, and both should begin
before a pilot rather than after, because a department will ask for the
safe-to-host certificate at the first meeting where money is discussed.

---

## 3. Teachers — the failure that has already happened here

Uttar Pradesh launched digital attendance for basic school teachers on **8 July
2024** and suspended it within about nine days. Teachers and Shiksha Mitras
protested; the stated reasons were a system that did not work, a rigid marking
window, roads flooded in the monsoon, and the fear that being late meant a
deducted day. A committee was appointed to review it.

That is the precedent any teacher-facing platform in this state is measured
against, and the lessons are specific:

| The 2024 failure                                 | This platform                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Time-bound: mark attendance by 8:00 or be absent | Nothing is time-bound. There is no deadline anywhere.                                   |
| Punitive: a missed mark cost pay                 | Nothing costs anybody anything. No absence, no penalty.                                 |
| Extra work with nothing back                     | The scheme-wise return the block officer already compiles by hand now assembles itself. |
| Individual and comparable                        | Ranking teachers against each other is refused in code (`RECOGNITION_RULES`).           |
| Mandated top-down                                | A school joins by claiming itself.                                                      |

Also deliberate: **Shiksha Mitras and instructors are staff too.** They
protested alongside regular teachers in 2024, and a platform that recognises
only permanent teachers would earn the same objection.

---

## 4. Officers — the "one more login" problem

An officer rejects a platform by ignoring it. The defence is that it produces
something they already owe somebody: `/v1/reports/schemes.csv` is the monthly
scheme-wise return, and the clearance queue is ranked by risk so ten minutes
spent on it is ten minutes well spent. See
[`teacher-adoption.md`](teacher-adoption.md).

---

## 5. Parents and the press

The question to answer is: _if the whole database were printed in a newspaper
tomorrow, would a child be harmed?_ Today the answer is no, and that is the
single most defensible position available.

Beyond that: the village page holds no personal data at all, shows only work an
officer has cleared, and exists only for schools the block office has confirmed.
Photographs are of the work rather than of faces, confirmed by three people who
know the school before anything leaves it.

---

## What is not done

Stated plainly, because a readiness document that claims completeness is worth
nothing:

- **No STQC certification and no CERT-In safe-to-host certificate.** Neither can
  be self-issued. Start both before the pilot.
- **No WCAG 2.1 AA audit evidence pack**, though the build is close.
- **No privacy notice screen, and no access/correct/erase flows.** Designed, not
  built. Required before real teachers' data is held.
- **No named grievance officer or Data Protection Officer.** An appointment, not
  a feature.
- **No DPIA.** Should be written now rather than when the Board asks.
- **No independent security audit.** The code has never been read by anybody
  outside this repository.
- **No integration with UDISE+, DIKSHA, Vidyanjali or Prerna.** The department
  will ask how this relates to systems it already runs, and "it does not" is a
  worse answer than a considered one. Vidyanjali in particular overlaps the
  needs board and should be linked to rather than duplicated.

## Suggested order

1. Privacy notice, data-principal rights, grievance officer. Nothing else is
   lawful without them once real data is held.
2. DPIA and the accessibility evidence pack — both are inputs to everything below.
3. CERT-In VAPT and safe-to-host. Long lead time; start early.
4. STQC certification.
5. A single-district pilot under a written agreement with the department.
6. Bulk UDISE import, so claiming becomes the exception rather than the norm.
