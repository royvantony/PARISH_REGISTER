import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Lock, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen }) => {
  const { user, updatePassword, requestLogout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

    setIsLoading(true);
    const result = await updatePassword(newPassword);
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
      onClose={() => {}} // Non-dismissible: must change password or logout
      title="Set Your Permanent Password"
      description="You logged in with a temporary password. Please choose a new secure password to continue."
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
              <strong>First-Time Security Setup:</strong> As a parish official ({user?.role?.replace(/_/g, ' ')}), setting a private password protects sensitive parishioner records and baptismal data.
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
              icon={<Lock className="w-4 h-4" />}
              className="w-full"
            />
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
