# WorkSphere Security Architecture & Threat Model

## Executive Overview

WorkSphere employs a **defense-in-depth** security architecture designed to protect sensitive remote-work venue telemetry, user check-in data, zero-knowledge verification claims, passkey authentication credentials, and collaborative CRDT state.

This specification outlines WorkSphere's formal security model, including:
1. Comprehensive **Threat Model & Mitigation Matrix** (XSS, CSRF, Clickjacking, SSRF, Supply Chain, and Relay Attacks).
2. Complete **Content Security Policy (CSP) Directives & Justification**.
3. **WebAuthn (FIDO2) Passkey Ceremony Security Assertions**.
4. **Zero-Knowledge Proof (Groth16) Privacy & Integrity Guarantees**.
5. **Real-time WebRTC & PartyKit CRDT Security Controls**.

---

## 1. Threat Model & Risk Mitigation Matrix

WorkSphere categorizes security risks according to the STRIDE framework (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) tailored to modern Next.js App Router architectures.

| Threat Category | Primary Attack Vector | WorkSphere Mitigation Strategy | Technical Enforcer |
| :--- | :--- | :--- | :--- |
| **Cross-Site Scripting (XSS)** | Malicious payload injection in crowdsourced venue reviews, collaborative notes, or third-party script compromise. | Strict strict-dynamic CSP with per-request 128-bit cryptographic nonces (`generateCryptographicNonce()`), Contextual React JSX HTML escaping, and forbidden `'unsafe-inline'` script execution. | `src/middleware.ts` & Next.js compiler |
| **Cross-Site Request Forgery (CSRF)** | Unauthorized state-changing actions (e.g. reserving seats, mutating favorites, or modifying venue claims) via cross-site requests. | Double-submit CSRF cookie token pattern (`CSRF_COOKIE_NAME` and `CSRF_HEADER_NAME`) checked on all state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`). | `src/lib/csrf.ts` & `src/middleware.ts` |
| **Clickjacking** | Framing WorkSphere inside transparent iframes on malicious third-party domains to trick users into performing actions. | `frame-ancestors 'self'` directive enforced at HTTP response header level, rejecting cross-origin iframe embedding. | `generateCsp()` header policy |
| **Server-Side Request Forgery (SSRF)** | Attacker-supplied URLs targeting internal cloud metadata endpoints (`169.254.169.254`), localhost (`127.0.0.1`), or private IP ranges. | Pre-flight DNS resolution with strict IP blocklists covering IPv4 (RFC 1918, RFC 3927) and IPv6 (ULA, link-local) before issuing HTTP requests. | `src/lib/ssrfValidation.ts` |
| **Passkey / Replay Attacks** | Interception or replay of WebAuthn authentication signatures across domains or expired sessions. | Single-use 32-byte cryptographic random challenges (`base64url` encoded) with 5-minute TTL enforcement and domain-locked Relying Party ID (`worksphere.com`). | `src/lib/auth/passkeyChallenge.ts` & `WEBAUTHN_PASSKEY_SPECIFICATION.md` |
| **Supply Chain & Malicious NPM Packages** | Compromised third-party dependencies executing malicious scripts or exfiltrating browser state. | Strict CSP `script-src` and `connect-src` whitelist preventing exfiltration to unapproved external endpoints, coupled with lockfile integrity auditing. | `generateCsp()` whitelist |
| **Telemetry & Noise Data Poisoning** | Malicious users submitting fake low/high decibel audio telemetry or fake seat availability data. | Differential privacy noise filtering (`applyPrivacyFilter`), outlier detection via Z-score evaluation, and rate-limited submission queues. | `src/lib/privacy/differentialPrivacy.ts` & `src/lib/telemetryQueue.ts` |

---

## 2. Content Security Policy (CSP) Specification

WorkSphere generates a dynamic Content Security Policy for every request, injecting a 128-bit cryptographically random base64 nonce into inline script tags and HTTP response headers.

### Detailed Directives & Security Rationale

```http
Content-Security-Policy: 
  default-src 'self'; 
  base-uri 'self'; 
  object-src 'none'; 
  frame-ancestors 'self'; 
  form-action 'self'; 
  script-src 'self' 'nonce-<RANDOM_NONCE>' https://*.clerk.com https://*.clerk.accounts.dev https://*.mapbox.com https://api.mapbox.com https://events.mapbox.com https://challenges.cloudflare.com; 
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.mapbox.com; 
  font-src 'self' https://fonts.gstatic.com data:; 
  img-src 'self' data: blob: https: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://nominatim.openstreetmap.org https://router.project-osrm.org https://*.basemaps.cartocdn.com https://*.mapbox.com; 
  media-src 'self' blob: data:; 
  connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://nominatim.openstreetmap.org https://router.project-osrm.org https://*.basemaps.cartocdn.com https://*.mapbox.com https://*.partykit.dev wss://*.partykit.dev; 
  frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com; 
  worker-src 'self' blob:; 
  upgrade-insecure-requests;
```

#### Directive Breakdown & Defense Rationale

1. **`default-src 'self'`**:
   - Restricts all resource loading to the same origin by default unless explicitly overridden.

2. **`object-src 'none'`**:
   - Disables legacy browser plugins (`<object>`, `<embed>`, `<applet>`), eliminating Flash/Java plugin exploit vectors.

3. **`frame-ancestors 'self'`**:
   - Modern replacement for `X-Frame-Options: SAMEORIGIN`. Prevents third-party sites from embedding WorkSphere in iframes, completely mitigating UI redress/clickjacking attacks.

4. **`script-src 'self' 'nonce-${nonce}' ...`**:
   - Requires every executable script tag to match the server-generated cryptographic nonce.
   - Restricts external script sources exclusively to authenticated identity providers (Clerk), interactive map rendering engines (Mapbox), and bot verification (Cloudflare Turnstile).
   - In production, `'unsafe-eval'` is strictly excluded.

5. **`connect-src 'self' ...`**:
   - Prevents exfiltration of sensitive tokens, user state, or CRDT updates to unauthorized domains.
   - Allows WebSocket (`wss://`) and HTTP connections only to WorkSphere backend services, Clerk auth servers, open map tile APIs, and PartyKit real-time room servers.

6. **`worker-src 'self' blob:`**:
   - Permits instantiation of off-main-thread Web Workers for cryptographic proof generation (snarkjs ZKP worker) and audio DSP FFT analysis using local `blob:` URLs.

7. **`upgrade-insecure-requests`**:
   - Automatically instructs browsers to upgrade all legacy HTTP asset requests to HTTPS before transmission.

---

## 3. WebAuthn Passkey Security Assertions

WorkSphere implements FIDO2 / WebAuthn passkey authentication to provide phishing-resistant user sign-in and step-up authorization.

### Cryptographic Assurance Guarantees

1. **Origin Locking & Relying Party (RP) Binding**:
   - All passkey ceremonies validate `clientDataJSON.origin` against exact expected origins (`https://worksphere.com` or `https://*.worksphere.com`).
   - Scoped strictly to Relying Party ID `worksphere.com` to prevent cross-site credential theft or phishing proxy attacks.

2. **Replay Attack Prevention**:
   - Every registration and authentication flow generates a 32-byte cryptographically secure random challenge (`crypto.getRandomValues()`).
   - Challenges are stored in Redis with a strict 5-minute Time-to-Live (TTL) and atomic single-use deletion upon verification.

3. **User Verification (UV) Enforcement**:
   - Requires biometric or hardware PIN authorization (`userVerification: "required"`), ensuring physical presence and proof-of-user identity.

4. **Private Browsing Graceful Fallback**:
   - IndexedDB access required for WebAuthn challenge caching is wrapped in timeout-protected try/catch handling. When Safari Private Browsing blocks database storage, the application falls back gracefully without locking the UI.

---

## 4. Zero-Knowledge Proof (Groth16) Security & Privacy

For student verification and premium venue access, WorkSphere leverages snarkjs Groth16 zero-knowledge proofs over the `bn128` elliptic curve.

- **Client-Side Proof Generation**: Proof computation runs inside an isolated Web Worker (`zkpWorker.ts`), preventing main-thread blocking and ensuring user secrets never leave the client device.
- **Nullifier Hash Anti-Replay**: Each generated proof contains a unique cryptographically hashed nullifier (`PoseidonHash(secretKey, scope)`). The server maintains an immutable nullifier registry to prevent proof double-spending or replay attacks.
- **Snarkjs Worker Abort Control**: Worker execution is wired to `AbortController` signals, terminating computation immediately upon component unmount to free system memory and CPU cycles.

---

## 5. Real-Time WebRTC & PartyKit CRDT Security Controls

WorkSphere supports real-time collaborative workspace notes and venue check-in state via Yjs CRDTs synchronized over PartyKit WebSockets.

- **Authentication & Room Scoping**: Room connections require valid JWT tokens. User IDs are verified before establishing room subscription contexts.
- **Input Sanitization & Yjs Encoding**: CRDT state updates are encoded as binary `Uint8Array` diffs. Text content rendered from Yjs documents undergoes standard React DOM escaping to mitigate stored XSS risks.
- **Web Locks Storage Serialization**: Client-side IndexedDB mutations for offline CRDT state are serialized using the Web Locks API (`withWebLock`), preventing race conditions and database corruption across multiple browser tabs.

---

## 6. Verification & Automated Security Audits

WorkSphere enforces continuous security validation across the development lifecycle:

- **Automated Unit Tests**: Standard Jest suites verify CSRF token validation (`src/__tests__/lib/csrf.test.ts`), SSRF IP blocklist checks (`src/__tests__/lib/ssrfValidation.test.ts`), and WebAuthn origin enforcement.
- **Static Analysis & Linting**: ESLint security rules reject un-sanitized dynamic code evaluation, raw `innerHTML` usage without sanitization, and insecure crypto usages.
- **Dependency Auditing**: Automated CI/CD dependency vulnerability scans (`npm audit`) block pulls containing known high-severity CVEs.
