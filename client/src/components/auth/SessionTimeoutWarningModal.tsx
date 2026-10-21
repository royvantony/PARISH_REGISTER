import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth, INACTIVITY_TIMEOUT_MINUTES } from '../../context/AuthContext';
import { Clock, CheckCircle2, LogOut } from 'lucide-react';

export const SessionTimeoutWarningModal: React.FC = () => {
  const { isWarningOpen, remainingSeconds, staySignedIn, logout } = useAuth();

  if (!isWarningOpen) return null;

  // Format seconds into MM:SS
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <Modal
      isOpen={isWarningOpen}
      onClose={staySignedIn}
      title="Session Expiring Soon"
      description="You have been idle for several minutes. To protect parishioner confidentiality, your session will automatically sign out soon."
      maxWidth="md"
    >
      <div className="text-center py-2 space-y-5">
        {/* Animated Clock / Pulse Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center animate-pulse">
            <Clock className="w-8 h-8" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
          </span>
        </div>

        {/* Live Countdown Clock */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Automatic Sign Out In
          </div>
          <div className="text-4xl font-black font-mono tracking-tight text-amber-700">
            {formattedTime}
          </div>
          <p className="text-[11px] text-amber-800/80">
            Parish Register has a {INACTIVITY_TIMEOUT_MINUTES}-minute idle security threshold.
          </p>
        </div>

        <p className="text-xs text-parish-text-muted leading-relaxed max-w-sm mx-auto">
          Click <strong>Stay Signed In</strong> to continue your session, or <strong>Sign Out Now</strong> if you are finished.
        </p>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={logout}
            icon={<LogOut className="w-4 h-4 text-red-600" />}
            className="w-full sm:w-auto order-2 sm:order-1 text-red-600 hover:bg-red-50 hover:border-red-200"
          >
            Sign Out Now
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={staySignedIn}
            icon={<CheckCircle2 className="w-4 h-4" />}
            className="w-full sm:w-auto order-1 sm:order-2 shadow-soft font-bold"
          >
            Stay Signed In
          </Button>
        </div>
      </div>
    </Modal>
  );
};
