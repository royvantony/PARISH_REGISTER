import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { sendParishEmail } from '../lib/email.js';
import { logSystemActivity } from '../lib/activityLogger.js';
import { isFeatureEnabled } from './features.js';
import { checkUserPermission } from './permissions.js';
import { FamilyStatus, MemberRole, RegistrationType, UserRole } from '@prisma/client';

export const backupRouter = Router();

backupRouter.use(authenticateJWT);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max pack
});

// Magic bytes header for .parishpack format: "PARISHPACK_V1" (13 bytes) + padding (3 bytes) = 16 bytes
const MAGIC_HEADER = Buffer.from('PARISHPACK_V1\0\0\0', 'utf8');

function getBackupEncryptionKey(): Buffer {
  const secret =
    process.env.BACKUP_ENCRYPTION_KEY?.trim() ||
    process.env.FEATURE_VAULT_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'parish_register_backup_secret_key_2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a zip buffer into a proprietary AES-256-GCM .parishpack container.
 */
function encryptToParishPack(zipBuffer: Buffer): Buffer {
  const key = getBackupEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(zipBuffer), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes tag

  // Format: [16B MAGIC] + [12B IV] + [16B TAG] + [CIPHERTEXT]
  return Buffer.concat([MAGIC_HEADER, iv, tag, encrypted]);
}

/**
 * Decrypts a .parishpack container back into raw zip buffer.
 * Throws an error if header is invalid or if payload was tampered with.
 */
function decryptFromParishPack(packBuffer: Buffer): Buffer {
  if (packBuffer.length < 44) {
    throw new Error('Invalid archive: File is too small to be a valid .parishpack.');
  }

  const magic = packBuffer.subarray(0, 16);
  if (!magic.equals(MAGIC_HEADER)) {
    throw new Error('Invalid archive format: Not a valid .parishpack file.');
  }

  const iv = packBuffer.subarray(16, 28);
  const tag = packBuffer.subarray(28, 44);
  const ciphertext = packBuffer.subarray(44);

  const key = getBackupEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err: any) {
    throw new Error('Decryption failed: Tampered archive or invalid encryption key.');
  }
}

// In-memory OTP store: userId -> { otpHash: string; expiresAt: number; parishId: number }
const otpStore = new Map<number, { otpHash: string; expiresAt: number; parishId: number }>();

// ---------------------------------------------------------------------------
// 1. GET /api/backup/export - Export Complete Parish Archive (.parishpack)
// ---------------------------------------------------------------------------
backupRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const parishId = req.activeParishId;

    // Check Developer Controls
    const isExportAllowed = await isFeatureEnabled('SETTING_BACKUP_EXPORT', parishId);
    if (!isExportAllowed && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Parish backup export feature is currently disabled.' });
    }

    // Role check: Only Super Admin, Diocesan Admin, Parish Priest, or Parish Admin
    const canExport =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.PARISH_PRIEST ||
      (user.role === UserRole.PARISH_ADMIN && (await checkUserPermission(user.userId, user.role, parishId, 'SETTINGS', 'canExport')));

    if (!canExport) {
      return res.status(403).json({ error: 'You do not have permission to export parish backup archives.' });
    }

    // 1. Fetch Parish details
    const parish = await prisma.parish.findUnique({
      where: { id: parishId },
      include: {
        diocese: true,
        units: { orderBy: { id: 'asc' } },
        nativeDioceses: { orderBy: { id: 'asc' } },
      },
    });

    if (!parish) {
      return res.status(404).json({ error: 'Active parish not found.' });
    }

    // 2. Fetch all Families with Members, Direct Debits, Documents metadata, and Notes
    const families = await prisma.family.findMany({
      where: { parishId },
      include: {
        unit: true,
        members: { orderBy: { id: 'asc' } },
        directDebits: true,
        documents: true,
        notes: { orderBy: { noteDate: 'asc' } },
      },
      orderBy: { id: 'asc' },
    });

    // 3. Fetch Parish Users (exclude global SUPER_ADMIN)
    const users = await prisma.parishUser.findMany({
      where: {
        parishId,
        role: { not: UserRole.SUPER_ADMIN },
      },
      include: {
        overrides: true,
      },
      orderBy: { id: 'asc' },
    });

    // 4. Fetch Role Permission overrides for this parish
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { parishId },
      orderBy: { id: 'asc' },
    });

    // 5. Build in-memory zip archive
    const zip = new AdmZip();

    const timestamp = new Date().toISOString();
    const manifest = {
      formatVersion: '1.0',
      system: 'Parish Register System',
      exportTimestamp: timestamp,
      parish: {
        parishCode: parish.parishCode,
        parishName: parish.parishName,
        city: parish.city,
        state: parish.state,
        postalCode: parish.postalCode,
        contactEmail: parish.contactEmail,
        contactPhone: parish.contactPhone,
        idPrefix: parish.idPrefix,
        nextFamilyNumber: parish.nextFamilyNumber,
        governingDiocese: parish.diocese?.dioceseName || null,
      },
      counts: {
        units: parish.units.length,
        nativeDioceses: parish.nativeDioceses.length,
        families: families.length,
        members: families.reduce((acc, f) => acc + f.members.length, 0),
        users: users.length,
        documents: families.reduce((acc, f) => acc + f.documents.length, 0),
      },
    };

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
    zip.addFile('units.json', Buffer.from(JSON.stringify(parish.units, null, 2), 'utf8'));
    zip.addFile('native_dioceses.json', Buffer.from(JSON.stringify(parish.nativeDioceses, null, 2), 'utf8'));
    zip.addFile('families.json', Buffer.from(JSON.stringify(families, null, 2), 'utf8'));
    zip.addFile('users.json', Buffer.from(JSON.stringify(users, null, 2), 'utf8'));
    zip.addFile('role_permissions.json', Buffer.from(JSON.stringify(rolePermissions, null, 2), 'utf8'));

    // 6. Attach physical documents from uploads directory
    let attachedDocCount = 0;
    for (const fam of families) {
      for (const doc of fam.documents) {
        if (doc.localPath && fs.existsSync(doc.localPath)) {
          const fileBuf = fs.readFileSync(doc.localPath);
          const zipEntryName = `documents/${fam.familyCode || `fam_${fam.id}`}/${path.basename(doc.localPath)}`;
          zip.addFile(zipEntryName, fileBuf);
          attachedDocCount++;
        }
      }
    }

    const zipBuffer = zip.toBuffer();
    const encryptedPack = encryptToParishPack(zipBuffer);

    // Audit log
    await logSystemActivity({
      parishId,
      userId: user.userId,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'REPORT_EXPORT',
      category: 'GOVERNANCE',
      description: `Exported full parish archive pack for "${parish.parishName}" (${families.length} families, ${attachedDocCount} documents).`,
      req,
    });

    const safeFilename = `${parish.parishCode || 'PARISH'}_ARCHIVE_${new Date().toISOString().slice(0, 10)}.parishpack`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', encryptedPack.length);
    return res.send(encryptedPack);
  } catch (err: any) {
    console.error('Backup export error:', err);
    return res.status(500).json({ error: 'Failed to generate parish backup archive.' });
  }
});

// ---------------------------------------------------------------------------
// 2. POST /api/backup/request-otp - Request 6-Digit Email OTP for Import
// ---------------------------------------------------------------------------
backupRouter.post('/request-otp', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const parishId = req.activeParishId;

    const isImportAllowed = await isFeatureEnabled('SETTING_BACKUP_IMPORT', parishId);
    if (!isImportAllowed && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Parish data import feature is currently disabled in Developer Controls.' });
    }

    // Role check: Only Super Admin, Diocesan Admin, Parish Priest, or Parish Admin
    const canImport =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.PARISH_PRIEST ||
      user.role === UserRole.PARISH_ADMIN;

    if (!canImport) {
      return res.status(403).json({ error: 'You do not have permission to perform parish archive imports.' });
    }

    // Generate 6-digit numeric OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    otpStore.set(user.userId, { otpHash, expiresAt, parishId });

    const parish = await prisma.parish.findUnique({ where: { id: parishId } });
    const parishName = parish?.parishName || 'Parish Register';

    // Dispatch OTP via Parish SMTP
    const emailResult = await sendParishEmail(parishId, {
      to: user.email,
      subject: `[${parishName}] Parish Data Import Authorization Code`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <h2 style="color: #1b4332; margin-top: 0;">Parish Archive Import Authorization</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Hello <strong>${user.fullName}</strong>,
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            A request was initiated to import a <strong>.parishpack</strong> archive into <strong>${parishName}</strong>.
            Please enter the 6-digit verification code below to authorize this administrative action:
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #047857; background: #ecfdf5; padding: 12px 24px; border-radius: 12px; border: 2px dashed #059669; display: inline-block;">
              ${rawOtp}
            </span>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
            This code expires in 10 minutes. If you did not initiate this import, please change your password immediately.
          </p>
        </div>
      `,
      text: `Your Parish Register Import OTP is: ${rawOtp}. Valid for 10 minutes.`,
    });

    const isDevEnv =
      process.env.APP_ENV === 'Dev' ||
      process.env.NODE_ENV !== 'production' ||
      process.env.ALLOW_DEV_LOGIN === 'true';

    console.log(`[Backup OTP] Generated OTP for user ${user.email}: ${rawOtp}`);

    return res.json({
      success: true,
      message: emailResult.success
        ? `A 6-digit verification code has been dispatched to ${user.email}.`
        : `OTP generated.${isDevEnv ? ` (Dev Console OTP: ${rawOtp})` : ''}`,
      devOtpHint: isDevEnv ? rawOtp : undefined,
    });
  } catch (err: any) {
    console.error('Request import OTP error:', err);
    return res.status(500).json({ error: 'Failed to dispatch authorization OTP.' });
  }
});

// ---------------------------------------------------------------------------
// 3. POST /api/backup/audit - Verify OTP & Deep Pre-Flight Integrity Audit
// ---------------------------------------------------------------------------
backupRouter.post('/audit', upload.single('archive'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const parishId = req.activeParishId;
    const { otp } = req.body;

    if (!otp || !otp.trim()) {
      return res.status(400).json({ error: '6-digit authorization code is required.' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No .parishpack file uploaded.' });
    }

    // 1. Verify OTP
    const stored = otpStore.get(user.userId);
    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Authorization code has expired. Please request a new code.' });
    }

    const submittedHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (submittedHash !== stored.otpHash) {
      return res.status(400).json({ error: 'Invalid authorization code.' });
    }

    // 2. Decrypt .parishpack
    let zipBuffer: Buffer;
    try {
      zipBuffer = decryptFromParishPack(req.file.buffer);
    } catch (decryptErr: any) {
      return res.status(400).json({ error: decryptErr.message });
    }

    const zip = new AdmZip(zipBuffer);
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      return res.status(400).json({ error: 'Corrupt archive: Missing manifest.json in package.' });
    }

    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    const familiesEntry = zip.getEntry('families.json');
    const usersEntry = zip.getEntry('users.json');
    const unitsEntry = zip.getEntry('units.json');

    const families: any[] = familiesEntry ? JSON.parse(familiesEntry.getData().toString('utf8')) : [];
    const users: any[] = usersEntry ? JSON.parse(usersEntry.getData().toString('utf8')) : [];
    const units: any[] = unitsEntry ? JSON.parse(unitsEntry.getData().toString('utf8')) : [];

    // 3. Deep Data Integrity Audit
    const warnings: string[] = [];
    const errors: string[] = [];

    const familyCodes = new Set<string>();
    let activeFamiliesCount = 0;
    let inactiveFamiliesCount = 0;
    let totalMembersCount = 0;

    families.forEach((fam, idx) => {
      if (fam.familyCode) {
        if (familyCodes.has(fam.familyCode)) {
          errors.push(`Duplicate family code in package: ${fam.familyCode}`);
        }
        familyCodes.add(fam.familyCode);
      }
      if (!fam.houseName && !fam.headFullName) {
        warnings.push(`Row ${idx + 1}: Family without House Name or Head Name.`);
      }
      if (fam.status === 'INACTIVE') {
        inactiveFamiliesCount++;
      } else {
        activeFamiliesCount++;
      }
      totalMembersCount += Array.isArray(fam.members) ? fam.members.length : 0;
    });

    // Check Documents inside archive
    const docEntries = zip.getEntries().filter((e) => e.entryName.startsWith('documents/') && !e.isDirectory);

    return res.json({
      success: true,
      verified: true,
      manifest,
      summary: {
        totalFamilies: families.length,
        activeFamilies: activeFamiliesCount,
        inactiveFamilies: inactiveFamiliesCount,
        totalMembers: totalMembersCount,
        totalWards: units.length,
        totalUsers: users.length,
        totalDocumentsInArchive: docEntries.length,
      },
      audit: {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.slice(0, 10),
      },
    });
  } catch (err: any) {
    console.error('Audit archive error:', err);
    return res.status(500).json({ error: 'Failed to inspect and audit parish archive.' });
  }
});

// ---------------------------------------------------------------------------
// 4. POST /api/backup/commit - Execute Atomic Database Import with Identity Sequence Sync
// ---------------------------------------------------------------------------
backupRouter.post('/commit', upload.single('archive'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const parishId = req.activeParishId;
    const { otp, importUsers } = req.body;

    if (!otp || !otp.trim()) {
      return res.status(400).json({ error: 'Authorization code is required.' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No archive provided.' });
    }

    // Verify OTP
    const stored = otpStore.get(user.userId);
    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Authorization code expired. Please request a new code.' });
    }

    const submittedHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (submittedHash !== stored.otpHash) {
      return res.status(400).json({ error: 'Invalid authorization code.' });
    }

    // Decrypt pack
    const zipBuffer = decryptFromParishPack(req.file.buffer);
    const zip = new AdmZip(zipBuffer);

    const familiesEntry = zip.getEntry('families.json');
    const unitsEntry = zip.getEntry('units.json');
    const nativeDiocesesEntry = zip.getEntry('native_dioceses.json');
    const usersEntry = zip.getEntry('users.json');

    if (!familiesEntry) {
      return res.status(400).json({ error: 'Invalid archive: Missing families.json' });
    }

    const families: any[] = JSON.parse(familiesEntry.getData().toString('utf8'));
    const units: any[] = unitsEntry ? JSON.parse(unitsEntry.getData().toString('utf8')) : [];
    const nativeDioceses: any[] = nativeDiocesesEntry ? JSON.parse(nativeDiocesesEntry.getData().toString('utf8')) : [];
    const users: any[] = usersEntry ? JSON.parse(usersEntry.getData().toString('utf8')) : [];

    // Physical documents destination folder: uploads/documents/parish_{parishId}/
    const uploadBaseDir = path.resolve(process.cwd(), 'uploads', 'documents', `parish_${parishId}`);
    if (!fs.existsSync(uploadBaseDir)) {
      fs.mkdirSync(uploadBaseDir, { recursive: true });
    }

    // Execute atomic PostgreSQL import transaction
    let importedFamiliesCount = 0;
    let importedMembersCount = 0;
    let importedDocsCount = 0;

    await prisma.$transaction(
      async (tx) => {
        // 1. Sync Wards / Family Units (Natural key: unitName)
        const unitMap = new Map<string, number>();
        for (const u of units) {
          if (!u.unitName) continue;
          const upserted = await tx.familyUnit.upsert({
            where: {
              parishId_unitName: {
                parishId,
                unitName: u.unitName.trim(),
              },
            },
            update: {
              category: u.category || 'GEOGRAPHIC',
              isActive: u.isActive !== undefined ? u.isActive : true,
            },
            create: {
              parishId,
              unitName: u.unitName.trim(),
              category: u.category || 'GEOGRAPHIC',
              isActive: u.isActive !== undefined ? u.isActive : true,
            },
          });
          unitMap.set(u.unitName.trim().toLowerCase(), upserted.id);
        }

        // 2. Sync Native Dioceses
        for (const d of nativeDioceses) {
          if (!d.dioceseName) continue;
          await tx.nativeDiocese.upsert({
            where: {
              parishId_dioceseName: {
                parishId,
                dioceseName: d.dioceseName.trim(),
              },
            },
            update: {
              stateInIndia: d.stateInIndia || 'Kerala',
              rite: d.rite || 'Syro-Malabar',
            },
            create: {
              parishId,
              dioceseName: d.dioceseName.trim(),
              stateInIndia: d.stateInIndia || 'Kerala',
              rite: d.rite || 'Syro-Malabar',
            },
          });
        }

        // 3. Import Families & Members (Natural key: familyCode)
        for (const fam of families) {
          const matchedUnitId = fam.unit?.unitName
            ? unitMap.get(fam.unit.unitName.trim().toLowerCase())
            : null;

          const famData = {
            parishId,
            familyCode: fam.familyCode || null,
            registrationType: fam.registrationType || RegistrationType.FAMILY,
            houseName: fam.houseName || fam.headFullName || 'Family',
            headFullName: fam.headFullName || null,
            unitId: matchedUnitId,
            streetAddress: fam.streetAddress || null,
            city: fam.city || null,
            state: fam.state || null,
            postalCode: fam.postalCode || null,
            primaryPhone: fam.primaryPhone || null,
            primaryEmail: fam.primaryEmail || null,
            originParish: fam.originParish || null,
            originDiocese: fam.originDiocese || null,
            status: fam.status === 'INACTIVE' ? FamilyStatus.INACTIVE : FamilyStatus.ACTIVE,
            registrationDate: fam.registrationDate ? new Date(fam.registrationDate) : new Date(),
            generalNotes: fam.generalNotes || null,
          };

          let savedFamilyId: number;
          if (fam.familyCode) {
            const upserted = await tx.family.upsert({
              where: { familyCode: fam.familyCode },
              update: famData,
              create: famData,
            });
            savedFamilyId = upserted.id;
          } else {
            const created = await tx.family.create({ data: famData });
            savedFamilyId = created.id;
          }
          importedFamiliesCount++;

          // Import Members
          if (Array.isArray(fam.members)) {
            // Remove previous members for this family if updating
            await tx.familyMember.deleteMany({ where: { familyId: savedFamilyId } });

            for (let i = 0; i < fam.members.length; i++) {
              const m = fam.members[i];
              await tx.familyMember.create({
                data: {
                  familyId: savedFamilyId,
                  fullName: m.fullName || 'Member',
                  role: m.role || MemberRole.CHILD,
                  dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
                  phone: m.phone || null,
                  email: m.email || null,
                  orderIndex: m.orderIndex !== undefined ? m.orderIndex : i,
                },
              });
              importedMembersCount++;
            }
          }

          // Import Direct Debits
          const debitList = Array.isArray(fam.directDebits)
            ? fam.directDebits
            : fam.directDebit
            ? [fam.directDebit]
            : [];

          if (debitList.length > 0) {
            await tx.directDebit.deleteMany({ where: { familyId: savedFamilyId } });
            for (const dd of debitList) {
              await tx.directDebit.create({
                data: {
                  familyId: savedFamilyId,
                  parishId,
                  active: dd.active !== undefined ? dd.active : true,
                  amount: dd.amount || 0,
                  frequency: dd.frequency || 'MONTHLY',
                  comments: dd.comments || null,
                },
              });
            }
          }

          // Import and extract documents for this family
          if (Array.isArray(fam.documents)) {
            for (const doc of fam.documents) {
              const zipMatches = zip.getEntries().filter((e) => e.entryName.includes(doc.fileName));
              if (zipMatches.length > 0) {
                const targetEntry = zipMatches[0];
                const familyFolder = path.join(uploadBaseDir, `family_${savedFamilyId}`);
                if (!fs.existsSync(familyFolder)) {
                  fs.mkdirSync(familyFolder, { recursive: true });
                }
                const destPath = path.join(familyFolder, doc.fileName);
                fs.writeFileSync(destPath, targetEntry.getData());

                await tx.familyDocument.create({
                  data: {
                    familyId: savedFamilyId,
                    fileName: doc.fileName,
                    documentType: doc.documentType || 'OTHER',
                    fileSize: doc.fileSize || targetEntry.header.size,
                    mimeType: doc.mimeType || 'application/pdf',
                    localPath: destPath,
                  },
                });
                importedDocsCount++;
              }
            }
          }
        }

        // 4. Optionally import Parish Users
        if (importUsers === true || importUsers === 'true') {
          for (const u of users) {
            if (!u.email || u.role === UserRole.SUPER_ADMIN) continue;
            await tx.parishUser.upsert({
              where: { email: u.email.trim().toLowerCase() },
              update: {
                fullName: u.fullName,
                username: u.username || null,
                role: u.role,
                isActive: u.isActive !== undefined ? u.isActive : true,
                parishId,
              },
              create: {
                fullName: u.fullName,
                username: u.username || null,
                email: u.email.trim().toLowerCase(),
                passwordHash: u.passwordHash,
                role: u.role,
                isActive: u.isActive !== undefined ? u.isActive : true,
                parishId,
              },
            });
          }
        }

        // 5. CRITICAL: Resynchronize PostgreSQL Auto-Increment Identity Sequences
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Family"', 'id'), COALESCE(MAX(id), 1)) FROM "Family";`);
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"FamilyMember"', 'id'), COALESCE(MAX(id), 1)) FROM "FamilyMember";`);
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"FamilyUnit"', 'id'), COALESCE(MAX(id), 1)) FROM "FamilyUnit";`);
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"NativeDiocese"', 'id'), COALESCE(MAX(id), 1)) FROM "NativeDiocese";`);
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"ParishUser"', 'id'), COALESCE(MAX(id), 1)) FROM "ParishUser";`);
      },
      { timeout: 60000 } // 60s transaction timeout for bulk imports
    );

    // Consume OTP so it cannot be re-used
    otpStore.delete(user.userId);

    // Audit log
    await logSystemActivity({
      parishId,
      userId: user.userId,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'SETTINGS_CHANGE',
      category: 'GOVERNANCE',
      description: `Committed complete archive import for Parish ID ${parishId}: ${importedFamiliesCount} families, ${importedMembersCount} members, ${importedDocsCount} documents.`,
      req,
    });

    return res.json({
      success: true,
      message: `Successfully imported ${importedFamiliesCount} families, ${importedMembersCount} members, and ${importedDocsCount} documents.`,
      counts: {
        families: importedFamiliesCount,
        members: importedMembersCount,
        documents: importedDocsCount,
      },
    });
  } catch (err: any) {
    console.error('Commit import error:', err);
    return res.status(500).json({ error: `Import failed: ${err.message || 'Transaction aborted.'}` });
  }
});
