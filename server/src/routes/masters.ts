import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

export const mastersRouter = Router();

// Apply auth to all master data endpoints
mastersRouter.use(authenticateJWT);

// GET /api/masters/units - List units for active parish
mastersRouter.get('/units', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const units = await prisma.familyUnit.findMany({
      where: { parishId },
      include: {
        _count: {
          select: { families: true },
        },
      },
      orderBy: { unitName: 'asc' },
    });

    return res.json(
      units.map((u) => ({
        id: u.id,
        unitName: u.unitName,
        category: u.category,
        isActive: u.isActive,
        familiesCount: u._count.families,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch family units' });
  }
});

// POST /api/masters/units - Create new unit
mastersRouter.post('/units', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const { unitName, category = 'GEOGRAPHIC' } = req.body;

    if (!unitName || !unitName.trim()) {
      return res.status(400).json({ error: 'Unit name is required.' });
    }

    const newUnit = await prisma.familyUnit.create({
      data: {
        parishId,
        unitName: unitName.trim(),
        category,
        isActive: true,
      },
    });

    return res.status(201).json(newUnit);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create unit. It may already exist.' });
  }
});

// PATCH /api/masters/units/:id - Update or toggle unit
mastersRouter.patch('/units/:id', async (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id as string, 10);
    const parishId = req.activeParishId;
    const { unitName, category, isActive } = req.body;

    const existing = await prisma.familyUnit.findFirst({
      where: { id: unitId, parishId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Unit not found in active parish.' });
    }

    const updated = await prisma.familyUnit.update({
      where: { id: unitId },
      data: {
        ...(unitName && { unitName: unitName.trim() }),
        ...(category && { category }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update unit.' });
  }
});

// GET /api/masters/users - List users for active parish or all if Diocesan Admin
mastersRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const isGlobal =
      req.user?.role === UserRole.SUPER_ADMIN ||
      req.user?.role === UserRole.DIOCESAN_ADMIN ||
      req.user?.role === UserRole.DIOCESAN_USER;

    const whereClause: any = {};
    if (isGlobal && req.query.all === 'true') {
      // Diocesan global view: All users
    } else if (isGlobal) {
      // Tenant view: Users belonging to this active parish plus global administrators
      whereClause.OR = [
        { parishId },
        { parishId: null },
      ];
    } else {
      whereClause.parishId = parishId;
    }

    if (req.user?.role !== UserRole.SUPER_ADMIN) {
      whereClause.role = {
        in: [
          UserRole.PARISH_SUPER_ADMIN,
          UserRole.PARISH_ADMIN,
          UserRole.PARISH_USER,
          UserRole.WARD_USER,
        ],
      };
    }

    const users = await prisma.parishUser.findMany({
      where: whereClause,
      include: {
        parish: { select: { id: true, parishName: true, parishCode: true } },
        unit: { select: { id: true, unitName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(
      users.map((u) => {
        const uIsGlobal =
          u.role === UserRole.SUPER_ADMIN ||
          u.role === UserRole.DIOCESAN_ADMIN ||
          u.role === UserRole.DIOCESAN_USER;

        return {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          parishId: u.parishId,
          parishName: u.parish?.parishName || (uIsGlobal ? 'All Parishes' : 'Unassigned'),
          parishCode: u.parish?.parishCode || '',
          assignedUnitId: u.assignedUnitId,
          unitName: u.unit?.unitName || null,
          createdAt: u.createdAt,
        };
      })
    );
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/masters/users - Create/invite a user
mastersRouter.post('/users', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const { fullName, email, password, role, assignedUnitId } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'Full name, email, temporary password, and role are required.' });
    }

    // Only allow inviting parish roles from the parish portal
    const allowedInviteRoles: UserRole[] = [
      UserRole.PARISH_SUPER_ADMIN,
      UserRole.PARISH_ADMIN,
      UserRole.PARISH_USER,
      UserRole.WARD_USER,
    ];
    if (!allowedInviteRoles.includes(role as UserRole)) {
      return res.status(400).json({ error: 'Only Parish roles can be invited.' });
    }

    const existingUser = await prisma.parishUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const isGlobalCaller =
      req.user?.role === UserRole.SUPER_ADMIN ||
      req.user?.role === UserRole.DIOCESAN_ADMIN;
    const targetParishId = isGlobalCaller && req.body.parishId ? parseInt(req.body.parishId, 10) : parishId;

    const newUser = await prisma.parishUser.create({
      data: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: role as UserRole,
        parishId: targetParishId,
        assignedUnitId: assignedUnitId ? parseInt(assignedUnitId, 10) : null,
        isActive: true,
        mustChangePassword: true,
      },
      include: {
        parish: { select: { parishName: true } },
        unit: { select: { unitName: true } },
      },
    });

    return res.status(201).json({
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      parishName: newUser.parish?.parishName || 'All Parishes',
      unitName: newUser.unit?.unitName || null,
    });
  } catch (err: any) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PATCH /api/masters/users/:id - Update user details (name, role, assigned ward, optional password reset)
mastersRouter.patch('/users/:id', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id as string, 10);
    const { fullName, role, assignedUnitId, newPassword } = req.body;
    const callerRole = req.user?.role;
    const callerId = req.user?.userId;

    const targetUser = await prisma.parishUser.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Hierarchy Protections:
    // 1. Super Admin accounts can only be modified by Super Admin
    if (targetUser.role === UserRole.SUPER_ADMIN && callerRole !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only Platform Super Admin can edit this account.' });
    }

    // 2. Parish Super Admin (Priest) can only be modified by Super Admin (unless Priest editing their own full name)
    if (targetUser.role === UserRole.PARISH_SUPER_ADMIN && callerRole !== UserRole.SUPER_ADMIN) {
      if (callerId !== targetUserId || (role && role !== targetUser.role)) {
        return res.status(403).json({ error: 'Only Platform Super Admin can modify a Parish Priest (Parish Super Admin) role.' });
      }
    }

    // 3. Parish Admin cannot modify Parish Super Admin or Super Admin
    if (
      (targetUser.role === UserRole.PARISH_SUPER_ADMIN || targetUser.role === UserRole.SUPER_ADMIN) &&
      callerRole === UserRole.PARISH_ADMIN
    ) {
      return res.status(403).json({ error: 'Parish Admins cannot modify superior accounts.' });
    }

    // 4. Role Assignment validation:
    if (role && role !== targetUser.role) {
      if (callerId === targetUserId) {
        return res.status(400).json({ error: 'You cannot change your own role.' });
      }

      if (([UserRole.SUPER_ADMIN, UserRole.DIOCESAN_ADMIN, UserRole.DIOCESAN_USER] as string[]).includes(role)) {
        if (callerRole !== UserRole.SUPER_ADMIN) {
          return res.status(403).json({ error: 'Unauthorized to assign diocesan or platform roles.' });
        }
      }

      if (role === UserRole.PARISH_SUPER_ADMIN && callerRole !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Only Platform Super Admin can assign the Parish Priest (Parish Super Admin) role.' });
      }

      if (callerRole === UserRole.PARISH_ADMIN && (role === UserRole.PARISH_ADMIN || role === UserRole.PARISH_SUPER_ADMIN)) {
        return res.status(403).json({ error: 'Only the Parish Priest can promote users to Parish Admin.' });
      }
    }

    const updateData: any = {};
    if (fullName && fullName.trim()) {
      updateData.fullName = fullName.trim();
    }

    if (role) {
      updateData.role = role as UserRole;
      if (role === UserRole.WARD_USER) {
        updateData.assignedUnitId = assignedUnitId ? parseInt(assignedUnitId, 10) : null;
      } else {
        updateData.assignedUnitId = null;
      }
    } else if (assignedUnitId !== undefined) {
      updateData.assignedUnitId = assignedUnitId ? parseInt(assignedUnitId, 10) : null;
    }

    if (newPassword && newPassword.trim()) {
      updateData.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      updateData.mustChangePassword = true;
    }

    const updated = await prisma.parishUser.update({
      where: { id: targetUserId },
      data: updateData,
      include: {
        parish: { select: { id: true, parishName: true, parishCode: true } },
        unit: { select: { id: true, unitName: true } },
      },
    });

    return res.json({
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
      parishId: updated.parishId,
      parishName: updated.parish?.parishName || 'All Parishes',
      parishCode: updated.parish?.parishCode || '',
      assignedUnitId: updated.assignedUnitId,
      unitName: updated.unit?.unitName || null,
      createdAt: updated.createdAt,
    });
  } catch (err: any) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

// PATCH /api/masters/users/:id/toggle-status - Toggle user active/inactive
mastersRouter.patch('/users/:id/toggle-status', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id as string, 10);

    if (req.user?.userId === targetUserId) {
      return res.status(400).json({ error: 'You cannot deactivate your own logged-in account.' });
    }

    const targetUser = await prisma.parishUser.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const callerRole = req.user?.role;

    // Hierarchy Protections:
    // 1. Super Admin cannot be deactivated through the UI
    if (targetUser.role === UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Platform Super Admin accounts cannot be deactivated.' });
    }

    // 2. Only Super Admin can deactivate a Parish Super Admin (Parish Priest)
    if (targetUser.role === UserRole.PARISH_SUPER_ADMIN && callerRole !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only the Platform Super Admin can modify a Parish Priest (Parish Super Admin) account.' });
    }

    // 3. Parish Priest (PARISH_SUPER_ADMIN) has supreme authority to block Parish Admins (Trustees), Parish Users, and Ward Users.
    // Lower roles cannot deactivate a Parish Admin or Parish Super Admin.
    if (
      targetUser.role === UserRole.PARISH_ADMIN &&
      callerRole !== UserRole.SUPER_ADMIN &&
      callerRole !== UserRole.DIOCESAN_ADMIN &&
      callerRole !== UserRole.PARISH_SUPER_ADMIN
    ) {
      return res.status(403).json({ error: 'Only the Parish Priest (Parish Super Admin) or Diocesan Admin can deactivate Parish Admins (Trustees).' });
    }

    const updated = await prisma.parishUser.update({
      where: { id: targetUserId },
      data: { isActive: !targetUser.isActive },
    });

    return res.json({ id: updated.id, isActive: updated.isActive });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// GET /api/masters/dioceses - Standardized Indian Dioceses for active parish
mastersRouter.get('/dioceses', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const dioceses = await prisma.nativeDiocese.findMany({
      where: { parishId },
      orderBy: { dioceseName: 'asc' },
    });
    return res.json(dioceses);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch Indian dioceses' });
  }
});

// POST /api/masters/dioceses - Create new Indian Diocese / Eparchy for active parish
mastersRouter.post('/dioceses', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const { dioceseName, stateInIndia = 'Kerala', rite = 'Syro-Malabar' } = req.body;

    if (!dioceseName || !dioceseName.trim()) {
      return res.status(400).json({ error: 'Diocese name is required.' });
    }

    const trimmedName = dioceseName.trim();

    // Check if already exists in this parish (case-insensitive)
    const existing = await prisma.nativeDiocese.findFirst({
      where: {
        parishId,
        dioceseName: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return res.status(409).json({ error: `Diocese '${existing.dioceseName}' already exists in this parish's master list.` });
    }

    const newDiocese = await prisma.nativeDiocese.create({
      data: {
        parishId,
        dioceseName: trimmedName,
        stateInIndia: stateInIndia.trim() || 'Kerala',
        rite: rite.trim() || 'Syro-Malabar',
      },
    });

    return res.status(201).json(newDiocese);
  } catch (err: any) {
    console.error('Failed to create diocese:', err);
    return res.status(500).json({ error: 'Failed to create diocese.' });
  }
});

// PUT /api/masters/dioceses/:id - Update an Indian Diocese / Eparchy for active parish
mastersRouter.put('/dioceses/:id', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid diocese ID.' });
    }

    const { dioceseName, stateInIndia = 'Kerala', rite = 'Syro-Malabar' } = req.body;

    if (!dioceseName || !dioceseName.trim()) {
      return res.status(400).json({ error: 'Diocese name is required.' });
    }

    const trimmedName = dioceseName.trim();

    // Check if diocese exists in active parish
    const existing = await prisma.nativeDiocese.findFirst({
      where: { id, parishId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Diocese not found in this parish.' });
    }

    // Check for duplicate name in the same parish, excluding the current diocese
    const duplicate = await prisma.nativeDiocese.findFirst({
      where: {
        parishId,
        id: { not: id },
        dioceseName: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (duplicate) {
      return res.status(409).json({
        error: `Diocese '${duplicate.dioceseName}' already exists in this parish's master list.`,
      });
    }

    const updated = await prisma.nativeDiocese.update({
      where: { id },
      data: {
        dioceseName: trimmedName,
        stateInIndia: stateInIndia.trim() || 'Kerala',
        rite: rite.trim() || 'Syro-Malabar',
      },
    });

    // If diocese name was changed, cascade to existing families in this parish
    if (existing.dioceseName !== trimmedName) {
      await prisma.family.updateMany({
        where: {
          parishId,
          originDiocese: existing.dioceseName,
        },
        data: {
          originDiocese: trimmedName,
        },
      });
    }

    return res.json(updated);
  } catch (err: any) {
    console.error('Failed to update diocese:', err);
    return res.status(500).json({ error: 'Failed to update diocese.' });
  }
});

// DELETE /api/masters/dioceses/:id - Delete an Indian Diocese from active parish master list
mastersRouter.delete('/dioceses/:id', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid diocese ID.' });
    }

    const existing = await prisma.nativeDiocese.findFirst({
      where: { id, parishId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Diocese not found in this parish.' });
    }

    await prisma.nativeDiocese.delete({
      where: { id },
    });

    return res.json({ message: `Diocese '${existing.dioceseName}' removed successfully.` });
  } catch (err: any) {
    console.error('Failed to delete diocese:', err);
    return res.status(500).json({ error: 'Failed to delete diocese.' });
  }
});

// GET /api/masters/parishes - List parishes (Accessible by Diocesan Super Admin)
mastersRouter.get('/parishes', async (req: Request, res: Response) => {
  try {
    const isGlobal =
      req.user?.role === UserRole.SUPER_ADMIN ||
      req.user?.role === UserRole.DIOCESAN_ADMIN ||
      req.user?.role === UserRole.DIOCESAN_USER;

    if (!isGlobal) {
      const parish = await prisma.parish.findUnique({
        where: { id: req.user?.parishId || 1 },
      });
      return res.json(parish ? [parish] : []);
    }

    const parishes = await prisma.parish.findMany({
      orderBy: { parishName: 'asc' },
      include: {
        _count: {
          select: { families: true, units: true },
        },
      },
    });

    return res.json(parishes);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch parishes' });
  }
});

