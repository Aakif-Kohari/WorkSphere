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

