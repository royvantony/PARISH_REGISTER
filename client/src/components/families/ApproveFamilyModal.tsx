import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { CheckCircle2, ShieldCheck, MapPin, Users, Home } from 'lucide-react';

interface ApproveFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: number;
  houseName: string;
  headName?: string;
  unitName?: string | null;
  registrationType?: string;
  membersCount?: number;
  updatePayload?: any;
  onSuccess: (allocatedCode: string) => void;
}

export const ApproveFamilyModal: React.FC<ApproveFamilyModalProps> = ({
  isOpen,
  onClose,
  familyId,
  houseName,
  headName,
  unitName,
  registrationType = 'FAMILY',
  membersCount = 1,
  updatePayload,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await api.post(`/families/${familyId}/approve`, updatePayload || {});
      onSuccess(res.data.familyCode);
      onClose();
    } catch (err: any) {
      console.error('Failed to approve registration:', err);
      setError(err.response?.data?.error || 'Failed to approve registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Approval & Allocate Code"
      maxWidth="md"
      closeOnEsc={!isLoading}
    >
      <div className="space-y-4">
        {/* Notice Banner */}
        <div className="p-3.5 rounded-xl bg-parish-primary-light/60 border border-parish-border text-parish-text flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-parish-primary shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-parish-text text-sm">
              Official Registration Approval
            </p>
            <p className="text-parish-text-muted leading-relaxed">
              You are about to officially verify and approve this registration. A permanent sequential parish family code will be generated and allocated immediately.
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
            <span className="font-semibold text-parish-primary bg-parish-primary-light px-2 py-0.5 rounded text-[11px] border border-parish-border">
              {registrationType === 'FAMILY'
                ? 'Family Household'
                : registrationType === 'INDIVIDUAL_STUDENT'
                ? 'International Student'
                : 'Individual Member'}
            </span>
          </div>

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

            <div className="space-y-0.5">
              <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-600" /> Ward Assignment
              </span>
              <p className="font-semibold text-parish-text">
                {unitName ? (
                  unitName === 'Nil' ? 'Nil' : `${unitName} Ward`
                ) : (
                  <span className="text-amber-800 font-medium">⚠️ Unassigned (No Ward)</span>
                )}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] text-parish-text-muted flex items-center gap-1">
                <Users className="w-3 h-3 text-sky-600" /> Members Count
              </span>
              <p className="font-semibold text-parish-text">
                {membersCount} {membersCount === 1 ? 'member' : 'members'} registered
              </p>
            </div>
          </div>
        </div>

        {/* Save & Approve Notice if coming from edit form */}
        {updatePayload && (
          <div className="p-3 rounded-xl bg-parish-primary-light/60 border border-parish-border text-[11px] text-parish-text flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-parish-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Save & Approve:</strong> All updated details on this form (including ward assignment, contact information, and member records) will be saved and officially activated upon approval.
            </p>
          </div>
        )}

        {/* Warning / Impact Notice */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Sequence Notice:</strong> This action will advance the parish family sequence number and activate this household in the official directory, census counts, and parish reports.
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
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            {updatePayload ? 'Save Changes & Approve' : 'Confirm Approval & Allocate Code'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
