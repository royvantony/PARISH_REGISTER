import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ConfirmButton } from '../ui/ConfirmButton';
import { Input } from '../ui/Input';
import { api } from '../../lib/api';
import { cn, calculateMonthlyEquivalent } from '../../lib/utils';
import {
  CreditCard,
  AlertCircle,
  ShieldCheck,
  Save,
  Home,
  Hash,
  Lock,
  Tag,
} from 'lucide-react';

export interface DirectDebitItem {
  id?: number;
  familyId?: number;
  reference?: string | null;
  amount?: number | string | null;
  frequency?: string | null;
  comments?: string | null;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface DirectDebitModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: number;
  houseName: string;
  familyCode?: string | null;
  directDebit?: DirectDebitItem | null;
  canEdit: boolean;
  onSuccess: (updatedRecord: DirectDebitItem) => void;
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
  directDebit,
  canEdit,
  onSuccess,
}) => {
  const isEditing = Boolean(directDebit && directDebit.id);
  const [reference, setReference] = useState('');
  const [active, setActive] = useState(true);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form based on current item when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (directDebit) {
        setReference(directDebit.reference || '');
        setActive(directDebit.active !== false);
        setAmount(directDebit.amount !== null && directDebit.amount !== undefined ? String(directDebit.amount) : '');
        setFrequency(directDebit.frequency || 'Monthly');
        setComments(directDebit.comments || '');
      } else {
        setReference('');
        setActive(true);
        setAmount('');
        setFrequency('Monthly');
        setComments('');
      }
    }
  }, [isOpen, directDebit]);

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

      const payload = {
        reference: reference.trim() || null,
        amount: amount ? parseFloat(amount) : null,
        frequency,
        active,
        comments: comments.trim() || null,
      };

      let res;
      if (isEditing && directDebit?.id) {
        res = await api.put(`/families/${familyId}/direct-debits/${directDebit.id}`, payload);
      } else {
        res = await api.post(`/families/${familyId}/direct-debits`, payload);
      }

      onSuccess(res.data.directDebit);
      onClose();
    } catch (err: any) {
      console.error('Failed to save direct debit:', err);
      setError(err.response?.data?.error || 'Failed to save Direct Debit details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Direct Debit Schedule' : 'Add Direct Debit Schedule'}
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
              {isEditing ? 'Edit Direct Debit Schedule' : 'New Direct Debit Schedule'}
            </p>
            <p className="text-parish-text-muted leading-relaxed">
              Track recurring direct debit contributions for this household. Families can have multiple direct debit schedules (e.g. husband, wife, adult children).
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
        <div className="p-3 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-1 text-xs">
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

        {/* Reference / Contributor single-line small text box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="dd-reference-input" className="block text-xs font-semibold text-parish-text flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-parish-primary" />
              <span>Reference / Contributor</span>
              <span className="text-[10px] text-parish-text-muted font-normal">(Optional)</span>
            </label>
            <span className="text-[10px] text-parish-text-muted">Max width 25</span>
          </div>
          <div className="max-w-[25rem]">
            <Input
              id="dd-reference-input"
              type="text"
              maxLength={100}
              placeholder="e.g. Husband - Thomas, Wife - Mary"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={!canEdit || isLoading}
              className="text-xs font-semibold"
            />
          </div>
          <p className="text-[10px] text-parish-text-muted">
            Identify who this direct debit is for (e.g., Husband, Wife, Son) or a bank transaction reference.
          </p>
        </div>

        {/* Active Toggle */}
        <div
          className={cn(
            "p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer",
            active
              ? "border-parish-primary/40 bg-parish-primary-light/20"
              : "border-parish-border bg-parish-surface-subtle"
          )}
          onClick={() => canEdit && !isLoading && setActive(!active)}
        >
          <div className="space-y-0.5 select-none pr-3">
            <label htmlFor="dd-active-toggle" className="text-xs font-bold text-parish-text cursor-pointer">
              Schedule Status
            </label>
            <p className="text-[11px] text-parish-text-muted">
              {active
                ? 'Active (currently contributing to parish).'
                : 'Paused / Inactive schedule.'}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              id="dd-active-toggle"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={!canEdit || isLoading}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-parish-primary"></div>
          </label>
        </div>

        {/* Direct Debit Amount */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text">
            Contribution Amount ($ AUD) {active && <span className="text-red-500">*</span>}
          </label>
          <div className="relative max-w-[25rem]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-parish-text-muted">
              $
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={active ? "50.00" : "Turn status ON above to enter amount"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!canEdit || isLoading || !active}
              className="pl-7 text-xs font-semibold"
              required={active}
            />
          </div>

          {/* Amount Presets */}
          {canEdit && (
            <div className="flex items-center flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] font-medium text-parish-text-muted mr-0.5">Quick:</span>
              {PRESET_AMOUNTS.map((p) => {
                const isSelected = amount === p && active;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setAmount(p);
                      if (!active) setActive(true);
                    }}
                    className={cn(
                      'px-2.5 py-0.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer select-none',
                      isSelected
                        ? 'bg-parish-primary text-white border-parish-primary shadow-xs'
                        : 'bg-parish-surface-subtle hover:bg-parish-primary-light hover:text-parish-primary hover:border-parish-primary text-parish-text border-parish-border'
                    )}
                  >
                    ${p}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Contribution Frequency */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text">
            Contribution Frequency <span className="text-red-500">*</span>
          </label>
          <div className="max-w-[25rem]">
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
          {active && amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && frequency.toLowerCase() !== 'monthly' && (
            <div className="text-[11px] text-parish-primary font-medium flex items-center gap-1.5 pt-0.5">
              <span>Normalized Monthly Average:</span>
              <strong className="font-bold">≈ ${Math.round(calculateMonthlyEquivalent(amount, frequency)).toLocaleString()} AUD / mo (Avg)</strong>
            </div>
          )}
        </div>

        {/* Additional Remarks */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text">
            Additional Remarks <span className="text-parish-text-muted font-normal">(Optional)</span>
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={!canEdit || isLoading}
            rows={2}
            placeholder="e.g. Account name or specific bank arrangement notes..."
            className="w-full bg-parish-surface text-parish-text text-xs rounded-xl border border-parish-border p-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary disabled:opacity-60"
          />
        </div>

        {/* Audit Trail Guarantee Notice */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Audit Guarantee:</strong> Any adjustment to direct debit schedules is automatically logged into the <strong>Record History & Audit Trail</strong> with your user name and exact timestamp.
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
              {isEditing ? 'Save Changes' : 'Add Direct Debit'}
            </ConfirmButton>
          )}
        </div>
      </form>
    </Modal>
  );
};
