/**
 * Attribute attestation step.
 *
 * Mirrors the model-attestation flow so the same hash-compare primitive can
 * cover an entirely different domain (KYC / DeFi compliance):
 *
 *   1. Build a canonical payload for the attribute key (the credential the
 *      holder would present in a real BBS+ flow).
 *   2. Hash the payload — that's the observed digest.
 *   3. Load the pinned known-good hash from config/known-good-attributes.json.
 *   4. Apply any tamper-state override (used by the WOW demo to flip the
 *      *expected* hash without touching the credential itself).
 *   5. Compare and return a structured verdict.
 *
 * The pipeline does **not** call Ollama or Gemma 4 in attribute mode — this
 * step is lightweight and works fully offline.
 */
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize, randomNonce, sha256Prefixed } from "./hash.js";
import type {
  AttributeAttestationResult,
  KnownGoodAttributeTable,
  TamperState,
} from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

const TAMPER_STATE_PATH = resolve(REPO_ROOT, ".tamper-state.json");
const KNOWN_GOOD_PATH = resolve(REPO_ROOT, "config", "known-good-attributes.json");

const safeReadJson = async <T>(path: string): Promise<T | null> => {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const loadKnownGood = async (): Promise<KnownGoodAttributeTable | null> =>
  safeReadJson<KnownGoodAttributeTable>(KNOWN_GOOD_PATH);

const loadTamperState = async (): Promise<TamperState | null> =>
  safeReadJson<TamperState>(TAMPER_STATE_PATH);

/**
 * Canonical payload for an attribute credential. In a real system this would
 * be the BBS+-signed VC the holder presents; for the demo we deterministically
 * derive a stable payload from the attribute key + a fixed demo subject so
 * the hash is reproducible across machines.
 *
 * Exposed for tooling that needs to recompute pinned hashes (e.g. tests, or
 * an operator updating `config/known-good-attributes.json`).
 */
export const attributeCanonicalPayload = (key: string): string =>
  canonicalize({
    schema: "attribute-credential.v1",
    key,
    subject: "demo-subject-id",
    issuer: "compliance-provider-A",
  });

/** Compute the canonical hash for an attribute key. */
export const attributeObservedDigest = (key: string): string =>
  sha256Prefixed(attributeCanonicalPayload(key));

export const attestAttribute = async (
  attrKey: string,
): Promise<AttributeAttestationResult> => {
  const [table, tamper] = await Promise.all([loadKnownGood(), loadTamperState()]);

  const observedDigest = attributeObservedDigest(attrKey);
  const entry = table?.attributes[attrKey];
  const expectedDigest = tamper?.attributeHashOverride ?? entry?.hash ?? null;

  // Common shape for "unknown" returns — keep labels/issuer best-effort.
  const fallbackLabel = entry?.label ?? attrKey;
  const fallbackIssuer = entry?.issuer ?? "unknown-issuer";

  if (entry === undefined) {
    return {
      type: "attribute",
      attributeKey: attrKey,
      label: fallbackLabel,
      issuer: fallbackIssuer,
      verdict: "unknown",
      observedDigest,
      expectedDigest,
      attestationToken: "",
      reason: `No known-good entry for attribute "${attrKey}". Add it to config/known-good-attributes.json.`,
    };
  }

  if (expectedDigest === null) {
    return {
      type: "attribute",
      attributeKey: attrKey,
      label: entry.label,
      issuer: entry.issuer,
      verdict: "unknown",
      observedDigest,
      expectedDigest: null,
      attestationToken: "",
      reason: `No pinned hash available for "${attrKey}".`,
    };
  }

  // Soft check: the credential entry has an expiry. We do not refuse to attest
  // on expiry — the verify step in the pipeline surfaces it separately — but
  // we note it in the reason text when the verdict is "verified".
  const isExpired = (() => {
    const t = Date.parse(entry.expiresAt);
    return Number.isFinite(t) && t < Date.now();
  })();

  if (expectedDigest === observedDigest) {
    const attestationToken = sha256Prefixed(
      canonicalize({
        attributeKey: attrKey,
        digest: observedDigest,
        nonce: randomNonce(),
        attestedAt: new Date().toISOString(),
      }),
    );
    return {
      type: "attribute",
      attributeKey: attrKey,
      label: entry.label,
      issuer: entry.issuer,
      verdict: "verified",
      observedDigest,
      expectedDigest,
      attestationToken,
      reason: tamper
        ? "Tamper override matches the held credential — no anomaly detected."
        : isExpired
          ? "Attribute hash matches, but the credential has expired (see Verify step)."
          : "Held credential hash matches the pinned issuer attestation.",
    };
  }

  return {
    type: "attribute",
    attributeKey: attrKey,
    label: entry.label,
    issuer: entry.issuer,
    verdict: "tampered",
    observedDigest,
    expectedDigest,
    attestationToken: "",
    reason: tamper?.note
      ? `Attribute hash mismatch — ${tamper.note}`
      : "Attribute hash mismatch — held credential does not match the pinned issuer attestation.",
  };
};

export type AttributeVerifyResult = Readonly<{
  ok: boolean;
  expiresAt: string | null;
  reason: string;
}>;

/**
 * Simple "credential is currently valid" check used by the TUI's Verify step
 * in attribute mode. Real-world implementations would also walk a revocation
 * list, but that is out of scope for this demo (see writeup §Limitations).
 */
export const verifyAttribute = async (
  attrKey: string,
): Promise<AttributeVerifyResult> => {
  const table = await loadKnownGood();
  const entry = table?.attributes[attrKey];
  if (entry === undefined) {
    return { ok: false, expiresAt: null, reason: `Unknown attribute "${attrKey}".` };
  }
  const expiresMs = Date.parse(entry.expiresAt);
  if (!Number.isFinite(expiresMs)) {
    return {
      ok: false,
      expiresAt: entry.expiresAt,
      reason: `Could not parse expiry "${entry.expiresAt}".`,
    };
  }
  if (expiresMs < Date.now()) {
    return {
      ok: false,
      expiresAt: entry.expiresAt,
      reason: `Credential expired at ${entry.expiresAt}.`,
    };
  }
  return {
    ok: true,
    expiresAt: entry.expiresAt,
    reason: `Credential valid until ${entry.expiresAt}.`,
  };
};
