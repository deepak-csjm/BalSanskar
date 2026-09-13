-- The village's side of the school.
--
-- Everything before this migration serves a chain that runs teacher -> head
-- teacher -> block -> district. That chain is necessary and it is not
-- sufficient, because it contains nobody who lives in the village.
--
-- Three tables, and the reasoning for each is in
-- packages/shared/src/contracts/village.ts:
--
--   school_needs        what a school needs that a villager could provide.
--                       No money, no amounts, no pledges — a need is met when
--                       the head teacher says somebody turned up.
--
--   smc_meetings        that the School Management Committee met and what it
--                       decided. The RTE Act already requires the committee and
--                       its minutes; almost nowhere can the parents it is made
--                       of actually see them.
--
--   habitation_surveys  hamlets walked in search of children who are not in
--                       school. Uttar Pradesh has more of them than any other
--                       state. Counts only: the DPDP Act forbids tracking a
--                       child outright, and the school already holds the names
--                       lawfully in its own register.
--
-- Nothing here holds anything about a child, a parent or a villager's contact
-- details. See docs/data-protection.md.

-- CreateEnum
CREATE TYPE "NeedKind" AS ENUM ('MATERIAL', 'REPAIR', 'VOLUNTEER_TIME', 'EVENT_SUPPORT', 'ENROLMENT_HELP', 'OTHER');

-- CreateEnum
CREATE TYPE "NeedStatus" AS ENUM ('OPEN', 'PROMISED', 'MET', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "HabitationKind" AS ENUM ('VILLAGE', 'HAMLET', 'WARD', 'WORKSITE', 'MIGRANT_SETTLEMENT', 'OTHER');

-- DropIndex
DROP INDEX "activities_schemes_idx";

-- Prisma's diff wanted two more statements here and both were removed by hand.
--
-- It cannot model `media_assets.perceptualBits`, which is a PostgreSQL
-- generated column holding the bit form of the perceptual hash (see the
-- 20260912230000_phash_bits migration). Prisma sees `Unsupported("bit(64)")`,
-- concludes the column is wrong, and emits an ALTER that PostgreSQL refuses
-- outright — a generated column has no default to drop. The column is correct
-- as it stands; the diff is not. Expect to strike the same two lines out of any
-- future generated migration, or check `\d media_assets` if in doubt.

-- CreateTable
CREATE TABLE "school_needs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "kind" "NeedKind" NOT NULL,
    "status" "NeedStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "quantity" INTEGER,
    "classLevels" "ClassLevel"[],
    "helperCredit" TEXT,
    "metOn" DATE,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smc_meetings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "heldOn" DATE NOT NULL,
    "membersPresent" INTEGER NOT NULL,
    "parentsPresent" INTEGER NOT NULL,
    "womenPresent" INTEGER NOT NULL,
    "decisions" TEXT NOT NULL,
    "raisedWithBlock" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smc_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habitation_surveys" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "habitationName" TEXT NOT NULL,
    "kind" "HabitationKind" NOT NULL DEFAULT 'HAMLET',
    "surveyedOn" DATE NOT NULL,
    "householdsVisited" INTEGER NOT NULL,
    "childrenFound" INTEGER NOT NULL,
    "childrenEnrolled" INTEGER NOT NULL,
    "surveyedBy" TEXT NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habitation_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_needs_schoolId_status_idx" ON "school_needs"("schoolId", "status");

-- CreateIndex
CREATE INDEX "school_needs_blockId_status_idx" ON "school_needs"("blockId", "status");

-- CreateIndex
CREATE INDEX "school_needs_districtId_status_idx" ON "school_needs"("districtId", "status");

-- CreateIndex
CREATE INDEX "smc_meetings_schoolId_heldOn_idx" ON "smc_meetings"("schoolId", "heldOn");

-- CreateIndex
CREATE INDEX "smc_meetings_blockId_heldOn_idx" ON "smc_meetings"("blockId", "heldOn");

-- CreateIndex
CREATE INDEX "habitation_surveys_blockId_surveyedOn_idx" ON "habitation_surveys"("blockId", "surveyedOn");

-- CreateIndex
CREATE INDEX "habitation_surveys_districtId_surveyedOn_idx" ON "habitation_surveys"("districtId", "surveyedOn");

-- CreateIndex
CREATE UNIQUE INDEX "habitation_surveys_schoolId_habitationName_surveyedOn_key" ON "habitation_surveys"("schoolId", "habitationName", "surveyedOn");

-- AddForeignKey
ALTER TABLE "school_needs" ADD CONSTRAINT "school_needs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_needs" ADD CONSTRAINT "school_needs_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_needs" ADD CONSTRAINT "school_needs_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_needs" ADD CONSTRAINT "school_needs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smc_meetings" ADD CONSTRAINT "smc_meetings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smc_meetings" ADD CONSTRAINT "smc_meetings_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smc_meetings" ADD CONSTRAINT "smc_meetings_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smc_meetings" ADD CONSTRAINT "smc_meetings_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitation_surveys" ADD CONSTRAINT "habitation_surveys_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitation_surveys" ADD CONSTRAINT "habitation_surveys_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitation_surveys" ADD CONSTRAINT "habitation_surveys_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitation_surveys" ADD CONSTRAINT "habitation_surveys_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "class_enrolments_school_class" RENAME TO "class_enrolments_schoolId_classLevel_key";

