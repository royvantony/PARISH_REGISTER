import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
import { getParishFeatures } from './features.js';

export const permissionsRouter = Router();

// Apply auth to all permission endpoints
permissionsRouter.use(authenticateJWT);

export const SYSTEM_MODULES = [
  { key: 'REGISTER', name: 'Parish Register Directory', category: 'Core Register' },
  { key: 'REGISTER_NEW', name: 'Register New Family', category: 'Core Register' },
  { key: 'IMPORT_REGISTRATIONS', name: 'Import Online Registrations (CSV)', category: 'Core Register' },
  { key: 'DIRECT_DEBIT', name: 'Direct Debit', category: 'Finance' },
  { key: 'WARDS', name: 'Family Units / Wards', category: 'Masters' },
  { key: 'USERS', name: 'Users & Roles Management', category: 'Administration' },
  { key: 'DASHBOARD_ACTIVITY', name: 'Dashboard Pastoral Notes', category: 'Dashboard' },
  { key: 'SETTINGS', name: 'System Settings & Masters', category: 'Administration' },
];

/**
 * Maps each functional permission module to its controlling Developer Feature Key.
 * If a feature is disabled in Developer Controls for a parish, that module is
 * automatically filtered out and disallowed from role & user permission matrixes.
 */
export const MODULE_TO_FEATURE_KEY: Record<string, string> = {
  REGISTER: 'PAGE_REGISTER',
  REGISTER_NEW: 'PAGE_REGISTER_NEW',
  IMPORT_REGISTRATIONS: 'PAGE_REGISTER_IMPORT',
  DIRECT_DEBIT: 'REGISTER_DIRECT_DEBIT',
  WARDS: 'PAGE_UNITS',
  USERS: 'PAGE_USERS',
  DASHBOARD_ACTIVITY: 'DASH_ACTIVITY_FEED',
  SETTINGS: 'PAGE_SETTINGS',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Record<string, {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
}>> = {
  [UserRole.SUPER_ADMIN]: { // Developer / System Architect (Full wildcard bypass)
    REGISTER: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    REGISTER_NEW: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    IMPORT_REGISTRATIONS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    DIRECT_DEBIT: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    WARDS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    USERS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    DASHBOARD_ACTIVITY: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    SETTINGS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
  },
  [UserRole.DIOCESAN_ADMIN]: { // Bishop / Chancellor (Full diocese-wide authority)
    REGISTER: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    REGISTER_NEW: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    IMPORT_REGISTRATIONS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    DIRECT_DEBIT: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    WARDS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    USERS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    DASHBOARD_ACTIVITY: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    SETTINGS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
  },
  [UserRole.DIOCESAN_USER]: { // Diocesan Staff / Accountant (Read-only / Roster Export)
    REGISTER: { canView: true, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: true, canApprove: false },
    REGISTER_NEW: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    IMPORT_REGISTRATIONS: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    DIRECT_DEBIT: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    WARDS: { canView: true, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: true, canApprove: false },
    USERS: { canView: true, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    DASHBOARD_ACTIVITY: { canView: true, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    SETTINGS: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
  },
  [UserRole.PARISH_PRIEST]: { // Parish Priest (Supreme Parish Authority - approvals, block admins, full finance)
    REGISTER: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    REGISTER_NEW: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    IMPORT_REGISTRATIONS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    DIRECT_DEBIT: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    WARDS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    USERS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    DASHBOARD_ACTIVITY: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: true, canExport: true, canApprove: true },
    SETTINGS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: false, canExport: true, canApprove: true },
  },
  [UserRole.PARISH_ADMIN]: { // Parish Trustees / Executive Committee (Parish Management & Approvals)
    REGISTER: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: false, canExport: true, canApprove: true },
    REGISTER_NEW: { canView: true, canCreate: true, canEdit: true, canArchive: false, canDelete: false, canExport: false, canApprove: true },
    IMPORT_REGISTRATIONS: { canView: true, canCreate: true, canEdit: true, canArchive: false, canDelete: false, canExport: true, canApprove: true },
    DIRECT_DEBIT: { canView: true, canCreate: true, canEdit: true, canArchive: false, canDelete: false, canExport: true, canApprove: false },
    WARDS: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: false, canExport: true, canApprove: true },
    USERS: { canView: true, canCreate: true, canEdit: true, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    DASHBOARD_ACTIVITY: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: false, canExport: true, canApprove: true },
    SETTINGS: { canView: true, canCreate: false, canEdit: true, canArchive: false, canDelete: false, canExport: false, canApprove: false },
  },
  [UserRole.PARISH_USER]: { // Parish Secretary / Office Volunteer (Daily tasks, submit registrations for approval)
    REGISTER: { canView: true, canCreate: true, canEdit: true, canArchive: true, canDelete: false, canExport: true, canApprove: false },
    REGISTER_NEW: { canView: true, canCreate: true, canEdit: true, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    IMPORT_REGISTRATIONS: { canView: true, canCreate: true, canEdit: true, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    DIRECT_DEBIT: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    WARDS: { canView: true, canCreate: true, canEdit: true, canArchive: false, canDelete: false, canExport: true, canApprove: false },
    USERS: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    DASHBOARD_ACTIVITY: { canView: true, canCreate: true, canEdit: true, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    SETTINGS: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
  },
  [UserRole.WARD_USER]: { // Ward Coordinator / Unit Representative (Strictly assigned ward only)
    REGISTER: { canView: true, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    REGISTER_NEW: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    IMPORT_REGISTRATIONS: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    DIRECT_DEBIT: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    WARDS: { canView: true, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    USERS: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    DASHBOARD_ACTIVITY: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
    SETTINGS: { canView: false, canCreate: false, canEdit: false, canArchive: false, canDelete: false, canExport: false, canApprove: false },
  },
};

// Helper to seed defaults for a specific parish (used during parish initialization or for Parish 1)
export async function ensureDefaultPermissions(parishId: number = 1) {
  for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[]) {
    for (const [module, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS[role])) {
      const exists = await prisma.rolePermission.findUnique({
        where: {
          parishId_role_module: {
            parishId,
            role,
            module,
          },
        },
      });
      if (!exists) {
        await prisma.rolePermission.create({
          data: {
            parishId,
            role,
            module,
            ...perms,
          },
        });
      }
    }
  }
}

// GET /api/permissions/matrix - Get role permission matrix for active parish
permissionsRouter.get('/matrix', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || 1;

    // Only ensure defaults for Parish 1 (Brisbane) so unprovisioned parishes stay empty until setup
    if (parishId === 1) {
      await ensureDefaultPermissions(parishId);
    }

    // Retrieve active parish feature toggles from encrypted vault / in-memory cache
    const parishFeatures = await getParishFeatures(parishId);
    const featureMap = new Map(parishFeatures.map((f) => [f.key, f.isEnabled]));

    // Strictly filter system modules based on developer controls configured for this parish
    const allowedModules = SYSTEM_MODULES.filter((mod) => {
      const featKey = MODULE_TO_FEATURE_KEY[mod.key];
      if (!featKey) return true;
      return featureMap.get(featKey) ?? false;
    });

    const permissions = await prisma.rolePermission.findMany({
      where: {
        parishId,
        module: { in: allowedModules.map((m) => m.key) },
      },
      orderBy: [{ role: 'asc' }, { module: 'asc' }],
    });

    return res.json({
      modules: allowedModules,
      matrix: permissions,
      isInitialized: permissions.length > 0,
    });
  } catch (err: any) {
    console.error('Error fetching permission matrix:', err);
    return res.status(500).json({ error: 'Failed to fetch permission matrix' });
  }
});

// PUT /api/permissions/roles/:role - Update permissions for a role in active parish
permissionsRouter.put('/roles/:role', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId;
    const role = req.params.role as UserRole;
    const { permissions } = req.body; // Array of { module, canView, canCreate, canEdit, canArchive, canDelete, canExport }

    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({ error: 'Invalid user role specified.' });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array.' });
    }

    await prisma.$transaction(
      permissions.map((p) =>
        prisma.rolePermission.upsert({
          where: {
            parishId_role_module: {
              parishId,
              role,
              module: p.module,
            },
          },
          update: {
            canView: Boolean(p.canView),
            canCreate: Boolean(p.canCreate),
            canEdit: Boolean(p.canEdit),
            canArchive: Boolean(p.canArchive),
            canDelete: Boolean(p.canDelete),
            canExport: Boolean(p.canExport),
            canApprove: Boolean(p.canApprove),
          },
          create: {
            parishId,
            role,
            module: p.module,
            canView: Boolean(p.canView),
            canCreate: Boolean(p.canCreate),
            canEdit: Boolean(p.canEdit),
            canArchive: Boolean(p.canArchive),
            canDelete: Boolean(p.canDelete),
            canExport: Boolean(p.canExport),
            canApprove: Boolean(p.canApprove),
          },
        })
      )
    );

    return res.json({ message: `Permissions updated successfully for ${role} in this parish.` });
  } catch (err: any) {
    console.error('Error updating role permissions:', err);
    return res.status(500).json({ error: 'Failed to update role permissions.' });
  }
});

// GET /api/permissions/my-permissions - Get current authenticated user's effective permissions
permissionsRouter.get('/my-permissions', async (req: Request, res: Response) => {
  try {
    const userContext = req.user;
    if (!userContext) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const userId = userContext.userId;
    const user = await prisma.parishUser.findUnique({
      where: { id: userId },
      include: {
        overrides: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Super Admin & Diocesan Admin have wildcard bypass for all permissions
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.DIOCESAN_ADMIN) {
      const fullPerms: Record<string, any> = {};
      for (const mod of SYSTEM_MODULES) {
        fullPerms[mod.key] = {
          canView: true,
          canCreate: true,
          canEdit: true,
          canArchive: true,
          canDelete: true,
          canExport: true,
          canApprove: true,
        };
      }
      return res.json({ permissions: fullPerms });
    }

    const userParishId = user.parishId || req.activeParishId || 1;
    const parishFeatures = await getParishFeatures(userParishId);
    const featureMap = new Map(parishFeatures.map((f) => [f.key, f.isEnabled]));

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { parishId: userParishId, role: user.role },
    });

    const permissionsMap: Record<string, any> = {};
    for (const mod of SYSTEM_MODULES) {
      const featKey = MODULE_TO_FEATURE_KEY[mod.key];
      const isFeatureAllowed = featKey ? (featureMap.get(featKey) ?? false) : true;

      // If this functional module is disabled in Developer Controls for this parish, all rights are revoked
      if (!isFeatureAllowed) {
        permissionsMap[mod.key] = {
          canView: false,
          canCreate: false,
          canEdit: false,
          canArchive: false,
          canDelete: false,
          canExport: false,
          canApprove: false,
        };
        continue;
      }

      const defaultRolePerm = DEFAULT_ROLE_PERMISSIONS[user.role]?.[mod.key] || {
        canView: false,
        canCreate: false,
        canEdit: false,
        canArchive: false,
        canDelete: false,
        canExport: false,
        canApprove: false,
      };

      const base = rolePermissions.find((r) => r.module === mod.key) || defaultRolePerm;
      const override = user.overrides.find((o) => o.module === mod.key);

      const canView = Boolean(
        override?.canView !== null && override?.canView !== undefined ? override.canView : base.canView
      );

      // CRITICAL RULE: If canView is false, user has NO access or action rights in this module
      permissionsMap[mod.key] = {
        canView,
        canCreate: canView ? Boolean(override?.canCreate !== null && override?.canCreate !== undefined ? override.canCreate : base.canCreate) : false,
        canEdit: canView ? Boolean(override?.canEdit !== null && override?.canEdit !== undefined ? override.canEdit : base.canEdit) : false,
        canArchive: canView ? Boolean(override?.canArchive !== null && override?.canArchive !== undefined ? override.canArchive : base.canArchive) : false,
        canDelete: canView ? Boolean(override?.canDelete !== null && override?.canDelete !== undefined ? override.canDelete : base.canDelete) : false,
        canExport: canView ? Boolean(override?.canExport !== null && override?.canExport !== undefined ? override.canExport : base.canExport) : false,
        canApprove: canView ? Boolean((override as any)?.canApprove !== null && (override as any)?.canApprove !== undefined ? (override as any).canApprove : (base as any).canApprove || false) : false,
      };
    }


    return res.json({ permissions: permissionsMap });
  } catch (err: any) {
    console.error('Error fetching my permissions:', err);
    return res.status(500).json({ error: 'Failed to fetch user permissions.' });
  }
});

// GET /api/permissions/users/:userId - Get a user's effective permissions & overrides
permissionsRouter.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string, 10);
    const user = await prisma.parishUser.findUnique({
      where: { id: userId },
      include: {
        unit: { select: { id: true, unitName: true } },
        overrides: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userParishId = user.parishId || req.activeParishId || 1;
    const parishFeatures = await getParishFeatures(userParishId);
    const featureMap = new Map(parishFeatures.map((f) => [f.key, f.isEnabled]));

    // Strictly filter system modules based on developer controls configured for this parish
    const allowedModules = SYSTEM_MODULES.filter((mod) => {
      const featKey = MODULE_TO_FEATURE_KEY[mod.key];
      if (!featKey) return true;
      return featureMap.get(featKey) ?? false;
    });

    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        parishId: userParishId,
        role: user.role,
        module: { in: allowedModules.map((m) => m.key) },
      },
    });

    // Compute effective permissions (Override takes priority if explicitly set)
    const effective = allowedModules.map((mod) => {
      const base = rolePermissions.find((r) => r.module === mod.key) || {
        canView: false,
        canCreate: false,
        canEdit: false,
        canArchive: false,
        canDelete: false,
        canExport: false,
        canApprove: false,
      };

      const override = user.overrides.find((o) => o.module === mod.key);
      const canView = Boolean(
        override?.canView !== null && override?.canView !== undefined ? override.canView : base.canView
      );

      return {
        module: mod.key,
        name: mod.name,
        category: mod.category,
        canView,
        canCreate: canView ? Boolean(override?.canCreate !== null && override?.canCreate !== undefined ? override.canCreate : base.canCreate) : false,
        canEdit: canView ? Boolean(override?.canEdit !== null && override?.canEdit !== undefined ? override.canEdit : base.canEdit) : false,
        canArchive: canView ? Boolean(override?.canArchive !== null && override?.canArchive !== undefined ? override.canArchive : base.canArchive) : false,
        canDelete: canView ? Boolean(override?.canDelete !== null && override?.canDelete !== undefined ? override.canDelete : base.canDelete) : false,
        canExport: canView ? Boolean(override?.canExport !== null && override?.canExport !== undefined ? override.canExport : base.canExport) : false,
        canApprove: canView ? Boolean((override as any)?.canApprove !== null && (override as any)?.canApprove !== undefined ? (override as any).canApprove : (base as any).canApprove || false) : false,
        isOverridden: Boolean(override),
        base,
      };
    });


    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        assignedUnitId: user.assignedUnitId,
        unitName: user.unit?.unitName || null,
      },
      effective,
      rawOverrides: user.overrides,
    });
  } catch (err: any) {
    console.error('Error fetching user permissions:', err);
    return res.status(500).json({ error: 'Failed to fetch user permissions.' });
  }
});

// PUT /api/permissions/users/:userId/overrides - Save user overrides
permissionsRouter.put('/users/:userId/overrides', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string, 10);
    const { overrides } = req.body; // Array of { module, canView, canCreate, canEdit, canArchive, canDelete, canExport }

    const user = await prisma.parishUser.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await prisma.$transaction(
      overrides.map((o: any) =>
        prisma.userPermissionOverride.upsert({
          where: {
            userId_module: {
              userId,
              module: o.module,
            },
          },
          update: {
            canView: o.canView,
            canCreate: o.canCreate,
            canEdit: o.canEdit,
            canArchive: o.canArchive,
            canDelete: o.canDelete,
            canExport: o.canExport,
            canApprove: o.canApprove !== undefined ? o.canApprove : null,
          },
          create: {
            userId,
            module: o.module,
            canView: o.canView,
            canCreate: o.canCreate,
            canEdit: o.canEdit,
            canArchive: o.canArchive,
            canDelete: o.canDelete,
            canExport: o.canExport,
            canApprove: o.canApprove !== undefined ? o.canApprove : null,
          },
        })
      )
    );

    return res.json({ message: `Custom overrides saved for ${user.fullName}.` });
  } catch (err: any) {
    console.error('Error saving user overrides:', err);
    return res.status(500).json({ error: 'Failed to save user overrides.' });
  }
});

// DELETE /api/permissions/users/:userId/overrides - Clear user overrides (Reset to role default)
permissionsRouter.delete('/users/:userId/overrides', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string, 10);
    await prisma.userPermissionOverride.deleteMany({
      where: { userId },
    });

    return res.json({ message: 'User overrides cleared. User will inherit role defaults.' });
  } catch (err: any) {
    console.error('Error clearing overrides:', err);
    return res.status(500).json({ error: 'Failed to reset user permissions.' });
  }
});

// Generic helper: Check if a user has permission for a specific module & action based ONLY on matrix & overrides
export async function checkUserPermission(
  userId: number,
  role: UserRole,
  parishId: number,
  module: string,
  action: 'canView' | 'canCreate' | 'canEdit' | 'canArchive' | 'canDelete' | 'canExport' | 'canApprove' = 'canView'
): Promise<boolean> {
  // Super Admin developer wildcard bypass
  if (role === UserRole.SUPER_ADMIN) {
    return true;
  }

  const targetParishId = parishId || 1;

  const override = await prisma.userPermissionOverride.findUnique({
    where: { userId_module: { userId, module } },
  });

  const rolePerm = await prisma.rolePermission.findUnique({
    where: { parishId_role_module: { parishId: targetParishId, role, module } },
  });

  const canView = override?.canView !== null && override?.canView !== undefined
    ? override.canView
    : (rolePerm?.canView ?? DEFAULT_ROLE_PERMISSIONS[role]?.[module]?.canView ?? false);

  if (!canView) return false;
  if (action === 'canView') return true;

  if (override && (override as any)[action] !== null && (override as any)[action] !== undefined) {
    return Boolean((override as any)[action]);
  }

  if (rolePerm && (rolePerm as any)[action] !== null && (rolePerm as any)[action] !== undefined) {
    return Boolean((rolePerm as any)[action]);
  }

  return Boolean(DEFAULT_ROLE_PERMISSIONS[role]?.[module]?.[action] ?? false);
}

// Helper: Check if a user has approval authority for registrations based strictly on matrix & user overrides
export async function canUserApproveRegistration(
  userId: number,
  role: UserRole,
  parishId?: number,
  module: 'REGISTER_NEW' | 'REGISTER' | 'IMPORT_REGISTRATIONS' = 'REGISTER_NEW'
): Promise<boolean> {
  // Super Admin developer wildcard bypass
  if (role === UserRole.SUPER_ADMIN) {
    return true;
  }

  const targetParishId = parishId || 1;

  // 1. Check for explicit user permission override
  const override = await prisma.userPermissionOverride.findUnique({
    where: { userId_module: { userId, module } },
  });

  // 2. Check role permission from database
  const rolePerm = await prisma.rolePermission.findUnique({
    where: { parishId_role_module: { parishId: targetParishId, role, module } },
  });

  // 3. Verify user has canView for this module first
  const canView = override?.canView !== null && override?.canView !== undefined
    ? override.canView
    : (rolePerm?.canView ?? DEFAULT_ROLE_PERMISSIONS[role]?.[module]?.canView ?? false);

  if (!canView) return false;

  // 4. Check for explicit user permission override
  if (override && (override as any).canApprove !== null && (override as any).canApprove !== undefined) {
    return Boolean((override as any).canApprove);
  }

  // 5. Check role permission from database matrix
  if (rolePerm && (rolePerm as any).canApprove !== undefined && (rolePerm as any).canApprove !== null) {
    return Boolean((rolePerm as any).canApprove);
  }

  // 6. Inherit strictly from default matrix without any hardcoded role overrides
  return Boolean(DEFAULT_ROLE_PERMISSIONS[role]?.[module]?.canApprove ?? false);
}

// GET /api/permissions/can-approve - Check if current user has approval authority
permissionsRouter.get('/can-approve', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.json({ canApprove: false });
    const targetModule = (req.query.module as any) || 'REGISTER_NEW';
    const canApprove = await canUserApproveRegistration(user.userId, user.role, req.activeParishId, targetModule);
    return res.json({ canApprove });
  } catch (err: any) {
    console.error('Error checking can-approve:', err);
    return res.status(500).json({ error: 'Failed to check approval authority.' });
  }
});

// Helper: Check user's Direct Debit permissions (view and edit)
export async function getUserDirectDebitPermissions(
  userId: number,
  role: UserRole,
  parishId?: number
): Promise<{ canView: boolean; canEdit: boolean }> {
  // 1. Super Admin and Diocesan Admin always have full authority
  if (role === UserRole.SUPER_ADMIN || role === UserRole.DIOCESAN_ADMIN) {
    return { canView: true, canEdit: true };
  }

  // 2. Check for explicit user permission override
  const override = await prisma.userPermissionOverride.findUnique({
    where: {
      userId_module: {
        userId,
        module: 'DIRECT_DEBIT',
      },
    },
  });

  let canView = override?.canView ?? null;
  let canEdit = override?.canEdit ?? null;

  // 3. Check role permission from database if not overridden
  const targetParishId = parishId || 1;
  const rolePerm = await prisma.rolePermission.findUnique({
    where: {
      parishId_role_module: {
        parishId: targetParishId,
        role,
        module: 'DIRECT_DEBIT',
      },
    },
  });

  if (canView === null) {
    canView = rolePerm?.canView ?? DEFAULT_ROLE_PERMISSIONS[role]?.DIRECT_DEBIT?.canView ?? false;
  }
  if (!canView) {
    return { canView: false, canEdit: false };
  }

  if (canEdit === null) {
    canEdit = rolePerm?.canEdit ?? DEFAULT_ROLE_PERMISSIONS[role]?.DIRECT_DEBIT?.canEdit ?? false;
  }

  return { canView: true, canEdit: Boolean(canEdit) };
}

// GET /api/permissions/direct-debit - Check current user's direct debit permissions
permissionsRouter.get('/direct-debit', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.json({ canView: false, canEdit: false });
    const perms = await getUserDirectDebitPermissions(user.userId, user.role, req.activeParishId);
    return res.json(perms);
  } catch (err: any) {
    console.error('Error checking direct debit permissions:', err);
    return res.status(500).json({ error: 'Failed to check direct debit permissions.' });
  }
});

// Helper: Check user's Import Registrations permissions (view, create, and approve)
export async function canUserImportRegistrations(
  userId: number,
  role: UserRole,
  parishId?: number
): Promise<{ canView: boolean; canCreate: boolean; canApprove: boolean }> {
  // 1. Super Admin and Diocesan Admin always have full authority
  if (role === UserRole.SUPER_ADMIN || role === UserRole.DIOCESAN_ADMIN) {
    return { canView: true, canCreate: true, canApprove: true };
  }

  // 2. Check for explicit user permission override
  const override = await prisma.userPermissionOverride.findUnique({
    where: {
      userId_module: {
        userId,
        module: 'IMPORT_REGISTRATIONS',
      },
    },
  });

  let canView = override?.canView ?? null;
  let canCreate = override?.canCreate ?? null;
  let canApprove = (override as any)?.canApprove ?? null;

  // 3. Check role permission from database if not overridden
  const targetParishId = parishId || 1;
  const rolePerm = await prisma.rolePermission.findUnique({
    where: {
      parishId_role_module: {
        parishId: targetParishId,
        role,
        module: 'IMPORT_REGISTRATIONS',
      },
    },
  });

  if (canView === null) {
    canView = rolePerm?.canView ?? DEFAULT_ROLE_PERMISSIONS[role]?.IMPORT_REGISTRATIONS?.canView ?? false;
  }
  if (!canView) {
    return { canView: false, canCreate: false, canApprove: false };
  }

  if (canCreate === null) {
    canCreate = rolePerm?.canCreate ?? DEFAULT_ROLE_PERMISSIONS[role]?.IMPORT_REGISTRATIONS?.canCreate ?? false;
  }
  if (canApprove === null) {
    canApprove = rolePerm?.canApprove ?? DEFAULT_ROLE_PERMISSIONS[role]?.IMPORT_REGISTRATIONS?.canApprove ?? false;
  }

  return {
    canView: true,
    canCreate: Boolean(canCreate),
    canApprove: Boolean(canApprove),
  };
}

// GET /api/permissions/import - Check current user's import permissions
permissionsRouter.get('/import', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.json({ canView: false, canCreate: false, canApprove: false });
    const perms = await canUserImportRegistrations(user.userId, user.role, req.activeParishId);
    return res.json(perms);
  } catch (err: any) {
    console.error('Error checking import permissions:', err);
    return res.status(500).json({ error: 'Failed to check import permissions.' });
  }
});

/**
 * Checks if a user has export capability for a specific module (default: REGISTER)
 */
export async function canUserExportModule(
  userId: number,
  role: UserRole,
  parishId: number,
  module: string = 'REGISTER'
): Promise<boolean> {
  if (role === UserRole.SUPER_ADMIN) {
    return true;
  }

  const targetParishId = parishId || 1;
  const override = await prisma.userPermissionOverride.findUnique({
    where: {
      userId_module: {
        userId,
        module,
      },
    },
  });

  const rolePerm = await prisma.rolePermission.findUnique({
    where: {
      parishId_role_module: {
        parishId: targetParishId,
        role,
        module,
      },
    },
  });

  // Verify canView first
  const canView = override?.canView !== null && override?.canView !== undefined
    ? override.canView
    : (rolePerm?.canView ?? DEFAULT_ROLE_PERMISSIONS[role]?.[module]?.canView ?? false);

  if (!canView) return false;

  if (override?.canExport !== null && override?.canExport !== undefined) {
    return Boolean(override.canExport);
  }
  if (rolePerm?.canExport !== null && rolePerm?.canExport !== undefined) {
    return Boolean(rolePerm.canExport);
  }
  return Boolean(DEFAULT_ROLE_PERMISSIONS[role]?.[module]?.canExport ?? false);
}




