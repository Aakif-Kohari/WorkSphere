"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useOfflineConflicts } from "@/hooks/useOfflineConflicts";
import { OfflineConflictResolutionModal } from "./OfflineConflictResolutionModal";

export function OfflineConflictBadge() {
  const { conflictCount } = useOfflineConflicts();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (conflictCount === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer shadow-sm animate-pulse"
        title="Offline conflicts detected in IndexedDB. Click to resolve."
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          {conflictCount} {conflictCount === 1 ? "Conflict" : "Conflicts"}
        </span>
      </button>

      <OfflineConflictResolutionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
