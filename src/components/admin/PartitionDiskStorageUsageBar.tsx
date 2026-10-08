"use client";

import React, { useState, useMemo } from "react";
import {
  HardDrive,
  AlertTriangle,
  Layers,
  Database,
  Archive,
  CheckCircle2,
  PieChart,
  SlidersHorizontal,
} from "lucide-react";
import type { VenuePartitionDetails } from "@/lib/adminPartitionService";

export interface PartitionDiskStorageUsageBarProps {
  partitions: VenuePartitionDetails[];
  totalSizeBytes?: number;
  totalSizePretty?: string;
  onFilterByParent?: (parentTable: string) => void;
  onFilterByStatus?: (status: string) => void;
}

const TABLE_PALETTE = [
  { bg: "bg-violet-500", text: "text-violet-400", border: "border-violet-500/30", fill: "#8b5cf6" },
  { bg: "bg-cyan-500", text: "text-cyan-400", border: "border-cyan-500/30", fill: "#06b6d4" },
  { bg: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/30", fill: "#10b981" },
  { bg: "bg-amber-500", text: "text-amber-400", border: "border-amber-500/30", fill: "#f59e0b" },
  { bg: "bg-pink-500", text: "text-pink-400", border: "border-pink-500/30", fill: "#ec4899" },
  { bg: "bg-blue-500", text: "text-blue-400", border: "border-blue-500/30", fill: "#3b82f6" },
  { bg: "bg-teal-500", text: "text-teal-400", border: "border-teal-500/30", fill: "#14b8a6" },
  { bg: "bg-indigo-500", text: "text-indigo-400", border: "border-indigo-500/30", fill: "#6366f1" },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function PartitionDiskStorageUsageBar({
  partitions,
  totalSizeBytes: propTotalSizeBytes,
  totalSizePretty: propTotalSizePretty,
  onFilterByParent,
  onFilterByStatus,
}: PartitionDiskStorageUsageBarProps) {
  const [viewMode, setViewMode] = useState<"parent" | "tier">("parent");
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const totalBytes = useMemo(() => {
    if (typeof propTotalSizeBytes === "number" && propTotalSizeBytes > 0) {
      return propTotalSizeBytes;
    }
    return partitions.reduce((acc, p) => acc + (p.tableSizeBytes || 0), 0);
  }, [partitions, propTotalSizeBytes]);

  const totalFormatted = propTotalSizePretty || formatBytes(totalBytes);

  // Parent table breakdown
  const parentBreakdown = useMemo(() => {
    const map = new Map<string, { bytes: number; count: number; rows: number }>();
    partitions.forEach((p) => {
      const current = map.get(p.parentTable) || { bytes: 0, count: 0, rows: 0 };
      map.set(p.parentTable, {
        bytes: current.bytes + (p.tableSizeBytes || 0),
        count: current.count + 1,
        rows: current.rows + (p.rowCount || 0),
      });
    });

    const list = Array.from(map.entries()).map(([parentTable, data], idx) => {
      const percent = totalBytes > 0 ? (data.bytes / totalBytes) * 100 : 0;
      const palette = TABLE_PALETTE[idx % TABLE_PALETTE.length];
      return {
        key: parentTable,
        label: parentTable,
        bytes: data.bytes,
        count: data.count,
        rows: data.rows,
        percent,
        palette,
      };
    });

    return list.sort((a, b) => b.bytes - a.bytes);
  }, [partitions, totalBytes]);

  // Status / Tier breakdown
  const tierBreakdown = useMemo(() => {
    let activeBytes = 0;
    let activeCount = 0;
    let archivedBytes = 0;
    let archivedCount = 0;
    let expiredBytes = 0;
    let expiredCount = 0;

    partitions.forEach((p) => {
      const bytes = p.tableSizeBytes || 0;
      if (p.isArchived) {
        archivedBytes += bytes;
        archivedCount += 1;
      } else if (p.isExpired) {
        expiredBytes += bytes;
        expiredCount += 1;
      } else {
        activeBytes += bytes;
        activeCount += 1;
      }
    });

    return [
      {
        key: "ACTIVE",
        label: "Active (Attached)",
        bytes: activeBytes,
        count: activeCount,
        percent: totalBytes > 0 ? (activeBytes / totalBytes) * 100 : 0,
        palette: {
          bg: "bg-emerald-500",
          text: "text-emerald-400",
          border: "border-emerald-500/30",
          fill: "#10b981",
        },
      },
      {
        key: "EXPIRED",
        label: "Expired (>12 mo)",
        bytes: expiredBytes,
        count: expiredCount,
        percent: totalBytes > 0 ? (expiredBytes / totalBytes) * 100 : 0,
        palette: {
          bg: "bg-amber-500",
          text: "text-amber-400",
          border: "border-amber-500/30",
          fill: "#f59e0b",
        },
      },
      {
        key: "ARCHIVED",
        label: "Archived (Cold)",
        bytes: archivedBytes,
        count: archivedCount,
        percent: totalBytes > 0 ? (archivedBytes / totalBytes) * 100 : 0,
        palette: {
          bg: "bg-zinc-600",
          text: "text-zinc-400",
          border: "border-zinc-500/30",
          fill: "#71717a",
        },
      },
    ].filter((tier) => tier.count > 0 || tier.bytes > 0);
  }, [partitions, totalBytes]);

  const activeSegments = viewMode === "parent" ? parentBreakdown : tierBreakdown;

  // Cold threshold warnings
  const heavyPartitionsCount = useMemo(() => {
    return partitions.filter((p) => p.isNearColdStorage || (p.tableSizeBytes || 0) >= 100 * 1024 * 1024).length;
  }, [partitions]);

  if (partitions.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Partition disk storage usage breakdown"
      className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
    >
      {/* Usage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Partition Disk Storage Usage
          </h3>
          <span className="text-xs text-zinc-400">
            ({totalFormatted} across {partitions.length} partitions)
          </span>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-black/30 p-1 rounded-xl border border-white/5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("parent")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              viewMode === "parent"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            By Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tier")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              viewMode === "tier"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            By Tier
          </button>
        </div>
      </div>

      {/* Primary Stacked Progress Bar */}
      <div className="relative mb-3">
        <div
          className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-900 border border-white/10 p-0.5"
          role="progressbar"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Total partition storage: ${totalFormatted}`}
        >
          {activeSegments.map((seg) => {
            if (seg.percent <= 0) return null;
            const isHovered = hoveredSegment === seg.key;
            return (
              <button
                type="button"
                key={seg.key}
                style={{ width: `${seg.percent}%` }}
                onMouseEnter={() => setHoveredSegment(seg.key)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => {
                  if (viewMode === "parent") {
                    onFilterByParent?.(seg.key);
                  } else {
                    onFilterByStatus?.(seg.key);
                  }
                }}
                className={`h-full transition-all focus:outline-none focus:ring-1 focus:ring-white ${
                  seg.palette.bg
                } ${isHovered ? "brightness-125 scale-y-110 z-10" : "opacity-90 hover:opacity-100"}`}
                title={`${seg.label}: ${formatBytes(seg.bytes)} (${seg.percent.toFixed(1)}%) - Click to filter`}
                aria-label={`${seg.label}: ${formatBytes(seg.bytes)} (${seg.percent.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* Interactive Legend & Metric Grid */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        {activeSegments.map((seg) => {
          const isHovered = hoveredSegment === seg.key;
          return (
            <button
              type="button"
              key={seg.key}
              onMouseEnter={() => setHoveredSegment(seg.key)}
              onMouseLeave={() => setHoveredSegment(null)}
              onClick={() => {
                if (viewMode === "parent") {
                  onFilterByParent?.(seg.key);
                } else {
                  onFilterByStatus?.(seg.key);
                }
              }}
              className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 transition-colors text-left ${
                isHovered
                  ? "bg-white/10 text-white"
                  : "text-zinc-300 hover:bg-white/[0.04]"
              }`}
              title={`Click to filter by ${seg.label}`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-sm shrink-0 ${seg.palette.bg}`}
              />
              <span className="font-medium text-zinc-200">{seg.label}:</span>
              <span className="font-mono text-zinc-400">
                {formatBytes(seg.bytes)}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                ({seg.percent.toFixed(1)}%)
              </span>
            </button>
          );
        })}

        {heavyPartitionsCount > 0 && (
          <div className="ml-auto flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {heavyPartitionsCount} heavy partition(s) &gt;100 MB
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
