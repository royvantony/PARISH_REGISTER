import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Mail,
  KeyRound,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onPasswordResetSuccess?: (email: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onPasswordResetSuccess,
}) => {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Sync initial email when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setStep('request');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setCooldown(0);
    }
  }, [isOpen, initialEmail]);

  // Resend cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetEmail = email.trim();
    if (!targetEmail) {
      setErrorMsg('Please enter your registered email address or username.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: targetEmail });
      // If server resolved the canonical email address, store it
      if (res.data?.email) {
        setEmail(res.data.email);
      }
      setStep('verify');
      setCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to dispatch reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || isLoading) return;
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = code.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setErrorMsg('Please enter the 6-digit numeric verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(),
        code: cleanCode,
        newPassword: newPassword.trim(),
      });
      setStep('success');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to reset password. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    onClose();
    if (onPasswordResetSuccess) {
      onPasswordResetSuccess(email);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'success' ? 'Password Reset Complete' : 'Forgot Password'}
      description={
        step === 'request'
          ? 'Enter your registered email address or username to receive a 6-digit verification code.'
          : step === 'verify'
          ? 'Enter the 6-digit code sent to your email and choose your new password.'
          : undefined
      }
      maxWidth="md"
      closeOnEsc={false}
      closeOnBackdropClick={false}
    >
      <div className="space-y-4 pt-2">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Enter Email / Username */}
        {step === 'request' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Registered Email or Username <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. fr.vicar or royvadakumpadan@gmail.com"
                required
                autoFocus
                icon={<Mail className="w-4 h-4" />}
                className="text-xs"
              />
              <span className="text-[11px] text-parish-text-muted block mt-1">
                A 6-digit one-time code will be dispatched to your registered email address.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-parish-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isLoading}
                className="gap-2"
              >
                <span>Send Reset Code</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Enter 6-digit OTP & New Password */}
        {step === 'verify' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* Notification of dispatched email */}
            <div className="p-3 rounded-xl bg-parish-surface-subtle border border-parish-border text-xs text-parish-text space-y-1">
              <div className="flex items-center gap-2 font-bold text-parish-primary">
                <Mail className="w-4 h-4" />
                <span>Verification Code Sent</span>
              </div>
              <p className="text-[11px] text-parish-text-muted">
                We sent a 6-digit code to <strong className="text-parish-text font-mono">{email}</strong>. It expires in 15 minutes.
              </p>
            </div>

            {/* 6-Digit Code Input */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                6-Digit Verification Code <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                autoFocus
                className="font-mono text-center text-xl font-bold tracking-[6px]"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] text-parish-text-muted">Enter the 6 numbers from your email</span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={cooldown > 0 || isLoading}
                  className={`text-[11px] font-semibold cursor-pointer transition-colors ${
                    cooldown > 0
                      ? 'text-parish-text-muted cursor-not-allowed'
                      : 'text-parish-primary hover:underline'
                  }`}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  icon={<Lock className="w-4 h-4" />}
                  className="pr-10 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text cursor-pointer p-1"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  minLength={6}
                  icon={<KeyRound className="w-4 h-4" />}
                  className="pr-10 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text cursor-pointer p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-parish-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep('request')}
                disabled={isLoading}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Change Email</span>
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isLoading}
                  className="gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Password</span>
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 'success' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-parish-text">
                Password Reset Successfully!
              </h3>
              <p className="text-xs text-parish-text-muted max-w-sm mx-auto">
                Your account password has been updated. You can now sign in with your new password.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleFinish}
                className="w-full justify-center gap-2"
              >
                <span>Proceed to Login</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

