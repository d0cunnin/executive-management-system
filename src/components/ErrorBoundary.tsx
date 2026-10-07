import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Catches anything that breaks while drawing a page, so D'Andrea sees a
 * message and a way forward instead of a blank screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EMS page error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid min-h-[50vh] place-items-center px-4">
        <div className="glass max-w-md p-6">
          <p className="label">Something went wrong on this page</p>
          <p className="mt-2 text-sm text-white">Your information is safe. Reloading usually fixes this. If it keeps happening, send a screenshot of this message.</p>
          <p className="mt-3 break-words rounded-lg bg-ink-950/60 p-2 font-mono text-xs text-amber-200">{error.message}</p>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="btn-ghost" href="/">
              Go to Today
            </a>
          </div>
        </div>
      </div>
    )
  }
}
