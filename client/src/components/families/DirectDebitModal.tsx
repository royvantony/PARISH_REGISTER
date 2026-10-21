import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ConfirmButton } from '../ui/ConfirmButton';
import { Input } from '../ui/Input';
import { api } from '../../lib/api';
import {
  CreditCard,
  AlertCircle,
  ShieldCheck,
  Save,
  Home,
  Hash,
  Lock,
} from 'lucide-react';

interface DirectDebitData {
  id?: number;
  amount?: number | string | null;
  frequency?: string | null;
  comments?: string | null;
  active?: boolean;
}

interface DirectDebitModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: number;
  houseName: string;
  familyCode?: string | null;
  currentDirectDebit?: DirectDebitData | null;
  canEdit: boolean;
  onSuccess: (updatedRecord: any) => void;
}

const FREQUENCY_OPTIONS = [
  'Weekly',
  'Fortnightly',
  'Monthly',
  'Quarterly',
  'Annual',
];

const PRESET_AMOUNTS = ['25', '50', '100', '150', '200'];

export const DirectDebitModal: React.FC<DirectDebitModalProps> = ({
  isOpen,
  onClose,
  familyId,
  houseName,
  familyCode,
  currentDirectDebit,
  canEdit,
  onSuccess,
}) => {
  const [active, setActive] = useState(true);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (currentDirectDebit) {
        setActive(currentDirectDebit.active ?? true);
        setAmount(currentDirectDebit.amount ? String(currentDirectDebit.amount) : '');
        setFrequency(currentDirectDebit.frequency || 'Monthly');
        setComments(currentDirectDebit.comments || '');
      } else {
        setActive(true);
        setAmount('');
        setFrequency('Monthly');
        setComments('');
      }
    }
  }, [isOpen, currentDirectDebit]);

  const validateInputs = (): boolean => {
    if (!canEdit) return false;
    setError(null);

    if (active) {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        setError('Please enter a valid positive contribution amount.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!validateInputs()) return;

    try {
      setIsLoading(true);

      const res = await api.put(`/families/${familyId}/direct-debit`, {
        amount: amount ? parseFloat(amount) : null,
        frequency,
        active,
        comments: comments.trim() || null,
      });

      onSuccess(res.data.directDebit);
      onClose();
    } catch (err: any) {
      console.error('Failed to update direct debit:', err);
      setError(err.response?.data?.error || 'Failed to update Direct Debit details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Direct Debit Details"
      maxWidth="md"
      closeOnEsc={!isLoading}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Notice Banner */}
        <div className="p-3.5 rounded-xl bg-parish-primary-light/50 border border-parish-border text-parish-text flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-parish-primary/10 text-parish-primary flex items-center justify-center shrink-0 mt-0.5">
            <CreditCard className="w-4 h-4 text-parish-primary" />
          </div>
          <div className="text-xs space-y-1">
            <p className="font-bold text-parish-text text-sm">
              Direct Debit Contribution
            </p>
            <p className="text-parish-text-muted leading-relaxed">
              Track recurring direct debit contributions for the parish.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Read-Only Notice if user cannot edit */}
        {!canEdit && (
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs flex items-center gap-2 font-medium">
            <Lock className="w-4 h-4 text-slate-600 shrink-0" />
            <span>You have Read-Only view access for Direct Debit details. Only authorized financial trustees and parish priests can edit.</span>
          </div>
        )}

        {/* Household Summary Card */}
        <div className="p-3.5 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
              <Home className="w-3 h-3 text-parish-primary" /> House Name:
            </span>
            <span className="font-bold text-parish-text">{houseName}</span>
          </div>
          {familyCode && (
            <div className="flex items-center justify-between pt-1 border-t border-parish-border/50">
              <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                <Hash className="w-3 h-3 text-parish-primary" /> Family Code:
              </span>
              <span className="font-mono font-bold text-parish-text">{familyCode}</span>
            </div>
          )}
        </div>

        {/* Active Toggle */}
        <div className="p-3.5 rounded-xl border border-parish-border bg-parish-surface flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="dd-active-toggle" className="text-xs font-bold text-parish-text cursor-pointer">
              Direct Debit Contribution Status
            </label>
            <p className="text-[11px] text-parish-text-muted">
              {active ? 'Direct debit is active.' : 'Direct debit is paused / inactive.'}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="dd-active-toggle"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={!canEdit || isLoading}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-parish-primary"></div>
          </label>
        </div>

        {/* Amount & Frequency Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Amount */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-parish-text">
              Direct Debit Amount ($ AUD) {active && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-parish-text-muted">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="50.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!canEdit || isLoading || !active}
                className="pl-7 text-xs font-semibold"
                required={active}
              />
            </div>

            {/* Amount Presets */}
            {canEdit && active && (
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-parish-text-muted">Quick:</span>
                {PRESET_AMOUNTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-parish-surface-subtle hover:bg-parish-primary-light hover:text-parish-primary hover:border-parish-primary text-parish-text border border-parish-border transition-colors cursor-pointer"
                  >
                    ${p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-parish-text">
              Contribution Frequency <span className="text-red-500">*</span>
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              disabled={!canEdit || isLoading || !active}
              className="w-full bg-parish-surface text-parish-text text-xs rounded-xl border border-parish-border p-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary disabled:opacity-60"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes & Bank Reference */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text">
            Mandate / Donor Remarks <span className="text-parish-text-muted font-normal">(Optional)</span>
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={!canEdit || isLoading}
            rows={2}
            placeholder="e.g. Account Holder: Thomas Abraham"
            className="w-full bg-parish-surface text-parish-text text-xs rounded-xl border border-parish-border p-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary disabled:opacity-60"
          />
        </div>

        {/* Audit Trail Guarantee Notice */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Audit Guarantee:</strong> Any adjustment to the direct debit amount, frequency, or active status is automatically logged into the <strong>Record History & Audit Trail</strong> with your user name and exact timestamp.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-parish-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {canEdit ? 'Cancel' : 'Close'}
          </Button>

          {canEdit && (
            <ConfirmButton
              variant="primary"
              confirmVariant="primary"
              size="sm"
              onConfirm={handleSubmit}
              beforeConfirm={validateInputs}
              isLoading={isLoading}
              icon={<Save className="w-4 h-4" />}
              confirmLabel="Confirm Save?"
            >
              Save Direct Debit
            </ConfirmButton>
          )}
        </div>
      </form>
    </Modal>
  );
};
