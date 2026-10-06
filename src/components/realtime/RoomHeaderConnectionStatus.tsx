"use client";

import React from "react";
import { ConnectionStatus } from "@/hooks/usePartySocket";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface RoomHeaderConnectionStatusProps {
  status: ConnectionStatus;
  reconnectAttempt?: number;
  className?: string;
}

/**
 * Connection status indicator component for collaborative room headers (#4380).
 * Displays real-time WebSocket connection state: Connected, Reconnecting (with backoff attempt count), or Offline.
 */
export function RoomHeaderConnectionStatus({
  status,
  reconnectAttempt = 0,
  className = "",
}: RoomHeaderConnectionStatusProps) {
  if (status === "connected") {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="room-status-connected"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 backdrop-blur-sm transition-all ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Connected</span>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="room-status-reconnecting"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 backdrop-blur-sm transition-all ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        <span>
          Reconnecting{reconnectAttempt > 0 ? ` (${reconnectAttempt})` : ""}...
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="room-status-offline"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 backdrop-blur-sm transition-all ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
      </span>
      <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Offline</span>
    </div>
  );
}

export default RoomHeaderConnectionStatus;
