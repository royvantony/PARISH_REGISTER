import crypto from 'crypto';

// Secret key for encrypting sensitive vaults in the database
const getEncryptionKey = (): Buffer => {
  const secret =
    process.env.FEATURE_VAULT_KEY ||
    process.env.JWT_SECRET ||
    'st_alphonsa_parish_brisbane_secret_jwt_key_2026';
  // Derive a deterministic 32-byte key using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
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

