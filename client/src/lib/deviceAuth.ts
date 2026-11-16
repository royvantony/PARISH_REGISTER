import { api } from './api';

const DEVICE_STORAGE_PREFIX = 'parish_terminal_sec_';

export interface DeviceVerifyResult {
  status: 'APPROVED' | 'PENDING' | 'REVOKED' | 'UNREGISTERED';
  deviceId?: number;
  deviceName?: string;
  parishName?: string;
  requestedAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  isFirstDeviceSetup?: boolean;
}

/**
 * Returns a human-friendly string identifying the OS, device platform, and browser.
 */
export function getBrowserMetadata(): string {
  if (typeof window === 'undefined') return 'Unknown Browser';

  const ua = navigator.userAgent;
  let browser = 'Web Browser';
  let os = 'Unknown OS';

  // Detect Browser
  if (ua.includes('Edg/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    browser = 'Google Chrome';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Apple Safari';
  } else if (ua.includes('Firefox/')) {
    browser = 'Mozilla Firefox';
  }

  // Detect OS
  if (ua.includes('Win')) {
    os = 'Windows';
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS')) {
    os = 'macOS';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  }

  return `${browser} on ${os}`;
}

/**
 * Retrieves the cryptographic device secret for a given parish from redundant persistent storage.
 */
export function getStoredDeviceSecret(parishId: number): string | null {
  try {
    const key = `${DEVICE_STORAGE_PREFIX}${parishId}`;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Generates or retrieves an existing 64-character high-entropy cryptographic secret for the parish.
 */
export function ensureDeviceSecret(parishId: number): string {
  const existing = getStoredDeviceSecret(parishId);
  if (existing && existing.length >= 32) return existing;

  // Generate cryptographically secure random bytes
  const array = new Uint8Array(32);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) array[i] = Math.floor(Math.random() * 256);
  }

  const newSecret = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  try {
    const key = `${DEVICE_STORAGE_PREFIX}${parishId}`;
    localStorage.setItem(key, newSecret);
  } catch (err) {
    console.error('Failed to store terminal secret in localStorage:', err);
  }

  return newSecret;
}

/**
 * Checks with the backend whether this browser/terminal is authorized for the given parish.
 */
export async function verifyTerminalAuthorization(parishId: number): Promise<DeviceVerifyResult> {
  const deviceToken = getStoredDeviceSecret(parishId);
  if (!deviceToken) {
    return { status: 'UNREGISTERED' };
  }

  try {
    const res = await api.post('/devices/verify', {
      parishId,
      deviceToken,
      browserInfo: getBrowserMetadata(),
    });
    return res.data;
  } catch (err) {
    console.error('Terminal authorization verification failed:', err);
    // On network failure, don't hard block, return UNREGISTERED or let login proceed if offline
    return { status: 'UNREGISTERED' };
  }
}

/**
 * Submits an enrollment request for this terminal to the parish administration.
 */
export async function registerTerminal(
  parishId: number,
  deviceName: string
): Promise<{ success: boolean; status: string; deviceName: string; message: string }> {
  const deviceSecret = ensureDeviceSecret(parishId);
  const browserInfo = getBrowserMetadata();

  const res = await api.post('/devices/register', {
    parishId,
    deviceName,
    deviceSecret,
    browserInfo,
  });

  return res.data;
}

/**
 * Direct in-person terminal authorization by a Parish Priest or Admin typing their credentials.
 */
export async function authorizeTerminalDirectly(
  parishId: number,
  identifier: string,
  password: string,
  terminalName?: string
): Promise<{ success: boolean; status: string; deviceName: string; message: string }> {
  const deviceToken = ensureDeviceSecret(parishId);
  const browserInfo = getBrowserMetadata();

  const res = await api.post('/devices/authorize-direct', {
    parishId,
    deviceToken,
    email: identifier,
    password,
    terminalName,
    browserInfo,
  });

  return res.data;
}


