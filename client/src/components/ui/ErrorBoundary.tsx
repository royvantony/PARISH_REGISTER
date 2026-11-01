import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-parish-bg flex items-center justify-center p-4 select-none">
          <div className="max-w-md w-full bg-parish-surface border border-parish-border rounded-2xl p-6 sm:p-8 text-center shadow-soft space-y-4 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-parish-text">Application Notice</h2>
              <p className="text-xs text-parish-text-muted leading-relaxed">
                An unexpected view error occurred while rendering this screen.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-parish-surface-subtle border border-parish-border text-left font-mono text-[11px] text-red-700 max-h-32 overflow-y-auto break-words">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Home className="w-3.5 h-3.5" />}
                onClick={this.handleGoHome}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
