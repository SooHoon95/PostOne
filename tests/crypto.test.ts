import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ORIGINAL_KEY = process.env.TOKEN_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64); // 32 bytes hex
});

afterAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe("crypto utilities", () => {
  it("round trips a plaintext", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);
    const { encryptToken, decryptToken } = await import("@/lib/crypto/encrypt");
    const plaintext =
      "linkedin_access_token_xyz_long_string_with_specials_!@#";

    const enc = encryptToken(plaintext);
    expect(enc.ciphertext).not.toContain(plaintext);
    expect(enc.iv).toHaveLength(24); // 12 bytes hex
    expect(enc.tag).toHaveLength(32); // 16 bytes hex

    const decrypted = decryptToken(enc);
    expect(decrypted).toBe(plaintext);
  });

  it("fails decryption with tampered ciphertext", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);
    const { encryptToken, decryptToken } = await import("@/lib/crypto/encrypt");
    const enc = encryptToken("hello");
    const tampered = {
      ...enc,
      ciphertext: enc.ciphertext.replace(/.$/, (c) =>
        c === "0" ? "1" : "0"
      ),
    };
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws if key length is invalid", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "deadbeef";
    const { encryptToken } = await import("@/lib/crypto/encrypt");
    expect(() => encryptToken("x")).toThrow(/TOKEN_ENCRYPTION_KEY/);
    process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);
  });
});
