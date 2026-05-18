/**
 * Lemma API thin wrapper.
 *
 * Surface kept intentionally narrow — only what the claim-check pipeline needs:
 *   - registerDocument  (POST /v1/documents)
 *   - health            (GET  /v1/health)
 *
 * If LEMMA_API_BASE is unset, the client targets the public workers deployment.
 */
import type {
  ClientConfig,
  HealthResponse,
  LemmaClient,
  RegisterDocumentRequest,
  RegisterDocumentResponse,
} from "./types.js";
import { get, post } from "./http.js";

const DEFAULT_API_BASE = "https://workers.lemma.workers.dev";

export const createClient = (config: Partial<ClientConfig> = {}): LemmaClient => ({
  apiBase: config.apiBase ?? DEFAULT_API_BASE,
  apiKey: config.apiKey,
  fetcher: config.fetcher,
});

export const registerDocument = (
  client: LemmaClient,
  payload: RegisterDocumentRequest,
): Promise<RegisterDocumentResponse> =>
  post<RegisterDocumentResponse>(client)("/v1/documents")(payload);

// TODO: Type this properly using spec types if possible, or define SubmitProofRequest locally
export type SubmitProofRequest = Readonly<{
  docHash: string;
  circuitId: string;
  proof: string;
  inputs: ReadonlyArray<string>;
}>;

export type SubmitProofResponse = Readonly<{
  status: "received" | "verified" | "onchain-verified" | "rejected";
  verificationId: string;
}>;

export const submitProof = (
  client: LemmaClient,
  payload: SubmitProofRequest,
): Promise<SubmitProofResponse> =>
  post<SubmitProofResponse>(client)("/v1/proofs")(payload);

export const health = (client: LemmaClient): Promise<HealthResponse> =>
  get<HealthResponse>(client)("/v1/health")();
