import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { FamilyStatus, RegistrationType, MemberRole, UserRole } from '@prisma/client';

export interface StagingChild {
  fullName: string;
  dob: string;
  gender: string;
}

export interface StagingDocItem {
  key: string;
  label: string;
  url: string | null;
  status: 'NONE' | 'PENDING' | 'CACHED' | 'FAILED';
  localTempPath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
}

export interface StagingRow {
  rowId: string;
  rowIndex: number;
  legacyCode: string;
  membershipStatus: 'ACTIVE' | 'INACTIVE';
  registrationType: 'FAMILY' | 'INDIVIDUAL';
  houseName: string;
  wardId: number | null;
  wardName: string;
  wardStatus: 'MATCHED' | 'UNMATCHED' | 'MISSING';
  addressStreet: string;
  city: string;
  state: string;
  postalCode: string;
  headName: string;
  headDob: string;
  headPob: string;
  headPhone: string;
  headEmail: string;
  headBaptismDate: string;
  headConfirmationDate: string;
  spouseName: string;
  spouseDob: string;
  spousePob: string;
  spousePhone: string;
  spouseEmail: string;
  marriageDate: string;
  marriagePlace: string;
  children: StagingChild[];
  originParish: string;
  originDiocese: string;
  notes: string;
  documents: Record<string, StagingDocItem>;
  validationStatus: 'READY' | 'WARNING' | 'ERROR';
  errors: string[];
  warnings: string[];
  isRectified?: boolean;
  isDuplicate?: boolean;
  duplicateMatch?: {
    id: number;
    familyCode: string | null;
    headFullName: string | null;
    houseName: string;
  } | null;
  isCodeCollision?: boolean;
}

export interface StagingSessionSummary {
  id: number;
  parishId: number;
  status: string;
  fileName: string | null;
  hasExistingCodes: boolean;
  unmatchedWardAction: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  createdAt: Date;
  updatedAt: Date;
}

// Flexible date normalizer (YYYY-MM-DD, DD/MM/YYYY, D/M/YYYY, etc.)
export function parseDateToIso(raw: any): { iso: string; isValid: boolean } {
  if (!raw) return { iso: '', isValid: true };
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const d = String(raw.getUTCDate()).padStart(2, '0');
    return { iso: `${y}-${m}-${d}`, isValid: true };
  }
  const s = String(raw).trim();
  if (!s) return { iso: '', isValid: true };

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
    if (y >= 1900 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isValid: true };
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (day > 1000) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (year < 100) {
      year += 2000;
    }
    if (year >= 1900 && year <= 2099 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, isValid: true };
    }
  }

  // Fallback check
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) {
    const y = fallback.getFullYear();
    const m = String(fallback.getMonth() + 1).padStart(2, '0');
    const d = String(fallback.getDate()).padStart(2, '0');
    if (y >= 1900 && y <= 2099) {
      return { iso: `${y}-${m}-${d}`, isValid: true };
    }
  }

  return { iso: s, isValid: false };
}

// Document fields mapping
export const DOCUMENT_COLUMNS = [
  { key: 'marriageCert', label: 'Marriage Certificate URL', docType: 'CERTIFICATE' },
  { key: 'headId', label: 'Head ID / Passport URL', docType: 'ID_PROOF' },
  { key: 'headBaptism', label: 'Head Baptism Certificate URL', docType: 'CERTIFICATE' },
  { key: 'spouseBaptism', label: 'Spouse Baptism Certificate URL', docType: 'CERTIFICATE' },
  { key: 'child1Baptism', label: 'Child 1 Baptism Certificate URL', docType: 'CERTIFICATE' },
  { key: 'child2Baptism', label: 'Child 2 Baptism Certificate URL', docType: 'CERTIFICATE' },
  { key: 'child3Baptism', label: 'Child 3 Baptism Certificate URL', docType: 'CERTIFICATE' },
  { key: 'otherDoc', label: 'Other Document URL', docType: 'OTHER' },
];

/**
 * Generates an Excel workbook template for Parish Onboarding.
 */
export async function generateOnboardingExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Parish Register System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Parish Onboarding', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const columns = [
    { header: 'Legacy Family Code (Optional)', key: 'legacyCode', width: 22 },
    { header: 'Membership Status (ACTIVE/INACTIVE)', key: 'membershipStatus', width: 28 },
    { header: 'Registration Type (FAMILY/INDIVIDUAL)', key: 'registrationType', width: 28 },
    { header: 'House Name (Veettuperu)*', key: 'houseName', width: 28 },
    { header: 'Family Unit / Ward Name', key: 'wardName', width: 24 },
    { header: 'Address - Street', key: 'addressStreet', width: 28 },
    { header: 'City / Suburb', key: 'city', width: 18 },
    { header: 'State', key: 'state', width: 10 },
    { header: 'Postal Code', key: 'postalCode', width: 14 },
    { header: 'Head Full Name*', key: 'headName', width: 26 },
    { header: 'Head Date of Birth (YYYY-MM-DD)*', key: 'headDob', width: 28 },
    { header: 'Head Place of Birth', key: 'headPob', width: 20 },
    { header: 'Head Phone', key: 'headPhone', width: 18 },
    { header: 'Head Email', key: 'headEmail', width: 26 },
    { header: 'Head Baptism Date (YYYY-MM-DD)', key: 'headBaptismDate', width: 28 },
    { header: 'Head Confirmation Date (YYYY-MM-DD)', key: 'headConfirmationDate', width: 30 },
    { header: 'Spouse Full Name', key: 'spouseName', width: 26 },
    { header: 'Spouse Date of Birth (YYYY-MM-DD)', key: 'spouseDob', width: 28 },
    { header: 'Spouse Place of Birth', key: 'spousePob', width: 20 },
    { header: 'Spouse Phone', key: 'spousePhone', width: 18 },
    { header: 'Spouse Email', key: 'spouseEmail', width: 26 },
    { header: 'Marriage Date (YYYY-MM-DD)', key: 'marriageDate', width: 26 },
    { header: 'Marriage Place', key: 'marriagePlace', width: 22 },
    { header: 'Child 1 Full Name', key: 'child1Name', width: 22 },
    { header: 'Child 1 Date of Birth (YYYY-MM-DD)', key: 'child1Dob', width: 28 },
    { header: 'Child 1 Gender (MALE/FEMALE)', key: 'child1Gender', width: 24 },
    { header: 'Child 2 Full Name', key: 'child2Name', width: 22 },
    { header: 'Child 2 Date of Birth (YYYY-MM-DD)', key: 'child2Dob', width: 28 },
    { header: 'Child 2 Gender (MALE/FEMALE)', key: 'child2Gender', width: 24 },
    { header: 'Child 3 Full Name', key: 'child3Name', width: 22 },
    { header: 'Child 3 Date of Birth (YYYY-MM-DD)', key: 'child3Dob', width: 28 },
    { header: 'Child 3 Gender (MALE/FEMALE)', key: 'child3Gender', width: 24 },
    { header: 'Child 4 Full Name', key: 'child4Name', width: 22 },
    { header: 'Child 4 Date of Birth (YYYY-MM-DD)', key: 'child4Dob', width: 28 },
    { header: 'Child 4 Gender (MALE/FEMALE)', key: 'child4Gender', width: 24 },
    { header: 'Child 5 Full Name', key: 'child5Name', width: 22 },
    { header: 'Child 5 Date of Birth (YYYY-MM-DD)', key: 'child5Dob', width: 28 },
    { header: 'Child 5 Gender (MALE/FEMALE)', key: 'child5Gender', width: 24 },
    { header: 'Origin Parish in India', key: 'originParish', width: 24 },
    { header: 'Origin Diocese in India', key: 'originDiocese', width: 24 },
    { header: 'Pastoral & Household Notes', key: 'notes', width: 30 },
    ...DOCUMENT_COLUMNS.map((d) => ({ header: d.label, key: d.key, width: 34 })),
  ];

  worksheet.columns = columns;

  // Header row styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    // Color document columns with Indigo, standard columns with Burgundy
    const isDoc = colNumber > 41;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isDoc ? 'FF3730A3' : 'FF7F1D1D' }, // Indigo-900 or Red-900
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Sample row 1
  worksheet.addRow({
    legacyCode: 'SABN-0001',
    membershipStatus: 'ACTIVE',
    registrationType: 'FAMILY',
    houseName: 'Vadakumpadan',
    wardName: 'St. Alphonsa Ward',
    addressStreet: '12 Acacia Street',
    city: 'Chermside',
    state: 'QLD',
    postalCode: '4032',
    headName: 'Thomas Roy Vadakumpadan',
    headDob: '1982-04-15',
    headPob: 'Thrissur',
    headPhone: '0412345678',
    headEmail: 'thomas.vadakumpadan@example.com',
    headBaptismDate: '1982-05-02',
    headConfirmationDate: '1995-10-12',
    spouseName: 'Mary Thomas Vadakumpadan',
    spouseDob: '1985-08-20',
    spousePob: 'Ernakulam',
    spousePhone: '0423456789',
    spouseEmail: 'mary.vadakumpadan@example.com',
    marriageDate: '2010-01-14',
    marriagePlace: 'Lourdes Cathedral, Thrissur',
    child1Name: 'Francis Thomas Vadakumpadan',
    child1Dob: '2012-09-08',
    child1Gender: 'MALE',
    child2Name: 'Teresa Thomas Vadakumpadan',
    child2Dob: '2016-03-24',
    child2Gender: 'FEMALE',
    originParish: 'St. Thomas Church, Palayur',
    originDiocese: 'Trichur (Syro-Malabar)',
    notes: 'Family moved to Brisbane in 2018. Very active in choir.',
    marriageCert: 'https://example.com/parish-docs/FAM0001_marriage.pdf',
    headId: 'https://example.com/parish-docs/FAM0001_passport.pdf',
    headBaptism: '',
    spouseBaptism: '',
    child1Baptism: '',
    child2Baptism: '',
    child3Baptism: '',
    otherDoc: '',
  });

  // Sample row 2 (Inactive family)
  worksheet.addRow({
    legacyCode: 'SABN-0002',
    membershipStatus: 'INACTIVE',
    registrationType: 'FAMILY',
    houseName: 'Kanjirakkatt',
    wardName: 'St. Joseph Ward',
    addressStreet: '45 Palm Grove',
    city: 'Aspley',
    state: 'QLD',
    postalCode: '4034',
    headName: 'Joseph Kanjirakkatt',
    headDob: '1975-11-03',
    headPob: 'Pala',
    headPhone: '0434567890',
    headEmail: '',
    notes: 'Relocated to Sydney in 2024. Maintained for parish history.',
  });

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

/**
 * Validates a single parsed row against parish master data and rules.
 */
export function validateStagingRow(
  raw: any,
  rowIndex: number,
  parishUnits: Array<{ id: number; unitName: string }>,
  existingFamilies?: Array<{ id: number; familyCode: string | null; headFullName: string | null; houseName: string; headDobIso?: string | null }>
): StagingRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const legacyCode = String(raw.legacyCode || raw['Legacy Family Code (Optional)'] || '').trim();
  const rawStatus = String(raw.membershipStatus || raw['Membership Status (ACTIVE/INACTIVE)'] || 'ACTIVE').trim().toUpperCase();
  const membershipStatus: 'ACTIVE' | 'INACTIVE' = rawStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const regTypeRaw = String(raw.registrationType || raw['Registration Type (FAMILY/INDIVIDUAL)'] || 'FAMILY').trim().toUpperCase();
  const registrationType: 'FAMILY' | 'INDIVIDUAL' = regTypeRaw === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'FAMILY';

  const houseName = String(raw.houseName || raw['House Name (Veettuperu)*'] || raw['House Name'] || '').trim();
  if (!houseName) {
    errors.push('House Name is required');
  }

  // Ward matching
  const rawWard = String(raw.wardName || raw['Family Unit / Ward Name'] || raw['Ward'] || '').trim();
  let wardId: number | null = null;
  let wardName = rawWard;
  let wardStatus: 'MATCHED' | 'UNMATCHED' | 'MISSING' = 'MISSING';

  if (rawWard) {
    const matchedUnit = parishUnits.find(
      (u) =>
        u.unitName.trim().toLowerCase() === rawWard.toLowerCase() ||
        u.unitName.trim().toLowerCase().replace(/\s+ward$/i, '') === rawWard.toLowerCase().replace(/\s+ward$/i, '')
    );
    if (matchedUnit) {
      wardId = matchedUnit.id;
      wardName = matchedUnit.unitName;
      wardStatus = 'MATCHED';
    } else {
      wardStatus = 'UNMATCHED';
      warnings.push(`Ward "${rawWard}" not found in parish master. Please select from dropdown.`);
    }
  } else {
    warnings.push('No Family Unit / Ward assigned.');
  }

  // Address
  const addressStreet = String(raw.addressStreet || raw['Address - Street'] || '').trim();
  const city = String(raw.city || raw['City / Suburb'] || '').trim();
  const state = String(raw.state || raw['State'] || 'QLD').trim().toUpperCase();
  const postalCode = String(raw.postalCode || raw['Postal Code'] || '').trim();

  // Head details
  const headName = String(raw.headName || raw['Head Full Name*'] || raw['Head Full Name'] || '').trim();
  if (!headName) {
    errors.push('Head Full Name is required');
  }

  const rawHeadDob = raw.headDob || raw['Head Date of Birth (YYYY-MM-DD)*'] || raw['Head Date of Birth'];
  const headDobParsed = parseDateToIso(rawHeadDob);
  if (!headDobParsed.iso) {
    errors.push('Head Date of Birth is required');
  } else if (!headDobParsed.isValid) {
    errors.push(`Invalid Head Date of Birth format: "${headDobParsed.iso}". Use YYYY-MM-DD`);
  }

  const headPob = String(raw.headPob || raw['Head Place of Birth'] || '').trim();
  const headPhone = String(raw.headPhone || raw['Head Phone'] || '').trim();
  const headEmail = String(raw.headEmail || raw['Head Email'] || '').trim().toLowerCase();

  const headBaptismDateParsed = parseDateToIso(raw.headBaptismDate || raw['Head Baptism Date (YYYY-MM-DD)']);
  if (!headBaptismDateParsed.isValid) warnings.push('Invalid Head Baptism Date format');

  const headConfirmationDateParsed = parseDateToIso(raw.headConfirmationDate || raw['Head Confirmation Date (YYYY-MM-DD)']);
  if (!headConfirmationDateParsed.isValid) warnings.push('Invalid Head Confirmation Date format');

  // Spouse details
  const spouseName = String(raw.spouseName || raw['Spouse Full Name'] || '').trim();
  const spouseDobParsed = parseDateToIso(raw.spouseDob || raw['Spouse Date of Birth (YYYY-MM-DD)']);
  if (raw.spouseDob && !spouseDobParsed.isValid) warnings.push('Invalid Spouse Date of Birth format');

  const spousePob = String(raw.spousePob || raw['Spouse Place of Birth'] || '').trim();
  const spousePhone = String(raw.spousePhone || raw['Spouse Phone'] || '').trim();
  const spouseEmail = String(raw.spouseEmail || raw['Spouse Email'] || '').trim().toLowerCase();

  const marriageDateParsed = parseDateToIso(raw.marriageDate || raw['Marriage Date (YYYY-MM-DD)']);
  if (raw.marriageDate && !marriageDateParsed.isValid) warnings.push('Invalid Marriage Date format');
  const marriagePlace = String(raw.marriagePlace || raw['Marriage Place'] || '').trim();

  // Children (up to 5)
  const children: StagingChild[] = [];
  for (let c = 1; c <= 5; c++) {
    const cName = String(raw[`child${c}Name`] || raw[`Child ${c} Full Name`] || '').trim();
    if (cName) {
      const cDobRaw = raw[`child${c}Dob`] || raw[`Child ${c} Date of Birth (YYYY-MM-DD)`];
      const cDobParsed = parseDateToIso(cDobRaw);
      if (cDobRaw && !cDobParsed.isValid) {
        warnings.push(`Invalid Child ${c} Date of Birth format`);
      }
      const cGenderRaw = String(raw[`child${c}Gender`] || raw[`Child ${c} Gender (MALE/FEMALE)`] || 'MALE').trim().toUpperCase();
      const gender = cGenderRaw.startsWith('F') ? 'FEMALE' : 'MALE';
      children.push({
        fullName: cName,
        dob: cDobParsed.iso,
        gender,
      });
    }
  }

  // Origins & notes
  const originParish = String(raw.originParish || raw['Origin Parish in India'] || '').trim();
  const originDiocese = String(raw.originDiocese || raw['Origin Diocese in India'] || '').trim();
  const notes = String(raw.notes || raw['Pastoral & Household Notes'] || '').trim();

  // Document URLs
  const documents: Record<string, StagingDocItem> = {};
  for (const docDef of DOCUMENT_COLUMNS) {
    const rawUrl = String(raw[docDef.key] || raw[docDef.label] || '').trim();
    if (rawUrl) {
      const isHttp = /^https?:\/\//i.test(rawUrl);
      if (!isHttp) {
        warnings.push(`${docDef.label} is not a valid HTTP/HTTPS web link.`);
      }
      documents[docDef.key] = {
        key: docDef.key,
        label: docDef.label,
        url: isHttp ? rawUrl : null,
        status: isHttp ? 'PENDING' : 'NONE',
        error: isHttp ? undefined : 'Invalid URL scheme',
      };
    } else {
      documents[docDef.key] = {
        key: docDef.key,
        label: docDef.label,
        url: null,
        status: 'NONE',
      };
    }
  }

  // Code Collision Check with existing registered families in Parish Register
  let isCodeCollision = false;
  if (legacyCode && existingFamilies) {
    const matched = existingFamilies.find(
      (f) => f.familyCode && f.familyCode.trim().toLowerCase() === legacyCode.toLowerCase()
    );
    if (matched) {
      isCodeCollision = true;
      errors.push(`Family Code "${legacyCode}" is already assigned to "${matched.headFullName || 'another family'}" in the Parish Register. Please edit.`);
    }
  }

  // Duplicate Family Check (Head Name + House Name OR Head Name + DOB)
  let isDuplicate = false;
  let duplicateMatch: { id: number; familyCode: string | null; headFullName: string | null; houseName: string } | null = null;

  if (headName && existingFamilies) {
    const matched = existingFamilies.find((f) => {
      const nameMatch = f.headFullName && f.headFullName.trim().toLowerCase() === headName.toLowerCase();
      if (!nameMatch) return false;

      const houseMatch = houseName && f.houseName && f.houseName.trim().toLowerCase() === houseName.toLowerCase();
      if (houseMatch) return true;

      if (headDobParsed.isValid && headDobParsed.iso && f.headDobIso) {
        if (f.headDobIso === headDobParsed.iso) return true;
      }
      return false;
    });

    if (matched) {
      isDuplicate = true;
      duplicateMatch = {
        id: matched.id,
        familyCode: matched.familyCode,
        headFullName: matched.headFullName,
        houseName: matched.houseName,
      };
      warnings.push(
        `Duplicate Family Detected: Matches existing family "${matched.familyCode || 'Registered'}" (${matched.headFullName} - ${matched.houseName}) in Parish Register. You can remove this record from staging or edit.`
      );
    }
  }

  // Validation Status calculation
  let validationStatus: 'READY' | 'WARNING' | 'ERROR' = 'READY';
  if (errors.length > 0) {
    validationStatus = 'ERROR';
  } else if (warnings.length > 0 || wardStatus === 'UNMATCHED') {
    validationStatus = 'WARNING';
  }

  return {
    rowId: `row_${rowIndex}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    rowIndex,
    legacyCode,
    membershipStatus,
    registrationType,
    houseName,
    wardId,
    wardName,
    wardStatus,
    addressStreet,
    city,
    state,
    postalCode,
    headName,
    headDob: headDobParsed.iso,
    headPob,
    headPhone,
    headEmail,
    headBaptismDate: headBaptismDateParsed.iso,
    headConfirmationDate: headConfirmationDateParsed.iso,
    spouseName,
    spouseDob: spouseDobParsed.iso,
    spousePob,
    spousePhone,
    spouseEmail,
    marriageDate: marriageDateParsed.iso,
    marriagePlace,
    children,
    originParish,
    originDiocese,
    notes,
    documents,
    validationStatus,
    errors,
    warnings,
    isRectified: Boolean(raw.isRectified),
    isDuplicate,
    duplicateMatch,
    isCodeCollision,
  };
}

/**
 * Downloads a document from a URL with an 8-second timeout into parish temp directory.
 */
export async function downloadAndCacheDocument(
  url: string,
  parishId: number,
  sessionId: number,
  filePrefix: string
): Promise<{ success: boolean; localPath?: string; fileName?: string; mimeType?: string; fileSize?: number; error?: string }> {
  try {
    const tempDir = path.resolve(process.cwd(), 'uploads', 'temp', `onboarding_${parishId}_${sessionId}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // SSRF Guard: Prevent internal network scanning
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host === '169.254.169.254'
    ) {
      return { success: false, error: 'Access to private internal host denied.' };
    }

    // 8-second timeout using AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ParishRegisterOnboarding/1.0',
        Accept: 'application/pdf,image/*,*/*',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status} ${response.statusText}` };
    }

    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    let ext = '.pdf';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
    else if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else {
      const urlExt = path.extname(parsed.pathname);
      if (urlExt && urlExt.length <= 5) ext = urlExt;
    }

    const fileName = `${filePrefix}_${Date.now()}${ext}`;
    const localPath = path.join(tempDir, fileName);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Limit single file size to 25MB
    if (buffer.length > 25 * 1024 * 1024) {
      return { success: false, error: 'File size exceeds 25MB limit.' };
    }

    fs.writeFileSync(localPath, buffer);

    return {
      success: true,
      localPath,
      fileName,
      mimeType,
      fileSize: buffer.length,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Download timed out after 8 seconds.' };
    }
    return { success: false, error: err.message || 'Download failed.' };
  }
}
