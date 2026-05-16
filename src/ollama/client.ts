/**
 * Ollama HTTP client. Pure functions returning Promises.
 *
 * Three endpoints are used by the claim-check pipeline:
 *   - GET  /api/tags        — list available local models (sanity check)
 *   - POST /api/show        — pull the model digest for attestation
 *   - POST /api/generate    — run inference for the claim verdict
 *
 * Note: the demo runs `stream: false` for simplicity. If you want streamed
 * tokens in the TUI later, switch to ReadableStream parsing — the response
 * contract is documented at the Ollama API reference above.
 */
import type {
  GenerateRequest,
  GenerateResponse,
  OllamaConfig,
  ShowResponse,
  TagsResponse,
} from "./types.js";

const resolveFetch = (cfg: OllamaConfig): typeof fetch =>
  cfg.fetcher ?? (globalThis.fetch as typeof fetch);

export const createOllama = (overrides: Partial<OllamaConfig> = {}): OllamaConfig => ({
  baseUrl: overrides.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  model: overrides.model ?? process.env.OLLAMA_MODEL ?? "gemma4:latest",
  fetcher: overrides.fetcher,
});

const request = async <T>(
  cfg: OllamaConfig,
  path: string,
  init: RequestInit,
): Promise<T> => {
  const res = await resolveFetch(cfg)(`${cfg.baseUrl}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama ${String(res.status)} on ${path}: ${text}`);
  }
  return (await res.json()) as T;
};

export const tags = (cfg: OllamaConfig): Promise<TagsResponse> =>
  request<TagsResponse>(cfg, "/api/tags", { method: "GET" });

export const show = (cfg: OllamaConfig, model?: string): Promise<ShowResponse> =>
  request<ShowResponse>(cfg, "/api/show", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: model ?? cfg.model }),
  });

export const generate = (
  cfg: OllamaConfig,
  payload: Omit<GenerateRequest, "model" | "stream"> & Readonly<{ model?: string }>,
): Promise<GenerateResponse> =>
  request<GenerateResponse>(cfg, "/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: payload.model ?? cfg.model,
      prompt: payload.prompt,
      images: payload.images,
      options: payload.options,
      stream: false,
    } satisfies GenerateRequest),
  });
