import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient, RegistrationType, MemberRole, FamilyStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to parse dates formatted as DD/MM/YYYY
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000; // Handle 2-digit years if any

    // Validate reasonable range (e.g. 1920 to 2025)
    if (year < 1920 || year > 2025 || isNaN(day) || isNaN(month) || isNaN(year) || month < 0 || month > 11 || day < 1 || day > 31) {
      return null;
    }
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Clean and standardize diocese names
function cleanDiocese(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const val = raw.trim();
  const lower = val.toLowerCase();

  if (lower.includes('ernakulam') || lower.includes('eranakulam') || lower.includes('ernakulum') || lower.includes('angamaly')) {
    return 'Ernakulam-Angamaly';
  }
  if (lower.includes('irinjalakuda') || lower.includes('irinjalkuda') || lower.includes('irijalakuda')) {
    return 'Irinjalakuda';
  }
  if (lower.includes('changanassery') || lower.includes('changanacherry') || lower.includes('chenganasherry') || lower.includes('changanaserry')) {
    return 'Changanassery';
  }
  if (lower.includes('kanjirapall') || lower.includes('kanjirappall')) {
    return 'Kanjirapally';
  }
  if (lower.includes('palakkad')) return 'Palakkad';
  if (lower.includes('pala') || lower.includes('palai')) return 'Pala';
  if (lower.includes('thrissur')) return 'Thrissur';
  if (lower.includes('kothamangalam') || lower.includes('kothamanglam')) return 'Kothamangalam';
  if (lower.includes('idukki')) return 'Idukki';
  if (lower.includes('thalassery') || lower.includes('thalasserry') || lower.includes('tellicherry')) return 'Thalassery';
  if (lower.includes('thamarassery') || lower.includes('tamarasary')) return 'Thamarassery';
  if (lower.includes('mananthavady')) return 'Mananthavady';
  if (lower.includes('ramanathapuram')) return 'Ramanathapuram';
  if (lower.includes('muvattupuzha')) return 'Muvattupuzha';
  if (lower.includes('thiruvalla') || lower.includes('tiruvalla')) return 'Thiruvalla';
  if (lower.includes('mavelikkara') || lower.includes('mavelikara')) return 'Mavelikkara';
  if (lower.includes('pathanamthitta')) return 'Pathanamthitta';
  if (lower.includes('kottayam')) return 'Kottayam';
  if (lower.includes('kalyan')) return 'Kalyan';
  if (lower.includes('shamshabad')) return 'Shamshabad';
  if (lower.includes('kottapuram')) return 'Kottapuram';
  if (lower.includes('alappuzha') || lower.includes('alleppey')) return 'Alappuzha';
  if (lower.includes('calicut') || lower.includes('kozhikode')) return 'Calicut';
  if (lower.includes('quilon') || lower.includes('kollam')) return 'Quilon';
  if (lower.includes('trivandrum') || lower.includes('thiruvananthapuram')) return 'Trivandrum';
  if (lower.includes('bengaluru')) return 'Bangalore';

  return val;
}

// Map CSV status strings to enum
function mapStatus(statusStr: string | undefined): FamilyStatus {
  if (!statusStr) return FamilyStatus.ACTIVE;
  const s = statusStr.trim().toLowerCase();
  if (s === 'active') return FamilyStatus.ACTIVE;
  if (s === 'inactive') return FamilyStatus.INACTIVE;
  if (s === 'merged') return FamilyStatus.MERGED;
  return FamilyStatus.PENDING;
}

// Check if member name is a genuine name (filter out Excel zero/dummy placeholders)
function isValidMemberName(name: string | undefined): boolean {
  if (!name || !name.trim()) return false;
  const n = name.trim().toLowerCase();
  return (
    n !== '0' &&
    n !== 'child' &&
    n !== '0-1' &&
    n !== 'n/a' &&
    n !== 'not applicable' &&
    n !== 'nil' &&
    n !== 'unknown'
  );
}

// Clean and capitalize member names to proper Title Case
function formatPersonName(name: string | undefined): string | null {
  if (!isValidMemberName(name)) return null;
  return name!
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

// Standardize unit names
function cleanUnitName(rawUnit: string | undefined): string {
  if (!rawUnit || !rawUnit.trim()) return 'Nil';
  const u = rawUnit.trim();
  if (u.toLowerCase() === 'st josephs' || u.toLowerCase() === 'st-josephs') return 'St-Joseph';
  return u;
}

async function run() {
  console.log('🚀 Starting Parish Master CSV Ingestion...');

  const csvFilePath = path.resolve(__dirname, '../../data/parish_register_master.csv');
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found at: ${csvFilePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📄 Found ${records.length} records in master CSV. Processing...`);

  // 1. Get or create Brisbane Parish
  const parish = await prisma.parish.upsert({
    where: { parishCode: 'SABN' },
    update: {
      nextFamilyNumber: 100451,
    },
    create: {
      parishCode: 'SABN',
      parishName: 'St. Alphonsa Syro-Malabar Catholic Parish',
      city: 'Brisbane North',
      state: 'QLD',
      postalCode: '4034',
      idPrefix: 'SABN',
      nextFamilyNumber: 100451,
      isActive: true,
    },
  });

  console.log('🧹 Clearing existing parish family records for clean master import...');
  await prisma.familyDocument.deleteMany({});
  await prisma.familyNote.deleteMany({});
  await prisma.memberHistory.deleteMany({});
  await prisma.directDebit.deleteMany({});
  await prisma.familyMember.deleteMany({});
  await prisma.family.deleteMany({});

  let importedFamilies = 0;
  let importedMembers = 0;

  for (const row of records) {
    const rawUnit = cleanUnitName(row['Select Family Unit|select-1'] || row['Family Unit|select-1']);
    const houseName = row['House Name (Veettuperu)|text-1']?.trim() || 'Not Specified';
    const familyCode = row['Parish Family ID']?.trim() || null;
    const status = mapStatus(row['Active/Inactive']);
    const regDate = parseDate(row['Date|date-7']);
    const agreement = row['Agreement|consent-1']?.trim().toLowerCase() === 'checked';
    const signatureUrl = row['Sign Here|signature-1']?.trim() || null;
    const letterUrl = row['Upload Letter from parish|upload-1']?.trim() || null;
    const comments = row['Comments (DD.MM.YY - put comments)']?.trim() || null;

    // 2. Ensure Unit exists for this parish
    const unitCategory =
      rawUnit.includes('Student') || rawUnit.includes('Youth')
        ? 'DEMOGRAPHIC'
        : 'GEOGRAPHIC';

    const unit = await prisma.familyUnit.upsert({
      where: {
        parishId_unitName: {
          parishId: parish.id,
          unitName: rawUnit,
        },
      },
      update: {},
      create: {
        parishId: parish.id,
        unitName: rawUnit,
        category: unitCategory,
        isActive: true,
      },
    });

    // 3. Classify registration type
    let regType = RegistrationType.FAMILY;
    if (rawUnit === 'International-Student') {
      regType = RegistrationType.INDIVIDUAL_STUDENT;
    } else if (rawUnit === 'International-Youth') {
      regType = RegistrationType.SINGLE_YOUTH;
    }

    // 4. Extract Head Name & Create Family record
    const headName = row['Name|name-1']?.trim();

    const family = await prisma.family.create({
      data: {
        parishId: parish.id,
        familyCode: familyCode,
        registrationType: regType,
        houseName: houseName,
        headFullName: headName || houseName,
        unitId: unit.id,
        streetAddress: row['Address in Australia|address-1-street_address']?.trim() || null,
        city: row['City|address-1-city']?.trim() || null,
        state: row['State/Province|address-1-state']?.trim() || null,
        postalCode: row['ZIP / Postal Code|address-1-zip']?.trim() || null,
        primaryPhone: row['Phone|phone-1']?.trim() || null,
        primaryEmail: row['Email Address|email-1']?.trim() || null,
        originParish: row['Parish in India|text-3']?.trim() || null,
        originDiocese: cleanDiocese(row['Diocese in India|text-4']),
        originParishPhone: row['Phone (Parish in India)|phone-4']?.trim() || null,
        status: status,
        agreementConsent: agreement,
        registrationDate: regDate,
        generalNotes: row['General Notes']?.trim() || null,
      },
    });

    importedFamilies++;

    // 5. Ingest Members
    // Member 1: Head of Family
    if (isValidMemberName(headName)) {
      await prisma.familyMember.create({
        data: {
          familyId: family.id,
          role: MemberRole.HEAD,
          fullName: headName,
          dateOfBirth: parseDate(row['Date of Birth|date-1']),
          phone: row['Phone|phone-2']?.trim() || null,
          email: row['Email Address|email-2']?.trim() || null,
          isPrimaryContact: true,
          orderIndex: 0,
        },
      });
      importedMembers++;
    }

    // Member 2: Spouse (Optional)
    const spouseName = row['Name|name-2']?.trim();
    if (isValidMemberName(spouseName)) {
      const isDuplicateSpouse =
        regType !== RegistrationType.FAMILY &&
        spouseName.toLowerCase() === headName?.toLowerCase();

      if (!isDuplicateSpouse) {
        await prisma.familyMember.create({
          data: {
            familyId: family.id,
            role: MemberRole.SPOUSE,
            fullName: spouseName,
            dateOfBirth: parseDate(row['Date of Birth|date-2']),
            phone: row['Phone|phone-3']?.trim() || null,
            email: row['Email Address|email-3']?.trim() || null,
            isPrimaryContact: false,
            orderIndex: 1,
          },
        });
        importedMembers++;
      }
    }

    // Children 1 to 4
    const childrenKeys = [
      { name: 'Full Name of Child|text-12', dob: 'Date of Birth|date-3', pob: 'Place of Birth|text-5' },
      { name: 'Full Name of Child|text-11', dob: 'Date of Birth|date-4', pob: 'Place of Birth|text-6' },
      { name: 'Full Name of Child|text-10', dob: 'Date of Birth|date-5', pob: 'Place of Birth|text-7' },
      { name: 'Full Name of Child|text-9',  dob: 'Date of Birth|date-6', pob: 'Place of Birth|text-8' },
    ];

    let childIndex = 2;
    for (const childKey of childrenKeys) {
      const childName = row[childKey.name]?.trim();
      if (isValidMemberName(childName)) {
        const isDuplicateChild =
          regType !== RegistrationType.FAMILY &&
          childName.toLowerCase() === headName?.toLowerCase();

        if (!isDuplicateChild) {
          await prisma.familyMember.create({
            data: {
              familyId: family.id,
              role: MemberRole.CHILD,
              fullName: childName,
              dateOfBirth: parseDate(row[childKey.dob]),
              placeOfBirth: row[childKey.pob]?.trim() || null,
              orderIndex: childIndex++,
            },
          });
          importedMembers++;
        }
      }
    }

    // 6. Ingest Documents (Signature & Release Letter)
    if (signatureUrl) {
      await prisma.familyDocument.create({
        data: {
          familyId: family.id,
          documentType: 'SIGNATURE',
          fileName: 'signature.png',
          localPath: signatureUrl,
          originalUrl: signatureUrl,
        },
      });
    }

    if (letterUrl) {
      await prisma.familyDocument.create({
        data: {
          familyId: family.id,
          documentType: 'PARISH_LETTER',
          fileName: 'parish_release_letter.pdf',
          localPath: letterUrl,
          originalUrl: letterUrl,
        },
      });
    }

    // 7. Ingest Comments as FamilyNotes
    if (comments) {
      await prisma.familyNote.create({
        data: {
          familyId: family.id,
          noteDate: regDate || new Date(),
          noteContent: comments,
          recordedBy: 'CSV Import',
        },
      });
    }
  }

  console.log(`\n🎉 Ingestion Finished Successfully!`);
  console.log(`📊 Total Families Created: ${importedFamilies}`);
  console.log(`👥 Total Parishioner Members Created: ${importedMembers}`);
}

run()
  .catch((e) => {
    console.error('❌ Ingestion Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
