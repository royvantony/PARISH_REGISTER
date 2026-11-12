type ConnectionListener = (offline: boolean) => void;

let isOfflineState = typeof navigator !== 'undefined' ? !navigator.onLine : false;
let pendingCheck: Promise<boolean> | null = null;
const listeners = new Set<ConnectionListener>();

function notify(nextOffline: boolean) {
  if (isOfflineState === nextOffline) return;
  isOfflineState = nextOffline;
  listeners.forEach((cb) => cb(isOfflineState));
}

export function getIsOffline(): boolean {
  return isOfflineState;
}

export function subscribeConnectionStatus(listener: ConnectionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markServerOnline(): void {
  notify(false);
}

export function markServerOffline(): void {
  notify(true);
}

/**
 * Checks whether the API server is reachable via /api/health.
 * Returns true if reachable, false otherwise, and updates global offline state.
 */
export async function verifyServerConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notify(true);
    return false;
  }

  if (pendingCheck) return pendingCheck;

  pendingCheck = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (res.ok) {
        notify(false);
        return true;
      }
      notify(true);
      return false;
    } catch {
      notify(true);
      return false;
    } finally {
      window.clearTimeout(timer);
      pendingCheck = null;
    }
  })();

  return pendingCheck;
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => notify(true));
  window.addEventListener('online', () => {
    verifyServerConnection().then((ok) => {
      if (ok) {
        window.location.reload();
      }
    });
  });
}
