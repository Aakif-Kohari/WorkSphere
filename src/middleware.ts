import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  runMiddlewarePipeline,
  middlewareMatcher,
  isCsrfExemptRoute,
} from "./lib/middleware";
import { generateCryptographicNonce, generateCsp } from "./lib/security/csp";
import { matchRateTier, getClientIp } from "./lib/tokenBucketRateLimit";

/**
 * WorkSphere Orchestrated Edge Middleware Pipeline
 * Chains Rate Limiting, Authentication & Authorization, Security Headers (CSP & Nonce), and CSRF Protection.
 */
export default clerkMiddleware(async (auth, req) => {
  return await runMiddlewarePipeline(req, {
    auth,
    protect: auth.protect,
  });
});

export {
  generateCryptographicNonce,
  generateCsp,
  isCsrfExemptRoute,
  matchRateTier,
  getClientIp,
};

export const config = {
  matcher: middlewareMatcher,
};
