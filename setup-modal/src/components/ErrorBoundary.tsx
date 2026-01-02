import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and display errors gracefully
 * Prevents single component errors from crashing the entire modal
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    // Reset error state
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="max-w-md p-6 bg-white rounded-lg shadow-lg border border-red-200">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
            </div>
            <p className="text-gray-600 mb-4">An unexpected error occurred in the setup modal. Please try reloading or contact support if the problem persists.</p>
            {this.state.error && import.meta.env.DEV && (
              <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                <p className="text-sm font-medium text-red-900 mb-1">Error Details (Dev Only):</p>
                <p className="text-xs text-red-800 font-mono">{this.state.error.message}</p>
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
