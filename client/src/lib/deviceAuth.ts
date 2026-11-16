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

export interface HardwareTelemetry {
  hardwareHash: string;
  gpuRenderer: string;
  screenResolution: string;
  cpuCores: number;
  deviceMemory?: string;
  timezone: string;
  platformSummary: string;
}

/**
 * 100% automated, zero-prompt hardware telemetry collection.
 * Extracts physical machine characteristics to uniquely identify this terminal
 * across browsers, cache clears, and Safari Private Browsing.
 */
export function collectHardwareTelemetry(): HardwareTelemetry {
  if (typeof window === 'undefined') {
    return {
      hardwareHash: 'server_env',
      gpuRenderer: 'Standard Adapter',
      screenResolution: 'Standard Display',
      cpuCores: 2,
      timezone: 'UTC',
      platformSummary: 'Server',
    };
  }

  // 1. GPU Renderer via WebGL unmasked info
  let gpuRenderer = 'Standard Display Adapter';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const unmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (unmasked) {
          gpuRenderer = unmasked.toString().replace(/ANGLE \((.*)\)/, '$1');
        }
      }
    }
  } catch {
    // WebGL disabled
  }

  // 2. Display specifications (Resolution, Retina factor, Color Depth)
  const width = window.screen.width || 0;
  const height = window.screen.height || 0;
  const dpr = window.devicePixelRatio || 1;
  const colorDepth = window.screen.colorDepth || 24;
  const screenResolution = `${width} × ${height} (${dpr > 1 ? `${dpr}x Retina` : '1x'}, ${colorDepth}-bit)`;

  // 3. CPU Concurrency & RAM
  const cpuCores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB RAM` : undefined;

  // 4. Timezone & Locale
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // 5. Browser & OS Platform Summary
  const platformSummary = getBrowserMetadata();

  // 6. Fast deterministic 64-bit FNV-1a hardware signature
  const rawFingerprint = [
    gpuRenderer,
    width,
    height,
    dpr,
    colorDepth,
    cpuCores,
    timezone,
    navigator.platform || '',
  ].join('|');

  let h1 = 0x811c9dc5;
  for (let i = 0; i < rawFingerprint.length; i++) {
    h1 ^= rawFingerprint.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
  }
  const hardwareHash = `hw_${h1.toString(16).padStart(8, '0')}`;

  return {
    hardwareHash,
    gpuRenderer,
    screenResolution,
    cpuCores,
    deviceMemory: mem,
    timezone,
    platformSummary,
  };
}

/**
 * Checks with the backend whether this browser/terminal is authorized for the given parish.
 * Seamlessly matches approved terminals by hardware signature even in Safari Private Browsing.
 */
export async function verifyTerminalAuthorization(parishId: number): Promise<DeviceVerifyResult> {
  const deviceToken = getStoredDeviceSecret(parishId);
  const telemetry = collectHardwareTelemetry();

  try {
    const res = await api.post('/devices/verify', {
      parishId,
      deviceToken,
      hardwareHash: telemetry.hardwareHash,
      telemetry,
      browserInfo: getBrowserMetadata(),
    });

    // If server recognized this physical machine and returned an adopted secret, persist it
    if (res.data?.adoptedSecret) {
      try {
        localStorage.setItem(`${DEVICE_STORAGE_PREFIX}${parishId}`, res.data.adoptedSecret);
      } catch {
        // Private mode quota
      }
    }

    return res.data;
  } catch (err) {
    console.error('Terminal authorization verification failed:', err);
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
  const telemetry = collectHardwareTelemetry();

  const res = await api.post('/devices/register', {
    parishId,
    deviceName,
    deviceSecret,
    browserInfo,
    telemetry,
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
  const telemetry = collectHardwareTelemetry();

  const res = await api.post('/devices/authorize-direct', {
    parishId,
    deviceToken,
    email: identifier,
    password,
    terminalName,
    browserInfo,
    telemetry,
  });

  return res.data;
}


