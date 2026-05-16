import type { AttestationResult } from "../attestation/types.js";
import type { InferenceResult } from "../inference/index.js";
import type { ProofSubmission } from "../proof/index.js";

export type StepName = "attest" | "infer" | "prove";

export type StepStatus = "pending" | "running" | "ok" | "fail" | "skipped";

export type StepState = Readonly<{
  status: StepStatus;
  message: string;
  startedAt?: number;
  finishedAt?: number;
}>;

export type PipelineState = Readonly<{
  attest: StepState;
  infer: StepState;
  prove: StepState;
  attestation?: AttestationResult;
  inference?: InferenceResult;
  proof?: ProofSubmission;
  error?: string;
}>;

export const initialPipeline: PipelineState = {
  attest: { status: "pending", message: "Waiting" },
  infer: { status: "pending", message: "Waiting" },
  prove: { status: "pending", message: "Waiting" },
};
