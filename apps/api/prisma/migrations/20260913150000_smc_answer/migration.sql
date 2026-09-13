-- The block's answer to what a School Management Committee asked for.
--
-- `raisedWithBlock` has existed since the village layer went in, and until now
-- it was a wish sent into a void: a committee of parents could record what it
-- asked the block office for, and nothing in the system could ever say the ask
-- had been met, refused, or even read.
--
-- A clock that cannot be stopped is not accountability, it is a grievance
-- counter. So the office that owes the answer now has a way to give one — in
-- writing, attributed, and dated — and the waiting board can tell an
-- outstanding request from a settled one.
--
-- NOTE for whoever generates the next migration: `prisma migrate diff` also
-- emits an ALTER on "media_assets"."perceptualBits" dropping a default and
-- setting the type to bit(64). That column is GENERATED ALWAYS from
-- "perceptualHash"; it has no default to drop and the statement fails. It is a
-- known artefact of diffing an Unsupported() column and it has been struck out
-- here. Expect it again next time.

ALTER TABLE "smc_meetings" ADD COLUMN     "answerNote" TEXT,
ADD COLUMN     "answeredAt" TIMESTAMP(3),
ADD COLUMN     "answeredById" TEXT;

-- What the block still owes, oldest first. Partial on the null answer because
-- the answered rows are the ones nobody needs to scan.
CREATE INDEX "smc_meetings_blockId_answeredAt_idx" ON "smc_meetings"("blockId", "answeredAt");

ALTER TABLE "smc_meetings" ADD CONSTRAINT "smc_meetings_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
