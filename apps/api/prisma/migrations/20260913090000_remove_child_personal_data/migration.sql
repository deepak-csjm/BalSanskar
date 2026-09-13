-- Remove every piece of personal data about a child.
--
-- See docs/data-protection.md for the reasoning. In short: the DPDP Act treats
-- anyone under eighteen as a child, "verifiable" parental consent is a standard
-- this platform cannot honestly meet across 130,000 schools, and the entire
-- benefit purchased by that risk was printing a given name under a photograph.
--
-- This migration is destructive and deliberately so. It drops names, guardian
-- contact details, scanned consent slips and the link between a child and an
-- activity. Nothing here can be recovered afterwards, which is the point: a
-- backup of this table is the same liability as the table.
--
-- What survives is what the department actually reports on — how many children
-- are on the register, how many took part, which class, which school.

-- 1. Enrolment counts, replacing the roster. -------------------------------
CREATE TABLE "class_enrolments" (
  "id"         TEXT NOT NULL,
  "schoolId"   TEXT NOT NULL,
  "classLevel" "ClassLevel" NOT NULL,
  "enrolled"   INTEGER NOT NULL,
  "asOn"       DATE NOT NULL,
  "updatedById" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "class_enrolments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_enrolments_enrolled_sane" CHECK ("enrolled" >= 0 AND "enrolled" <= 1000)
);

CREATE UNIQUE INDEX "class_enrolments_school_class" ON "class_enrolments" ("schoolId", "classLevel");

ALTER TABLE "class_enrolments"
  ADD CONSTRAINT "class_enrolments_schoolId_fkey" FOREIGN KEY ("schoolId")
  REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_enrolments"
  ADD CONSTRAINT "class_enrolments_updatedById_fkey" FOREIGN KEY ("updatedById")
  REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Carry across what the roster was actually being used for: the count. Done
-- before the drop so a live deployment does not lose its over-counting check.
INSERT INTO "class_enrolments" ("id", "schoolId", "classLevel", "enrolled", "asOn", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "schoolId",
  "classLevel",
  COUNT(*),
  CURRENT_DATE,
  CURRENT_TIMESTAMP
FROM "students"
WHERE "isActive" = true
GROUP BY "schoolId", "classLevel";

-- 2. Achievements detach from the child and attach to the class. -----------
ALTER TABLE "achievements" ADD COLUMN "classLevel" "ClassLevel";
ALTER TABLE "achievements" ADD COLUMN "childrenRecognised" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "achievements" ADD COLUMN "creditedTeacherId" TEXT;

UPDATE "achievements" a
SET "classLevel" = s."classLevel"
FROM "students" s
WHERE a."studentId" = s."id";

-- Anything that cannot be resolved to a class is not worth keeping a child's
-- record for; there is no correct class to guess.
DELETE FROM "achievements" WHERE "classLevel" IS NULL;
ALTER TABLE "achievements" ALTER COLUMN "classLevel" SET NOT NULL;

ALTER TABLE "achievements" DROP CONSTRAINT IF EXISTS "achievements_studentId_fkey";
ALTER TABLE "achievements" DROP COLUMN "studentId";
ALTER TABLE "achievements"
  ADD CONSTRAINT "achievements_creditedTeacherId_fkey" FOREIGN KEY ("creditedTeacherId")
  REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "achievements_classLevel_idx" ON "achievements" ("classLevel");

-- 3. Photographs answer a different question now. --------------------------
-- Was consent on file for every child in the frame  ->  is any child
-- identifiable in the frame at all. The old answer cannot be translated into
-- the new one, so nothing is carried over: every existing photograph goes back
-- through a human before it can travel again.
ALTER TABLE "activity_media" RENAME COLUMN "consentVerified" TO "noIdentifiableChild";
ALTER TABLE "activity_media" RENAME COLUMN "consentVerifiedAt" TO "noIdentifiableChildAt";
ALTER TABLE "activity_media" ALTER COLUMN "noIdentifiableChild" SET DEFAULT false;
UPDATE "activity_media" SET "noIdentifiableChild" = false, "noIdentifiableChildAt" = NULL;

-- 4. The child's data itself. ----------------------------------------------
DROP TABLE IF EXISTS "media_consents";
DROP TABLE IF EXISTS "activity_students";
DROP TABLE IF EXISTS "students";

DROP TYPE IF EXISTS "ConsentStatus";
DROP TYPE IF EXISTS "ConsentMethod";
DROP TYPE IF EXISTS "Gender";

-- 5. Scheme tagging, so a block officer's monthly return assembles itself. --
CREATE TYPE "Scheme" AS ENUM (
  'NIPUN_BHARAT', 'READING_CAMPAIGN', 'PM_POSHAN', 'KAYAKALP', 'MISSION_SHAKTI',
  'SWACHH_VIDYALAYA', 'SCHOOL_CHALO', 'DIGITAL_LEARNING', 'KHELO_AND_HEALTH',
  'SCIENCE_AND_MATH', 'COMMUNITY_PARTICIPATION', 'TEACHER_DEVELOPMENT', 'NONE'
);
ALTER TABLE "activities" ADD COLUMN "schemes" "Scheme"[] NOT NULL DEFAULT ARRAY[]::"Scheme"[];
CREATE INDEX "activities_schemes_idx" ON "activities" USING GIN ("schemes");
