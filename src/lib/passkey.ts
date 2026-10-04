import { isMobileWebview } from "@/lib/webauthn";

export const RP_NAME = "WorkSphere";

/**
 * Resolves the Relying Party ID (hostname) from the incoming request.
 */
export function getRpId(req: Request): string {
  const host = req.headers.get("host") || "localhost";
  return host.split(":")[0];
}

/**
 * Resolves the absolute Origin URL from the incoming request.
 */
export function getOrigin(req: Request): string {
  const host = req.headers.get("host") || "localhost:3000";
  const protocol =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.includes("127.0.0.1")
      ? "http"
      : "https");
  return `${protocol}://${host}`;
}

/**
 * Resolves the expected origin(s) for WebAuthn response verification.
 * For recognized mobile webview user agent strings, origin checks are relaxed
 * by accepting clientDataOrigin alongside the request origin.
 */
export function getExpectedOrigin(
  req: Request,
  clientDataOrigin?: string,
): string | string[] {
  const defaultOrigin = getOrigin(req);
  const userAgent = req.headers.get("user-agent");

  const expectedOrigins = new Set<string>([defaultOrigin]);

  if (isMobileWebview(userAgent) && clientDataOrigin) {
    expectedOrigins.add(clientDataOrigin);
  }

  const allowedEmbedOrigins = (process.env.ALLOWED_EMBED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (clientDataOrigin && allowedEmbedOrigins.includes(clientDataOrigin)) {
    expectedOrigins.add(clientDataOrigin);
  }

  const origins = Array.from(expectedOrigins);
  return origins.length === 1 ? origins[0] : origins;
}

/**
 * Default domain-separated salt for WorkSphere bookmark notes PRF evaluation.
 */
export const DEFAULT_PRF_SALT_STRING = "WorkSphere-Passkey-Notes-PRF-Salt-v1";

/**
 * Converts a string or Uint8Array into a 32-byte salt buffer for the PRF extension.
 */
export function createPrfSalt(customSalt?: string | Uint8Array): Uint8Array {
  if (customSalt instanceof Uint8Array) {
    if (customSalt.length === 32) return customSalt;
    const buf = new Uint8Array(32);
    buf.set(customSalt.subarray(0, 32));
    return buf;
  }
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(customSalt || DEFAULT_PRF_SALT_STRING);
  const salt = new Uint8Array(32);
  salt.set(rawBytes.subarray(0, 32));
  return salt;
}

/**
 * Builds WebAuthn authentication extension input for PRF (Pseudo-Random Function).
 * Used during WebAuthn navigator.credentials.get / generateAuthenticationOptions:
 * extensions: { prf: { eval: { first: saltBuffer } } }
 */
export function buildPrfAuthenticationExtension(salt?: Uint8Array | string): {
  prf: {
    eval: {
      first: Uint8Array;
      second?: Uint8Array;
    };
  };
} {
  const saltBuffer = createPrfSalt(salt);
  return {
    prf: {
      eval: {
        first: saltBuffer,
      },
    },
  };
}

/**
 * Default expiration window for passkey challenges stored in client storage (5 minutes in milliseconds).
 */
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const PASSKEY_SESSION_STORAGE_KEY = "worksphere_passkey_challenge";

export interface StoredPasskeyChallenge {
  challenge: string;
  ceremonyType: "registration" | "authentication" | "step_up";
  createdAt: number;
  expiresAt: number;
}

/**
 * Stores a passkey ceremony challenge in sessionStorage with a timestamp and 5-minute expiration window.
 *
 * @param challenge The challenge string received from server options
 * @param ceremonyType The ceremony type ("registration" | "authentication" | "step_up")
 * @param ttlMs Time-to-live in milliseconds (defaults to 5 minutes)
 */
export function savePasskeyChallengeToSession(
  challenge: string,
  ceremonyType: "registration" | "authentication" | "step_up" = "authentication",
  ttlMs: number = PASSKEY_CHALLENGE_TTL_MS,
): StoredPasskeyChallenge | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  const now = Date.now();
  const entry: StoredPasskeyChallenge = {
    challenge,
    ceremonyType,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  try {
    window.sessionStorage.setItem(
      PASSKEY_SESSION_STORAGE_KEY,
      JSON.stringify(entry),
    );
    return entry;
  } catch (err) {
    console.warn("Failed to save passkey challenge to sessionStorage:", err);
    return null;
  }
}

/**
 * Retrieves the stored passkey challenge from sessionStorage.
 * Automatically invalidates and removes the challenge if it is older than 5 minutes.
 *
 * @param expectedCeremonyType Optional ceremony type to ensure matching context
 * @returns The active challenge string, or null if expired, missing, or mismatched
 */
export function getValidPasskeyChallengeFromSession(
  expectedCeremonyType?: "registration" | "authentication" | "step_up",
): string | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  try {
    const raw = window.sessionStorage.getItem(PASSKEY_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: StoredPasskeyChallenge = JSON.parse(raw);
    const now = Date.now();

    // Check 5-minute expiration window or corrupted timestamp
    if (!parsed || !parsed.challenge || !parsed.expiresAt || now >= parsed.expiresAt) {
      clearPasskeyChallengeFromSession();
      return null;
    }

    // Optional ceremony type verification
    if (expectedCeremonyType && parsed.ceremonyType !== expectedCeremonyType) {
      clearPasskeyChallengeFromSession();
      return null;
    }

    return parsed.challenge;
  } catch (err) {
    clearPasskeyChallengeFromSession();
    return null;
  }
}

/**
 * Clears any cached passkey challenge from sessionStorage.
 * Can be called upon ceremony completion, cancellation, start of fresh ceremony, or page unload.
 */
export function clearPasskeyChallengeFromSession(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(PASSKEY_SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to remove passkey challenge from sessionStorage:", err);
  }
}

/**
 * Attaches beforeunload / unload event listener to clear passkey challenge from sessionStorage on tab/window close.
 * Returns a cleanup unsubscribe function.
 */
export function setupPasskeyUnloadCleanup(): () => void {
  if (typeof window === "undefined") return () => {};

  const handleUnload = () => {
    clearPasskeyChallengeFromSession();
  };

  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("pagehide", handleUnload);

  return () => {
    window.removeEventListener("beforeunload", handleUnload);
    window.removeEventListener("pagehide", handleUnload);
  };
}
