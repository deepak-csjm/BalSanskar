-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('NEW', 'STANDARD', 'TRUSTED', 'WATCH');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClearanceState" AS ENUM ('NOT_REQUIRED', 'AWAITING_ATTESTATION', 'AWAITING_BLOCK', 'AUTO_CLEARED', 'CLEARED', 'RETURNED');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "attestationNote" TEXT,
ADD COLUMN     "attestedAt" TIMESTAMP(3),
ADD COLUMN     "attestedById" TEXT,
ADD COLUMN     "clearance" "ClearanceState" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "clearanceNote" TEXT,
ADD COLUMN     "clearanceTarget" "VisibilityLevel",
ADD COLUMN     "clearedAt" TIMESTAMP(3),
ADD COLUMN     "clearedById" TEXT,
ADD COLUMN     "riskFlags" TEXT[],
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "perceptualHash" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "clearedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReturnedAt" TIMESTAMP(3),
ADD COLUMN     "returnedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "trustTier" "TrustTier" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "school_claims" (
    "id" TEXT NOT NULL,
    "udiseCode" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "schoolId" TEXT,
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "proposedNameHi" TEXT NOT NULL,
    "proposedNameEn" TEXT,
    "proposedType" "SchoolType" NOT NULL DEFAULT 'PRIMARY',
    "villageOrWard" TEXT,
    "claimantName" TEXT NOT NULL,
    "claimantPhone" TEXT NOT NULL,
    "claimantDesignation" TEXT,
    "claimantEmployeeCode" TEXT,
    "evidenceKey" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_claims_blockId_status_idx" ON "school_claims"("blockId", "status");

-- CreateIndex
CREATE INDEX "school_claims_districtId_status_idx" ON "school_claims"("districtId", "status");

-- CreateIndex
CREATE INDEX "school_claims_udiseCode_idx" ON "school_claims"("udiseCode");

-- CreateIndex
CREATE INDEX "school_claims_claimantPhone_idx" ON "school_claims"("claimantPhone");

-- CreateIndex
CREATE INDEX "activities_blockId_clearance_riskScore_idx" ON "activities"("blockId", "clearance", "riskScore");

-- CreateIndex
CREATE INDEX "media_assets_perceptualHash_idx" ON "media_assets"("perceptualHash");

-- CreateIndex
CREATE INDEX "schools_status_idx" ON "schools"("status");

-- AddForeignKey
ALTER TABLE "school_claims" ADD CONSTRAINT "school_claims_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_claims" ADD CONSTRAINT "school_claims_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_claims" ADD CONSTRAINT "school_claims_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_claims" ADD CONSTRAINT "school_claims_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_attestedById_fkey" FOREIGN KEY ("attestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_clearedById_fkey" FOREIGN KEY ("clearedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
