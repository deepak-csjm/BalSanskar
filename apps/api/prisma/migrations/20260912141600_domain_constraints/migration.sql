-- Constraints and indexes that the Prisma schema language cannot express.
--
-- Each one enforces a rule the application also checks. The database copy is
-- the one that holds when two requests race, when a background job misbehaves,
-- or when someone runs an ad-hoc UPDATE against production.

-- Exactly one consent decision is in force per child at any time.
CREATE UNIQUE INDEX "media_consents_one_current_per_student"
  ON "media_consents" ("studentId")
  WHERE "isCurrent" = true;

-- A revoked consent must carry the moment it was revoked, and a live one must not.
ALTER TABLE "media_consents"
  ADD CONSTRAINT "media_consents_revocation_coherent"
  CHECK (("status" = 'REVOKED') = ("revokedAt" IS NOT NULL));

-- Published activities always carry a publication timestamp and a reviewer.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_published_has_review"
  CHECK (
    "status" <> 'PUBLISHED'
    OR ("publishedAt" IS NOT NULL AND "reviewedById" IS NOT NULL)
  );

-- A rejection without a reason is the single most common way to lose a teacher's
-- goodwill, so the database refuses to store one.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_rejected_has_reason"
  CHECK ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL);

-- Participant counts are counts.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_participant_count_non_negative"
  CHECK ("participantCount" IS NULL OR "participantCount" >= 0);

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_appreciation_count_non_negative"
  CHECK ("appreciationCount" >= 0);

-- Phone numbers are stored in one canonical form so that they can identify an
-- account. Anything else is a bug upstream and is refused here.
ALTER TABLE "users"
  ADD CONSTRAINT "users_phone_e164_india"
  CHECK ("phone" ~ '^\+91[6-9][0-9]{9}$');

ALTER TABLE "schools"
  ADD CONSTRAINT "schools_udise_11_digits"
  CHECK ("udiseCode" ~ '^[0-9]{11}$');

-- Achievement positions start at first place.
ALTER TABLE "achievements"
  ADD CONSTRAINT "achievements_position_positive"
  CHECK ("position" IS NULL OR "position" >= 1);

-- Case-insensitive prefix search over names, which is how the school and
-- student pickers are actually used ("type the first few letters").
-- A pg_trgm GIN index would additionally serve infix search; it is left out so
-- that the migration needs no superuser rights on a managed database.
CREATE INDEX "schools_name_hi_lower_idx" ON "schools" (lower("nameHi") text_pattern_ops);
CREATE INDEX "schools_name_en_lower_idx" ON "schools" (lower("nameEn") text_pattern_ops);
CREATE INDEX "students_name_lower_idx" ON "students" (lower("fullName") text_pattern_ops);
CREATE INDEX "users_name_lower_idx" ON "users" (lower("fullName") text_pattern_ops);
CREATE INDEX "activities_title_lower_idx" ON "activities" (lower("title") text_pattern_ops);

-- The public showcase reads exactly one slice of the activities table on every
-- request; give it a dedicated covering index.
CREATE INDEX "activities_public_feed_idx"
  ON "activities" ("publishedAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "visibility" = 'PUBLIC';
