import React, { useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { verifyServerConnection } from '../../lib/connectionState';

export const NoConnectionScreen: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [stillOfflineMsg, setStillOfflineMsg] = useState<string | null>(null);

  const handleRetry = async () => {
    setIsChecking(true);
    setStillOfflineMsg(null);
    const ok = await verifyServerConnection();
    if (ok) {
      window.location.reload();
      return;
    }
    setIsChecking(false);
    setStillOfflineMsg('Still unable to reach the server. Please verify your connection.');
  };

  return (
    <div className="min-h-screen bg-parish-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-parish-surface border border-parish-border rounded-2xl p-8 text-center shadow-soft space-y-5 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-parish-surface-subtle border border-parish-border text-parish-primary mx-auto flex items-center justify-center">
          <WifiOff className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-parish-primary bg-parish-primary-light px-2.5 py-1 rounded-full">
            Offline
          </span>
          <h2 className="text-xl font-extrabold text-parish-text tracking-tight pt-1">
            No Connection
          </h2>
          <p className="text-xs sm:text-sm text-parish-text-muted leading-relaxed">
            Unable to connect to the Parish Register server. Check your internet or Wi-Fi connection and try again.
          </p>
        </div>

        <div className="pt-1 flex flex-col items-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />}
            onClick={handleRetry}
            disabled={isChecking}
          >
            {isChecking ? 'Checking Connection...' : 'Try Again'}
          </Button>

          {stillOfflineMsg && (
            <p className="text-xs font-medium text-parish-danger" role="status" aria-live="polite">
              {stillOfflineMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
