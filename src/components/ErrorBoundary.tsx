import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ConversationButton } from './ConversationButton';
import { handleError } from '@/lib/error-handler';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    handleError(error, {
      title: 'Application Error',
      description: 'An unexpected error occurred',
      logToConsole: true,
      showToast: false,
    });
    
    console.error('Error details:', errorInfo);
  }

  private handleReload = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="text-center max-w-md w-full space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-foreground">Something went wrong</h1>
              <p className="text-muted-foreground">
                We're sorry, but something unexpected happened. Please try refreshing the page.
              </p>
            </div>
            
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-left">
                <p className="text-sm font-mono text-destructive break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}
            
            <div className="pt-4">
              <ConversationButton
                variant="primary"
                onClick={this.handleReload}
                aria-label="Reload application"
              >
                Reload Page
              </ConversationButton>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
