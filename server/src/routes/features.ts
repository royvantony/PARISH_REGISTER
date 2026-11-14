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
    defaultEnabled: false,
  },
  {
    key: 'PAGE_REGISTER_NEW',
    name: 'Register New Family',
    category: 'PAGE',
    description: 'Family registration wizard for adding new households',
    route: '/register/new',
    defaultEnabled: false,
  },
  {
    key: 'PAGE_REGISTER_IMPORT',
    name: 'Import Registrations (CSV)',
    category: 'PAGE',
    description: 'Bulk CSV registration upload and mapping pipeline',
    route: '/register/import',
    defaultEnabled: false,
  },
  {
    key: 'PAGE_UNITS',
    name: 'Family Units / Wards',
    category: 'PAGE',
    description: 'Geographic and demographic family unit administration',
    route: '/units',
    defaultEnabled: false,
  },
  {
    key: 'PAGE_USERS',
    name: 'Users & Roles Management',
    category: 'PAGE',
    description: 'Parish user accounts, credentials, and access control',
    route: '/users',
    defaultEnabled: false,
  },
  {
    key: 'PAGE_SETTINGS',
    name: 'System Settings & Masters',
    category: 'PAGE',
    description: 'Parish profile, diocese details, and origin diocese configuration',
    route: '/settings',
    defaultEnabled: false,
  },

  // 2. Dashboard Sub-Items
  {
    key: 'DASH_SUMMARY_CARDS',
    name: 'Demographic Summary Cards',
    category: 'DASHBOARD',
    description: 'Active families, student singles, and member metrics',
    defaultEnabled: false,
  },
  {
    key: 'DASH_DEMO_COMPOSITION',
    name: 'Demographic Composition Chart',
    category: 'DASHBOARD',
    description: 'Families vs International Students vs Individuals pie chart',
    defaultEnabled: false,
  },
  {
    key: 'DASH_WARD_CHART',
    name: 'Ward Distribution Bar Chart',
    category: 'DASHBOARD',
    description: 'Household distribution breakdown across parish wards/units',
    defaultEnabled: false,
  },
  {
    key: 'DASH_AGE_BRACKETS',
    name: 'Age Cohorts Breakdown',
    category: 'DASHBOARD',
    description: 'Demographic age pyramids and parishioner life stages',
    defaultEnabled: false,
  },
  {
    key: 'DASH_TREND_CHART',
    name: 'Registration Trends Over Time',
    category: 'DASHBOARD',
    description: 'Yearly registration growth and cumulative parishioner volume',
    defaultEnabled: false,
  },
  {
    key: 'DASH_SUBURB_CHART',
    name: 'Top Suburbs Geographic Spread',
    category: 'DASHBOARD',
    description: 'Geographic distribution of registered households across residential suburbs',
    defaultEnabled: false,
  },
  {
    key: 'DASH_FAMILY_SIZE',
    name: 'Family Size Breakdown Chart',
    category: 'DASHBOARD',
    description: 'Household size distribution from 1 to 5+ members',
    defaultEnabled: false,
  },
  {
    key: 'DASH_ORIGIN_DIOCESES',
    name: 'Dioceses of Origin (Kerala / India)',
    category: 'DASHBOARD',
    description: 'Parishioners native roots across Kerala & India searchable ranked breakdown',
    defaultEnabled: false,
  },
  {
    key: 'DASH_QUICK_ACTIONS',
    name: 'Dashboard Quick Action Buttons',
    category: 'DASHBOARD',
    description: 'Top header action shortcuts and directory navigation buttons',
    defaultEnabled: false,
  },
  {
    key: 'DASH_ACTIVITY_FEED',
    name: 'Pastoral Activity & Notes Feed',
    category: 'DASHBOARD',
    description: 'Recent pastoral visits, updates, and family activity audit stream',
    defaultEnabled: false,
  },

  // 3. Settings Components
  {
    key: 'SETTING_DIOCESE_BOX',
    name: 'Governing Diocese Profile Box',
    category: 'SETTINGS',
    description: 'Official diocese contact, Bishop name, and diocesan credentials',
    defaultEnabled: false,
  },
  {
    key: 'SETTING_PARISH_BOX',
    name: 'Parish Profile & Identifiers Box',
    category: 'SETTINGS',
    description: 'Parish code, contact details, priest details, and auto-numbering',
    defaultEnabled: false,
  },
  {
    key: 'SETTING_NATIVE_DIOCESES',
    name: 'Origin Dioceses Masters Tab',
    category: 'SETTINGS',
    description: 'Indian native dioceses catalogue, states, and rites management',
    defaultEnabled: false,
  },
  {
    key: 'SETTING_SYSTEM_HEALTH',
    name: 'System Health & Telemetry Box',
    category: 'SETTINGS',
    description: 'Database latency, uptime monitor, and diagnostic telemetry',
    defaultEnabled: false,
  },
  {
    key: 'SETTING_SMTP',
    name: 'Email & SMTP Gateway Configuration',
    category: 'SETTINGS',
    description: 'Outgoing email server settings, Gmail App Passwords, and test email dispatcher',
    defaultEnabled: false,
  },
  {
    key: 'SETTING_ACTIVITY_LOGS',
    name: 'Security & System Activity Logs Tab',
    category: 'SETTINGS',
    description: 'System audit logs, user authentication tracking, and settings change history',
    defaultEnabled: false,
  },
  {
    key: 'SETTING_BACKUP_EXPORT',
    name: 'Parish Archive Export (.parishpack)',
    category: 'SETTINGS',
    description: 'Export complete parish data, members, users, and certificates in an encrypted package',
    defaultEnabled: false,
  },
  {
    key: 'SETTING_BACKUP_IMPORT',
    name: 'Parish Archive Import with OTP Verification',
    category: 'SETTINGS',
    description: 'Import full parish archive with 2FA email authorization and identity integrity verification',
    defaultEnabled: false,
  },
  {
    key: 'SYS_ACTIVITY_LOGGING',
    name: 'Global System Activity Logging Engine',
    category: 'SETTINGS',
    description: 'Master switch to record user logins, logouts, page visits, and administrative changes',
    defaultEnabled: false,
  },

  // 4. Users Page Tabs
  {
    key: 'USERS_TAB_LIST',
    name: 'User Accounts Directory Tab',
    category: 'USERS',
    description: 'List, invite, search, and edit parish user accounts',
    defaultEnabled: false,
  },
  {
    key: 'USERS_TAB_MATRIX',
    name: 'Role Permissions Matrix Tab',
    category: 'USERS',
    description: 'Configure standard permissions per role',
    defaultEnabled: false,
  },
  {
    key: 'USERS_TAB_OVERRIDES',
    name: 'User Permission Overrides Tab',
    category: 'USERS',
    description: 'Fine-grained permission overrides per individual user',
    defaultEnabled: false,
  },

  // 5. Parish Register Sub-Features
  {
    key: 'REGISTER_DIRECT_DEBIT',
    name: 'Direct Debit Banking Feature',
    category: 'REGISTER',
    description: 'Direct debit pledge amounts, frequencies, and management drawer',
    defaultEnabled: false,
  },
  {
    key: 'REGISTER_DOCUMENTS',
    name: 'Family Documents & Certificates',
    category: 'REGISTER',
    description: 'Secure attachments repository for parish release letters, baptism certificates, and ID documents',
    defaultEnabled: false,
  },
  {
    key: 'REGISTER_PRINT_DOSSIER',
    name: 'Print Family Dossier',
    category: 'REGISTER',
    description: 'Printable individual family dossiers (preview and PDF export)',
    defaultEnabled: false,
  },
  {
    key: 'REGISTER_PRINT_LIST',
    name: 'Print Directory Lists',
    category: 'REGISTER',
    description: 'Parish directory printable list (PDF Formatted Colour and Flat Black & White)',
    defaultEnabled: false,
  },

  // 6. Visual Theme Selector
  {
    key: 'FEATURE_THEME_SELECTOR',
    name: 'Theme Selector Buttons',
    category: 'GENERAL',
    description: 'Show/hide theme switch buttons. When hidden, Cathedral Burgundy is forced as default.',
    defaultEnabled: false,
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
      items = decryptPayload<SystemFeatureItem[]>(vault.controlManifest, vault.iv, vault.tag);
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

  // Ensure all standard system features exist and keep metadata synced
  const defMap = new Map(SYSTEM_FEATURES.map((d, idx) => [d.key, { def: d, id: idx + 1 }]));
  const byKey = new Map<string, SystemFeatureItem>();
  let hasMissing = false;

  for (const item of items) {
    const existing = byKey.get(item.key);
    const matched = defMap.get(item.key);
    if (existing) hasMissing = true;
    const syncedName = matched ? matched.def.name : item.name;
    const syncedCategory = matched ? matched.def.category : item.category;
    const syncedDescription = matched ? (matched.def.description || null) : item.description;
    const syncedRoute = matched ? (matched.def.route || null) : item.route;
    if (
      item.name !== syncedName ||
      item.category !== syncedCategory ||
      item.description !== syncedDescription ||
      item.route !== syncedRoute
    ) {
      hasMissing = true;
    }
    byKey.set(item.key, {
      id: matched ? matched.id : item.id,
      key: item.key,
      name: syncedName,
      category: syncedCategory,
      description: syncedDescription,
      route: syncedRoute,
      isEnabled: Boolean(existing?.isEnabled || item.isEnabled),
    });
  }

  for (let idx = 0; idx < SYSTEM_FEATURES.length; idx++) {
    const def = SYSTEM_FEATURES[idx];
    if (!byKey.has(def.key)) {
      byKey.set(def.key, {
        id: idx + 1,
        key: def.key,
        name: def.name,
        category: def.category,
        description: def.description || null,
        route: def.route || null,
        // By default on new database or new parish creation: all features are disabled (false)
        isEnabled: false,
      });
      hasMissing = true;
    }
  }

  items = Array.from(byKey.values());

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
      controlManifest: encrypted.encryptedData,
      iv: encrypted.iv,
      tag: encrypted.tag,
    },
    create: {
      parishId,
      controlManifest: encrypted.encryptedData,
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

// ----------------------------------------------------
// DEVELOPER CRYPTOGRAPHIC WORKBENCH (SUPER_ADMIN ONLY)
// ----------------------------------------------------

/**
 * GET /api/features/crypto/raw/:parishId
 * Fetch raw ciphertext record directly from PostgreSQL SystemFeatureVault.
 */
featuresRouter.get('/crypto/raw/:parishId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Developer privilege required.' });
    }

    const parishId = Number(req.params.parishId || 1);
    const vault = await prisma.systemFeatureVault.findUnique({
      where: { parishId },
    });

    if (!vault) {
      return res.status(404).json({ error: `No feature vault found for Parish #${parishId}.` });
    }

    return res.json({
      parishId: vault.parishId,
      controlManifest: vault.controlManifest,
      iv: vault.iv,
      tag: vault.tag,
      version: vault.version,
      updatedAt: vault.updatedAt,
    });
  } catch (err: any) {
    console.error('Error fetching raw vault:', err);
    return res.status(500).json({ error: 'Failed to fetch raw vault record.' });
  }
});

/**
 * POST /api/features/crypto/decrypt
 * Decrypts any arbitrary AES-256-GCM ciphertext, IV, and tag using the server's master key.
 */
featuresRouter.post('/crypto/decrypt', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Developer privilege required.' });
    }

    const { ciphertext, iv, tag } = req.body;
    if (!ciphertext || !iv || !tag) {
      return res.status(400).json({ error: 'Missing required parameters: ciphertext, iv, and tag are required.' });
    }

    const cleanCiphertext = String(ciphertext).trim();
    const cleanIv = String(iv).trim();
    const cleanTag = String(tag).trim();

    try {
      const decrypted = decryptPayload<any>(cleanCiphertext, cleanIv, cleanTag);
      return res.json({
        success: true,
        data: decrypted,
        formattedJson: typeof decrypted === 'object' ? JSON.stringify(decrypted, null, 2) : String(decrypted),
      });
    } catch (decryptErr: any) {
      return res.status(400).json({
        success: false,
        error: `Decryption failed: ${decryptErr.message || 'Authentication tag mismatch or corrupt ciphertext.'}`,
      });
    }
  } catch (err: any) {
    console.error('Error in crypto decrypt:', err);
    return res.status(500).json({ error: 'Internal error executing decryption.' });
  }
});

/**
 * POST /api/features/crypto/encrypt
 * Encrypts arbitrary plaintext / JSON string into AES-256-GCM ciphertext, IV, and auth tag.
 */
featuresRouter.post('/crypto/encrypt', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Developer privilege required.' });
    }

    const { plaintext } = req.body;
    if (plaintext === undefined || plaintext === null) {
      return res.status(400).json({ error: 'plaintext is required.' });
    }

    let payloadToEncrypt: any = plaintext;
    if (typeof plaintext === 'string') {
      try {
        payloadToEncrypt = JSON.parse(plaintext);
      } catch {
        // Not JSON, encrypt as string
        payloadToEncrypt = plaintext;
      }
    }

    const encrypted = encryptPayload(payloadToEncrypt);

    return res.json({
      success: true,
      controlManifest: encrypted.encryptedData,
      iv: encrypted.iv,
      tag: encrypted.tag,
    });
  } catch (err: any) {
    console.error('Error in crypto encrypt:', err);
    return res.status(500).json({ error: 'Internal error executing encryption.' });
  }
});
