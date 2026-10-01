import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isModuleLoadError } from './lazyScreen';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a screen crash or a failed lazy chunk must never leave
 * the tab blank — the user gets a message and a way out instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[EventHub] screen crashed:', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const isLoadFailure = isModuleLoadError(this.state.error);
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
      >
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-dangerbg text-danger text-subtitle font-bold">
          !
        </span>
        <h1 className="text-subtitle text-textprimary">
          {isLoadFailure ? 'Could not load this screen' : 'Something went wrong'}
        </h1>
        <p className="mt-2 max-w-sm text-body text-textmuted">
          {isLoadFailure
            ? 'The app updated or the dev server restarted. Reload to get the latest code.'
            : this.state.error.message || 'This screen could not be loaded.'}
        </p>
        <div className="mt-6 flex gap-3">
          {!isLoadFailure && (
            <button
              type="button"
              onClick={this.reset}
              className="h-11 rounded-base bg-primary px-5 text-body font-semibold text-white transition duration-200 hover:brightness-95 active:brightness-90"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-11 rounded-base border border-border bg-surface px-5 text-body font-semibold text-textprimary transition-colors duration-200 hover:bg-neutralbg"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
