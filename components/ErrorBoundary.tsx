"use client";

import React from "react";

interface State {
  hasError: boolean;
  message?: string;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : "Unknown error" };
  }

  componentDidCatch() {
    // Intentionally silent in production.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center px-4 py-10">
          <div className="sx-card p-8 max-w-md text-center">
            <h2 className="text-xl font-bold" style={{ color: "var(--accent)" }}>
              Something went wrong
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {this.state.message ?? "Please refresh the page."}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="sx-btn mt-5 sm:w-auto px-6"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
