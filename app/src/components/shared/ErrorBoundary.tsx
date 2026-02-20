import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

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
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-productivity px-4 py-2 text-body font-medium text-white hover:bg-blue-600"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
