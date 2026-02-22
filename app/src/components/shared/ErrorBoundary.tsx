import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  copied: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private copyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  componentWillUnmount(): void {
    if (this.copyTimeoutId !== null) {
      clearTimeout(this.copyTimeoutId);
    }
  }

  private handleCopy = (): void => {
    const { error, componentStack } = this.state;

    const parts = [
      '[Life Tracker Ultimate v0.1.0 — Error Report]',
      `Timestamp: ${new Date().toISOString()}`,
      `Error: ${error?.message ?? 'Unknown error'}`,
      '',
      'Stack:',
      error?.stack ?? '(no stack trace)',
    ];

    if (componentStack) {
      parts.push('', 'Component Stack:', componentStack);
    }

    void navigator.clipboard.writeText(parts.join('\n')).then(() => {
      this.setState({ copied: true });
      this.copyTimeoutId = setTimeout(() => {
        this.setState({ copied: false });
        this.copyTimeoutId = null;
      }, 2000);
    });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback != null) {
      return this.props.fallback;
    }

    return (
      <div className="flex h-screen items-center justify-center bg-white p-section">
        <div className="max-w-md rounded-lg bg-surface-kpi p-section text-center">
          <div className="mb-3 text-3xl">{'\u26A0\uFE0F'}</div>
          <h2 className="text-lg font-semibold text-surface-dark">
            Something went wrong
          </h2>
          <p className="mt-2 text-body text-gray-500">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleCopy}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-body font-medium text-gray-700 hover:bg-gray-50"
            >
              {this.state.copied ? 'Copied!' : 'Copy Error Details'}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-productivity px-4 py-2 text-body font-medium text-white hover:bg-blue-600"
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
