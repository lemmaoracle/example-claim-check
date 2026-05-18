/**
 * Public surface of the Lemma thin wrapper used by example-claim-check.
 *
 * The wrapper only covers document registration: the on-device pipeline binds
 * a claim-check result to a hash and registers it as a Lemma document via
 * POST /v1/documents. Circuit proof submission (POST /v1/proofs) requires a
 * registered ZK circuit and a real proof, and is out of scope for this demo —
 * see docs/writeup.md ("Edge proving is not yet implemented").
 */
export { createClient, registerDocument, submitProof, health } from "./client.js";
export type {
  ClientConfig,
  LemmaClient,
  DocumentCommitments,
  RegisterDocumentRequest,
  RegisterDocumentResponse,
  HealthResponse,
} from "./types.js";
export type {
  SubmitProofRequest,
  SubmitProofResponse,
} from "./client.js";
