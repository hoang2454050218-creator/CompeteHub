import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallbackClassName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={this.props.fallbackClassName || 'min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg px-4'}>
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Đã xảy ra sự cố
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Hệ thống gặp lỗi ngoài dự kiến. Vui lòng thử tải lại trang.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="btn-primary inline-flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại
              </button>
              <a href="/" className="btn-secondary">
                Về trang chủ
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Khu vực này đang gặp lỗi.</p>
          <button onClick={this.handleReset} className="btn-secondary text-sm inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
