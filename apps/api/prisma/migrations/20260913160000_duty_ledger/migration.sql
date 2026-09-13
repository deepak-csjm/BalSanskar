-- Teaching days consumed by work that is not teaching.
--
-- The feature the teachers' associations asked for themselves: when the state's
-- committee on digital attendance met on 13 November 2025, the condition the
-- unions put first was release from non-academic work.
--
-- This is not a new instrument. UDISE+ already collects exactly this number, as
-- Data Capture Format field 3.3.25 in Part C of every teacher's profile. It is
-- self-declared once a year, aggregated to nothing and published nowhere. What
-- follows makes the same statutory field timely and legible, which is a far
-- safer thing to put in front of a Basic Shiksha Adhikari than a novel
-- measurement of their own department.
--
-- Two columns carry the design. `category` maps onto the three purposes s.27 of
-- the Right to Education Act permits — census, disaster relief and elections —
-- so the residue that fits none of them appears as a by-product of ordinary
-- record-keeping rather than as an allegation somebody has to make. And
-- `duringSchoolHours` records the fact an Allahabad High Court Division Bench
-- made decisive when it resolved contradictory single-judge orders: teachers may
-- be deployed on election work, but not on teaching days or in teaching hours.
-- Nothing anywhere records it today.
--
-- There is deliberately no column for the officer who issued the order. A
-- platform that names them is an accusation engine, and the district officer who
-- would have to publish it is personally exposed.
--
-- NOTE: `prisma migrate diff` again emits an ALTER on
-- "media_assets"."perceptualBits" dropping a default and setting bit(64). That
-- column is GENERATED ALWAYS and the statement fails. Struck out, as before.

-- CreateEnum
CREATE TYPE "DutyCategory" AS ENUM ('CENSUS', 'ELECTION', 'DISASTER_RELIEF', 'SURVEY', 'DATA_ENTRY', 'TRAINING', 'MEETING', 'PROVISIONING', 'OTHER');

-- CreateTable
CREATE TABLE "duty_records" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "category" "DutyCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "orderReference" TEXT,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "teachingDaysLost" INTEGER NOT NULL,
    "duringSchoolHours" BOOLEAN NOT NULL DEFAULT false,
    "honorariumDueRupees" INTEGER,
    "honorariumReceivedRupees" INTEGER,
    "note" TEXT,
    "attestedById" TEXT,
    "attestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "duty_records_schoolId_fromDate_idx" ON "duty_records"("schoolId", "fromDate");

-- CreateIndex
CREATE INDEX "duty_records_blockId_fromDate_idx" ON "duty_records"("blockId", "fromDate");

-- CreateIndex
CREATE INDEX "duty_records_districtId_fromDate_idx" ON "duty_records"("districtId", "fromDate");

-- CreateIndex
CREATE INDEX "duty_records_teacherId_fromDate_idx" ON "duty_records"("teacherId", "fromDate");

-- AddForeignKey
ALTER TABLE "duty_records" ADD CONSTRAINT "duty_records_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_records" ADD CONSTRAINT "duty_records_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_records" ADD CONSTRAINT "duty_records_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_records" ADD CONSTRAINT "duty_records_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_records" ADD CONSTRAINT "duty_records_attestedById_fkey" FOREIGN KEY ("attestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

