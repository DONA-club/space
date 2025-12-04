"use client";

import React from "react";
import { showError } from "@/utils/toast";

const GlobalErrorMonitor: React.FC = () => {
  React.useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error("[GlobalErrorMonitor] window.onerror:", event.error || event.message, event);
      const msg =
        (event.error && (event.error.message || String(event.error))) ||
        (event.message ? String(event.message) : "Erreur Javascript");
      if (msg) showError(`Erreur: ${msg}`);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      // eslint-disable-next-line no-console
      console.error("[GlobalErrorMonitor] unhandledrejection:", event.reason, event);
      const msg =
        (event.reason && (event.reason.message || String(event.reason))) ||
        "Promesse rejetée sans catch";
      if (msg) showError(`Rejet: ${msg}`);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
};

export default GlobalErrorMonitor;