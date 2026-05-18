/**
 * Public surface of the Lemma thin wrapper used by example-claim-check.
 *
 * The wrapper covers document registration (`registerDocument`) and proof
 * submission (`submitProof`). The on-device pipeline builds a Poseidon
 * commitment, generates a Groth16 proof via snarkjs, and submits both the
 * document binding and the proof to the Lemma workers API.
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
