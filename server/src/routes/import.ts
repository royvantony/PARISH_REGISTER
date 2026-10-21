import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { FamilyStatus, RegistrationType, MemberRole, UserRole } from '@prisma/client';
import { canUserImportRegistrations } from './permissions.js';

export const importRouter = Router();

// Apply auth to all import endpoints
importRouter.use(authenticateJWT);

// Helper to parse dates (supports YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
function parseDateFlexible(dateStr: string | undefined | null): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  // Try ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);

    // If first part is 4 digits, it's YYYY/MM/DD
    if (day > 1000) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (year < 100) {
      year += 2000;
    }

    if (year >= 1900 && year <= 2099 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Clean and standardize diocese names
function cleanDiocese(raw: string | undefined | null): string | null {
  if (!raw || !raw.trim()) return null;
  const val = raw.trim();
  const lower = val.toLowerCase();

  if (lower.includes('ernakulam') || lower.includes('angamaly')) return 'Ernakulam-Angamaly';
  if (lower.includes('irinjalakuda') || lower.includes('irinjalkuda')) return 'Irinjalakuda';
  if (lower.includes('changanassery') || lower.includes('changanacherry')) return 'Changanassery';
  if (lower.includes('kanjirapall')) return 'Kanjirapally';
  if (lower.includes('palakkad')) return 'Palakkad';
  if (lower.includes('pala') || lower.includes('palai')) return 'Pala';
  if (lower.includes('thrissur')) return 'Thrissur';
  if (lower.includes('kothamangalam')) return 'Kothamangalam';
  if (lower.includes('idukki')) return 'Idukki';
  if (lower.includes('thalassery') || lower.includes('tellicherry')) return 'Thalassery';
  if (lower.includes('thamarassery')) return 'Thamarassery';
  if (lower.includes('mananthavady')) return 'Mananthavady';
  if (lower.includes('ramanathapuram')) return 'Ramanathapuram';
  if (lower.includes('muvattupuzha')) return 'Muvattupuzha';
  if (lower.includes('kottayam')) return 'Kottayam';
  if (lower.includes('kalyan')) return 'Kalyan';
  if (lower.includes('shamshabad')) return 'Shamshabad';

  return val;
}

// Standardize unit / ward names
function cleanUnitName(rawUnit: string | undefined | null): string {
  if (!rawUnit || !rawUnit.trim()) return '';
  const u = rawUnit.trim();
  const lower = u.toLowerCase();
  if (lower === 'st josephs' || lower === 'st-josephs' || lower === 'st joseph') return 'St-Joseph';
  if (lower === 'st thomas' || lower === 'st-thomas') return 'St-Thomas';
  if (lower === 'st alphonsa' || lower === 'st-alphonsa') return 'St-Alphonsa';
  if (lower === 'st marys' || lower === 'st-marys' || lower === 'st mary') return 'St-Marys';
  if (lower === 'st antonys' || lower === 'st-antonys' || lower === 'st anthony') return 'St-Antony';
  if (lower === 'st georges' || lower === 'st-georges' || lower === 'st george') return 'St-George';
  return u;
}

// Helper to extract value from row with multiple possible header keys
function getRowValue(row: Record<string, any>, possibleKeys: string[]): string {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }

  // Also check normalized lowercase match without punctuation
  const rowEntries = Object.entries(row);
  for (const searchKey of possibleKeys) {
    const cleanSearch = searchKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [colName, val] of rowEntries) {
      const cleanCol = colName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanCol === cleanSearch && val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }
  return '';
}

// GET /api/import/template - Download pre-populated CSV template
importRouter.get('/template', async (req: Request, res: Response) => {
  const parishId = req.activeParishId || 1;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const perms = await canUserImportRegistrations(user.userId, user.role, parishId);
  if (!perms.canView) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to view or access import registrations.' });
  }

  const headers = [
    'Registration Type',
    'House Name (Veettuperu)',
    'Family Unit / Ward',
    'Head Full Name',
    'Head Date of Birth (YYYY-MM-DD)',
    'Head Place of Birth',
    'Head Phone',
    'Head Email',
    'Spouse Full Name',
    'Spouse Date of Birth (YYYY-MM-DD)',
    'Spouse Place of Birth',
    'Spouse Phone',
    'Spouse Email',
    'Child 1 Full Name',
    'Child 1 Date of Birth (YYYY-MM-DD)',
    'Child 1 Place of Birth',
    'Child 2 Full Name',
    'Child 2 Date of Birth (YYYY-MM-DD)',
    'Child 2 Place of Birth',
    'Child 3 Full Name',
    'Child 3 Date of Birth (YYYY-MM-DD)',
    'Child 3 Place of Birth',
    'Child 4 Full Name',
    'Child 4 Date of Birth (YYYY-MM-DD)',
    'Child 4 Place of Birth',
    'Child 5 Full Name',
    'Child 5 Date of Birth (YYYY-MM-DD)',
    'Child 5 Place of Birth',
    'Address - Street',
    'City / Suburb',
    'State',
    'Postal Code',
    'Origin Parish in India',
    'Origin Diocese in India',
    'General Notes',
  ];

  const sampleRows = [
    [
      'FAMILY',
      'Valiyaveettil',
      'St-Thomas',
      'Thomas Joseph',
      '1982-05-14',
      'Pala',
      '0412345678',
      'thomas.valiya@example.com',
      'Mary Thomas',
      '1985-09-20',
      'Kanjirapally',
      '0487654321',
      'mary.valiya@example.com',
      'Joseph Thomas',
      '2012-08-10',
      'Brisbane',
      'Ann Maria Thomas',
      '2015-11-25',
      'Brisbane',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '12 Sunshine Parade',
      'Chermside',
      'QLD',
      '4032',
      'St. Thomas Cathedral',
      'Pala',
      'Family with 2 children. Extra child columns left empty.',
    ],
    [
      'FAMILY',
      'Naduviledath',
      'St-Joseph',
      'Antony Naduvil',
      '1979-02-18',
      'Irinjalakuda',
      '0433221100',
      'antony.n@example.com',
      'Jancy Antony',
      '1982-07-22',
      'Thrissur',
      '0433221101',
      'jancy.n@example.com',
      'Ephrem Antony',
      '2008-04-12',
      'Irinjalakuda',
      'Teresa Antony',
      '2010-09-15',
      'Brisbane',
      'Francis Antony',
      '2013-01-20',
      'Brisbane',
      'Seraphina Antony',
      '2016-06-08',
      'Brisbane',
      'Benedict Antony',
      '2019-12-03',
      'Brisbane',
      '88 Eucalyptus Crescent',
      'Aspley',
      'QLD',
      '4034',
      'St. Mary Forane Church',
      'Irinjalakuda',
      'Large household with 5 children. All child columns filled.',
    ],
    [
      'INDIVIDUAL_STUDENT',
      'Kottackal',
      'International-Student',
      'Mathew George',
      '2001-03-15',
      'Angamaly',
      '0423456789',
      'mathew.g@student.qut.edu.au',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '45 Victoria Avenue',
      'Kelvin Grove',
      'QLD',
      '4059',
      'St. George Forane Church',
      'Ernakulam-Angamaly',
      'Master of Information Technology student at QUT. 0 children.',
    ],
  ];

  const csvRows = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
  ];

  const csvContent = csvRows.join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="parish_registration_template.csv"');
  return res.status(200).send(csvContent);
});

// POST /api/import/preview - Parse, validate, detect duplicates, and preview registrations
importRouter.post('/preview', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || 1;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const perms = await canUserImportRegistrations(user.userId, user.role, parishId);
    if (!perms.canView) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view or import registrations.' });
    }

    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No data rows provided for preview.' });
    }

    // Load reference units for this parish
    const parishUnits = await prisma.familyUnit.findMany({
      where: { parishId, isActive: true },
      select: { id: true, unitName: true },
    });

    // Load existing families for fast duplicate checking in active parish
    const existingFamilies = await prisma.family.findMany({
      where: { parishId },
      select: {
        id: true,
        familyCode: true,
        houseName: true,
        headFullName: true,
        primaryPhone: true,
        primaryEmail: true,
        status: true,
      },
    });

    const previewRecords = [];
    let readyCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const errors: string[] = [];
      const warnings: string[] = [];

      // 1. Extract House Name (Mandatory)
      const houseName = getRowValue(row, [
        'House Name (Veettuperu)',
        'House Name (Veettuperu)|text-1',
        'House Name',
        'Family Name',
        'Veettuperu',
      ]);

      if (!houseName) {
        errors.push('House Name (Veettuperu) is missing.');
      }

      // 2. Extract Head Name (Mandatory)
      const headName = getRowValue(row, [
        'Head Full Name',
        'Name|name-1',
        'Head Name',
        'Head of Family',
        'Full Name',
      ]);

      if (!headName) {
        errors.push('Head of Family Full Name is missing.');
      }

      // 3. Extract Registration Type
      const rawRegType = getRowValue(row, [
        'Registration Type',
        'Type',
      ]).toUpperCase();

      let regType: RegistrationType = RegistrationType.FAMILY;
      if (rawRegType.includes('STUDENT')) {
        regType = RegistrationType.INDIVIDUAL_STUDENT;
      } else if (rawRegType.includes('INDIVIDUAL') || rawRegType.includes('SINGLE')) {
        regType = RegistrationType.INDIVIDUAL;
      }

      // 4. Resolve Ward / Unit
      const rawWard = getRowValue(row, [
        'Family Unit / Ward',
        'Select Family Unit|select-1',
        'Family Unit|select-1',
        'Ward',
        'Unit',
        'Family Unit',
      ]);

      const cleanedWard = cleanUnitName(rawWard);
      let matchedUnitId: number | null = null;
      let matchedUnitName = 'Unassigned';

      if (cleanedWard) {
        const found = parishUnits.find(
          (u) =>
            u.unitName.toLowerCase() === cleanedWard.toLowerCase() ||
            u.unitName.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanedWard.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (found) {
          matchedUnitId = found.id;
          matchedUnitName = found.unitName;
        } else {
          warnings.push(`Ward "${rawWard}" not recognized in parish masters (will be marked as Unassigned).`);
        }
      } else {
        warnings.push('Ward / Unit not specified (will be marked as Unassigned).');
      }

      // 5. Contact & Address
      const headPhone = getRowValue(row, ['Head Phone', 'Phone|phone-1', 'Phone|phone-2', 'Phone', 'Mobile']);
      const headEmail = getRowValue(row, ['Head Email', 'Email Address|email-1', 'Email Address|email-2', 'Email']);
      const headDob = getRowValue(row, ['Head Date of Birth (YYYY-MM-DD)', 'Date of Birth|date-1', 'Head DOB', 'DOB']);
      const headPob = getRowValue(row, ['Head Place of Birth', 'Place of Birth|text-1', 'Head POB', 'Place of Birth']);

      const streetAddress = getRowValue(row, [
        'Address - Street',
        'Address in Australia|address-1-street_address',
        'Street Address',
        'Address',
      ]);
      const city = getRowValue(row, ['City / Suburb', 'City|address-1-city', 'Suburb', 'City']) || 'Brisbane';
      const state = getRowValue(row, ['State', 'State/Province|address-1-state']) || 'QLD';
      const postalCode = getRowValue(row, ['Postal Code', 'ZIP / Postal Code|address-1-zip', 'Postcode', 'Zip']);

      // 6. Spouse
      const spouseName = getRowValue(row, ['Spouse Full Name', 'Name|name-2', 'Spouse Name']);
      const spouseDob = getRowValue(row, ['Spouse Date of Birth (YYYY-MM-DD)', 'Date of Birth|date-2', 'Spouse DOB']);
      const spousePob = getRowValue(row, ['Spouse Place of Birth', 'Spouse POB']);
      const spousePhone = getRowValue(row, ['Spouse Phone', 'Phone|phone-3']);
      const spouseEmail = getRowValue(row, ['Spouse Email', 'Email Address|email-3']);

      // 7. Dynamic Children Extraction (Supports 1 child up to any number of children: 5, 8, 12, etc.)
      const children = [];

      // Scan all row keys to discover any Child column numbers (e.g., Child 1, Child 5, Child 8)
      const childNumbers = new Set<number>();
      for (const colKey of Object.keys(row)) {
        const match = colKey.match(/child\s*(\d+)/i);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > 0) {
            childNumbers.add(parsed);
          }
        }
      }

      // Guarantee at least indices 1 through 8 are checked even if formatting varies
      for (let n = 1; n <= 8; n++) {
        childNumbers.add(n);
      }

      const sortedIndices = Array.from(childNumbers).sort((a, b) => a - b);

      for (const n of sortedIndices) {
        const cName = getRowValue(row, [
          `Child ${n} Full Name`,
          `Child ${n} Name`,
          `Child ${n}`,
          `Child${n} Full Name`,
          `Child${n} Name`,
          `Child${n}`,
          `Full Name of Child ${n}`,
          // WordPress Gravity Forms field mapping fallbacks
          n === 1 ? 'Full Name of Child|text-12' : '',
          n === 2 ? 'Full Name of Child|text-11' : '',
          n === 3 ? 'Full Name of Child|text-10' : '',
          n === 4 ? 'Full Name of Child|text-9' : '',
        ].filter(Boolean));

        const cDob = getRowValue(row, [
          `Child ${n} Date of Birth (YYYY-MM-DD)`,
          `Child ${n} Date of Birth`,
          `Child ${n} DOB`,
          `Child${n} Date of Birth (YYYY-MM-DD)`,
          `Child${n} Date of Birth`,
          `Child${n} DOB`,
          `Date of Birth Child ${n}`,
          n === 1 ? 'Date of Birth|date-3' : '',
          n === 2 ? 'Date of Birth|date-4' : '',
          n === 3 ? 'Date of Birth|date-5' : '',
          n === 4 ? 'Date of Birth|date-6' : '',
        ].filter(Boolean));

        const cPob = getRowValue(row, [
          `Child ${n} Place of Birth`,
          `Child ${n} POB`,
          `Child${n} Place of Birth`,
          `Child${n} POB`,
          `Place of Birth Child ${n}`,
          n === 1 ? 'Place of Birth|text-5' : '',
          n === 2 ? 'Place of Birth|text-6' : '',
          n === 3 ? 'Place of Birth|text-7' : '',
          n === 4 ? 'Place of Birth|text-8' : '',
        ].filter(Boolean));

        if (
          cName &&
          cName.trim() &&
          cName !== '0' &&
          cName.toLowerCase() !== 'nil' &&
          cName.toLowerCase() !== 'n/a' &&
          cName.toLowerCase() !== 'not applicable'
        ) {
          children.push({
            fullName: cName.trim(),
            dateOfBirth: cDob,
            placeOfBirth: cPob,
          });
        }
      }


      // 8. Roots
      const originParish = getRowValue(row, ['Origin Parish in India', 'Parish in India|text-3', 'Origin Parish', 'Home Parish']);
      const originDiocese = cleanDiocese(getRowValue(row, ['Origin Diocese in India', 'Diocese in India|text-4', 'Origin Diocese', 'Diocese']));
      const generalNotes = getRowValue(row, ['General Notes', 'Comments', 'Notes']);

      // 9. Duplicate detection against database
      let duplicateMatch = null;
      if (headPhone) {
        const cleanPhone = headPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.length >= 8) {
          duplicateMatch = existingFamilies.find(
            (f) => f.primaryPhone && f.primaryPhone.replace(/[^0-9]/g, '').includes(cleanPhone)
          );
        }
      }

      if (!duplicateMatch && headEmail) {
        duplicateMatch = existingFamilies.find(
          (f) => f.primaryEmail && f.primaryEmail.trim().toLowerCase() === headEmail.trim().toLowerCase()
        );
      }

      if (!duplicateMatch && houseName && headName) {
        duplicateMatch = existingFamilies.find(
          (f) =>
            f.houseName.trim().toLowerCase() === houseName.trim().toLowerCase() &&
            f.headFullName?.trim().toLowerCase() === headName.trim().toLowerCase()
        );
      }

      if (duplicateMatch) {
        const identifier = duplicateMatch.familyCode || `Pending Household #${duplicateMatch.id}`;
        warnings.push(`Possible duplicate: Matches existing record (${identifier} - ${duplicateMatch.houseName}).`);
      }

      // Determine Row Status
      let rowStatus: 'READY' | 'WARNING' | 'ERROR' = 'READY';
      if (errors.length > 0) {
        rowStatus = 'ERROR';
        errorCount++;
      } else if (warnings.length > 0) {
        rowStatus = 'WARNING';
        warningCount++;
      } else {
        readyCount++;
      }

      previewRecords.push({
        rowIndex: i + 1,
        tempId: `row_${i + 1}_${Date.now()}`,
        status: rowStatus,
        errors,
        warnings,
        isDuplicate: Boolean(duplicateMatch),
        duplicateInfo: duplicateMatch
          ? {
              id: duplicateMatch.id,
              familyCode: duplicateMatch.familyCode,
              houseName: duplicateMatch.houseName,
              headFullName: duplicateMatch.headFullName,
              status: duplicateMatch.status,
            }
          : null,
        data: {
          registrationType: regType,
          houseName,
          unitId: matchedUnitId,
          unitName: matchedUnitName,
          headName,
          headDob,
          headPob,
          headPhone,
          headEmail,
          hasSpouse: Boolean(spouseName),
          spouseName,
          spouseDob,
          spousePob,
          spousePhone,
          spouseEmail,
          children,
          streetAddress,
          city,
          state,
          postalCode,
          originParish,
          originDiocese,
          generalNotes,
        },
      });
    }

    return res.json({
      summary: {
        totalRows: rows.length,
        readyCount,
        warningCount,
        errorCount,
        canApprove: perms.canApprove,
      },
      records: previewRecords,
    });
  } catch (err: any) {
    console.error('Error generating import preview:', err);
    return res.status(500).json({ error: 'Failed to process import preview.' });
  }
});

// POST /api/import/save-single - Save an individual verified registration
importRouter.post('/save-single', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || 1;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const perms = await canUserImportRegistrations(user.userId, user.role, parishId);
    if (!perms.canCreate) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to stage registrations.' });
    }

    const {
      registrationType = RegistrationType.FAMILY,
      houseName,
      unitId,
      headName,
      headDob,
      headPob,
      headPhone,
      headEmail,
      hasSpouse,
      spouseName,
      spouseDob,
      spousePob,
      spousePhone,
      spouseEmail,
      children = [],
      streetAddress,
      city,
      state,
      postalCode,
      originParish,
      originDiocese,
      generalNotes,
      approveImmediately = false,
    } = req.body;

    if (!houseName || !headName) {
      return res.status(400).json({ error: 'House name and Head of Family name are required.' });
    }

    // Permission check for immediate approval
    if (approveImmediately && !perms.canApprove) {
      return res.status(403).json({
        error: 'Access denied: You do not have approval rights to activate registrations immediately. Please save as Pending.',
      });
    }

    // Resolve Ward if provided
    let resolvedUnitId: number | null = null;
    if (unitId && unitId !== 'UNASSIGNED' && unitId !== 'NONE') {
      const parsed = parseInt(String(unitId), 10);
      if (!isNaN(parsed)) {
        const unitExists = await prisma.familyUnit.findFirst({
          where: { id: parsed, parishId },
        });
        if (unitExists) resolvedUnitId = parsed;
      }
    }

    const parish = await prisma.parish.findUnique({ where: { id: parishId } });
    if (!parish) return res.status(404).json({ error: 'Parish not found.' });

    let allocatedFamilyCode: string | null = null;
    const targetStatus = approveImmediately ? FamilyStatus.ACTIVE : FamilyStatus.PENDING;

    // Transactional save
    const result = await prisma.$transaction(async (tx) => {
      // 1. Allocate family code only if approving immediately
      if (approveImmediately) {
        allocatedFamilyCode = `${parish.idPrefix}${parish.nextFamilyNumber}`;
        await tx.parish.update({
          where: { id: parishId },
          data: { nextFamilyNumber: { increment: 1 } },
        });
      }

      // 2. Prepare general notes with audit tag
      const auditTag = `[Imported from CSV on ${new Date().toLocaleDateString('en-AU')}]`;
      const combinedNotes = generalNotes ? `${generalNotes}\n\n${auditTag}` : auditTag;

      // 3. Create Family
      const createdFamily = await tx.family.create({
        data: {
          parishId,
          familyCode: allocatedFamilyCode,
          registrationType,
          houseName: houseName.trim(),
          headFullName: headName.trim(),
          unitId: resolvedUnitId,
          streetAddress: streetAddress ? streetAddress.trim() : null,
          city: city ? city.trim() : null,
          state: state ? state.trim() : null,
          postalCode: postalCode ? postalCode.trim() : null,
          primaryPhone: headPhone ? headPhone.trim() : null,
          primaryEmail: headEmail ? headEmail.trim() : null,
          originParish: originParish ? originParish.trim() : null,
          originDiocese: originDiocese ? originDiocese.trim() : null,
          status: targetStatus,
          generalNotes: combinedNotes,
          registrationDate: new Date(),
        },
      });

      // 4. Create Head Member
      await tx.familyMember.create({
        data: {
          familyId: createdFamily.id,
          role: MemberRole.HEAD,
          fullName: headName.trim(),
          dateOfBirth: parseDateFlexible(headDob),
          placeOfBirth: headPob ? headPob.trim() : null,
          phone: headPhone ? headPhone.trim() : null,
          email: headEmail ? headEmail.trim() : null,
          isPrimaryContact: true,
          orderIndex: 0,
        },
      });

      // 5. Create Spouse Member (if present)
      if (hasSpouse && spouseName && spouseName.trim()) {
        await tx.familyMember.create({
          data: {
            familyId: createdFamily.id,
            role: MemberRole.SPOUSE,
            fullName: spouseName.trim(),
            dateOfBirth: parseDateFlexible(spouseDob),
            placeOfBirth: spousePob ? spousePob.trim() : null,
            phone: spousePhone ? spousePhone.trim() : null,
            email: spouseEmail ? spouseEmail.trim() : null,
            isPrimaryContact: false,
            orderIndex: 1,
          },
        });
      }

      // 6. Create Children Members
      if (Array.isArray(children)) {
        let childOrder = 2;
        for (const child of children) {
          if (child.fullName && child.fullName.trim()) {
            await tx.familyMember.create({
              data: {
                familyId: createdFamily.id,
                role: MemberRole.CHILD,
                fullName: child.fullName.trim(),
                dateOfBirth: parseDateFlexible(child.dateOfBirth),
                placeOfBirth: child.placeOfBirth ? child.placeOfBirth.trim() : null,
                orderIndex: childOrder++,
              },
            });
          }
        }
      }

      return createdFamily;
    });

    return res.status(201).json({
      success: true,
      family: {
        id: result.id,
        familyCode: result.familyCode,
        status: result.status,
        houseName: result.houseName,
        headFullName: result.headFullName,
      },
    });
  } catch (err: any) {
    console.error('Error saving imported family record:', err);
    return res.status(500).json({ error: 'Failed to save imported family record.' });
  }
});
