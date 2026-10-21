-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('FAMILY', 'INDIVIDUAL_STUDENT', 'SINGLE_YOUTH');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('HEAD', 'SPOUSE', 'CHILD', 'OTHER_DEPENDENT');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MERGED', 'PENDING');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DIOCESAN_ADMIN', 'SUPER_ADMIN', 'PARISH_ADMIN', 'UNIT_COORDINATOR');

-- CreateTable
CREATE TABLE "NativeDiocese" (
    "id" SERIAL NOT NULL,
    "dioceseName" TEXT NOT NULL,
    "stateInIndia" TEXT NOT NULL DEFAULT 'Kerala',
    "rite" TEXT NOT NULL DEFAULT 'Syro-Malabar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NativeDiocese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parish" (
    "id" SERIAL NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParishUser" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PARISH_ADMIN',
    "assignedUnitId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParishUser_pkey" PRIMARY KEY ("id")
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
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectDebit" (
    "id" SERIAL NOT NULL,
    "parishId" INTEGER NOT NULL,
    "familyId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2),
    "frequency" TEXT,
    "comments" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
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

-- CreateIndex
CREATE UNIQUE INDEX "NativeDiocese_dioceseName_key" ON "NativeDiocese"("dioceseName");

-- CreateIndex
CREATE UNIQUE INDEX "Parish_parishCode_key" ON "Parish"("parishCode");

-- CreateIndex
CREATE UNIQUE INDEX "ParishUser_email_key" ON "ParishUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyUnit_parishId_unitName_key" ON "FamilyUnit"("parishId", "unitName");

-- CreateIndex
CREATE UNIQUE INDEX "Family_familyCode_key" ON "Family"("familyCode");

-- CreateIndex
CREATE UNIQUE INDEX "DirectDebit_familyId_key" ON "DirectDebit"("familyId");

-- AddForeignKey
ALTER TABLE "ParishUser" ADD CONSTRAINT "ParishUser_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParishUser" ADD CONSTRAINT "ParishUser_assignedUnitId_fkey" FOREIGN KEY ("assignedUnitId") REFERENCES "FamilyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
