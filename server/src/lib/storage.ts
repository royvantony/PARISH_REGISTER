import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { URL } from 'url';

// Base storage directory outside web root
const STORAGE_BASE_DIR = path.resolve(process.cwd(), 'uploads', 'documents');

// Ensure base upload directory exists
if (!fs.existsSync(STORAGE_BASE_DIR)) {
  fs.mkdirSync(STORAGE_BASE_DIR, { recursive: true });
}

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/**
 * Validates file magic bytes (file signature) to prevent disguised executable files.
 */
export function detectMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 (0x89 'PNG')
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Checks if a hostname or IP is a dangerous private, internal, or cloud-metadata address (SSRF guard).
 */
export function isInternalOrPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();

  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0.0.0.0' ||
    h === '169.254.169.254' || // AWS / Cloud metadata
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true;
  }

  // Check IPv4 private subnets
  const ipMatch = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const octet1 = parseInt(ipMatch[1], 10);
    const octet2 = parseInt(ipMatch[2], 10);

    if (octet1 === 10) return true; // 10.0.0.0/8
    if (octet1 === 127) return true; // Loopback
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true; // 172.16.0.0/12
    if (octet1 === 192 && octet2 === 168) return true; // 192.168.0.0/16
    if (octet1 === 169 && octet2 === 254) return true; // Link-local
  }

  return false;
}

export interface SavedDocumentResult {
  fileName: string;
  localPath: string;
  mimeType: string;
  fileSize: number;
  originalUrl?: string | null;
}

/**
 * Saves a file buffer to protected parish storage.
 */
export async function saveDocumentBuffer(params: {
  parishId: number;
  familyId: number;
  buffer: Buffer;
  originalName: string;
  declaredMimeType?: string;
}): Promise<SavedDocumentResult> {
  const { parishId, familyId, buffer, originalName, declaredMimeType } = params;

  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('File size exceeds the 10 MB limit.');
  }

  // Magic bytes inspection
  const detectedMime = detectMimeTypeFromBuffer(buffer);
  const finalMime = detectedMime || declaredMimeType;

  if (!finalMime || !ALLOWED_MIME_TYPES.has(finalMime)) {
    throw new Error(
      'Invalid file format. Only JPEG, PNG, WEBP, and PDF documents are permitted.'
    );
  }

  // Destination folder: uploads/documents/parish_{id}/family_{id}/
  const targetDir = path.join(STORAGE_BASE_DIR, `parish_${parishId}`, `family_${familyId}`);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Randomized UUID filename for storage (eliminates path traversal)
  const ext = EXTENSION_MAP[finalMime] || path.extname(originalName) || '.bin';
  const diskFileName = `${crypto.randomUUID()}${ext}`;
  const absolutePath = path.join(targetDir, diskFileName);

  await fs.promises.writeFile(absolutePath, buffer);

  // Store relative path from STORAGE_BASE_DIR for portability
  const relativePath = path.relative(STORAGE_BASE_DIR, absolutePath);

  // Clean, displayable filename
  const cleanOriginalName = path.basename(originalName).replace(/[^\w\s\.-]/gi, '_');

  return {
    fileName: cleanOriginalName,
    localPath: relativePath,
    mimeType: finalMime,
    fileSize: buffer.length,
  };
}

/**
 * Safely downloads an external document from a URL (e.g. from CSV import)
 * with strict SSRF filtering, 10MB limit, and magic bytes validation.
 */
export async function downloadExternalDocument(params: {
  parishId: number;
  familyId: number;
  url: string;
  preferredName?: string;
}): Promise<SavedDocumentResult> {
  const { parishId, familyId, url, preferredName } = params;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format for document attachment.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted for document downloads.');
  }

  if (isInternalOrPrivateHost(parsedUrl.hostname)) {
    throw new Error('Access to internal or private network addresses is forbidden.');
  }

  const client = parsedUrl.protocol === 'https:' ? https : http;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const req = client.get(url, { timeout: 15000 }, (res) => {
      // Handle redirects (max 1 hop)
      if (
        res.statusCode &&
        [301, 302, 307, 308].includes(res.statusCode) &&
        res.headers.location
      ) {
        try {
          const redirectUrl = new URL(res.headers.location, url);
          if (isInternalOrPrivateHost(redirectUrl.hostname)) {
            return reject(new Error('Redirected to forbidden internal address.'));
          }
          const redirectClient = redirectUrl.protocol === 'https:' ? https : http;
          redirectClient
            .get(redirectUrl.href, { timeout: 15000 }, (redRes) => {
              handleResponse(redRes);
            })
            .on('error', reject);
          return;
        } catch (e) {
          return reject(e);
        }
      }

      handleResponse(res);

      function handleResponse(response: http.IncomingMessage) {
        if (response.statusCode && response.statusCode >= 400) {
          return reject(
            new Error(`Server returned HTTP error ${response.statusCode} while fetching document.`)
          );
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const maxBytes = 10 * 1024 * 1024; // 10MB

        response.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            response.destroy();
            reject(new Error('Downloaded document exceeded 10MB limit.'));
          } else {
            chunks.push(chunk);
          }
        });

        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        response.on('error', reject);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timed out while fetching external document.'));
    });

    req.on('error', reject);
  });

  const parsedFilename = path.basename(parsedUrl.pathname) || preferredName || 'attachment.png';
  const saved = await saveDocumentBuffer({
    parishId,
    familyId,
    buffer,
    originalName: preferredName || parsedFilename,
  });

  saved.originalUrl = url;
  return saved;
}

/**
 * Resolves full path on disk and verifies it remains within the storage sandbox.
 */
export function getAbsoluteDocumentPath(relativePath: string): string | null {
  const resolved = path.resolve(STORAGE_BASE_DIR, relativePath);
  if (!resolved.startsWith(STORAGE_BASE_DIR)) {
    // Directory traversal detected
    return null;
  }
  return resolved;
}

/**
 * Removes a document file safely from the storage disk.
 */
export async function deleteDocumentFile(relativePath: string): Promise<boolean> {
  const abs = getAbsoluteDocumentPath(relativePath);
  if (!abs || !fs.existsSync(abs)) return false;

  try {
    await fs.promises.unlink(abs);
    return true;
  } catch (err) {
    console.error('Failed to unlink document file:', err);
    return false;
  }
}

