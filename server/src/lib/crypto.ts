import crypto from 'crypto';

const LEGACY_DEV_SECRET = 'st_alphonsa_parish_brisbane_secret_jwt_key_2026';

export const JWT_EXPIRES_IN = '1d';

function isStrictProduction(): boolean {
  const mode = (process.env.APP_ENV || process.env.NODE_ENV || 'development').trim().toLowerCase();
  return mode === 'production';
}

export function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (isStrictProduction()) {
    if (!configured || configured === LEGACY_DEV_SECRET) {
      throw new Error(
        'Security configuration error: JWT_SECRET must be set to a unique random secret when APP_ENV=Production.'
      );
    }
    return configured;
  }
  return configured || LEGACY_DEV_SECRET;
}

function getVaultSecret(): string {
  const vaultKey = process.env.FEATURE_VAULT_KEY?.trim();
  if (isStrictProduction()) {
    if (!vaultKey || vaultKey === LEGACY_DEV_SECRET) {
      throw new Error(
        'Security configuration error: FEATURE_VAULT_KEY must be set to a unique random secret when APP_ENV=Production.'
      );
    }
    return vaultKey;
  }
  return vaultKey || process.env.JWT_SECRET?.trim() || LEGACY_DEV_SECRET;
}

/**
 * Validates required production secrets on server startup so misconfigured deployments fail fast.
 */
export function assertProductionSecretsConfigured(): void {
  if (!isStrictProduction()) return;
  getJwtSecret();
  getVaultSecret();
}

// Secret key for encrypting sensitive vaults in the database
const getEncryptionKey = (): Buffer => {
  // Derive a deterministic 32-byte key using SHA-256
  return crypto.createHash('sha256').update(getVaultSecret()).digest();
};

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt any JavaScript object or string using AES-256-GCM authenticated encryption.
 */
export function encryptPayload(data: any): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const textToEncrypt = typeof data === 'string' ? data : JSON.stringify(data);
  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 * Throws an error if data was tampered with (GCM authentication tag check).
 */
export function decryptPayload<T = any>(encryptedData: string, ivHex: string, tagHex: string): T {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as unknown as T;
  }
}

