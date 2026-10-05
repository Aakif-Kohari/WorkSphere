"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export interface VibeTagsProps {
  tags?: string[] | null;
  className?: string;
  maxDisplay?: number;
  size?: "sm" | "md" | "lg";
}

/**
 * Renders venue vibe badges / tags (#4369).
 * Returns null early if tags prop is undefined, null, or an empty array
 * to prevent rendering a blank badge container with awkward whitespace.
 */
export function VibeTags({
  tags,
  className = "",
  maxDisplay = 4,
  size = "md",
}: VibeTagsProps) {
  // Early return null guard when tag list is missing or empty (#4369)
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return null;
  }

  // Filter out empty or whitespace-only tags
  const validTags = tags.filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  );

  if (validTags.length === 0) {
    return null;
  }

  const visibleTags = validTags.slice(0, maxDisplay);
  const hiddenCount = validTags.length - visibleTags.length;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  return (
    <div
      data-testid="vibe-tags-container"
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {visibleTags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          data-testid={`vibe-tag-${tag.toLowerCase().replace(/\s+/g, "-")}`}
          className={`inline-flex items-center font-medium rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60 transition-colors ${
            sizeClasses[size] || sizeClasses.md
          }`}
        >
          <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
          <span className="capitalize">{tag}</span>
        </span>
      ))}

      {hiddenCount > 0 && (
        <span
          data-testid="vibe-tags-more-badge"
          className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
        >
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}

export default VibeTags;
