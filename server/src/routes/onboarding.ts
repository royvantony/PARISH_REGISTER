import { Router, Request, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { FamilyStatus, RegistrationType, MemberRole, UserRole } from '@prisma/client';
import { logSystemActivity } from '../lib/activityLogger.js';
import {
  generateOnboardingExcel,
  validateStagingRow,
  downloadAndCacheDocument,
  DOCUMENT_COLUMNS,
  type StagingRow,
} from '../services/onboardingService.js';
import { getParishFeatures } from './features.js';
import { canUserOnboardParish } from './permissions.js';

export const onboardingRouter = Router();

onboardingRouter.use(authenticateJWT);

/**
 * Access guard enforcing the platform integration pathway:
 * Developer Approval (PAGE_ONBOARDING) -> Role & Rights (PARISH_ONBOARDING) -> Feature
 */
async function checkOnboardingAccess(
  req: Request,
  res: Response,
  requiredAction: 'canView' | 'canCreate' | 'canApprove' = 'canView'
): Promise<boolean> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return false;
  }

  // Developer / Super Admin has full unrestricted access
  if (user.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  const parishId = req.activeParishId || 1;

  // 1. Developer Approval Check: Is PAGE_ONBOARDING enabled for this parish?
  const features = await getParishFeatures(parishId);
  const isFeatureEnabled = features.find((f) => f.key === 'PAGE_ONBOARDING')?.isEnabled ?? false;
  if (!isFeatureEnabled) {
    res.status(403).json({ error: 'Parish Onboarding is currently disabled by Developer Controls for this parish.' });
    return false;
  }

  // 2. Role & Rights Check: Does this user have the required action permission?
  const perms = await canUserOnboardParish(user.userId, user.role, parishId);
  if (!perms[requiredAction]) {
    res.status(403).json({
      error: `Access denied: You do not have permission to perform this onboarding action (${requiredAction}).`,
    });
    return false;
  }

  return true;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max excel file
});

/**
 * 1. GET /api/onboarding/template - Download standardized Excel template
 */
onboardingRouter.get('/template', async (req: Request, res: Response) => {
  if (!(await checkOnboardingAccess(req, res, 'canView'))) return;
  try {
    const buffer = await generateOnboardingExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Parish_Onboarding_Template.xlsx"');
    return res.send(buffer);
  } catch (err: any) {
    console.error('Failed to generate onboarding template:', err);
    return res.status(500).json({ error: 'Failed to generate onboarding template.' });
  }
});

/**
 * 2. GET /api/onboarding/active-session - Check for existing in-progress draft session
 */
onboardingRouter.get('/active-session', async (req: Request, res: Response) => {
  if (!(await checkOnboardingAccess(req, res, 'canView'))) return;
  try {
    const parishId = req.activeParishId || 1;
    const session = await prisma.onboardingSession.findFirst({
      where: {
        parishId,
        status: 'DRAFT',
      },
      orderBy: { updatedAt: 'desc' },
    });

    const existingCodes = (
      await prisma.family.findMany({
        where: { parishId, familyCode: { not: null } },
        select: { familyCode: true },
      })
    )
      .map((f) => f.familyCode!)
      .filter(Boolean);

    return res.json({ session: session || null, existingCodes });
  } catch (err: any) {
    console.error('Error fetching active onboarding session:', err);
    return res.status(500).json({ error: 'Failed to fetch onboarding session.' });
  }
});

/**
 * 3. POST /api/onboarding/upload - Parse Excel/CSV and initialize Staging Session
 */
onboardingRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!(await checkOnboardingAccess(req, res, 'canCreate'))) return;
  try {
    const user = req.user!;
    const parishId = req.activeParishId || 1;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No Excel or CSV file uploaded.' });
    }

    const hasExistingCodes = req.body.hasExistingCodes === 'true' || req.body.hasExistingCodes === true;
    const unmatchedWardAction = req.body.unmatchedWardAction || 'MANUAL';

    // Fetch existing parish wards for mapping
    const parishUnits = await prisma.familyUnit.findMany({
      where: { parishId, isActive: true },
      select: { id: true, unitName: true },
    });

    // Fetch existing registered families for duplicate and code collision detection
    const existingFamilies = await prisma.family.findMany({
      where: { parishId },
      select: {
        id: true,
        familyCode: true,
        houseName: true,
        headFullName: true,
        members: {
          where: { role: 'HEAD' },
          select: { dateOfBirth: true },
          take: 1,
        },
      },
    });

    const existingFamiliesFormatted = existingFamilies.map((f) => ({
      id: f.id,
      familyCode: f.familyCode,
      houseName: f.houseName,
      headFullName: f.headFullName,
      headDobIso: f.members[0]?.dateOfBirth ? f.members[0].dateOfBirth.toISOString().split('T')[0] : null,
    }));

    const rowsData: any[] = [];

    // Parse Excel workbook using exceljs
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'Uploaded workbook has no worksheets.' });
    }

    // Extract header keys from row 1
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim();
    });

    // Extract data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const rowObj: Record<string, any> = {};
      let hasAnyValue = false;

      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          let val = cell.value;
          // Handle rich text or object values from Excel
          if (val && typeof val === 'object' && 'text' in val) {
            val = (val as any).text;
          } else if (val && typeof val === 'object' && 'result' in val) {
            val = (val as any).result;
          }
          rowObj[header] = val;
          if (val !== null && val !== undefined && String(val).trim() !== '') {
            hasAnyValue = true;
          }
        }
      });

      if (hasAnyValue) {
        rowsData.push(rowObj);
      }
    });

    if (rowsData.length === 0) {
      return res.status(400).json({ error: 'The uploaded file contains no data rows.' });
    }

    // Validate rows into staging structures with collision and duplicate detection
    const validatedRows: StagingRow[] = rowsData.map((raw, index) =>
      validateStagingRow(raw, index + 1, parishUnits, existingFamiliesFormatted)
    );

    const validRows = validatedRows.filter((r) => r.validationStatus === 'READY').length;
    const warningRows = validatedRows.filter((r) => r.validationStatus === 'WARNING').length;
    const errorRows = validatedRows.filter((r) => r.validationStatus === 'ERROR').length;

    // Discard any prior incomplete draft sessions for this parish to keep only 1 active session
    await prisma.onboardingSession.deleteMany({
      where: { parishId, status: 'DRAFT' },
    });

    // Create new persistent session
    const session = await prisma.onboardingSession.create({
      data: {
        parishId,
        status: 'DRAFT',
        fileName: file.originalname,
        hasExistingCodes,
        unmatchedWardAction,
        totalRows: validatedRows.length,
        validRows,
        warningRows,
        errorRows,
        rows: validatedRows as any,
      },
    });

    // Audit log
    await logSystemActivity({
      parishId,
      userId: user.userId,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'SETTINGS_CHANGE',
      category: 'GOVERNANCE',
      description: `Uploaded Parish Onboarding staging file "${file.originalname}" (${validatedRows.length} families).`,
      req,
    });

    return res.json({
      success: true,
      session,
      existingCodes: existingFamiliesFormatted.map((f) => f.familyCode!).filter(Boolean),
    });
  } catch (err: any) {
    console.error('Onboarding upload error:', err);
    return res.status(500).json({ error: `Failed to process onboarding file: ${err.message}` });
  }
});

/**
 * 4. PUT /api/onboarding/session/:id/update-row - In-place editing of a single row in Staging
 */
onboardingRouter.put('/session/:id/update-row', async (req: Request, res: Response) => {
  if (!(await checkOnboardingAccess(req, res, 'canCreate'))) return;
  try {
    const parishId = req.activeParishId || 1;
    const sessionId = parseInt(String(req.params.id), 10);
    const { rowId, updatedFields } = req.body;

    const session = await prisma.onboardingSession.findFirst({
      where: { id: sessionId, parishId, status: 'DRAFT' },
    });

    if (!session) {
      return res.status(404).json({ error: 'Active onboarding draft session not found.' });
    }

    const parishUnits = await prisma.familyUnit.findMany({
      where: { parishId, isActive: true },
      select: { id: true, unitName: true },
    });

    const rows = session.rows as any as StagingRow[];
    const rowIndex = rows.findIndex((r) => r.rowId === rowId);

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Staging row not found.' });
    }

    // Merge updated fields into row
    const existing = rows[rowIndex];
    const merged = { ...existing, ...updatedFields };

    // Re-validate row
    const revalidated = validateStagingRow(merged, existing.rowIndex, parishUnits);
    revalidated.rowId = existing.rowId;
    revalidated.documents = existing.documents; // retain doc caching state

    rows[rowIndex] = revalidated;

    const validRows = rows.filter((r) => r.validationStatus === 'READY').length;
    const warningRows = rows.filter((r) => r.validationStatus === 'WARNING').length;
    const errorRows = rows.filter((r) => r.validationStatus === 'ERROR').length;

    const updatedSession = await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        rows: rows as any,
        validRows,
        warningRows,
        errorRows,
      },
    });

    return res.json({
      success: true,
      row: revalidated,
      session: updatedSession,
    });
  } catch (err: any) {
    console.error('Update staging row error:', err);
    return res.status(500).json({ error: 'Failed to update staging row.' });
  }
});

/**
 * 5. POST /api/onboarding/session/:id/cache-docs - Background download of document URLs
 */
onboardingRouter.post('/session/:id/cache-docs', async (req: Request, res: Response) => {
  if (!(await checkOnboardingAccess(req, res, 'canCreate'))) return;
  try {
    const parishId = req.activeParishId || 1;
    const sessionId = parseInt(String(req.params.id), 10);

    const session = await prisma.onboardingSession.findFirst({
      where: { id: sessionId, parishId, status: 'DRAFT' },
    });

    if (!session) {
      return res.status(404).json({ error: 'Active onboarding draft session not found.' });
    }

    const rows = session.rows as any as StagingRow[];
    let cachedCount = 0;
    let failedCount = 0;

    // Process rows that have pending document URLs
    for (const row of rows) {
      for (const key of Object.keys(row.documents)) {
        const doc = row.documents[key];
        if (doc && doc.url && doc.status === 'PENDING') {
          const filePrefix = `${row.legacyCode || `row_${row.rowIndex}`}_${key}`;
          const result = await downloadAndCacheDocument(doc.url, parishId, sessionId, filePrefix);

          if (result.success) {
            doc.status = 'CACHED';
            doc.localTempPath = result.localPath;
            doc.fileName = result.fileName;
            doc.mimeType = result.mimeType;
            doc.fileSize = result.fileSize;
            delete doc.error;
            cachedCount++;
          } else {
            doc.status = 'FAILED';
            doc.error = result.error;
            failedCount++;
          }
        }
      }
    }

    // Save updated document statuses
    const updatedSession = await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: { rows: rows as any },
    });

    return res.json({
      success: true,
      cachedCount,
      failedCount,
      session: updatedSession,
    });
  } catch (err: any) {
    console.error('Cache docs error:', err);
    return res.status(500).json({ error: 'Failed to cache documents.' });
  }
});

/**
 * 6. POST /api/onboarding/session/:id/save-draft - Save entire draft array
 */
onboardingRouter.post('/session/:id/save-draft', async (req: Request, res: Response) => {
  if (!(await checkOnboardingAccess(req, res, 'canCreate'))) return;
  try {
    const parishId = req.activeParishId || 1;
    const sessionId = parseInt(String(req.params.id), 10);
    const { rows, activePage } = req.body;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Rows array required.' });
    }

    const validRows = rows.filter((r) => r.validationStatus === 'READY').length;
    const warningRows = rows.filter((r) => r.validationStatus === 'WARNING').length;
    const errorRows = rows.filter((r) => r.validationStatus === 'ERROR').length;

    const updatedSession = await prisma.onboardingSession.update({
      where: { id: sessionId, parishId },
      data: {
        rows: rows as any,
        totalRows: rows.length,
        validRows,
        warningRows,
        errorRows,
        ...(activePage ? { activePage: Math.max(1, parseInt(String(activePage), 10)) } : {}),
      },
    });

    return res.json({ success: true, session: updatedSession });
  } catch (err: any) {
    console.error('Save draft error:', err);
    return res.status(500).json({ error: 'Failed to save onboarding draft.' });
  }
});

/**
 * 7. DELETE /api/onboarding/session/:id - Cancel draft session & delete temp files
 */
onboardingRouter.delete('/session/:id', async (req: Request, res: Response) => {
  if (!(await checkOnboardingAccess(req, res, 'canCreate'))) return;
  try {
    const parishId = req.activeParishId || 1;
    const sessionId = parseInt(String(req.params.id), 10);

    const session = await prisma.onboardingSession.findFirst({
      where: { id: sessionId, parishId },
    });

    if (session) {
      // Remove temp directory if exists
      const tempDir = path.resolve(process.cwd(), 'uploads', 'temp', `onboarding_${parishId}_${sessionId}`);
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      await prisma.onboardingSession.delete({ where: { id: sessionId } });
    }

    return res.json({ success: true, message: 'Draft session discarded successfully.' });
  } catch (err: any) {
    console.error('Delete draft error:', err);
    return res.status(500).json({ error: 'Failed to discard session.' });
  }
});

/**
 * 8. POST /api/onboarding/session/:id/commit - Final atomic commit into Parish Register
 */
onboardingRouter.post('/session/:id/commit', async (req: Request, res: Response) => {
  if (!(await checkOnboardingAccess(req, res, 'canApprove'))) return;
  try {
    const user = req.user!;
    const parishId = req.activeParishId || 1;
    const sessionId = parseInt(String(req.params.id), 10);

    const session = await prisma.onboardingSession.findFirst({
      where: { id: sessionId, parishId, status: 'DRAFT' },
    });

    if (!session) {
      return res.status(404).json({ error: 'Active onboarding draft session not found.' });
    }

    const rows = session.rows as any as StagingRow[];
    const blockingErrors = rows.filter((r) => r.validationStatus === 'ERROR');

    if (blockingErrors.length > 0) {
      return res.status(400).json({
        error: `Cannot commit onboarding while ${blockingErrors.length} row(s) have critical errors. Please resolve all red errors first.`,
      });
    }

    const parish = await prisma.parish.findUnique({ where: { id: parishId } });
    if (!parish) {
      return res.status(404).json({ error: 'Parish not found.' });
    }

    let runningFamilyNumber = parish.nextFamilyNumber || 100001;
    const uploadBaseDir = path.resolve(process.cwd(), 'uploads');
    let importedFamilies = 0;
    let importedMembers = 0;
    let importedDocs = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const row of rows) {
          // Determine family code
          let assignedCode = row.legacyCode?.trim();
          if (!assignedCode) {
            assignedCode = `${parish.idPrefix || 'PARISH'}-${String(runningFamilyNumber).padStart(4, '0')}`;
            runningFamilyNumber++;
          }

          // Ensure ward exists or use fallback
          let resolvedUnitId = row.wardId;
          if (!resolvedUnitId && row.wardName && session.unmatchedWardAction === 'AUTO_CREATE') {
            const newUnit = await tx.familyUnit.create({
              data: {
                parishId,
                unitName: row.wardName.trim(),
                isActive: true,
              },
            });
            resolvedUnitId = newUnit.id;
          }

          // 1. Create Family
          const newFamily = await tx.family.create({
            data: {
              parishId,
              familyCode: assignedCode,
              houseName: row.houseName,
              unitId: resolvedUnitId || null,
              status: row.membershipStatus === 'INACTIVE' ? FamilyStatus.INACTIVE : FamilyStatus.ACTIVE,
              registrationType: row.registrationType === 'INDIVIDUAL' ? RegistrationType.INDIVIDUAL : RegistrationType.FAMILY,
              headFullName: row.headName,
              primaryPhone: row.headPhone || null,
              primaryEmail: row.headEmail || null,
              streetAddress: row.addressStreet || null,
              city: row.city || null,
              state: row.state || 'QLD',
              postalCode: row.postalCode || null,
              originParish: row.originParish || null,
              originDiocese: row.originDiocese || null,
              generalNotes: row.notes || null,
              notes: row.notes ? { create: { noteContent: row.notes, recordedBy: user.fullName } } : undefined,
            },
          });

          importedFamilies++;

          // 2. Create Head Member
          const headMember = await tx.familyMember.create({
            data: {
              familyId: newFamily.id,
              fullName: row.headName,
              role: MemberRole.HEAD,
              dateOfBirth: row.headDob ? new Date(row.headDob) : null,
              placeOfBirth: row.headPob || null,
              phone: row.headPhone || null,
              email: row.headEmail || null,
              isPrimaryContact: true,
              orderIndex: 0,
            },
          });

          importedMembers++;

          // 3. Create Spouse Member (if present)
          let spouseMemberId: number | null = null;
          if (row.spouseName) {
            const spouseMember = await tx.familyMember.create({
              data: {
                familyId: newFamily.id,
                fullName: row.spouseName,
                role: MemberRole.SPOUSE,
                dateOfBirth: row.spouseDob ? new Date(row.spouseDob) : null,
                placeOfBirth: row.spousePob || null,
                phone: row.spousePhone || null,
                email: row.spouseEmail || null,
                isPrimaryContact: false,
                orderIndex: 1,
              },
            });
            spouseMemberId = spouseMember.id;
            importedMembers++;
          }

          // 4. Create Children
          let childIndex = 2;
          for (const child of row.children || []) {
            if (child.fullName) {
              await tx.familyMember.create({
                data: {
                  familyId: newFamily.id,
                  fullName: child.fullName,
                  role: MemberRole.CHILD,
                  dateOfBirth: child.dob ? new Date(child.dob) : null,
                  isPrimaryContact: false,
                  orderIndex: childIndex++,
                },
              });
              importedMembers++;
            }
          }

          // 5. Move Cached Documents to permanent storage & insert metadata
          const familyFolder = path.join(uploadBaseDir, `family_${newFamily.id}`);
          if (!fs.existsSync(familyFolder)) {
            fs.mkdirSync(familyFolder, { recursive: true });
          }

          for (const key of Object.keys(row.documents)) {
            const doc = row.documents[key];
            if (doc && doc.status === 'CACHED' && doc.localTempPath && fs.existsSync(doc.localTempPath)) {
              const permanentFileName = doc.fileName || path.basename(doc.localTempPath);
              const destPath = path.join(familyFolder, permanentFileName);
              fs.copyFileSync(doc.localTempPath, destPath);

              const docDef = DOCUMENT_COLUMNS.find((d) => d.key === key);
              const documentType = docDef?.docType || 'OTHER';

              await tx.familyDocument.create({
                data: {
                  familyId: newFamily.id,
                  memberId: key.includes('head') ? headMember.id : key.includes('spouse') ? spouseMemberId : null,
                  documentType,
                  fileName: permanentFileName,
                  localPath: destPath,
                  originalUrl: doc.url,
                  fileSize: doc.fileSize || 0,
                  mimeType: doc.mimeType || 'application/pdf',
                },
              });
              importedDocs++;
            }
          }
        }

        // Resync PostgreSQL Sequences
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Family"', 'id'), COALESCE(MAX(id), 1)) FROM "Family";`);
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"FamilyMember"', 'id'), COALESCE(MAX(id), 1)) FROM "FamilyMember";`);
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"FamilyDocument"', 'id'), COALESCE(MAX(id), 1)) FROM "FamilyDocument";`);

        // Update parish nextFamilyNumber
        await tx.parish.update({
          where: { id: parishId },
          data: { nextFamilyNumber: runningFamilyNumber },
        });

        // Mark session as COMMITTED
        await tx.onboardingSession.update({
          where: { id: sessionId },
          data: { status: 'COMMITTED' },
        });
      },
      { timeout: 90000 } // 90s transaction timeout for bulk onboarding
    );

    // Audit log
    await logSystemActivity({
      parishId,
      userId: user.userId,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'SETTINGS_CHANGE',
      category: 'GOVERNANCE',
      description: `Committed Parish Onboarding: ${importedFamilies} families, ${importedMembers} members, ${importedDocs} documents.`,
      req,
    });

    return res.json({
      success: true,
      message: `Onboarding successfully committed! ${importedFamilies} families, ${importedMembers} members, and ${importedDocs} documents registered.`,
      counts: {
        families: importedFamilies,
        members: importedMembers,
        documents: importedDocs,
      },
    });
  } catch (err: any) {
    console.error('Commit onboarding error:', err);
    return res.status(500).json({ error: `Commit failed: ${err.message || 'Transaction aborted.'}` });
  }
});
