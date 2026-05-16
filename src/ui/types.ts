import type {
  AttributeAttestationResult,
  ModelAttestationResult,
} from "../attestation/types.js";
import type { AttributeVerifyResult } from "../attestation/attribute.js";
import type { InferenceResult } from "../inference/index.js";
import type { ProofSubmission, AttributeProofSubmission } from "../proof/index.js";

/** UI mode selected via `--mode`. "claim" is the legacy model-attestation flow. */
export type Mode = "claim" | "attribute" | "both";

/**
 * Step identifiers used by the TUI. Two parallel triples — one per domain —
 * keep the rendering logic flat without per-mode discriminated state.
 */
export type StepName =
  | "attest"
  | "infer"
  | "prove"
  | "attest-attr"
  | "verify-attr"
  | "prove-attr";

export type StepStatus = "pending" | "running" | "ok" | "fail" | "skipped";

export type StepState = Readonly<{
  status: StepStatus;
  message: string;
  startedAt?: number;
  finishedAt?: number;
}>;

export type PipelineState = Readonly<{
  // Claim-mode steps
  attest: StepState;
  infer: StepState;
  prove: StepState;
  // Attribute-mode steps
  attestAttr: StepState;
  verifyAttr: StepState;
  proveAttr: StepState;
  // Results
  attestation?: ModelAttestationResult;
  inference?: InferenceResult;
  proof?: ProofSubmission;
  attestationAttr?: AttributeAttestationResult;
  verifyResult?: AttributeVerifyResult;
  proofAttr?: AttributeProofSubmission;
  error?: string;
}>;

const waiting: StepState = { status: "pending", message: "Waiting" };

export const initialPipeline: PipelineState = {
  attest: waiting,
  infer: waiting,
  prove: waiting,
  attestAttr: waiting,
  verifyAttr: waiting,
  proveAttr: waiting,
};
