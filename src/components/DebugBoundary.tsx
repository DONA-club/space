"use client";

import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any; info?: any };

class DebugBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined, info: undefined };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Logs détaillés pour diagnostic
    // eslint-disable-next-line no-console
    console.error("[DebugBoundary] Caught error:", error);
    // eslint-disable-next-line no-console
    console.error("[DebugBoundary] Info:", info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      const message =
        (this.state.error && (this.state.error.message || String(this.state.error))) ||
        "Une erreur est survenue dans ce composant.";
      return (
        <div className="min-h-screen grid place-items-center p-6 bg-muted/20">
          <div className="max-w-lg w-full rounded-lg border bg-background p-4 shadow-sm">
            <h2 className="text-base font-semibold mb-2">Erreur d’affichage</h2>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            <details className="text-xs text-muted-foreground whitespace-pre-wrap">
              <summary className="cursor-pointer">Détails (stack)</summary>
              {this.state.error?.stack || "Pas de stack disponible"}
            </details>
            <div className="mt-4 text-xs text-muted-foreground">
              Tu peux me copier/coller le message et la stack ci-dessus.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default DebugBoundary;