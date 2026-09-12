-- Constraints for the escalation gate.
--
-- The application enforces each of these with a better error message. These are
-- the copies that hold when two requests race, or when someone runs an ad-hoc
-- UPDATE against production.

-- ---------------------------------------------------------------------------
-- Backfill first.
--
-- Activities already published above school level were approved under the
-- previous rules, when a head teacher's sign-off was the only gate. An
-- attestation cannot be obtained retrospectively, so they are grandfathered as
-- cleared and attributed to whoever reviewed them, with a note saying so. The
-- alternative — pulling every school's published work back to school
-- visibility on the day of the upgrade — would be a worse thing to do to the
-- schools than the imperfect record this leaves.
-- ---------------------------------------------------------------------------

UPDATE "activities"
SET
  "clearance"       = 'CLEARED',
  "clearanceTarget" = "visibility",
  "attestedById"    = COALESCE("attestedById", "reviewedById"),
  "attestedAt"      = COALESCE("attestedAt", "reviewedAt", "publishedAt"),
  "attestationNote" = COALESCE(
    "attestationNote",
    'Cleared under the rules in force before block clearance was introduced.'
  ),
  "clearedById"     = COALESCE("clearedById", "reviewedById"),
  "clearedAt"       = COALESCE("clearedAt", "reviewedAt", "publishedAt"),
  "clearanceNote"   = COALESCE("clearanceNote", 'Grandfathered at upgrade.')
WHERE "visibility" <> 'SCHOOL'
  AND "clearance" = 'NOT_REQUIRED';

-- A grandfathered row with no reviewer at all cannot satisfy the attribution
-- constraints; there is nothing truthful to put in those columns, so it goes
-- back to school visibility, which is the safe direction.
UPDATE "activities"
SET "visibility" = 'SCHOOL',
    "clearance"  = 'NOT_REQUIRED',
    "clearanceTarget" = NULL,
    "attestedById" = NULL,
    "attestedAt" = NULL,
    "clearedById" = NULL,
    "clearedAt" = NULL
WHERE "visibility" <> 'SCHOOL'
  AND ("attestedById" IS NULL OR "clearedById" IS NULL);

-- Reflect the grandfathered history in each school's trust counters, so the
-- sampling rate starts from what the school has actually done rather than
-- treating every existing school as brand new.
UPDATE "schools" s
SET "clearedCount" = sub.n,
    "trustTier" = CASE
      WHEN sub.n >= 20 THEN 'TRUSTED'::"TrustTier"
      WHEN sub.n >= 5  THEN 'STANDARD'::"TrustTier"
      ELSE 'NEW'::"TrustTier"
    END
FROM (
  SELECT "schoolId", count(*)::int AS n
  FROM "activities"
  WHERE "clearance" = 'CLEARED'
  GROUP BY "schoolId"
) sub
WHERE s.id = sub."schoolId";

-- An activity is never visible above the level that has actually been cleared.
-- SCHOOL needs no clearance; anything wider must be CLEARED or AUTO_CLEARED.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_visibility_within_clearance"
  CHECK (
    "visibility" = 'SCHOOL'
    OR "clearance" IN ('CLEARED', 'AUTO_CLEARED')
  );

-- Anything that left the school carries the head teacher's attestation.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_escalated_is_attested"
  CHECK (
    "clearance" NOT IN ('AWAITING_BLOCK', 'AUTO_CLEARED', 'CLEARED')
    OR ("attestedById" IS NOT NULL AND "attestedAt" IS NOT NULL)
  );

-- A block officer's decision names the officer and the moment.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_clearance_decision_attributed"
  CHECK (
    "clearance" NOT IN ('CLEARED', 'RETURNED')
    OR ("clearedById" IS NOT NULL AND "clearedAt" IS NOT NULL)
  );

-- Sending work back without saying why is the fastest way to lose a school.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_returned_has_note"
  CHECK ("clearance" <> 'RETURNED' OR "clearanceNote" IS NOT NULL);

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_risk_score_non_negative"
  CHECK ("riskScore" >= 0);

-- Trust counters are counts.
ALTER TABLE "schools"
  ADD CONSTRAINT "schools_trust_counters_non_negative"
  CHECK ("clearedCount" >= 0 AND "returnedCount" >= 0);

-- One live claim per UDISE code at a time, so two people cannot both be
-- mid-claim on the same school. A resolved claim leaves the code free again.
CREATE UNIQUE INDEX "school_claims_one_pending_per_udise"
  ON "school_claims" ("udiseCode")
  WHERE "status" = 'PENDING';

ALTER TABLE "school_claims"
  ADD CONSTRAINT "school_claims_udise_11_digits"
  CHECK ("udiseCode" ~ '^[0-9]{11}$');

ALTER TABLE "school_claims"
  ADD CONSTRAINT "school_claims_phone_e164_india"
  CHECK ("claimantPhone" ~ '^\+91[6-9][0-9]{9}$');

-- A resolved claim names who resolved it.
ALTER TABLE "school_claims"
  ADD CONSTRAINT "school_claims_decision_attributed"
  CHECK (
    "status" NOT IN ('VERIFIED', 'REJECTED')
    OR ("reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  );

-- A verified claim points at the school it resolved to.
ALTER TABLE "school_claims"
  ADD CONSTRAINT "school_claims_verified_has_school"
  CHECK ("status" <> 'VERIFIED' OR "schoolId" IS NOT NULL);

-- The duplicate-photograph check reads this on every upload, over the whole
-- table. Give it its own index rather than scanning.
CREATE INDEX "media_assets_phash_lookup"
  ON "media_assets" ("perceptualHash")
  WHERE "perceptualHash" IS NOT NULL;
