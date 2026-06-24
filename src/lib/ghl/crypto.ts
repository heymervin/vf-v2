/**
 * GHL token encryption — AES-256-GCM, app-layer (SD-8).
 *
 * Output format: "v1:<iv base64>:<authTag base64>:<ciphertext base64>"
 *
 * The 32-byte key is derived from GHL_TOKEN_ENCRYPTION_KEY via SHA-256 so
 * the raw env value can be any length string. Both functions read the key at
 * call-time so they never throw at import.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV — standard for GCM
const VERSION_PREFIX = "v1";

/** Derive a 32-byte key from the raw env string using SHA-256. */
function deriveKey(): Buffer {
  const raw = process.env.GHL_TOKEN_ENCRYPTION_KEY ?? null;
  if (!raw) {
    throw new Error(
      "GHL_TOKEN_ENCRYPTION_KEY is not set. Cannot encrypt/decrypt GHL tokens."
    );
  }
  return createHash("sha256").update(raw).digest();
}

/**
 * Encrypts a plaintext GHL token.
 * Returns a "v1:<iv>:<authTag>:<ciphertext>" string safe to store in the DB.
 */
export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION_PREFIX,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a ciphertext produced by encryptToken.
 * Throws if the key is missing, the format is invalid, or the auth tag fails
 * (i.e. the ciphertext has been tampered with).
 */
export function decryptToken(ciphertext: string): string {
  const key = deriveKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Invalid ciphertext format. Expected v1:<iv>:<authTag>:<data>.");
  }

  const [, ivB64, authTagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // setAuthTag defers verification to final() — any tamper throws here.
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
