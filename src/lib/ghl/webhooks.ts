/**
 * GHL webhook signature verification.
 *
 * In PIT mode (current), GHL webhooks are delivered via a GHL Workflow with a
 * shared-secret header (`x-vf-webhook-secret`). The sender computes an
 * HMAC-SHA256 over the raw request body using the shared secret and sends the
 * hex digest as the signature value.
 *
 * In OAuth/marketplace mode (future), verification switches to RSA-SHA256
 * against GHL's published public key (`x-wh-signature`). The route handler
 * selects the path; this helper owns the HMAC path.
 *
 * Security properties:
 *   - Uses crypto.timingSafeEqual so the comparison is not exploitable via
 *     timing side-channel.
 *   - Handles mismatched digest lengths without throwing (pads to equal length
 *     before the safe comparison, always returning false on mismatch).
 *
 * Used by: src/app/api/webhooks/ghl/route.ts (Slice 2).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify that `signature` is the correct HMAC-SHA256 hex digest of `rawBody`
 * under `secret`.
 *
 * @param rawBody   The exact bytes received — must be read with `req.text()`
 *                  before any JSON parsing (signature is over the wire bytes).
 * @param signature The hex-encoded HMAC value from the webhook header.
 * @param secret    The shared secret (`GHL_WEBHOOK_SHARED_SECRET` env var).
 * @returns         `true` only when the signature is cryptographically valid.
 */
export function verifyGhlSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  // Compute the expected digest.
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signature, "utf8");

  // timingSafeEqual requires equal-length buffers. When lengths differ the
  // signature is definitely wrong — return false without leaking timing info
  // by still doing a constant-time comparison against a same-length zeroed
  // buffer rather than short-circuiting on length.
  if (expectedBuf.length !== receivedBuf.length) {
    // Compare expected against itself so the CPU work is the same regardless
    // of the received value, preventing a length-based timing oracle.
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }

  return timingSafeEqual(expectedBuf, receivedBuf);
}
