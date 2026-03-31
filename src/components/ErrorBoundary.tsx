import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<any, any> {
  constructor(props: Props) {
    super(props);
    this['state'] = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { children } = this['props'];
    if (this['state'].hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-accent/30">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="text-destructive" size={24} />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-destructive">Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Please try refreshing the page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-md overflow-auto max-h-40 text-xs font-mono">
                {this['state'].error?.message}
              </div>
            </CardContent>
            <div className="p-6 pt-0">
              <Button 
                className="w-full" 
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return children;
  }
}
