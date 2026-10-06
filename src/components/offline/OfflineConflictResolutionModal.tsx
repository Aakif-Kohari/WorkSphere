"use client";

import { useState } from "react";
import {
  X,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  GitCompare,
  ArrowRight,
  ShieldCheck,
  Globe,
  Edit3,
  Layers,
  Database,
  Trash2,
} from "lucide-react";
import {
  useOfflineConflicts,
  type UseOfflineConflictsReturn,
} from "@/hooks/useOfflineConflicts";
import type { ConflictedQueueItem } from "@/lib/offline/conflictService";

export interface OfflineConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OfflineConflictResolutionModal({
  isOpen,
  onClose,
}: OfflineConflictResolutionModalProps) {
  const {
    conflicts,
    conflictCount,
    isLoading,
    resolveItem,
    bulkResolve,
    refresh,
  } = useOfflineConflicts();

  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editJson, setEditJson] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const domains = Array.from(new Set(["all", ...conflicts.map((c) => c.domain)]));

  const filteredConflicts = conflicts.filter((item) => {
    if (selectedDomain === "all") return true;
    return item.domain === selectedDomain;
  });

  const handleStartEdit = (item: ConflictedQueueItem) => {
    setEditingItemId(item.id);
    setEditJson(JSON.stringify(item.clientPayload, null, 2));
    setEditError(null);
  };

  const handleSaveCustomMerge = async (item: ConflictedQueueItem) => {
    try {
      const parsed = JSON.parse(editJson);
      setResolvingId(item.id);
      await resolveItem(item, "CUSTOM_MERGE", parsed);
      setEditingItemId(null);
      setEditJson("");
    } catch (e: any) {
      setEditError(e.message || "Invalid JSON payload syntax");
    } finally {
      setResolvingId(null);
    }
  };

  const handleResolve = async (
    item: ConflictedQueueItem,
    strategy: "CLIENT_WINS" | "SERVER_WINS",
  ) => {
    setResolvingId(item.id);
    try {
      await resolveItem(item, strategy);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-resolution-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="conflict-resolution-title"
                  className="text-base font-semibold text-white"
                >
                  Offline Conflict Resolution
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  {conflictCount} {conflictCount === 1 ? "Conflict" : "Conflicts"}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Reconcile local IndexedDB drafts with server modifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
              title="Refresh conflict status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-zinc-800/60 bg-zinc-900/30">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {domains.map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                  selectedDomain === dom
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                {dom}
              </button>
            ))}
          </div>

          {filteredConflicts.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => bulkResolve("CLIENT_WINS")}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Keep All Local
              </button>
              <button
                onClick={() => bulkResolve("SERVER_WINS")}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Globe className="w-3.5 h-3.5" />
                Accept All Server
              </button>
            </div>
          )}
        </div>

        {/* Conflict Items List */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {filteredConflicts.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">
                No Unresolved Conflicts
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                All queued offline actions in IndexedDB are clean and synchronized with the cloud.
              </p>
            </div>
          ) : (
            filteredConflicts.map((item) => {
              const isEditing = editingItemId === item.id;
              const isResolving = resolvingId === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-md space-y-4 hover:border-zinc-700 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-amber-400 border border-amber-500/20 uppercase">
                        {item.domain}
                      </span>
                      <h4 className="text-sm font-semibold text-white">
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span>Retries: {item.retryCount}</span>
                      <span>·</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {item.lastError && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">
                      Reason: {item.lastError}
                    </div>
                  )}

                  {/* Side-by-side Diff or JSON Editor */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Edit Client Payload (JSON):</span>
                        {editError && <span className="text-rose-400">{editError}</span>}
                      </div>
                      <textarea
                        value={editJson}
                        onChange={(e) => {
                          setEditJson(e.target.value);
                          setEditError(null);
                        }}
                        rows={6}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveCustomMerge(item)}
                          disabled={isResolving}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                        >
                          Save &amp; Resolve
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Local Draft */}
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" /> Local Offline Draft
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono font-normal">
                            IndexedDB
                          </span>
                        </div>
                        <div className="text-xs space-y-1 font-mono text-zinc-300 bg-black/40 rounded-lg p-2.5 overflow-x-auto max-h-36">
                          {Object.entries(item.clientPayload).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <span className="text-zinc-500">{k}:</span>
                              <span className="text-emerald-300 truncate max-w-[200px]">
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Remote Server State */}
                      <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-blue-400">
                          <span className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5" /> Remote Server State
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono font-normal">
                            Cloud
                          </span>
                        </div>
                        <div className="text-xs space-y-1 font-mono text-zinc-300 bg-black/40 rounded-lg p-2.5 overflow-x-auto max-h-36">
                          {item.serverState ? (
                            Object.entries(item.serverState).map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-2">
                                <span className="text-zinc-500">{k}:</span>
                                <span className="text-blue-300 truncate max-w-[200px]">
                                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-zinc-500 italic">
                              Server state unavailable (e.g. dead-letter mutation error)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  {!isEditing && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Payload
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResolve(item, "SERVER_WINS")}
                        disabled={isResolving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
                      >
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        Accept Server
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResolve(item, "CLIENT_WINS")}
                        disabled={isResolving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Keep Local (Client Wins)
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/50 text-xs text-zinc-400">
          <span>Total IndexedDB conflicts: {conflictCount}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
