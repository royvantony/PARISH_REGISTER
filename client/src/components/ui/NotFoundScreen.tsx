import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';
import { Button } from './Button';

export const NotFoundScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-parish-surface border border-parish-border rounded-2xl p-8 text-center shadow-soft space-y-5 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-parish-surface-subtle border border-parish-border text-parish-text-muted mx-auto flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-parish-primary" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-parish-primary bg-parish-primary-light px-2.5 py-1 rounded-full">
            404 Error
          </span>
          <h2 className="text-xl font-extrabold text-parish-text tracking-tight pt-1">
            Resource Not Found
          </h2>
          <p className="text-xs sm:text-sm text-parish-text-muted leading-relaxed">
            The requested screen or resource does not exist, is invalid, or may have been removed.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <Button
            variant="primary"
            size="md"
            icon={<Home className="w-4 h-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};
