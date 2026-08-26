// At-rest encryption for OAuth access tokens stored in social_connections
// (see migration 0044). AES-GCM via Web Crypto — native to Cloudflare
// Workers, no dependency needed. Server-only.
import process from "node:process";

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function importKey(): Promise<CryptoKey> {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("falta_o_invalida_token_encryption_key");
  }
  return crypto.subtle.importKey("raw", fromHex(hex) as unknown as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(plain: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(plain),
  );
  return { ciphertext: toHex(cipherBuf), iv: toHex(iv) };
}

export async function decryptToken(ciphertext: string, iv: string): Promise<string> {
  const key = await importKey();
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromHex(iv) as unknown as BufferSource },
    key,
    fromHex(ciphertext) as unknown as BufferSource,
  );
  return new TextDecoder().decode(plainBuf);
}
