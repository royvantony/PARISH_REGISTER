import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { RotateCcw, Home, Users, MapPin, Hash, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ReactivateFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: number;
  houseName: string;
  familyCode?: string | null;
  headName?: string;
  unitName?: string | null;
  onSuccess: (newStatus: string) => void;
}

export const ReactivateFamilyModal: React.FC<ReactivateFamilyModalProps> = ({
  isOpen,
  onClose,
  familyId,
  houseName,
  familyCode,
  headName,
  unitName,
  onSuccess,
}) => {
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);

      const res = await api.post(`/families/${familyId}/reactivate`, {
        note: note.trim() || undefined,
      });

      onSuccess(res.data.status || 'ACTIVE');
      onClose();
    } catch (err: any) {
      console.error('Failed to reactivate household:', err);
      setError(err.response?.data?.error || 'Failed to reactivate household. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Household Reactivation"
      maxWidth="md"
      closeOnEsc={!isLoading}
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        {/* Notice Banner */}
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
          <RotateCcw className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-emerald-950 text-sm">
              Restore to Active Parish Directory
            </p>
            <p className="text-emerald-800 leading-relaxed">
              Are you sure you want to restore <strong>{houseName}</strong> back to <strong>ACTIVE</strong> status? They will immediately reappear in the active directory, census counts and parish communications.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Household Summary Card */}
        <div className="p-4 rounded-xl bg-parish-surface-subtle border border-parish-border space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-parish-border/70">
            <span className="font-bold uppercase tracking-wider text-parish-text-muted text-[11px]">
              Household Summary
            </span>
            <span className="font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              Restoring to Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-0.5">
              <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                <Home className="w-3 h-3 text-parish-primary" /> House Name
              </span>
              <p className="font-bold text-sm text-parish-text">{houseName}</p>
            </div>

            {familyCode && (
              <div className="space-y-0.5">
                <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                  <Hash className="w-3 h-3 text-parish-primary" /> Family Code
                </span>
                <p className="font-mono font-bold text-sm text-parish-text">{familyCode}</p>
              </div>
            )}

            {headName && (
              <div className="space-y-0.5">
                <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                  <Users className="w-3 h-3 text-parish-primary" /> Head of Household
                </span>
                <p className="font-bold text-sm text-parish-text">{headName}</p>
              </div>
            )}

            <div className="space-y-0.5">
              <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-600" /> Ward Assignment
              </span>
              <p className="font-semibold text-parish-text">
                {unitName ? (
                  unitName === 'Nil' ? 'Nil' : `${unitName} Ward`
                ) : (
                  <span className="text-amber-800 font-medium">Unassigned</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Optional Reactivation Note */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-parish-text">
            Reactivation / Pastoral Note <span className="text-parish-text-muted font-normal">(Optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Returned to parish boundaries, resumed active participation, or corrected administrative status."
            className="w-full bg-parish-surface text-parish-text text-xs rounded-xl border border-parish-border p-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
          />
        </div>

        {/* Audit preservation note */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Preservation Guarantee:</strong> All historical sacraments, baptism records, family notes, and historical numbers are preserved and will remain intact.
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
            icon={<RotateCcw className="w-4 h-4" />}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs"
          >
            Confirm Reactivation
          </Button>
        </div>
      </form>
    </Modal>
  );
};
