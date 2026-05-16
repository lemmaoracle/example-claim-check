/**
 * Ollama HTTP API types — only the fields this demo touches.
 * Reference: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

export type OllamaConfig = Readonly<{
  baseUrl: string;
  model: string;
  fetcher?: typeof fetch;
}>;

export type GenerateRequest = Readonly<{
  model: string;
  prompt: string;
  /** Image inputs as base64 strings (without data: prefix). */
  images?: ReadonlyArray<string>;
  /** Non-streaming for the demo — simpler integration. */
  stream?: boolean;
  options?: Readonly<Record<string, unknown>>;
}>;

export type GenerateResponse = Readonly<{
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}>;

export type ShowResponse = Readonly<{
  /** Modelfile contents — preserved for transparency. */
  modelfile?: string;
  /** Per-file digests — this is the source of truth for weight integrity. */
  details?: Readonly<{
    parent_model?: string;
    format?: string;
    family?: string;
    families?: ReadonlyArray<string>;
    parameter_size?: string;
    quantization_level?: string;
  }>;
  /** Manifest-level model digest reported by Ollama. */
  model_info?: Readonly<Record<string, unknown>>;
  /** Top-level digest if present. */
  digest?: string;
}>;

export type TagsResponse = Readonly<{
  models: ReadonlyArray<
    Readonly<{
      name: string;
      modified_at: string;
      size: number;
      digest: string;
    }>
  >;
}>;
