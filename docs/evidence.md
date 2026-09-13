# What the design rests on

Most of this platform's design decisions were, until this point, reasoning.
Reasoning about Uttar Pradesh basic education by someone who has never stood in
one of its schools is worth something, but it is not worth what it was being
treated as. This document records what was actually established, what changed
because of it, what remains unverified, and which claims must not be repeated
as fact until somebody checks them.

A note on method, because it bears on how much weight to give any of this.
Eight parallel research agents each took one angle, searched in Hindi and
English, and returned findings with retrieved URLs; a ninth read all of it
adversarially and named what was missing, weak or contradictory. It is
desk research. Not one teacher, head teacher or officer has been spoken to.

## The findings that changed the code

### Teachers refused a digital instrument at scale, and it is documented

Digital teacher attendance became compulsory on 8 July 2024 via a Digital
Register module on the Prerna portal — face recognition on department tablets,
geofenced to the school, check-in and check-out capturing time and location, in
a fifteen-minute window between 07:45 and 08:00 with lateness counted as
absence and leave deducted.

About **2 per cent of roughly 6.09 lakh teachers** complied on day one.
`#boycottonlineattendance` trended; teachers wore black armbands. The
department offered a thirty-minute grace period _conditional on the teacher
recording a reason for lateness_, which failed to stop anything, and the
Chief Secretary suspended the system on 16–17 July.

- [Business Standard](https://www.business-standard.com/india-news/up-online-attendance-for-teachers-up-digital-attendance-system-for-teachers-launched-on-july-8-suspended-124071700465_1.html)
  · [The Week](https://www.theweek.in/news/india/2024/07/16/up-govt-backs-off-from-digital-attendance-for-teachers-after-protests.html)
  · [Outlook](https://www.outlookindia.com/education/up-primary-teachers-boycott-online-attendance-basic-education-department-trending-x)
  · [Careers360, on the grace period](https://news.careers360.com/uttar-pradesh-school-teachers-campaign-online-against-digital-attendance-basic-education-department-allows-30-minute-relaxation)

**What changed.** `PLATFORM_GUARANTEES` and `FORBIDDEN_FEATURES` were written,
tested, and put on a public screen at `/vachan`. The failed concession is the
sharper lesson of the two and is now a rule: never ask a teacher to explain a
shortfall in a box an officer will read. Nothing on the waiting board asks for
a justification, and nothing there produces a consequence.

_Caveat worth carrying:_ only 2,09,863 tablets had been supplied and OTPs were
reportedly not reaching SIMs, so part of the 98 per cent is non-provisioning
rather than refusal. Do not quote the figure as pure collective veto.

### The objection was asymmetry, not measurement

The unions' demand was that the instrument be applied to the state secretariat
first. At the department's own committee on 13 November 2025 they tabled twelve
conditions; eleven were about workload and entitlement, and the first was
release from non-academic work.

- [ThePrint](https://theprint.in/india/necessary-or-too-harsh-whats-behind-the-govt-teacher-tussle-over-ups-digital-attendance-rule/2178424/)

**What changed.** The waiting board (`/v1/waiting`) and the response-times
report. This platform puts three offices in the path of a teacher's work and
was timing only the teacher. It now times the offices, names the office rather
than the individual, and shows an officer their own backlog first.

### Salary withholding is the department's routine first instrument

Applied in bulk, and often to head teachers collectively for data-compliance
failures no individual caused — reported across Moradabad, Mahoba, Azamgarh and
Farrukhabad. The department has itself had to circulate orders reminding Block
Education Officers that they have no power to withhold salary or issue notices
directly.

- [Amar Ujala, Azamgarh](https://www.amarujala.com/uttar-pradesh/azamgarh/119-teachers-found-absent-during-inspection-salaries-withheld-azamgarh-news-c-258-1-svns1002-156988-2026-09-12)

**What changed.** Nothing that lands on the head teacher's attestation step may
carry an aggregate score a district can be ranked on. Asserted in
`guarantees.ts` and tested in `duty.test.ts` and `integrity.test.ts`.

### The law protects teaching days and hours, not teachers

Section 27 of the RTE Act permits exactly three non-educational deployments:
decennial census, disaster relief, and elections. An Allahabad High Court
Division Bench, resolving contradictory single-judge orders, held that teachers
**can** be deployed on election work including electoral-roll revision before
poll notification, but **not on teaching days or during teaching hours**.
_Surya Pratap Singh v State of U.P._ (2025:AHC:19804, 11 February 2025) makes
BLO deployment of teachers a last resort conditional on exhausting other ECI
Guideline 1.2 categories.

- [RTE s.27](https://indiankanoon.org/doc/65091223/)
  · [Division Bench](https://www.livelaw.in/news-updates/rte-act-teachers-can-be-given-election-duties-issuance-notification-non-teaching-days-hours-allahabad-high-court-206646)
  · [Surya Pratap Singh](https://indiankanoon.org/doc/124088187/)

**What changed.** The duty ledger records `duringSchoolHours` — the fact the
judgment turns on and which nothing currently records anywhere — and classifies
each duty against the three purposes the Act names, so the residue is visible
without anybody having to allege anything. There is deliberately no column for
the officer who issued the order.

### The duty count is not a new instrument

UDISE+ already collects "Working days spent on NON-Teaching Assignments" as
Data Capture Format field 3.3.25, in Part C of every teacher's profile. It is
self-declared once a year, aggregated to nothing and published nowhere. NIEPA's
2018 national study measured government teachers spending 19.1 per cent of
annual school hours teaching.

**What changed.** The framing, which matters more than the code. The ledger
claims to make an existing statutory measure timely and evidenced, not to
invent a measurement of the department. That is the difference between a
feature a Basic Shiksha Adhikari can accept and one they must resist.

### Orders travel by WhatsApp, and forgeries travel with them

WhatsApp is an officially instituted channel, ordered from the state project
office — with no addressing, versioning, acknowledgement or audit trail.
Forged orders bearing officers' signatures circulate through the same pipe. A
Block Education Officer once ordered every school in Bareilly to supply 46 kg
of fodder, with departmental action threatened for negligence; the correction
mechanism was viral outrage, after which the BSA confirmed no government order
existed.

- [Amar Ujala, Bareilly](https://www.amarujala.com/uttar-pradesh/bareilly/beo-summoned-who-issued-order-to-procure-fodder-in-bareilly-2026-05-29)
  · [Caravan, on the bureaucracy](https://caravanmagazine.in/perspectives/post-office-state-education-bureaucratic)

**Not yet built.** Order authenticity is the strongest remaining candidate: a
pure service with no measurement in it, nothing for the state to lose by
endorsing it, and immediate value to a head teacher holding a photographed
letter. It must verify and never originate, or the Directorate will read it as
an unofficial order channel.

### Enrolment numbers on a public page are not neutral

The June 2025 school pairing order was implemented on data so wrong that the
High Court found schools above the threshold on the merger list; the policy was
paused after protests and litigation, not after any internal check. Teachers
read a low public headcount as a merger trigger and a threat to their post.

- [The Week](https://www.theweek.in/news/india/2025/08/06/up-government-pauses-school-mergers-what-went-wrong-with-the-transformative-initiative.html)
  · [The Wire](https://m.thewire.in/article/education/up-school-merger-sparks-protests-across-state-opposition-parties-unions-demand-rollback)

**What changed.** The village page no longer opens with a headcount. It opens
with what the village can actually do. The register is still there — a dated
figure the school controls is what makes a wrong merger list contestable — but
as a line in context, next to a link to the department's own UDISE+ record
rather than a restatement of it.

### The DPDP fork, which is a trap dressed as a shortcut

Section 7(b) lets the State and its instrumentalities process personal data
without consent to deliver a benefit, and s.17(4) removes the right to erasure
where processing is by the State or its instrumentality. The only State
exemption in s.17(2)(a) runs to instrumentalities individually notified — there
is none available to a private platform serving government schools.

- [DPDP s.7](https://www.dpdpa.com/dpdpa2023/chapter-2/section7.html)
  · [s.17 exemptions](https://www.apnilaw.com/bare-act/dpdp/section-17-digital-personal-data-protection-act-dpdp-exemptions/)
  · [Rules commencement](https://www.amsshardul.com/insight/enforcement-of-the-dpdp-act-and-notification-of-the-dpdp-rules/)

**The consequence to hold on to.** Becoming the department's processor will be
proposed as a win — consent friction disappears, adoption is guaranteed. It
would silently void promise 7, teachers would lose the ability to withdraw
their own record, and it is close to irreversible. It belongs in the
"conversation, not a pull request" register.

## What is NOT verified, and must not be repeated as fact

1. **The Jaunpur randomised trial.** Reportedly Banerjee, Banerji, Duflo,
   Glennerster and Khemani, run in Uttar Pradesh, reportedly finding that
   informing communities about the village education committee and publishing
   report cards moved nothing — not participation, not teacher effort, not
   learning — while an arm that trained volunteers to run reading camps did
   move reading. **Unsourced in this research, and two attempts to retrieve it
   in-session were blocked by the network.** If it holds, it is the single
   strongest challenge to the village page's theory of change, and the
   conclusion is that a public page must terminate in something a reader can
   do rather than in a dashboard. The page was reordered on that basis, which
   is defensible on the merger-fear finding alone — but nobody should quote the
   trial until they have read it. **First search to run.**
2. **The composite grant as a PFMS spending limit.** The strongest single
   mechanism in the whole corpus: the grant reportedly arrives as a spending
   limit against a zero-balance SMC account and is explicitly invisible in the
   school passbook. If true, "the money did not arrive" is very often "I cannot
   see whether it arrived", the state's utilisation shortfall has a visibility
   cause, and the right field is not _did the money come_ but _did the limit
   appear, on what date, and what happened next_. Rests on practitioner
   guidance, not an order. **Verify with one head teacher before building.**
3. **Kayakalp saturation.** Four irreconcilable figures circulate — 76.3%,
   81%, 96.3%, 97%. Do not quote any of them.
4. **Whether the grant problem is non-arrival or non-visibility.** The
   evidence points both ways; see 2.
5. **Bulk salary-withholding cases.** Each is single-sourced within one
   teacher-press ecosystem. The pattern repeats across enough districts to be
   believed as a pattern; no individual case should be cited alone.
6. **Several UP-specific order numbers** rest on teacher-press aggregation
   rather than the orders themselves. Publishing a misattributed order number
   would hand officials a reason to dismiss everything else.

## What nobody researched, and should

- **The UP Assembly election due in early 2027**, and what a model code of
  conduct does to a platform whose workflow contains two government officers.
  It freezes partnerships, orders and publicity.
- **Who actually reads the village page.** Every angle analysed supply. Nobody
  characterised the audience: rural adult and female literacy, smartphone
  ownership among parents of parishadiya children, data cost.
- **Any Indian state education system teachers voluntarily use.** The corpus is
  an exhaustive catalogue of failure and contains zero success cases. That is
  either a gap in the research or the most important finding in it.
- **Shiksha mitras and anudeshaks as users**, not as a caution. Roughly 1.43
  lakh of them, in the same buildings, on a fraction of the pay, and the most
  aggrieved group in the building. The platform's role model does not
  distinguish them.
- **How photo-based school reporting is actually gamed in India.** The
  integrity design is engineered from first principles, not from observed
  fabrication patterns.
- **Who pays.** Promise 11 says never a teacher, school, parent or village,
  which means somebody else funds 130,000 schools of storage and support. The
  conditions attached to that money are unexamined.
- **The name.** Nobody checked whether "BalSanskar" collides with an existing
  programme, or how it reads to Urdu-medium parishadiya schools and to a
  teachers' union. In this state the word carries freight worth checking before
  a launch, not after.

## Using this document

When a design decision here is questioned, the honest answer is one of three:
it is sourced above; it is on the unverified list; or it is reasoning and
should be labelled as such. Adding a fourth kind of answer — confident
assertion from nowhere — is how the earlier version of `child-safety.md` came
to describe a consent ledger that had been deleted months before.
