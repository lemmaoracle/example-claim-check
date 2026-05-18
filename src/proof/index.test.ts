import { describe, it, expect } from "vitest";
import { buildBinding, buildAttributeBinding } from "../proof/index.js";

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

describe("buildBinding", () => {
  it("produces deterministic claimHash and outputHash for same inputs", () => {
    const b1 = buildBinding(mockAttestation, "The Eiffel Tower is in Paris.", mockInference);
    const b2 = buildBinding(mockAttestation, "The Eiffel Tower is in Paris.", mockInference);
    expect(b1.claimHash).toBe(b2.claimHash);
    expect(b1.outputHash).toBe(b2.outputHash);
    expect(b1.modelDigest).toBe(b2.modelDigest);
  });

  it("changes claimHash when claim changes", () => {
    const b1 = buildBinding(mockAttestation, "The Eiffel Tower is in Paris.", mockInference);
    const b2 = buildBinding(mockAttestation, "The Eiffel Tower is in London.", mockInference);
    expect(b1.claimHash).not.toBe(b2.claimHash);
    expect(b1.outputHash).toBe(b2.outputHash);
  });

  it("changes payloadHash when attestationToken changes", () => {
    const b1 = buildBinding(mockAttestation, "The Eiffel Tower is in Paris.", mockInference);
    const b2 = buildBinding(
      { ...mockAttestation, attestationToken: "different" },
      "The Eiffel Tower is in Paris.",
      mockInference,
    );
    expect(b1.claimHash).toBe(b2.claimHash);
    expect(b1.outputHash).toBe(b2.outputHash);
    expect(b1.modelDigest).toBe(b2.modelDigest);
    expect(b1.payloadHash).not.toBe(b2.payloadHash);
  });

  it("produces a valid-looking payloadHash (numeric string)", () => {
    const b = buildBinding(mockAttestation, "The Eiffel Tower is in Paris.", mockInference);
    expect(/^\d+$/.test(b.payloadHash)).toBe(true);
    expect(BigInt(b.payloadHash) > 0n).toBe(true);
  });
});

describe("buildAttributeBinding", () => {
  const mockAttr = {
    type: "attribute" as const,
    verdict: "verified" as const,
    attributeKey: "kyc-verified",
    observedDigest: "sha256-abc123",
    expectedDigest: "sha256-abc123",
    attestationToken: "",
    issuer: "example-issuer",
    label: "KYC Verified",
    reason: "",
  };

  it("produces deterministic attributeDigest for same inputs", () => {
    const b1 = buildAttributeBinding(mockAttr);
    const b2 = buildAttributeBinding(mockAttr);
    expect(b1.attributeDigest).toBe(b2.attributeDigest);
    expect(b1.attributeKey).toBe(b2.attributeKey);
  });

  it("produces a valid-looking payloadHash (numeric string)", () => {
    const b = buildAttributeBinding(mockAttr);
    expect(/^\d+$/.test(b.payloadHash)).toBe(true);
    expect(BigInt(b.payloadHash) > 0n).toBe(true);
  });
});
