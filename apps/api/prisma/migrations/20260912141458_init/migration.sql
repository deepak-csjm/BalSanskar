-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_ADMIN', 'BLOCK_ADMIN', 'PRINCIPAL', 'TEACHER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('PRIMARY', 'UPPER_PRIMARY', 'COMPOSITE', 'KASTURBA_GANDHI', 'OTHER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ClassLevel" AS ENUM ('BALVATIKA', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5', 'CLASS_6', 'CLASS_7', 'CLASS_8');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('CLASSROOM_INNOVATION', 'LEARNING_OUTCOME', 'SPORTS', 'ARTS_AND_CULTURE', 'SCIENCE_AND_MATH', 'READING_AND_LIBRARY', 'COMMUNITY_ENGAGEMENT', 'INFRASTRUCTURE_IMPROVEMENT', 'HEALTH_AND_NUTRITION', 'DIGITAL_LEARNING', 'TEACHER_DEVELOPMENT', 'ENROLMENT_DRIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('SCHOOL', 'BLOCK', 'DISTRICT', 'STATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('ACADEMIC', 'SPORTS', 'ARTS', 'SCIENCE', 'LITERATURE', 'SOCIAL_SERVICE', 'ATTENDANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "AchievementLevel" AS ENUM ('SCHOOL', 'CLUSTER', 'BLOCK', 'DISTRICT', 'STATE', 'NATIONAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'DENIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('PAPER_FORM', 'VERBAL_IN_PERSON', 'DIGITAL_SELF_SERVE');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'REGISTRATION', 'PHONE_CHANGE');

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "division" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "udiseCode" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "nameEn" TEXT,
    "type" "SchoolType" NOT NULL DEFAULT 'PRIMARY',
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "villageOrWard" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TEACHER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "designation" TEXT,
    "employeeCode" TEXT,
    "schoolId" TEXT,
    "blockId" TEXT,
    "districtId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "statusReason" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "mustSetPassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "classLevel" "ClassLevel" NOT NULL,
    "section" TEXT,
    "rollNumber" TEXT,
    "gender" "Gender" NOT NULL,
    "birthYear" INTEGER,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_consents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "method" "ConsentMethod" NOT NULL,
    "guardianName" TEXT NOT NULL,
    "guardianRelation" TEXT,
    "documentKey" TEXT,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "media_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "learningOutcome" TEXT,
    "category" "ActivityCategory" NOT NULL,
    "occurredOn" DATE NOT NULL,
    "classLevels" "ClassLevel"[],
    "participantCount" INTEGER,
    "tags" TEXT[],
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "VisibilityLevel" NOT NULL DEFAULT 'SCHOOL',
    "requestedVisibility" "VisibilityLevel",
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "appreciationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "uploadedById" TEXT NOT NULL,
    "schoolId" TEXT,
    "attachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_media" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "consentVerified" BOOLEAN NOT NULL DEFAULT false,
    "consentVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_students" (
    "activityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_students_pkey" PRIMARY KEY ("activityId","studentId")
);

-- CreateTable
CREATE TABLE "appreciations" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appreciations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "level" "AchievementLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "awardedOn" DATE NOT NULL,
    "position" INTEGER,
    "organiser" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "schoolId" TEXT,
    "blockId" TEXT,
    "districtId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "districts_code_key" ON "districts"("code");

-- CreateIndex
CREATE INDEX "districts_nameEn_idx" ON "districts"("nameEn");

-- CreateIndex
CREATE INDEX "blocks_districtId_idx" ON "blocks"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_districtId_code_key" ON "blocks"("districtId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "schools_udiseCode_key" ON "schools"("udiseCode");

-- CreateIndex
CREATE INDEX "schools_blockId_idx" ON "schools"("blockId");

-- CreateIndex
CREATE INDEX "schools_districtId_idx" ON "schools"("districtId");

-- CreateIndex
CREATE INDEX "schools_nameHi_idx" ON "schools"("nameHi");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_schoolId_idx" ON "users"("schoolId");

-- CreateIndex
CREATE INDEX "users_blockId_idx" ON "users"("blockId");

-- CreateIndex
CREATE INDEX "users_districtId_idx" ON "users"("districtId");

-- CreateIndex
CREATE INDEX "users_status_role_idx" ON "users"("status", "role");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_purpose_createdAt_idx" ON "otp_challenges"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "otp_challenges_expiresAt_idx" ON "otp_challenges"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replacedById_key" ON "refresh_tokens"("replacedById");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "students_schoolId_classLevel_idx" ON "students"("schoolId", "classLevel");

-- CreateIndex
CREATE INDEX "students_schoolId_isActive_idx" ON "students"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "students_schoolId_classLevel_section_rollNumber_key" ON "students"("schoolId", "classLevel", "section", "rollNumber");

-- CreateIndex
CREATE INDEX "media_consents_studentId_recordedAt_idx" ON "media_consents"("studentId", "recordedAt");

-- CreateIndex
CREATE INDEX "activities_schoolId_status_occurredOn_idx" ON "activities"("schoolId", "status", "occurredOn");

-- CreateIndex
CREATE INDEX "activities_blockId_status_occurredOn_idx" ON "activities"("blockId", "status", "occurredOn");

-- CreateIndex
CREATE INDEX "activities_districtId_status_occurredOn_idx" ON "activities"("districtId", "status", "occurredOn");

-- CreateIndex
CREATE INDEX "activities_authorId_status_idx" ON "activities"("authorId", "status");

-- CreateIndex
CREATE INDEX "activities_status_visibility_publishedAt_idx" ON "activities"("status", "visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "activities_category_idx" ON "activities"("category");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_uploadedById_idx" ON "media_assets"("uploadedById");

-- CreateIndex
CREATE INDEX "media_assets_attachedAt_idx" ON "media_assets"("attachedAt");

-- CreateIndex
CREATE INDEX "activity_media_activityId_order_idx" ON "activity_media"("activityId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "activity_media_activityId_assetId_key" ON "activity_media"("activityId", "assetId");

-- CreateIndex
CREATE INDEX "activity_students_studentId_idx" ON "activity_students"("studentId");

-- CreateIndex
CREATE INDEX "appreciations_activityId_idx" ON "appreciations"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "appreciations_activityId_userId_key" ON "appreciations"("activityId", "userId");

-- CreateIndex
CREATE INDEX "achievements_studentId_idx" ON "achievements"("studentId");

-- CreateIndex
CREATE INDEX "achievements_schoolId_status_idx" ON "achievements"("schoolId", "status");

-- CreateIndex
CREATE INDEX "achievements_blockId_status_awardedOn_idx" ON "achievements"("blockId", "status", "awardedOn");

-- CreateIndex
CREATE INDEX "achievements_districtId_status_awardedOn_idx" ON "achievements"("districtId", "status", "awardedOn");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_actorId_createdAt_idx" ON "audit_events"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_districtId_createdAt_idx" ON "audit_events"("districtId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_media" ADD CONSTRAINT "activity_media_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_media" ADD CONSTRAINT "activity_media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_students" ADD CONSTRAINT "activity_students_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_students" ADD CONSTRAINT "activity_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
