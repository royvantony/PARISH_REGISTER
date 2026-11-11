import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
import {
  saveDocumentBuffer,
  downloadExternalDocument,
  getAbsoluteDocumentPath,
  deleteDocumentFile,
} from '../lib/storage.js';
import { isFeatureEnabled } from './features.js';
import { logSystemActivity, recordFamilyAuditNote } from '../lib/activityLogger.js';
import fs from 'fs';

export const documentsRouter = Router({ mergeParams: true });

// Apply JWT authentication to all document routes
documentsRouter.use(authenticateJWT);

// Configure multer for in-memory file buffers (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * Helper to check user permission for DOCUMENTS module
 */
async function checkDocPermission(
  req: Request,
  action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canExport'
): Promise<boolean> {
  const user = req.user;
  if (!user) return false;
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.DIOCESAN_ADMIN) {
    return true;
  }

  const parishId = req.activeParishId || user.parishId || 1;

  // 1. Check if Developer Feature is enabled for this parish
  const featureActive = await isFeatureEnabled('REGISTER_DOCUMENTS', parishId);
  if (!featureActive) return false;

  // 2. Check user-specific override
  const userOverride = await prisma.userPermissionOverride.findUnique({
    where: {
      userId_module: {
        userId: user.userId,
        module: 'DOCUMENTS',
      },
    },
  });
  if (userOverride && userOverride[action] !== null && userOverride[action] !== undefined) {
    return Boolean(userOverride[action]);
  }

  // 3. Check role-level permission
  const rolePerm = await prisma.rolePermission.findUnique({
    where: {
      parishId_role_module: {
        parishId,
        role: user.role,
        module: 'DOCUMENTS',
      },
    },
  });
  if (rolePerm && rolePerm[action] !== null && rolePerm[action] !== undefined) {
    return Boolean(rolePerm[action]);
  }

  // Default fallback based on role
  if (user.role === UserRole.PARISH_PRIEST) return true;
  if (user.role === UserRole.PARISH_ADMIN) {
    return action !== 'canDelete';
  }
  if (user.role === UserRole.PARISH_USER) {
    return action === 'canView';
  }
  return false;
}

// 1. GET /api/families/:familyId/documents - List all documents for a family
documentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.familyId as string, 10);
    const parishId = req.activeParishId;

    if (isNaN(familyId)) {
      return res.status(400).json({ error: 'Invalid family ID.' });
    }

    const canView = await checkDocPermission(req, 'canView');
    if (!canView) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view documents.' });
    }

    // Verify family belongs to active parish
    const family = await prisma.family.findFirst({
      where: { id: familyId, parishId },
      select: { id: true },
    });
    if (!family) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    const docs = await prisma.familyDocument.findMany({
      where: { familyId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        member: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return res.json(docs);
  } catch (err: any) {
    console.error('Error listing family documents:', err);
    return res.status(500).json({ error: 'Failed to retrieve family documents.' });
  }
});

// 2. POST /api/families/:familyId/documents - Upload a new document file
documentsRouter.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.familyId as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized.' });
    if (isNaN(familyId)) return res.status(400).json({ error: 'Invalid family ID.' });

    const canEdit = await checkDocPermission(req, 'canEdit');
    if (!canEdit) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to upload documents.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No document file was uploaded.' });
    }

    const family = await prisma.family.findFirst({
      where: { id: familyId, parishId },
    });
    if (!family) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    const documentType = (req.body.documentType?.trim() || 'Document').slice(0, 100);
    const memberId = req.body.memberId ? parseInt(req.body.memberId, 10) : null;

    // Save to sandboxed disk storage
    const saved = await saveDocumentBuffer({
      parishId: parishId || family.parishId,
      familyId,
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      declaredMimeType: req.file.mimetype,
    });

    const doc = await prisma.familyDocument.create({
      data: {
        familyId,
        memberId: memberId || null,
        documentType,
        fileName: saved.fileName,
        localPath: saved.localPath,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
      },
      include: {
        member: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    // Log in Parish Register history note
    await recordFamilyAuditNote({
      familyId,
      noteContent: `Document attached by ${user.fullName} (${user.role}): "${saved.fileName}" [${documentType}].`,
      recordedBy: user.fullName,
      userRole: user.role,
    });

    // Log to System & Security ActivityLog
    await logSystemActivity({
      parishId: parishId || family.parishId,
      userId: user.userId,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'DOCUMENT_CHANGE',
      category: 'REGISTER',
      description: `Document attached by ${user.fullName}: "${saved.fileName}" [${documentType}] for household ${family.houseName} (${family.familyCode || familyId}).`,
      path: req.originalUrl,
      req,
    });

    return res.status(201).json({
      message: 'Document successfully attached.',
      document: doc,
    });
  } catch (err: any) {
    console.error('Error uploading family document:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload document.' });
  }
});

// 3. POST /api/families/:familyId/documents/url - Attach document from an external URL (e.g. from web form)
documentsRouter.post('/url', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.familyId as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized.' });
    if (isNaN(familyId)) return res.status(400).json({ error: 'Invalid family ID.' });

    const canEdit = await checkDocPermission(req, 'canEdit');
    if (!canEdit) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to attach documents.' });
    }

    const { url, documentType = 'PARISH_LETTER', preferredName, memberId } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid document URL is required.' });
    }

    const family = await prisma.family.findFirst({
      where: { id: familyId, parishId },
    });
    if (!family) {
      return res.status(404).json({ error: 'Family record not found.' });
    }

    // Safely download and store
    const saved = await downloadExternalDocument({
      parishId: parishId || family.parishId,
      familyId,
      url,
      preferredName,
    });

    const doc = await prisma.familyDocument.create({
      data: {
        familyId,
        memberId: memberId ? parseInt(memberId, 10) : null,
        documentType,
        fileName: saved.fileName,
        localPath: saved.localPath,
        originalUrl: url,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
      },
      include: {
        member: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    // Log note
    await recordFamilyAuditNote({
      familyId,
      noteContent: `Document ingested from web URL by ${user.fullName} (${user.role}): "${saved.fileName}" [${documentType}].`,
      recordedBy: user.fullName,
      userRole: user.role,
    });

    // Log to System & Security ActivityLog
    await logSystemActivity({
      parishId: parishId || family.parishId,
      userId: user.userId,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'DOCUMENT_CHANGE',
      category: 'REGISTER',
      description: `Document ingested from URL by ${user.fullName}: "${saved.fileName}" [${documentType}] for household ${family.houseName} (${family.familyCode || familyId}).`,
      path: req.originalUrl,
      req,
    });

    return res.status(201).json({
      message: 'Document successfully ingested.',
      document: doc,
    });
  } catch (err: any) {
    console.error('Error ingesting document from URL:', err);
    return res.status(500).json({ error: err.message || 'Failed to download document from URL.' });
  }
});

// 4. GET /api/families/:familyId/documents/:docId/view - Stream document for in-app viewer (inline)
documentsRouter.get('/:docId/view', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.familyId as string, 10);
    const docId = parseInt(req.params.docId as string, 10);
    const parishId = req.activeParishId;

    if (isNaN(familyId) || isNaN(docId)) {
      return res.status(400).json({ error: 'Invalid document identifier.' });
    }

    const canView = await checkDocPermission(req, 'canView');
    if (!canView) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view documents.' });
    }

    const doc = await prisma.familyDocument.findFirst({
      where: { id: docId, familyId },
      include: {
        family: { select: { parishId: true, familyCode: true, houseName: true } },
      },
    });

    if (!doc || (parishId && doc.family.parishId !== parishId)) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const absPath = getAbsoluteDocumentPath(doc.localPath);
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Document file not found on disk storage.' });
    }

    // Log separate Document Viewed entry in Household Record History & Audit Trail
    if (req.user) {
      await recordFamilyAuditNote({
        familyId,
        noteContent: `Document viewed in viewer by ${req.user.fullName} (${req.user.role}): "${doc.fileName}" [${doc.documentType}].`,
        recordedBy: req.user.fullName,
        userRole: req.user.role,
      }).catch((e) => console.warn('Non-blocking: Failed to create view audit note:', e));
    }

    // Log separate Document Viewed event to System & Security ActivityLog
    await logSystemActivity({
      parishId: parishId || doc.family.parishId,
      userId: req.user?.userId,
      userName: req.user?.fullName,
      userRole: req.user?.role,
      actionType: 'DOCUMENT_VIEW',
      category: 'REGISTER',
      description: `Document viewed by ${req.user?.fullName || 'User'}: "${doc.fileName}" [${doc.documentType}] for household ${doc.family.houseName} (${doc.family.familyCode || doc.familyId}).`,
      path: `${req.baseUrl}${req.path}`,
      req,
    });

    const mime = doc.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const stream = fs.createReadStream(absPath);
    return stream.pipe(res);
  } catch (err: any) {
    console.error('Error viewing document:', err);
    return res.status(500).json({ error: 'Failed to stream document.' });
  }
});

// 5. GET /api/families/:familyId/documents/:docId/download - Download document file (attachment)
documentsRouter.get('/:docId/download', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.familyId as string, 10);
    const docId = parseInt(req.params.docId as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;

    if (isNaN(familyId) || isNaN(docId)) {
      return res.status(400).json({ error: 'Invalid document identifier.' });
    }

    const canExport = await checkDocPermission(req, 'canExport');
    if (!canExport) {
      return res.status(403).json({ error: 'Access denied: You do not have download permission for documents.' });
    }

    const doc = await prisma.familyDocument.findFirst({
      where: { id: docId, familyId },
      include: {
        family: { select: { parishId: true, familyCode: true, houseName: true } },
      },
    });

    if (!doc || (parishId && doc.family.parishId !== parishId)) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const absPath = getAbsoluteDocumentPath(doc.localPath);
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Document file not found on disk storage.' });
    }

    // Log separate Document Downloaded entry in Household Record History & Audit Trail
    if (user) {
      await recordFamilyAuditNote({
        familyId,
        noteContent: `Document downloaded by ${user.fullName} (${user.role}): "${doc.fileName}" [${doc.documentType}].`,
        recordedBy: user.fullName,
        userRole: user.role,
      }).catch((e) => console.warn('Non-blocking: Failed to create download audit note:', e));
    }

    // Log separate Document Downloaded event for System & Security ActivityLog
    await logSystemActivity({
      parishId: parishId || doc.family.parishId,
      userId: user?.userId,
      userName: user?.fullName,
      userRole: user?.role,
      actionType: 'DOCUMENT_DOWNLOAD',
      category: 'REGISTER',
      description: `Document downloaded by ${user?.fullName || 'User'}: "${doc.fileName}" [${doc.documentType}] for household ${doc.family.houseName} (${doc.family.familyCode || doc.familyId}).`,
      path: `${req.baseUrl}${req.path}`,
      req,
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const stream = fs.createReadStream(absPath);
    return stream.pipe(res);
  } catch (err: any) {
    console.error('Error downloading document:', err);
    return res.status(500).json({ error: 'Failed to download document.' });
  }
});

// 6. DELETE /api/families/:familyId/documents/:docId - Remove document
documentsRouter.delete('/:docId', async (req: Request, res: Response) => {
  try {
    const familyId = parseInt(req.params.familyId as string, 10);
    const docId = parseInt(req.params.docId as string, 10);
    const parishId = req.activeParishId;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized.' });
    if (isNaN(familyId) || isNaN(docId)) {
      return res.status(400).json({ error: 'Invalid document identifier.' });
    }

    const canDelete = await checkDocPermission(req, 'canDelete');
    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to delete documents.' });
    }

    const doc = await prisma.familyDocument.findFirst({
      where: { id: docId, familyId },
      include: {
        family: { select: { parishId: true, familyCode: true, houseName: true } },
      },
    });

    if (!doc || (parishId && doc.family.parishId !== parishId)) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Remove from disk
    await deleteDocumentFile(doc.localPath);

    // Remove database record
    await prisma.familyDocument.delete({
      where: { id: docId },
    });

    // Log in Parish Register history note
    await recordFamilyAuditNote({
      familyId,
      noteContent: `Document removed by ${user.fullName} (${user.role}): "${doc.fileName}" [${doc.documentType}].`,
      recordedBy: user.fullName,
      userRole: user.role,
    });

    // Log to System & Security ActivityLog
    await logSystemActivity({
      parishId: parishId || doc.family.parishId,
      userId: user.userId,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'DOCUMENT_CHANGE',
      category: 'REGISTER',
      description: `Document removed by ${user.fullName}: "${doc.fileName}" [${doc.documentType}] for household ${doc.family.houseName} (${doc.family.familyCode || doc.familyId}).`,
      path: req.originalUrl,
      req,
    });

    return res.json({ message: 'Document removed successfully.' });
  } catch (err: any) {
    console.error('Error removing document:', err);
    return res.status(500).json({ error: 'Failed to remove document.' });
  }
});

