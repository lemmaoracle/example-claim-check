import { describe, it, expect } from "vitest";
import { buildBinding } from "../proof/index.js";
import { toScalar } from "@lemmaoracle/sdk";

const mockAttestation = {
  type: "model" as const,
  verdict: "verified" as const,
  modelTag: "gemma4:latest",
  observedDigest: "gemma4:latest@sha256-c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf98fcf",
  expectedDigest: "gemma4:latest@sha256-c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf98fcf",
  attestationToken: "",
  reason: "",
};

const mockInference = {
  verdict: "supported" as const,
  rationale: "The Eiffel Tower is indeed located in Paris, France.",
  subClaims: ["The Eiffel Tower is in Paris."],
  raw: '{"verdict":"supported","rationale":"...","sub_claims":["The Eiffel Tower is in Paris."]}',
  durationMs: 1234,
};

describe("ZK proof generation", () => {
  it("generates a valid ZK proof with snarkjs", async () => {
    const binding = buildBinding(mockAttestation, "The Eiffel Tower is in Paris.", mockInference);

    const snarkjs = await import("snarkjs" as any);
    const { resolve } = await import("node:path");

    const wasmPath = resolve(process.cwd(), "circuits/build/claimCheckCommitmentV1_js/claimCheckCommitmentV1.wasm");
    const zkeyPath = resolve(process.cwd(), "circuits/build/claimCheckCommitmentV1_final.zkey");

    const witness = {
      modelDigest: toScalar(binding.modelDigest).toString(),
      attestationToken: toScalar(mockAttestation.attestationToken || "").toString(),
      claimHash: binding.claimHash,
      outputHash: binding.outputHash,
      nonce: toScalar(binding.nonce).toString(),
      claimedRoot: binding.payloadHash,
      timestampMin: "0",
      timestampMax: "0",
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, wasmPath, zkeyPath);

    expect(proof).toBeDefined();
    expect(proof.pi_a).toBeDefined();
    expect(proof.pi_b).toBeDefined();
    expect(proof.pi_c).toBeDefined();
    expect(publicSignals).toHaveLength(4);
    expect(publicSignals[0]).toBe(binding.payloadHash);
  }, 30000);
});
