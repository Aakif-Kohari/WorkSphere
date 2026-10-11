"use client";

import { useState } from "react";
import { Check, Copy, Languages, Loader2 } from "lucide-react";
import { useMessageTranslation } from "@/hooks/useMessageTranslation";

interface TranslatedMessageProps {
  messageId: string;
  text: string;
}

export function TranslatedMessage({ messageId, text }: TranslatedMessageProps) {
  const {
    translation,
    error,
    isLoading,
    showOriginal,
    translate,
    toggleOriginal,
  } = useMessageTranslation(messageId, text);

  const [copied, setCopied] = useState(false);

  const currentText = translation && !showOriginal ? translation.translatedText : text;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = currentText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy translated text to clipboard:", err);
    }
  };

  return (
    <div>
      {translation && (
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-400">
          <span>
            {translation.sourceLanguage &&
            translation.sourceLanguage.toLowerCase() !== "unknown" &&
            translation.sourceLanguage.toLowerCase() !== "undefined"
              ? `Translated from ${translation.sourceLanguage}`
              : "Auto-detected"}
          </span>
          <button
            type="button"
            onClick={toggleOriginal}
            className="underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label={
              showOriginal ? "Show translated message" : "Show original message"
            }
          >
            {showOriginal ? "Show translation" : "Show original"}
          </button>
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label={copied ? "Copied translated text" : "Copy translated text"}
              title={copied ? "Copied!" : "Copy"}
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
              ) : (
                <Copy className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
            {copied && (
              <span
                role="status"
                className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm dark:bg-zinc-700"
              >
                Copied!
              </span>
            )}
          </div>
        </div>
      )}
      <span className="whitespace-pre-wrap">{currentText}</span>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
      {!translation && (
        <button
          type="button"
          onClick={() => void translate()}
          disabled={isLoading || !text.trim()}
          className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-400 transition-colors hover:text-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:hover:text-zinc-200"
          aria-label={error ? "Retry translation" : "Translate message"}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Translating…
            </>
          ) : (
            <>
              <Languages className="h-3 w-3" aria-hidden="true" />
              {error ? "Retry translation" : "Translate"}
            </>
          )}
        </button>
      )}
    </div>
  );
}
