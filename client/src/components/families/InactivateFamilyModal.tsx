import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { AlertTriangle, UserX, CreditCard } from 'lucide-react';

interface InactivateFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: number;
  houseName: string;
  familyCode?: string | null;
  hasActiveDirectDebit?: boolean;
  onSuccess: (newStatus: string) => void;
}

const REASONS = [
  'Relocated to another parish / interstate / overseas',
  'Deceased / Household closed',
  'Left the parish / Withdrawn registration',
  'Duplicate record / Administrative cleanup',
  'Other reason',
];

export const InactivateFamilyModal: React.FC<InactivateFamilyModalProps> = ({
  isOpen,
  onClose,
  familyId,
  houseName,
  familyCode,
  hasActiveDirectDebit = false,
  onSuccess,
}) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [cancelDirectDebit, setCancelDirectDebit] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);

      const effectiveReason = reason === 'Other reason' && customReason.trim()
        ? customReason.trim()
        : reason;

      const res = await api.post(`/families/${familyId}/inactivate`, {
        reason: effectiveReason,
        notes: notes.trim() || undefined,
        cancelDirectDebit,
      });

      onSuccess(res.data.status || 'INACTIVE');
      onClose();
    } catch (err: any) {
      console.error('Failed to inactivate household:', err);
      setError(err.response?.data?.error || 'Failed to inactivate household. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Inactivate Household"
      maxWidth="md"
      closeOnEsc={!isLoading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-950">
              Archiving {houseName} {familyCode ? `(${familyCode})` : ''}
            </p>
            <p className="text-amber-800">
              Setting status to <strong>Inactive</strong> hides this household from the active parish directory and dashboard headcounts. All member details, sacramental history, and past notes are safely preserved and can be reactivated at any time.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Reason Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text">
            Primary Reason for Inactivation <span className="text-rose-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 cursor-pointer"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Reason if "Other reason" */}
        {reason === 'Other reason' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-parish-text">
              Specify Reason <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Returned to India permanently"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500"
            />
          </div>
        )}

        {/* Detailed Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text">
            Additional Pastoral Notes / Destination Parish (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Relocated to Melbourne. Joining St. Mary's Syro-Malabar Parish."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 text-xs rounded-xl border border-parish-border bg-parish-surface text-parish-text focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 resize-none"
          />
        </div>

        {/* Cancel Direct Debit Checkbox */}
        {hasActiveDirectDebit && (
          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="cancelDirectDebit"
              checked={cancelDirectDebit}
              onChange={(e) => setCancelDirectDebit(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="cancelDirectDebit" className="text-xs text-sky-900 cursor-pointer space-y-0.5">
              <span className="font-semibold flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-sky-700" />
                Cancel Active Direct Debit
              </span>
              <p className="text-[11px] text-sky-800">
                Automatically deactivates the household's scheduled direct debit to prevent accidental future debits.
              </p>
            </label>
          </div>
        )}

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
            icon={<UserX className="w-3.5 h-3.5" />}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            Confirm Inactivation
          </Button>
        </div>
      </form>
    </Modal>
  );
};
