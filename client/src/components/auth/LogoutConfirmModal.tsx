import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LogOut } from 'lucide-react';

export interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName?: string;
  userRole?: string;
  parishName?: string;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
  userRole,
  parishName,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Sign Out"
      maxWidth="md"
    >
      <div className="space-y-4 py-1 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-100 shadow-xs">
          <LogOut className="w-7 h-7" />
        </div>

        {/* Question & Explanation */}
        <div className="space-y-1.5">
          <h4 className="text-base font-bold text-parish-text">
            Are you sure you want to sign out?
          </h4>
          <p className="text-xs text-parish-text-muted leading-relaxed max-w-sm mx-auto">
            You are about to sign out of the Parish Register. Any unsaved edits on open forms will be discarded.
          </p>
        </div>

        {/* Current Active User & Parish Details */}
        {(userName || parishName) && (
          <div className="p-3.5 bg-parish-surface-subtle border border-parish-border rounded-xl text-left space-y-1.5 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-parish-text-muted">
              Current Session
            </div>
            {userName && (
              <div className="text-parish-text font-bold flex items-center justify-between">
                <span>{userName}</span>
                {userRole && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-parish-surface border border-parish-border text-parish-text-muted">
                    {userRole}
                  </span>
                )}
              </div>
            )}
            {parishName && (
              <div className="text-[11px] text-parish-text-muted truncate">
                {parishName}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            className="w-full sm:w-1/2 order-2 sm:order-1"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onConfirm}
            icon={<LogOut className="w-4 h-4" />}
            className="w-full sm:w-1/2 order-1 sm:order-2 shadow-sm font-bold"
          >
            Yes, Sign Out
          </Button>
        </div>
      </div>
    </Modal>
  );
};
