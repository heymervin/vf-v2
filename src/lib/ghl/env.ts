/**
 * GHL environment helpers.
 *
 * All functions read from process.env at call-time — no throwing at import.
 * Callers that need the key should check hasGhlEncryptionKey() or handle
 * the error thrown by crypto.ts.
 */

/** Base URL for the GHL (Lead Connector) REST API. */
export function ghlApiBase(): string {
  return "https://services.leadconnectorhq.com";
}

/** API version header value required on every GHL request. */
export function ghlApiVersion(): string {
  return "2021-07-28";
}

/**
 * Returns the AES-256-GCM encryption key for GHL tokens, or null if not set.
 * Never throws — callers decide whether the missing key is fatal.
 */
export function ghlTokenEncryptionKey(): string | null {
  return process.env.GHL_TOKEN_ENCRYPTION_KEY ?? null;
}

/** True when GHL_TOKEN_ENCRYPTION_KEY is present in the environment. */
export function hasGhlEncryptionKey(): boolean {
  return ghlTokenEncryptionKey() !== null;
}
