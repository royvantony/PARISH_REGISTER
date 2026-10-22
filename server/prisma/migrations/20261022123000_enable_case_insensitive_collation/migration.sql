-- 1. Create deterministic ICU case-insensitive collation
CREATE COLLATION IF NOT EXISTS case_insensitive_det (
  provider = icu,
  locale = 'und-u-ks-level2',
  deterministic = true
);

-- 2. Alter Family headFullName and houseName to use case-insensitive collation
ALTER TABLE "Family" ALTER COLUMN "headFullName" SET DATA TYPE text COLLATE case_insensitive_det;
ALTER TABLE "Family" ALTER COLUMN "houseName" SET DATA TYPE text COLLATE case_insensitive_det;

-- 3. Alter FamilyUnit unitName and FamilyMember fullName to use case-insensitive collation
ALTER TABLE "FamilyUnit" ALTER COLUMN "unitName" SET DATA TYPE text COLLATE case_insensitive_det;
ALTER TABLE "FamilyMember" ALTER COLUMN "fullName" SET DATA TYPE text COLLATE case_insensitive_det;
