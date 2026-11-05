import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT, optionalAuth } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
import { encryptPayload, decryptPayload } from '../lib/crypto.js';

export const featuresRouter = Router();

export interface FeatureDefinition {
  key: string;
  name: string;
  category: 'PAGE' | 'DASHBOARD' | 'SETTINGS' | 'USERS' | 'REGISTER' | 'GENERAL';
  description: string;
  route?: string;
  defaultEnabled: boolean;
}

export const SYSTEM_FEATURES: FeatureDefinition[] = [
  // 1. Pages & Routes
  {
    key: 'PAGE_REGISTER',
    name: 'Parish Register Directory',
    category: 'PAGE',
    description: 'Main Parish Register list, household search and member directory',
    route: '/register',
    defaultEnabled: true,
  },
  {
    key: 'PAGE_REGISTER_NEW',
    name: 'Register New Family',
    category: 'PAGE',
    description: 'Family registration wizard for adding new households',
    route: '/register/new',
    defaultEnabled: true,
  },
  {
    key: 'PAGE_REGISTER_IMPORT',
    name: 'Import Registrations (CSV)',
    category: 'PAGE',
    description: 'Bulk CSV registration upload and mapping pipeline',
    route: '/register/import',
    defaultEnabled: true,
  },
  {
    key: 'PAGE_UNITS',
    name: 'Family Units / Wards',
    category: 'PAGE',
    description: 'Geographic and demographic family unit administration',
    route: '/units',
    defaultEnabled: true,
  },
  {
    key: 'PAGE_USERS',
    name: 'Users & Roles Management',
    category: 'PAGE',
    description: 'Parish user accounts, credentials, and access control',
    route: '/users',
    defaultEnabled: true,
  },
  {
    key: 'PAGE_SETTINGS',
    name: 'System Settings & Masters',
    category: 'PAGE',
    description: 'Parish profile, diocesan chancery, and origin diocese configuration',
    route: '/settings',
    defaultEnabled: true,
  },

  // 2. Dashboard Sub-Items
  {
    key: 'DASH_KPI_CARDS',
    name: 'Demographic Summary Cards',
    category: 'DASHBOARD',
    description: 'Active families, student singles, and member metrics',
    defaultEnabled: true,
  },
  {
    key: 'DASH_DEMO_COMPOSITION',
    name: 'Demographic Composition Chart',
    category: 'DASHBOARD',
    description: 'Families vs International Students vs Individuals pie chart',
    defaultEnabled: true,
  },
  {
    key: 'DASH_WARD_CHART',
    name: 'Ward Distribution Bar Chart',
    category: 'DASHBOARD',
    description: 'Household distribution breakdown across parish wards/units',
    defaultEnabled: true,
  },
  {
    key: 'DASH_AGE_BRACKETS',
    name: 'Age Cohorts Breakdown',
    category: 'DASHBOARD',
    description: 'Demographic age pyramids and parishioner life stages',
    defaultEnabled: true,
  },
  {
    key: 'DASH_TREND_CHART',
    name: 'Registration Trends Over Time',
    category: 'DASHBOARD',
    description: 'Yearly registration growth and cumulative parishioner volume',
    defaultEnabled: true,
  },
  {
    key: 'DASH_SUBURB_CHART',
    name: 'Top Suburbs Geographic Spread',
    category: 'DASHBOARD',
    description: 'Geographic distribution of registered households across residential suburbs',
    defaultEnabled: true,
  },
  {
    key: 'DASH_FAMILY_SIZE',
    name: 'Family Size Breakdown Chart',
    category: 'DASHBOARD',
    description: 'Household size distribution from 1 to 5+ members',
    defaultEnabled: true,
  },
  {
    key: 'DASH_ORIGIN_DIOCESES',
    name: 'Dioceses of Origin (Kerala / India)',
    category: 'DASHBOARD',
    description: 'Parishioners native roots across Kerala & India searchable ranked breakdown',
    defaultEnabled: true,
  },
  {
    key: 'DASH_QUICK_ACTIONS',
    name: 'Dashboard Quick Action Buttons',
    category: 'DASHBOARD',
    description: 'Top header action shortcuts and directory navigation buttons',
    defaultEnabled: true,
  },
  {
    key: 'DASH_ACTIVITY_FEED',
    name: 'Pastoral Activity & Notes Feed',
    category: 'DASHBOARD',
    description: 'Recent pastoral visits, updates, and family activity audit stream',
    defaultEnabled: true,
  },

  // 3. Settings Components
  {
    key: 'SETTING_DIOCESE_BOX',
    name: 'Governing Diocese Profile Box',
    category: 'SETTINGS',
    description: 'Official chancery contact, Bishop name, and diocesan credentials',
    defaultEnabled: true,
  },
  {
    key: 'SETTING_PARISH_BOX',
    name: 'Parish Profile & Identifiers Box',
    category: 'SETTINGS',
    description: 'Parish code, contact details, priest details, and auto-numbering',
    defaultEnabled: true,
  },
  {
    key: 'SETTING_NATIVE_DIOCESES',
    name: 'Origin Dioceses Masters Tab',
    category: 'SETTINGS',
    description: 'Indian native dioceses catalogue, states, and rites management',
    defaultEnabled: true,
  },
  {
    key: 'SETTING_SYSTEM_HEALTH',
    name: 'System Health & Telemetry Box',
    category: 'SETTINGS',
    description: 'Database latency, uptime monitor, and diagnostic telemetry',
    defaultEnabled: true,
  },

  // 4. Users Page Tabs
  {
    key: 'USERS_TAB_LIST',
    name: 'User Accounts Directory Tab',
    category: 'USERS',
    description: 'List, invite, search, and edit parish user accounts',
    defaultEnabled: true,
  },
  {
    key: 'USERS_TAB_MATRIX',
    name: 'Role Permissions Matrix Tab',
    category: 'USERS',
    description: 'Configure standard permissions per role',
    defaultEnabled: true,
  },
  {
    key: 'USERS_TAB_OVERRIDES',
    name: 'User Permission Overrides Tab',
    category: 'USERS',
    description: 'Fine-grained permission overrides per individual user',
    defaultEnabled: true,
  },

  // 5. Parish Register Sub-Features
  {
    key: 'REGISTER_DIRECT_DEBIT',
    name: 'Direct Debit Banking Feature',
    category: 'REGISTER',
    description: 'Direct debit pledge amounts, frequencies, and management drawer',
    defaultEnabled: true,
  },
  {
    key: 'REGISTER_PRINT_DOSSIER',
    name: 'Print Family Dossier',
    category: 'REGISTER',
    description: 'Printable individual family dossiers (preview and PDF export)',
    defaultEnabled: true,
  },
  {
    key: 'REGISTER_PRINT_LIST',
    name: 'Print Directory Lists',
    category: 'REGISTER',
    description: 'Parish directory printable list (PDF Formatted Colour and Flat Black & White)',
    defaultEnabled: true,
  },

  // 6. Visual Theme Selector
  {
    key: 'FEATURE_THEME_SELECTOR',
    name: 'Theme Selector Buttons',
    category: 'GENERAL',
    description: 'Show/hide theme switch buttons. When hidden, Cathedral Burgundy is forced as default.',
    defaultEnabled: true,
  },
];

export interface SystemFeatureItem {
  id: number;
  key: string;
  name: string;
  category: string;
  description: string | null;
  route: string | null;
  isEnabled: boolean;
}

// In-memory cache: parishId -> SystemFeatureItem[]
const featureVaultCache = new Map<number, SystemFeatureItem[]>();

/**
 * Get decrypted features for a parish.
 * 1. Checks in-memory cache (0.0001ms)
 * 2. If missing, loads and decrypts from SystemFeatureVault table
 * 3. If no vault exists yet, initializes with SYSTEM_FEATURES defaults, encrypts, and saves.
 */
export async function getParishFeatures(parishId: number): Promise<SystemFeatureItem[]> {
  if (featureVaultCache.has(parishId)) {
    return featureVaultCache.get(parishId)!;
  }

  const vault = await prisma.systemFeatureVault.findUnique({
    where: { parishId },
  });

  let items: SystemFeatureItem[] = [];
  if (vault) {
    try {
      items = decryptPayload<SystemFeatureItem[]>(vault.encryptedData, vault.iv, vault.tag);
    } catch (err) {
      console.error(`[FeatureVault] Decryption failed or tampered for Parish ${parishId}. Failing closed (hidden/off).`);
      // Fail-closed: If the vault cannot be read, default ALL features to disabled/hidden (false)
      items = SYSTEM_FEATURES.map((def, idx) => ({
        id: idx + 1,
        key: def.key,
        name: def.name,
        category: def.category,
        description: def.description || null,
        route: def.route || null,
        isEnabled: false, // Strict default-hidden
      }));
      await saveParishFeatures(parishId, items);
      return items;
    }
  }

  // Ensure all standard system features exist in items
  const existingKeys = new Set(items.map((i) => i.key));
  let hasMissing = false;

  for (let idx = 0; idx < SYSTEM_FEATURES.length; idx++) {
    const def = SYSTEM_FEATURES[idx];
    if (!existingKeys.has(def.key)) {
      items.push({
        id: idx + 1,
        key: def.key,
        name: def.name,
        category: def.category,
        description: def.description || null,
        route: def.route || null,
        // If initializing a brand new parish, use def.defaultEnabled.
        // If backfilling an existing vault where a key was missing, fail-closed to false (hidden).
        isEnabled: vault ? false : def.defaultEnabled,
      });
      hasMissing = true;
    }
  }

  // Sort by category & id
  items.sort((a, b) => a.category.localeCompare(b.category) || a.id - b.id);

  if (!vault || hasMissing) {
    await saveParishFeatures(parishId, items);
  } else {
    featureVaultCache.set(parishId, items);
  }

  return items;
}

/**
 * Save and re-encrypt the feature vault for a parish.
 * Updates in-memory cache and stores AES-256-GCM ciphertext in PostgreSQL.
 */
export async function saveParishFeatures(parishId: number, features: SystemFeatureItem[]) {
  featureVaultCache.set(parishId, features);
  const encrypted = encryptPayload(features);

  await prisma.systemFeatureVault.upsert({
    where: { parishId },
    update: {
      encryptedData: encrypted.encryptedData,
      iv: encrypted.iv,
      tag: encrypted.tag,
    },
    create: {
      parishId,
      encryptedData: encrypted.encryptedData,
      iv: encrypted.iv,
      tag: encrypted.tag,
    },
  });
}

/**
 * Helper: check if a feature is enabled for a given parish.
 * Reads directly from in-memory cache in 0.0001ms.
 * Strict fail-closed: returns false if key is unknown or if an error occurs.
 */
export async function isFeatureEnabled(key: string, parishId?: number): Promise<boolean> {
  try {
    const targetParishId = parishId || 1;
    const features = await getParishFeatures(targetParishId);
    const match = features.find((f) => f.key === key);
    return match ? Boolean(match.isEnabled) : false; // Strict default-deny / fail-closed
  } catch (err) {
    console.error(`[FeatureVault] Error checking feature "${key}" for Parish ${parishId}:`, err);
    return false; // Fail-closed: unreadable -> hidden/disabled
  }
}

/**
 * Pre-warm/initialize feature cache for all active parishes
 */
export async function ensureDefaultFeatures(parishId?: number) {
  if (parishId) {
    await getParishFeatures(parishId);
  } else {
    const parishes = await prisma.parish.findMany({ select: { id: true } });
    for (const p of parishes) {
      await getParishFeatures(p.id);
    }
  }
}

// GET /api/features - Get feature toggles and flags map scoped to active parish
featuresRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const headerParish = req.headers['x-parish-id'];
    const queryParish = req.query.parishId;
    const targetParishId = Number(queryParish || headerParish || req.activeParishId || 1);

    const allFeatures = await getParishFeatures(targetParishId);

    const flagsMap: Record<string, boolean> = {};
    for (const f of allFeatures) {
      flagsMap[f.key] = Boolean(f.isEnabled);
    }

    return res.json({
      parishId: targetParishId,
      features: allFeatures,
      flags: flagsMap,
    });
  } catch (err: any) {
    console.error('Error fetching feature toggles (Failing closed):', err);
    // Fail-Closed Security: If the vault or cache cannot be read, default ALL flags to false (hidden)
    const failClosedFlags: Record<string, boolean> = {};
    for (const def of SYSTEM_FEATURES) {
      failClosedFlags[def.key] = false;
    }
    return res.json({
      parishId: 1,
      features: SYSTEM_FEATURES.map((f, idx) => ({ id: idx + 1, ...f, isEnabled: false })),
      flags: failClosedFlags,
    });
  }
});

// PUT /api/features/:key - Toggle a feature for a specific parish (Strictly SUPER_ADMIN Developer only)
featuresRouter.put('/:key', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Developer privilege required to modify system features.' });
    }

    const key = req.params.key as string;
    const { isEnabled } = req.body;

    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({ error: 'isEnabled must be a boolean.' });
    }

    const headerParish = req.headers['x-parish-id'];
    const bodyParish = req.body.parishId;
    const queryParish = req.query.parishId;
    const targetParishId = Number(bodyParish || queryParish || headerParish || req.activeParishId || 1);

    const allFeatures = await getParishFeatures(targetParishId);
    const targetFeature = allFeatures.find((f) => f.key === key);

    if (targetFeature) {
      targetFeature.isEnabled = isEnabled;
    } else {
      const def = SYSTEM_FEATURES.find((f) => f.key === key);
      allFeatures.push({
        id: allFeatures.length + 1,
        key,
        name: def?.name || key,
        category: def?.category || 'GENERAL',
        description: def?.description || null,
        route: def?.route || null,
        isEnabled,
      });
    }

    await saveParishFeatures(targetParishId, allFeatures);

    const updated = targetFeature || allFeatures[allFeatures.length - 1];

    return res.json({
      message: `Feature ${updated.name} for Parish #${targetParishId} is now ${updated.isEnabled ? 'ENABLED' : 'DISABLED'}.`,
      feature: updated,
      parishId: targetParishId,
    });
  } catch (err: any) {
    console.error('Error updating feature toggle:', err);
    return res.status(500).json({ error: 'Failed to update feature toggle.' });
  }
});

// POST /api/features/batch - Batch update features for a specific parish (Strictly SUPER_ADMIN Developer only)
featuresRouter.post('/batch', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Developer privilege required to modify system features.' });
    }

    const { updates, parishId } = req.body; // Array of { key: string, isEnabled: boolean }
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'updates must be an array.' });
    }

    const headerParish = req.headers['x-parish-id'];
    const queryParish = req.query.parishId;
    const targetParishId = Number(parishId || queryParish || headerParish || req.activeParishId || 1);

    const allFeatures = await getParishFeatures(targetParishId);
    const updateMap = new Map(updates.map((u) => [u.key, Boolean(u.isEnabled)]));

    for (const f of allFeatures) {
      if (updateMap.has(f.key)) {
        f.isEnabled = updateMap.get(f.key)!;
      }
    }

    await saveParishFeatures(targetParishId, allFeatures);

    const flagsMap: Record<string, boolean> = {};
    for (const f of allFeatures) {
      flagsMap[f.key] = f.isEnabled;
    }

    return res.json({
      message: `Features updated successfully for Parish #${targetParishId}.`,
      features: allFeatures,
      flags: flagsMap,
      parishId: targetParishId,
    });
  } catch (err: any) {
    console.error('Error batch updating features:', err);
    return res.status(500).json({ error: 'Failed to batch update features.' });
  }
});
