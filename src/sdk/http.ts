/**
 * Tiny fetch wrapper. Pure functions; no classes.
 *
 * Errors are surfaced as rejected promises with the HTTP status + body so the
 * TUI can show them inline. We intentionally avoid throwing custom error
 * classes — strings are sufficient for the demo surface.
 */
import type { LemmaClient } from "./types.js";

type HttpMethod = "GET" | "POST";

const resolveFetch = (client: LemmaClient): typeof fetch =>
  client.fetcher ?? (globalThis.fetch as typeof fetch);

const withAuthHeaders = (
  client: LemmaClient,
  base: Readonly<Record<string, string>>,
): Record<string, string> =>
  client.apiKey ? { ...base, authorization: `Bearer ${client.apiKey}` } : { ...base };

const parseJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json();
  } catch {
    return { error: "Invalid JSON response" };
  }
};

export const request =
  <T>(client: LemmaClient) =>
  (method: HttpMethod) =>
  (path: string) =>
  async (body?: unknown): Promise<T> => {
    const url = `${client.apiBase}${path}`;
    const headers = withAuthHeaders(client, { "content-type": "application/json" });
    const init: RequestInit = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    };
    const res = await resolveFetch(client)(url, init);
    const parsed = await parseJson(res);
    if (!res.ok) {
      const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
      throw new Error(`Lemma API ${String(res.status)} on ${method} ${path}: ${detail}`);
    }
    return parsed as T;
  };

export const get = <T>(client: LemmaClient) => request<T>(client)("GET");
export const post = <T>(client: LemmaClient) => request<T>(client)("POST");
