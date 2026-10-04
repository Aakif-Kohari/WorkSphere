"use client";

import React from "react";
import { ConnectionStatus } from "@/hooks/usePartySocket";

interface ReconnectingBadgeProps {
  status?: ConnectionStatus;
  isReconnecting?: boolean;
  attempt?: number;
  className?: string;
}

/**
 * ReconnectingBadge: Subtle status indicator badge shown in the UI
 * when PartyKit WebSocket is reconnecting with exponential backoff.
 */
export function ReconnectingBadge({
  status,
  isReconnecting,
  attempt,
  className = "",
}: ReconnectingBadgeProps) {
  const shouldShow =
    isReconnecting ||
    status === "reconnecting" ||
    (typeof attempt === "number" && attempt > 0 && status !== "connected");

  if (!shouldShow) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 backdrop-blur-sm transition-opacity duration-200 ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
      <span>Reconnecting...</span>
    </div>
  );
}

export default ReconnectingBadge;
