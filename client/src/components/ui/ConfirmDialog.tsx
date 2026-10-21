import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="text-center space-y-4 py-2">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200/60 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-base font-bold text-parish-text">{title}</h4>
          <p className="text-sm text-parish-text-muted leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
