-- The register of orders, and the answer a school can give back.
--
-- A UP basic education order is issued in Lucknow, addressed to District Basic
-- Shiksha Adhikaris — never to a school — and reaches the classroom through
-- WhatsApp groups the state project office itself instituted. That channel has
-- no addressing, no versioning, no acknowledgement and no audit trail, and
-- forged orders bearing officers' signatures travel through it alongside real
-- ones. A Block Education Officer in Bareilly once ordered every school to
-- supply 46 kg of fodder under threat of departmental action; the correction
-- mechanism was viral outrage, after which the BSA confirmed no government
-- order existed.
--
-- Three columns carry the design. `letterNumberNormalised` is what an
-- authenticity lookup matches on, so a head teacher holding a photographed
-- letter can ask whether it corresponds to anything real. `source` gives an
-- instruction a rank, which it currently arrives without. And `supersedesId`
-- is unique, so the chain is a chain: exactly one order may replace any given
-- order, and a school sees one current instruction instead of three
-- contradictory photocopies.
--
-- The response table is an acknowledgement and not a compliance score.
-- `blockedReason` has no value meaning "we did not get round to it", and that
-- absence is the point: when the state conceded a grace period on digital
-- attendance in July 2024 it made the concession conditional on the teacher
-- typing a justification into the system judging them, and the protest
-- continued until the system was withdrawn.
--
-- NOTE: the usual bogus ALTER on "media_assets"."perceptualBits" has been
-- struck out again. It is GENERATED ALWAYS and has no default to drop.

-- CreateEnum
CREATE TYPE "DirectiveSource" AS ENUM ('COURT_DIRECTION', 'STATE_ORDER', 'DISTRICT_ORDER', 'BLOCK_INSTRUCTION');

-- CreateEnum
CREATE TYPE "DirectiveStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ResponseState" AS ENUM ('SEEN', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "BlockedReason" AS ENUM ('FUNDS_NOT_RECEIVED', 'MATERIAL_NOT_RECEIVED', 'STAFF_SHORTAGE', 'BUILDING_OR_FACILITY_UNUSABLE', 'NO_INSTRUCTION_RECEIVED', 'CONFLICTS_WITH_ANOTHER_ORDER', 'OTHER');

-- CreateTable
CREATE TABLE "directives" (
    "id" TEXT NOT NULL,
    "source" "DirectiveSource" NOT NULL,
    "status" "DirectiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "letterNumber" TEXT NOT NULL,
    "letterNumberNormalised" TEXT NOT NULL,
    "issuedOn" DATE NOT NULL,
    "issuingOffice" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plainSummary" TEXT NOT NULL,
    "documentUrl" TEXT,
    "dueBy" DATE,
    "schoolTypes" "SchoolType"[],
    "districtId" TEXT,
    "blockId" TEXT,
    "supersedesId" TEXT,
    "publishedById" TEXT NOT NULL,
    "publishedByOffice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directive_responses" (
    "id" TEXT NOT NULL,
    "directiveId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "state" "ResponseState" NOT NULL,
    "blockedReason" "BlockedReason",
    "note" TEXT,
    "respondedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directive_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "directives_supersedesId_key" ON "directives"("supersedesId");

-- CreateIndex
CREATE INDEX "directives_letterNumberNormalised_idx" ON "directives"("letterNumberNormalised");

-- CreateIndex
CREATE INDEX "directives_status_issuedOn_idx" ON "directives"("status", "issuedOn");

-- CreateIndex
CREATE INDEX "directives_districtId_status_idx" ON "directives"("districtId", "status");

-- CreateIndex
CREATE INDEX "directives_blockId_status_idx" ON "directives"("blockId", "status");

-- CreateIndex
CREATE INDEX "directive_responses_directiveId_state_idx" ON "directive_responses"("directiveId", "state");

-- CreateIndex
CREATE INDEX "directive_responses_schoolId_idx" ON "directive_responses"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "directive_responses_directiveId_schoolId_key" ON "directive_responses"("directiveId", "schoolId");

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "directives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directive_responses" ADD CONSTRAINT "directive_responses_directiveId_fkey" FOREIGN KEY ("directiveId") REFERENCES "directives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directive_responses" ADD CONSTRAINT "directive_responses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directive_responses" ADD CONSTRAINT "directive_responses_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directive_responses" ADD CONSTRAINT "directive_responses_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directive_responses" ADD CONSTRAINT "directive_responses_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

