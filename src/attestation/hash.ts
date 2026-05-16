/**
 * Hashing utilities. We rely on Node's built-in crypto so the demo has zero
 * native deps. SHA-256 is sufficient — Ollama itself reports digests as
 * sha256:... strings, and we want to match that surface.
 */
import { createHash, randomBytes } from "node:crypto";

export const sha256Hex = (input: string | Uint8Array): string => {
  const hash = createHash("sha256");
  hash.update(input);
  return hash.digest("hex");
};

export const sha256Prefixed = (input: string | Uint8Array): string =>
  `sha256:${sha256Hex(input)}`;

/**
 * Canonical JSON stringification: sorted keys, no whitespace. Required for
 * stable hashes across runs. Sufficient for the demo's payload shapes
 * (no Date/BigInt/Map values).
 */
export const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
};

export const randomNonce = (): string => randomBytes(16).toString("hex");
