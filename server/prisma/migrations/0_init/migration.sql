-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('FAMILY', 'INDIVIDUAL_STUDENT', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('HEAD', 'SPOUSE', 'CHILD', 'OTHER_DEPENDENT');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MERGED', 'PENDING');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'DIOCESAN_ADMIN', 'DIOCESAN_USER', 'PARISH_PRIEST', 'PARISH_ADMIN', 'PARISH_USER');

-- CreateTable
CREATE TABLE "Diocese" (
    "id" SERIAL NOT NULL,
    "dioceseName" TEXT NOT NULL DEFAULT 'Diocese of St. Thomas the Apostle, Melbourne',
    "rite" TEXT NOT NULL DEFAULT 'Syro-Malabar',
    "bishopName" TEXT DEFAULT 'Bishop John Panamthottathil',
    "chanceryAddress" TEXT DEFAULT '62 Moore Rd, Mill Park VIC 3082, Australia',
    "city" TEXT DEFAULT 'Melbourne',
    "state" TEXT DEFAULT 'VIC',
    "postalCode" TEXT DEFAULT '3082',
    "contactPhone" TEXT DEFAULT '+61 3 9404 1533',
    "contactEmail" TEXT DEFAULT 'chancery@syromalabar.org.au',
    "website" TEXT DEFAULT 'https://syromalabar.org.au',
    "logoUrl" TEXT DEFAULT '/branding/logo.png',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diocese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativeDiocese" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "dioceseName" TEXT NOT NULL,
    "stateInIndia" TEXT NOT NULL DEFAULT 'Kerala',
    "rite" TEXT NOT NULL DEFAULT 'Syro-Malabar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NativeDiocese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parish" (
    "id" SERIAL NOT NULL,
    "dioceseId" INTEGER,
    "parishCode" TEXT NOT NULL,
    "parishName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "idPrefix" TEXT NOT NULL DEFAULT 'SABN',
    "nextFamilyNumber" INTEGER NOT NULL DEFAULT 100001,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priestName" TEXT,
    "priestEmail" TEXT,
    "priestPhone" TEXT,
    "logoUrl" TEXT,
    "activityLoggingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "hideInactiveUsers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParishUser" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER,
    "fullName" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PARISH_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParishUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "role" "UserRole" NOT NULL,
    "module" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canArchive" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "canView" BOOLEAN,
    "canCreate" BOOLEAN,
    "canEdit" BOOLEAN,
    "canArchive" BOOLEAN,
    "canDelete" BOOLEAN,
    "canExport" BOOLEAN,
    "canApprove" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyUnit" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "unitName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GEOGRAPHIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "familyCode" TEXT,
    "registrationType" "RegistrationType" NOT NULL DEFAULT 'FAMILY',
    "houseName" TEXT NOT NULL,
    "headFullName" TEXT,
    "unitId" INTEGER,
    "streetAddress" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "primaryPhone" TEXT,
    "primaryEmail" TEXT,
    "originParish" TEXT,
    "originDiocese" TEXT,
    "originParishPhone" TEXT,
    "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
    "mergedIntoFamilyId" INTEGER,
    "agreementConsent" BOOLEAN NOT NULL DEFAULT false,
    "signaturePath" TEXT,
    "registrationDate" TIMESTAMP(3),
    "studentMetadata" JSONB,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'CHILD',
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberHistory" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "familyId" INTEGER NOT NULL,
    "unitName" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyDocument" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "memberId" INTEGER,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "originalUrl" TEXT,
    "mimeType" TEXT DEFAULT 'application/octet-stream',
    "fileSize" INTEGER DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectDebit" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "familyId" INTEGER NOT NULL,
    "reference" VARCHAR(100),
    "amount" DECIMAL(10,2),
    "frequency" TEXT,
    "comments" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectDebit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyNote" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "noteDate" TIMESTAMP(3),
    "noteContent" TEXT NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemFeatureVault" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "controlManifest" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemFeatureVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmtpSetting" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" TEXT,
    "pass" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT DEFAULT 'Parish Register',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmtpSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemActivityLog" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "userId" INTEGER,
    "userName" TEXT NOT NULL,
    "userRole" TEXT,
    "actionType" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT NOT NULL,
    "details" TEXT,
    "path" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NativeDiocese_parishId_dioceseName_key" ON "NativeDiocese"("parishId", "dioceseName");

-- CreateIndex
CREATE UNIQUE INDEX "Parish_parishCode_key" ON "Parish"("parishCode");

-- CreateIndex
CREATE UNIQUE INDEX "ParishUser_username_key" ON "ParishUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ParishUser_email_key" ON "ParishUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_parishId_role_module_key" ON "RolePermission"("parishId", "role", "module");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_module_key" ON "UserPermissionOverride"("userId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyUnit_parishId_unitName_key" ON "FamilyUnit"("parishId", "unitName");

-- CreateIndex
CREATE UNIQUE INDEX "Family_familyCode_key" ON "Family"("familyCode");

-- CreateIndex
CREATE INDEX "Family_parishId_headFullName_idx" ON "Family"("parishId", "headFullName");

-- CreateIndex
CREATE INDEX "FamilyDocument_familyId_idx" ON "FamilyDocument"("familyId");

-- CreateIndex
CREATE INDEX "DirectDebit_familyId_idx" ON "DirectDebit"("familyId");

-- CreateIndex
CREATE INDEX "DirectDebit_parishId_active_idx" ON "DirectDebit"("parishId", "active");

-- CreateIndex
CREATE INDEX "FamilyNote_familyId_idx" ON "FamilyNote"("familyId");

-- CreateIndex
CREATE INDEX "FamilyNote_noteDate_idx" ON "FamilyNote"("noteDate");

-- CreateIndex
CREATE UNIQUE INDEX "SystemFeatureVault_parishId_key" ON "SystemFeatureVault"("parishId");

-- CreateIndex
CREATE INDEX "SystemFeatureVault_parishId_idx" ON "SystemFeatureVault"("parishId");

-- CreateIndex
CREATE UNIQUE INDEX "SmtpSetting_parishId_key" ON "SmtpSetting"("parishId");

-- CreateIndex
CREATE INDEX "SmtpSetting_parishId_idx" ON "SmtpSetting"("parishId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE INDEX "SystemActivityLog_parishId_createdAt_idx" ON "SystemActivityLog"("parishId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemActivityLog_parishId_actionType_idx" ON "SystemActivityLog"("parishId", "actionType");

-- CreateIndex
CREATE INDEX "SystemActivityLog_parishId_category_idx" ON "SystemActivityLog"("parishId", "category");

-- CreateIndex
CREATE INDEX "SystemActivityLog_userId_idx" ON "SystemActivityLog"("userId");

-- AddForeignKey
ALTER TABLE "NativeDiocese" ADD CONSTRAINT "NativeDiocese_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parish" ADD CONSTRAINT "Parish_dioceseId_fkey" FOREIGN KEY ("dioceseId") REFERENCES "Diocese"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParishUser" ADD CONSTRAINT "ParishUser_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ParishUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyUnit" ADD CONSTRAINT "FamilyUnit_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "FamilyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_mergedIntoFamilyId_fkey" FOREIGN KEY ("mergedIntoFamilyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberHistory" ADD CONSTRAINT "MemberHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberHistory" ADD CONSTRAINT "MemberHistory_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectDebit" ADD CONSTRAINT "DirectDebit_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectDebit" ADD CONSTRAINT "DirectDebit_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyNote" ADD CONSTRAINT "FamilyNote_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemFeatureVault" ADD CONSTRAINT "SystemFeatureVault_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmtpSetting" ADD CONSTRAINT "SmtpSetting_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemActivityLog" ADD CONSTRAINT "SystemActivityLog_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

