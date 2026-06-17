/**
 * Unit tests for GHL token encryption helpers.
 *
 * No DB, no network, no secrets from the environment — the test sets
 * GHL_TOKEN_ENCRYPTION_KEY itself so these run in CI without a .env.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// We import after setting the env so the module picks up the key.
const TEST_KEY = "test-super-secret-key-for-unit-testing-only-32+";

describe("encryptToken / decryptToken", () => {
  let encryptToken: (plaintext: string) => string;
  let decryptToken: (ciphertext: string) => string;

  beforeAll(async () => {
    process.env.GHL_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    // Dynamic import after env is set so the module reads the key fresh.
    const mod = await import("./crypto");
    encryptToken = mod.encryptToken;
    decryptToken = mod.decryptToken;
  });

  afterAll(() => {
    delete process.env.GHL_TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a plaintext token", () => {
    const plaintext = "ghl_pit_abcdef1234567890";
    const ciphertext = encryptToken(plaintext);
    expect(decryptToken(ciphertext)).toBe(plaintext);
  });

  it("produces unique ciphertext on every call (random IV)", () => {
    const plaintext = "same-token-every-time";
    const first = encryptToken(plaintext);
    const second = encryptToken(plaintext);
    // Different ciphertexts because each call uses a fresh random IV.
    expect(first).not.toBe(second);
    // But both decrypt to the same plaintext.
    expect(decryptToken(first)).toBe(plaintext);
    expect(decryptToken(second)).toBe(plaintext);
  });

  it("throws on tampered ciphertext (auth-tag failure)", () => {
    const plaintext = "tamper-me";
    const ciphertext = encryptToken(plaintext);
    // Flip the last character to corrupt the ciphertext segment.
    const corrupted = ciphertext.slice(0, -1) + (ciphertext.endsWith("A") ? "B" : "A");
    expect(() => decryptToken(corrupted)).toThrow();
  });

  it("throws a clear error when the encryption key is missing", async () => {
    // Temporarily remove the key.
    const savedKey = process.env.GHL_TOKEN_ENCRYPTION_KEY;
    delete process.env.GHL_TOKEN_ENCRYPTION_KEY;

    // Re-import to get a fresh module instance without the key in env.
    // Since vitest caches modules, we test the guard inside encrypt/decrypt
    // by patching process.env then calling the function — the functions read
    // the key at call-time via ghlTokenEncryptionKey().
    const { encryptToken: enc } = await import("./crypto");
    expect(() => enc("some-token")).toThrow(/GHL_TOKEN_ENCRYPTION_KEY/);

    // Restore.
    process.env.GHL_TOKEN_ENCRYPTION_KEY = savedKey!;
  });
});
