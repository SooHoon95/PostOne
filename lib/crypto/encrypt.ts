import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32-byte hex (64 chars)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plaintext: string): EncryptedToken {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decryptToken(enc: EncryptedToken): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(enc.iv, "hex"));
  decipher.setAuthTag(Buffer.from(enc.tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
