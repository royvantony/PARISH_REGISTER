import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'warning' | 'danger' | 'info' | 'success';
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'OK',
  variant = 'warning',
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200/60 dark:border-rose-800 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        );
      case 'success':
        return (
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/60 dark:border-emerald-800 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        );
      case 'info':
        return (
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border border-indigo-200/60 dark:border-indigo-800 mx-auto flex items-center justify-center">
            <Info className="w-6 h-6" />
          </div>
        );
      case 'warning':
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200/60 dark:border-amber-800 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        );
    }
  };

  const getButtonVariant = () => {
    switch (variant) {
      case 'danger':
        return 'danger';
      case 'warning':
      case 'info':
      case 'success':
      default:
        return 'primary';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm" closeOnBackdropClick={true} closeOnEsc={true}>
      <div className="text-center space-y-4 py-3 px-1">
        {getIcon()}
        <div className="space-y-2 px-2">
          <h4 className="text-base font-bold text-parish-text">{title}</h4>
          <p className="text-sm text-parish-text-muted leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-center pt-2">
          <Button variant={getButtonVariant()} size="sm" onClick={onClose} className="min-w-[100px]">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
