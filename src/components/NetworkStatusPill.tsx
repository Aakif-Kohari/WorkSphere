"use client";

import React, { useState, useEffect, useRef } from "react";
import { WifiOff, Check } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

interface NetworkStatusPillProps {
  className?: string;
  onlineFlashDurationMs?: number;
}

export function NetworkStatusPill({
  className = "",
  onlineFlashDurationMs = 2500,
}: NetworkStatusPillProps) {
  const { isOffline } = useOfflineSync();
  const [showOnlineFlash, setShowOnlineFlash] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;
      setShowOnlineFlash(false);
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setShowOnlineFlash(true);
      const timer = setTimeout(() => {
        setShowOnlineFlash(false);
      }, onlineFlashDurationMs);
      return () => clearTimeout(timer);
    }
  }, [isOffline, onlineFlashDurationMs]);

  if (!isOffline && !showOnlineFlash) {
    return null;
  }

  if (isOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shadow-sm animate-in fade-in duration-300 ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Offline</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shadow-sm animate-in fade-in duration-300 transition-opacity ${className}`}
    >
      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      <span>Back online</span>
    </div>
  );
}
