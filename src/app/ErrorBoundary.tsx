import { Component } from 'react';
import type { ReactNode } from 'react';
import { translate } from '../i18n';
import { useAppStore } from '../stores/app';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Top-level error boundary: catches render crashes and shows an
 * actionable fallback instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(): void {
    // In a future iteration this could report to an error service.
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    const lang = useAppStore.getState().lang;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070d] p-6">
        <div className="max-w-md rounded-2xl border border-[#fb7185]/30 bg-[#0a0f1c] p-8 text-center">
          <h1 className="text-xl font-bold tracking-wide text-[#e8eefc]">MOTION//DNA</h1>
          <p className="mt-4 text-sm text-[#8b98b8]">{translate(lang, 'errors.generic')}</p>
          {this.state.message && (
            <p className="mt-2 break-words font-mono text-[11px] text-[#fb7185]/80">
              {this.state.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 rounded-full bg-[#3b82f6] px-6 py-2 text-sm font-semibold text-white hover:bg-[#2563eb]"
          >
            ⟳
          </button>
        </div>
      </div>
    );
  }
}
