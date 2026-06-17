/**
 * Unit tests for src/lib/ghl/webhooks.ts
 *
 * verifyGhlSignature(rawBody, signature, secret) → boolean
 *
 * Mechanism: HMAC-SHA256 over rawBody using secret, hex-encoded.
 * Timing-safe: uses crypto.timingSafeEqual so the comparison
 * cannot be exploited via timing side-channel.
 *
 * These tests are DB-free and secret-free — they derive their own
 * HMAC values at runtime using node:crypto.
 */

import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyGhlSignature } from "./webhooks";

// ── helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = "super-secret-shared-key-for-tests";

/**
 * Produce the correct HMAC-SHA256 hex signature the same way the webhook
 * sender would — so tests can construct both valid and tampered scenarios.
 */
function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// ── test suite ────────────────────────────────────────────────────────────────

describe("verifyGhlSignature", () => {
  it("returns true for a valid HMAC-SHA256 signature", () => {
    const body = JSON.stringify({ type: "OpportunityStatusUpdate", locationId: "loc_abc" });
    const sig = sign(body, TEST_SECRET);

    expect(verifyGhlSignature(body, sig, TEST_SECRET)).toBe(true);
  });

  it("returns false when the body has been tampered with", () => {
    const originalBody = JSON.stringify({ type: "OpportunityStatusUpdate", locationId: "loc_abc" });
    const sig = sign(originalBody, TEST_SECRET);

    const tamperedBody = JSON.stringify({ type: "OpportunityStatusUpdate", locationId: "loc_EVIL" });
    expect(verifyGhlSignature(tamperedBody, sig, TEST_SECRET)).toBe(false);
  });

  it("returns false when the signature is wrong (bad secret)", () => {
    const body = JSON.stringify({ type: "InboundMessage" });
    const sigWithWrongKey = sign(body, "wrong-secret");

    expect(verifyGhlSignature(body, sigWithWrongKey, TEST_SECRET)).toBe(false);
  });

  it("returns false when the signature is an empty string", () => {
    const body = "{}";
    expect(verifyGhlSignature(body, "", TEST_SECRET)).toBe(false);
  });

  it("returns false when the signature is completely garbage", () => {
    const body = JSON.stringify({ type: "ContactTagUpdate" });
    expect(verifyGhlSignature(body, "not-a-valid-hmac-at-all", TEST_SECRET)).toBe(false);
  });

  it("returns false when the body is empty and signature does not match", () => {
    // A correct HMAC of an empty string against a different secret should fail.
    const sigForEmptyBodyWrongSecret = sign("", "other-secret");
    expect(verifyGhlSignature("", sigForEmptyBodyWrongSecret, TEST_SECRET)).toBe(false);
  });

  it("returns true for an empty body when the HMAC matches", () => {
    // Edge case: GHL could theoretically send a ping with no body.
    const sig = sign("", TEST_SECRET);
    expect(verifyGhlSignature("", sig, TEST_SECRET)).toBe(true);
  });

  it("is timing-safe — does not throw even when lengths differ", () => {
    // crypto.timingSafeEqual requires equal-length Buffers; the implementation
    // must pad/handle mismatches without throwing.
    const body = "{}";
    expect(() => verifyGhlSignature(body, "short", TEST_SECRET)).not.toThrow();
    expect(verifyGhlSignature(body, "short", TEST_SECRET)).toBe(false);
  });

  it("treats two different secrets as producing different valid signatures", () => {
    const body = JSON.stringify({ type: "InvoicePaid" });
    const sigA = sign(body, "secret-a");
    const sigB = sign(body, "secret-b");

    expect(verifyGhlSignature(body, sigA, "secret-a")).toBe(true);
    expect(verifyGhlSignature(body, sigB, "secret-b")).toBe(true);
    // Cross-check: sig from A must not pass B's key
    expect(verifyGhlSignature(body, sigA, "secret-b")).toBe(false);
  });
});
