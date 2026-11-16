import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Lock, ShieldCheck, AlertCircle, CheckCircle2, Mail, KeyRound } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen }) => {
  const { user, updatePassword, requestLogout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize countdown on open
  useEffect(() => {
    if (isOpen) {
      setOtpCountdown(60);
      setFeedback('A 5-minute verification code was dispatched to your email.');
    }
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const handleResendOtp = async () => {
    if (otpCountdown > 0 || isResending) return;
    setErrorMessage('');
    setFeedback(null);
    setIsResending(true);
    try {
      const res = await api.post('/auth/temp-login/resend-otp');
      setFeedback(res.data.message || 'A new 5-minute verification code has been dispatched to your email.');
      setOtpCountdown(60);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setIsLoading(true);
    const result = await updatePassword(newPassword, undefined, cleanOtp);
    setIsLoading(false);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setErrorMessage(result.error || 'Failed to update password.');
    }
  };

  if (!isOpen && !isSuccess) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { }} // Non-dismissible: must change password or logout
      title="Set Your Permanent Password"
      description="You logged in with a temporary password. Verify your email code and set your private password to continue."
      maxWidth="md"
    >
      {isSuccess ? (
        <div className="py-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-parish-text">Password Set Successfully!</h3>
            <p className="text-xs text-parish-text-muted mt-1">
              Your account is now secure. Welcome to the Parish Register portal, {user?.fullName}!
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
            <div className="leading-relaxed">
              <strong>First-Time Security Setup:</strong> As a parish official ({user?.role?.replace(/_/g, ' ')}), setting a private password protects sensitive parishioner records and parish registers.
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              icon={<Lock className="w-4 h-4" />}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-parish-text mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              icon={<Lock className="w-4 h-4" />}
              className="w-full"
            />
          </div>

          {/* Email OTP Verification Section (5-minute validity) */}
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-parish-text">
                  <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Security Verification Code (Email OTP)</span>
                  <span className="text-red-500">*</span>
                </div>
                <p className="text-[11px] text-parish-text-muted">
                  A 6-digit code valid for 5 minutes was sent to your email to confirm this sign-in attempt.
                </p>
              </div>
              {user?.email && (
                <span className="text-[10px] font-mono bg-amber-100/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full border border-amber-300/60">
                  {user.email}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  required
                  className="font-mono tracking-widest text-sm text-center font-bold"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendOtp}
                disabled={isResending || otpCountdown > 0}
                isLoading={isResending}
                icon={<Mail className="w-3.5 h-3.5 text-parish-primary" />}
                className="shrink-0 text-xs font-bold"
              >
                {otpCountdown > 0 ? `Resend (${otpCountdown}s)` : 'Resend Code'}
              </Button>
            </div>

            {feedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>{feedback}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-parish-border flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={requestLogout}
              className="text-xs text-parish-text-muted hover:text-red-600 transition-colors font-medium cursor-pointer"
            >
              Cancel & Sign Out
            </button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isLoading}
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
            >
              Save Password & Enter
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
