"use client";

export const CHAT_SOUND_STORAGE_KEY = "worksphere_chat_sound_enabled";
export const CHAT_SOUND_CHANGE_EVENT = "worksphere_chat_sound_change";
export const DEFAULT_CHAT_SOUND_FILE = "/sounds/notification-chime.mp3";

/**
 * Checks if chat sound effects are enabled in localStorage.
 * Defaults to true if no preference is stored.
 */
export function isChatSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(CHAT_SOUND_STORAGE_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

/**
 * Persists chat sound effects preference to localStorage and broadcasts change event.
 */
export function setChatSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_SOUND_STORAGE_KEY, String(enabled));
    window.dispatchEvent(
      new CustomEvent<boolean>(CHAT_SOUND_CHANGE_EVENT, { detail: enabled })
    );
  } catch {
    // storage unavailable (e.g. private mode or quota)
  }
}

/**
 * Plays the incoming chat message notification chime if sound effects are enabled.
 * Returns true if played, false if muted or failed.
 */
export function playChatMessageSound(soundSrc: string = DEFAULT_CHAT_SOUND_FILE): boolean {
  if (typeof window === "undefined") return false;
  if (!isChatSoundEnabled()) return false;

  try {
    const audio = new Audio(soundSrc);
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        // Autoplay policy or media load error
      });
    }
    return true;
  } catch {
    return false;
  }
}
