import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  AtSign,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'details' | 'security';
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'details',
}) => {
  const { user, activeParish, updatePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'security'>(initialTab);

  // Sync tab and reset on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      resetPasswordForm();
    }
  }, [isOpen, initialTab]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    resetPasswordForm();
    setActiveTab('details');
    onClose();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg('Please enter your current password.');
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

    if (newPassword === currentPassword) {
      setErrorMsg('New password cannot be the same as your current password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updatePassword(newPassword, currentPassword);
      if (result.success) {
        setSuccessMsg('Your password has been updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg(result.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRole = (role?: string) => {
    switch (role) {
      case 'PARISH_PRIEST':
        return 'Parish Priest';
      case 'PARISH_ADMIN':
        return 'Parish Admin';
      case 'PARISH_USER':
        return 'Parish User';
      case 'WARD_USER':
        return 'Ward Coordinator';
      case 'SUPER_ADMIN':
        return 'System Developer / Super Admin';
      case 'DIOCESAN_ADMIN':
        return 'Diocesan Admin';
      case 'DIOCESAN_USER':
        return 'Diocesan User';
      default:
        return role || 'Parish Member';
    }
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="User Profile & Security"
      description="Manage your account profile, role credentials, and account password."
      maxWidth="lg"
      closeOnEsc={false}
      closeOnBackdropClick={false}
    >
      <div className="space-y-6 pt-2">
        {/* User Card Header */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-parish-surface-subtle border border-parish-border">
          <div className="w-14 h-14 rounded-2xl bg-parish-primary text-white font-extrabold text-lg flex items-center justify-center shadow-xs shrink-0">
            {user.fullName.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-parish-text truncate">{user.fullName}</h3>
              <Badge variant="default" size="sm" className="font-medium text-[11px]">
                {formatRole(user.role)}
              </Badge>
            </div>
            <p className="text-xs text-parish-text-muted mt-0.5 truncate flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-parish-text-muted/70" />
              <span>{user.email}</span>
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-parish-border">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'border-parish-primary text-parish-primary bg-parish-primary/5'
                : 'border-transparent text-parish-text-muted hover:text-parish-text hover:bg-parish-surface-subtle'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Account Details</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'border-parish-primary text-parish-primary bg-parish-primary/5'
                : 'border-transparent text-parish-text-muted hover:text-parish-text hover:bg-parish-surface-subtle'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password</span>
          </button>
        </div>

        {/* Tab 1: Account Details */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-parish-border bg-parish-surface">
                <div className="text-[11px] font-semibold text-parish-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Full Name</span>
                </div>
                <div className="text-sm font-bold text-parish-text">{user.fullName}</div>
              </div>

              <div className="p-3.5 rounded-xl border border-parish-border bg-parish-surface">
                <div className="text-[11px] font-semibold text-parish-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Address</span>
                </div>
                <div className="text-sm font-bold text-parish-text font-mono truncate">{user.email}</div>
              </div>

              <div className="p-3.5 rounded-xl border border-parish-border bg-parish-surface">
                <div className="text-[11px] font-semibold text-parish-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5" />
                  <span>Username</span>
                </div>
                <div className="text-sm font-bold text-parish-text font-mono">
                  {user.username || 'Not assigned'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-parish-border bg-parish-surface">
                <div className="text-[11px] font-semibold text-parish-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Security Role</span>
                </div>
                <div className="text-sm font-bold text-parish-text">{formatRole(user.role)}</div>
              </div>

              <div className="sm:col-span-2 p-3.5 rounded-xl border border-parish-border bg-parish-surface">
                <div className="text-[11px] font-semibold text-parish-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Parish Jurisdiction</span>
                </div>
                <div className="text-sm font-bold text-parish-text flex items-center justify-between">
                  <span>{activeParish?.parishName || 'Diocesan Chancery Jurisdiction'}</span>
                  {activeParish?.parishCode && (
                    <Badge variant="subtle" size="sm" className="font-mono">
                      {activeParish.parishCode}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-parish-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="gap-1.5"
              >
                <span>Close</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('security')}
                className="gap-2"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Change Password</span>
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Change Password */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-parish-text mb-1">
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text cursor-pointer p-1"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text cursor-pointer p-1"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parish-text-muted hover:text-parish-text cursor-pointer p-1"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-parish-surface-subtle border border-parish-border text-[11px] text-parish-text-muted leading-relaxed">
              <strong>Password requirements:</strong> Minimum 6 characters. Once changed, your active session remains authenticated.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-parish-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                <span>Close</span>
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                className="gap-2"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Save New Password</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
