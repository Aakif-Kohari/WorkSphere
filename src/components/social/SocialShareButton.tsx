"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link2, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export interface SocialShareButtonProps {
  url?: string;
  className?: string;
  label?: string;
  copiedLabel?: string;
  onCopy?: (url: string) => void;
  showIcon?: boolean;
}

/**
 * Copies text to clipboard with modern navigator.clipboard API and fallback
 * hidden textarea mechanism for older mobile/unsupported browsers (#3467).
 */
export async function copyShareableLinkToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea fallback
    }
  }

  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (success) return true;
    } catch (err) {
      console.error("[SocialShareButton] Fallback copy failed:", err);
    }
  }

  return false;
}

export function SocialShareButton({
  url,
  className = "",
  label = "Share Session",
  copiedLabel = "Copied!",
  onCopy,
  showIcon = true,
}: SocialShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleShareClick = useCallback(async () => {
    const targetUrl =
      url || (typeof window !== "undefined" ? window.location.href : "");

    const success = await copyShareableLinkToClipboard(targetUrl);

    if (success) {
      setCopied(true);
      toast("Session link copied to clipboard! 📋", "success");
      onCopy?.(targetUrl);

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2500);
    } else {
      toast("Unable to copy session link", "error");
    }
  }, [url, toast, onCopy]);

  return (
    <button
      type="button"
      onClick={handleShareClick}
      data-testid="share-session-button"
      aria-label={label}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 ${
        copied
          ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
          : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white"
      } ${className}`}
    >
      {showIcon && (
        copied ? (
          <Check className="h-4 w-4 text-emerald-400 shrink-0" data-testid="share-icon-check" />
        ) : (
          <Link2 className="h-4 w-4 text-violet-400 shrink-0" data-testid="share-icon-link" />
        )
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

export default SocialShareButton;
