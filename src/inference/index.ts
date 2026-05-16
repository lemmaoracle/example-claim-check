/**
 * Inference step — runs the claim through Gemma 4 via Ollama.
 *
 * The model is asked to return a small JSON object so the TUI can render a
 * verdict cleanly. Gemma 4 supports function-style structured output, but we
 * intentionally use a constrained JSON prompt instead of a function call here
 * to keep the wire format portable across Ollama versions.
 */
import { generate, type OllamaConfig } from "../ollama/index.js";

export type ClaimVerdict = "supported" | "refuted" | "uncertain";

export type InferenceResult = Readonly<{
  verdict: ClaimVerdict;
  rationale: string;
  /** Sub-claims the model decomposed the input into. */
  subClaims: ReadonlyArray<string>;
  /** Raw model output — preserved so the proof can bind exactly what was generated. */
  raw: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
}>;

const SYSTEM_PROMPT = `You are a claim-checking assistant. The user gives you a single factual claim.
Decompose it into atomic sub-claims, then assess whether the overall claim is
SUPPORTED, REFUTED, or UNCERTAIN based on widely accepted public knowledge.

Reply with ONLY a JSON object — no markdown fences, no commentary outside JSON.
Schema:
{
  "verdict": "supported" | "refuted" | "uncertain",
  "rationale": string (1-3 sentences, plain text),
  "sub_claims": string[]
}`;

const buildPrompt = (claim: string): string =>
  `${SYSTEM_PROMPT}\n\nClaim: ${claim.trim()}\n\nJSON:`;

const tryParseJson = (raw: string): unknown => {
  // Strip Markdown fences if the model adds them despite instructions.
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  // Find the first JSON object span.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
};

const coerceVerdict = (v: unknown): ClaimVerdict => {
  const s = String(v ?? "").toLowerCase();
  if (s === "supported" || s === "refuted" || s === "uncertain") return s;
  return "uncertain";
};

const coerceStringArray = (v: unknown): ReadonlyArray<string> =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export const runInference = async (
  ollama: OllamaConfig,
  claim: string,
): Promise<InferenceResult> => {
  const startedAt = Date.now();
  const res = await generate(ollama, {
    prompt: buildPrompt(claim),
    options: { temperature: 0.1 },
  });
  const durationMs = Date.now() - startedAt;
  const parsed = tryParseJson(res.response);
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    return {
      verdict: coerceVerdict(obj.verdict),
      rationale: typeof obj.rationale === "string" ? obj.rationale : "(no rationale)",
      subClaims: coerceStringArray(obj.sub_claims),
      raw: res.response,
      durationMs,
    };
  }
  return {
    verdict: "uncertain",
    rationale: "Model output could not be parsed as JSON — treating as uncertain.",
    subClaims: [],
    raw: res.response,
    durationMs,
  };
};
