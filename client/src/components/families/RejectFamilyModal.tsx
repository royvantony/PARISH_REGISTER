import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { AlertCircle, X, Home, Users, ShieldAlert } from 'lucide-react';

interface RejectFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: number;
  houseName: string;
  headName?: string;
  onSuccess: () => void;
}

const REJECT_REASONS = [
  'Duplicate registration submission',
  'Resides outside parish canonical boundaries / jurisdiction',
  'Registration withdrawn upon applicant request',
  'Incomplete details / unable to verify baptismal or catholic records',
  'Other administrative reason',
];

export const RejectFamilyModal: React.FC<RejectFamilyModalProps> = ({
  isOpen,
  onClose,
  familyId,
  houseName,
  headName,
  onSuccess,
}) => {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);

      const effectiveReason =
        reason === 'Other administrative reason' && customReason.trim()
          ? customReason.trim()
          : reason;

      await api.post(`/families/${familyId}/reject`, {
        reason: effectiveReason,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to reject registration:', err);
      setError(err.response?.data?.error || 'Failed to reject registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Decline Pending Registration"
      maxWidth="md"
      closeOnEsc={!isLoading}
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-rose-950 text-sm">
              Decline & Archive Record
            </p>
            <p className="text-rose-800 leading-relaxed">
              Are you sure you want to decline this pending registration? This record will be archived as <strong>INACTIVE</strong> and will not be issued a parish family code.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Household Summary Card */}
        <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-parish-text-muted text-[11px]">
            Registration Candidate
          </span>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-0.5">
              <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                <Home className="w-3 h-3 text-parish-primary" /> House Name
              </span>
              <p className="font-bold text-sm text-parish-text">{houseName}</p>
            </div>

            {headName && (
              <div className="space-y-0.5">
                <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                  <Users className="w-3 h-3 text-parish-primary" /> Head of Household
                </span>
                <p className="font-bold text-sm text-parish-text">{headName}</p>
              </div>
            )}
          </div>
        </div>

        {/* Reason for rejection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text">
            Reason for Declining <span className="text-rose-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-parish-surface text-parish-text text-xs rounded-xl border border-parish-border p-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-600"
          >
            {REJECT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {reason === 'Other administrative reason' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-parish-text">
              Specify Reason Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              required
              rows={2}
              placeholder="Provide specific notes regarding why this registration is declined..."
              className="w-full bg-parish-surface text-parish-text text-xs rounded-xl border border-parish-border p-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-600"
            />
          </div>
        )}

        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Audit Retention:</strong> The applicant details and declination reasons will be logged in the audit trail notes for future reference.
          </p>
        </div>

        {/* Action Buttons */}
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
            size="sm"
            isLoading={isLoading}
            icon={<X className="w-4 h-4" />}
            className="bg-rose-700 hover:bg-rose-800 text-white font-semibold shadow-xs"
          >
            Decline Registration
          </Button>
        </div>
      </form>
    </Modal>
  );
};
