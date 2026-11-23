import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = 'Ocorreu um erro inesperado ao comunicar com o banco de dados.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.toLowerCase().includes('permission')) {
          friendly =
            'Permissão insuficiente no Firestore para esta operação. Verifique se seu e-mail foi confirmado ou entre novamente.';
        } else {
          friendly = parsed.error;
        }
      }
    } catch {
      if (error?.message) {
        friendly = error.message;
      }
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E4E2E8] rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <BrandLogo size="lg" />
            </div>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#7A2E4D]/10 text-[#7A2E4D] mb-4">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-[#16141C] mb-2">
              Algo precisou ser interrompido
            </h2>
            <p className="text-sm text-[#5E5B66] leading-relaxed mb-6">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#7A2E4D] hover:bg-[#61233C] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
