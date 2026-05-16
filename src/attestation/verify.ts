/**
 * Model attestation step.
 *
 * Flow:
 *   1. Ask Ollama `/api/show` for the local model's manifest digest.
 *   2. Load the curated known-good digest from config/known-good-hashes.json.
 *   3. Apply any tamper-state override (used by the WOW demo to flip the
 *      *expected* hash without touching the model itself).
 *   4. Compare and return a structured verdict.
 *
 * The verdict drives the TUI traffic light — verified -> green, tampered -> red.
 */
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createOllama, show, tags, type OllamaConfig } from "../ollama/index.js";
import { canonicalize, randomNonce, sha256Prefixed } from "./hash.js";
import type { ModelAttestationResult, KnownGoodTable, TamperState } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

const TAMPER_STATE_PATH = resolve(REPO_ROOT, ".tamper-state.json");
const KNOWN_GOOD_PATH = resolve(REPO_ROOT, "config", "known-good-hashes.json");

const safeReadJson = async <T>(path: string): Promise<T | null> => {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const loadKnownGood = async (): Promise<KnownGoodTable | null> =>
  safeReadJson<KnownGoodTable>(KNOWN_GOOD_PATH);

const loadTamperState = async (): Promise<TamperState | null> =>
  safeReadJson<TamperState>(TAMPER_STATE_PATH);

const extractDigest = (raw: unknown): string => {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.digest === "string" && obj.digest.length > 0) return obj.digest;
  }
  return "";
};

/**
 * The model's manifest digest as reported by `/api/tags`. This is the stable,
 * content-addressed digest: it is identical on every machine that pulled the
 * same model version, so it is the value safe to pin in known-good-hashes.json.
 * Returns "" when the tag is not present locally.
 */
const digestFromTags = async (ollama: OllamaConfig): Promise<string> => {
  const res = await tags(ollama);
  const entry = res.models.find((m) => m.name === ollama.model);
  if (!entry || entry.digest.length === 0) return "";
  return entry.digest.startsWith("sha256:") ? entry.digest : `sha256:${entry.digest}`;
};

export const attestModel = async (
  ollama: OllamaConfig = createOllama(),
): Promise<ModelAttestationResult> => {
  const [table, tamper] = await Promise.all([loadKnownGood(), loadTamperState()]);

  let observedDigest = "";
  try {
    const showRes = await show(ollama);
    observedDigest = extractDigest(showRes);
    if (observedDigest.length === 0) {
      // `/api/show` usually omits a top-level digest. The stable, content-
      // addressed manifest digest lives on `/api/tags` — prefer it so the
      // pinned value is reproducible across machines (not tied to a local
      // pull timestamp).
      observedDigest = await digestFromTags(ollama);
    }
    if (observedDigest.length === 0) {
      // Last resort if the tag is unknown to `/api/tags`: a deterministic
      // hash of the `/api/show` body so the demo can still run. This value
      // is machine-local and should not be pinned as known-good.
      observedDigest = sha256Prefixed(canonicalize(showRes));
    }
  } catch (e) {
    return {
      type: "model",
      verdict: "unknown",
      modelTag: ollama.model,
      observedDigest: "",
      expectedDigest: null,
      attestationToken: "",
      reason: `Could not query Ollama (${(e as Error).message}). Is the daemon running?`,
    };
  }

  const fromTable = table?.models[ollama.model]?.digest;
  const expectedDigest = tamper?.expectedDigestOverride ?? fromTable ?? null;

  if (expectedDigest === null) {
    return {
      type: "model",
      verdict: "unknown",
      modelTag: ollama.model,
      observedDigest,
      expectedDigest: null,
      attestationToken: "",
      reason: `No known-good digest for ${ollama.model}. Add its /api/tags digest to config/known-good-hashes.json.`,
    };
  }

  if (expectedDigest === observedDigest) {
    const attestationToken = sha256Prefixed(
      canonicalize({
        modelTag: ollama.model,
        digest: observedDigest,
        nonce: randomNonce(),
        attestedAt: new Date().toISOString(),
      }),
    );
    return {
      type: "model",
      verdict: "verified",
      modelTag: ollama.model,
      observedDigest,
      expectedDigest,
      attestationToken,
      reason: tamper
        ? "Tamper override matches the on-disk model — no anomaly detected."
        : "Observed model digest matches known-good entry.",
    };
  }

  return {
    type: "model",
    verdict: "tampered",
    modelTag: ollama.model,
    observedDigest,
    expectedDigest,
    attestationToken: "",
    reason: tamper?.note
      ? `Digest mismatch — ${tamper.note}`
      : "Digest mismatch — local model does not match the pinned known-good hash.",
  };
};
