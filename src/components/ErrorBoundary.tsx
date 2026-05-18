import React from 'react';

interface ErrorBoundaryProps {
  /** Friendly heading shown when the boundary catches an error. */
  title?: string;
  /** Optional fallback override. Receives the error + a reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Callback fired after the boundary catches; useful for logging / telemetry. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
  /** Optional callback so the parent can close the modal that owns the boundary. */
  onClose?: () => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Generic error boundary used to wrap heavy-weight modals (Print preview, BOM, etc.)
 * so that any rendering or downstream calculation bug surfaces as a recoverable
 * message instead of taking the whole app down.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    try {
      this.props.onError?.(error, info);
    } catch {
      // Swallow secondary errors from the logging callback.
    }
    console.error('ErrorBoundary caught error:', error, info);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
        <div className="max-w-lg w-full bg-slate-800 border border-red-500/60 rounded-lg p-5 text-slate-100 shadow-2xl">
          <h2 className="text-lg font-semibold text-red-300 mb-2">{this.props.title ?? 'Something went wrong'}</h2>
          <p className="text-sm text-slate-300 mb-3">
            Yeh window crash hua, lekin app surakshit hai. Aap dobara try kar sakte hain ya yeh dialog band karke baki kaam jari rakhein.
          </p>
          <pre className="text-xs bg-slate-900/70 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-red-200/80 mb-4">
            {error.message || String(error)}
          </pre>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm"
            >
              Retry
            </button>
            {this.props.onClose ? (
              <button
                type="button"
                onClick={() => {
                  this.reset();
                  this.props.onClose?.();
                }}
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm"
              >
                Close
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
