/**
 * Proof binding step.
 *
 * Two flavours, one Lemma endpoint:
 *   - submitToLemma          — claim-check mode (model attestation + inference)
 *   - submitAttributeToLemma — attribute mode  (KYC / DeFi compliance)
 *
 * Both build a Poseidon commitment root (`poseidon5`) over the attestation
 * digest, domain-specific hashes, and a nonce; generate a Groth16 zero-knowledge
 * proof on-device via snarkjs (circuit `claimCheckCommitmentV1`); register the
 * binding as a Lemma document via `POST /v1/documents`; and submit the proof
 * via `POST /v1/proofs`. If the compiled circuit artifacts are missing, proof
 * submission is skipped gracefully with a console warning.
 */
import { canonicalize, randomNonce, sha256Hex, sha256Prefixed } from "../attestation/hash.js";
import { subjectIdOf } from "../attestation/types.js";
import { registerDocument, submitProof, type LemmaClient } from "../sdk/index.js";
import { toScalar } from "@lemmaoracle/sdk";
import { poseidon5 } from "poseidon-lite";
import type { InferenceResult } from "../inference/index.js";
import type {
  AttestationResult,
  AttributeAttestationResult,
  ModelAttestationResult,
} from "../attestation/types.js";
import type { AttributeVerifyResult } from "../attestation/attribute.js";

export type ProofBinding = Readonly<{
  payloadHash: string;
  modelDigest: string;
  claimHash: string;
  outputHash: string;
  nonce: string;
  timestamp: string;
}>;

export type AttributeProofBinding = Readonly<{
  payloadHash: string;
  attributeKey: string;
  attributeDigest: string;
  nonce: string;
  timestamp: string;
}>;

export type ProofSubmission = Readonly<{
  binding: ProofBinding;
  docHash: string;
  registered: boolean;
  hooksQueued: number;
  reason: string;
}>;

export type AttributeProofSubmission = Readonly<{
  binding: AttributeProofBinding;
  docHash: string;
  registered: boolean;
  hooksQueued: number;
  reason: string;
}>;

const CLAIM_SCHEMA_ID = "passthrough-v1";
const ATTRIBUTE_SCHEMA_ID = "passthrough-v1";
const ISSUER_ID = "example-claim-check";

export const buildBinding = (
  attestation: ModelAttestationResult,
  claim: string,
  inference: InferenceResult,
): ProofBinding => {
  const claimHashScalar = toScalar(claim);
  const claimHash = claimHashScalar.toString();
  const outputHashScalar = toScalar(canonicalize({ verdict: inference.verdict, rationale: inference.rationale }));
  const outputHash = outputHashScalar.toString();
  const nonce = randomNonce();
  const timestamp = new Date().toISOString();

  const payloadHash = poseidon5([
    toScalar(attestation.observedDigest),
    toScalar(attestation.attestationToken || ""),
    claimHashScalar,
    outputHashScalar,
    toScalar(nonce),
  ]).toString();

  return {
    payloadHash,
    modelDigest: attestation.observedDigest,
    claimHash,
    outputHash,
    nonce,
    timestamp,
  };
};

export const buildAttributeBinding = (
  attestation: AttributeAttestationResult,
): AttributeProofBinding => {
  const nonce = randomNonce();
  const timestamp = new Date().toISOString();

  const payloadHash = poseidon5([
    toScalar(attestation.attributeKey),
    toScalar(attestation.observedDigest),
    toScalar(attestation.attestationToken || ""),
    toScalar(attestation.issuer),
    toScalar(nonce),
  ]).toString();

  return {
    payloadHash,
    attributeKey: attestation.attributeKey,
    attributeDigest: attestation.observedDigest,
    nonce,
    timestamp,
  };
};

/** Lemma document submission shared between modes. */
const registerBinding = async (
  client: LemmaClient,
  args: Readonly<{
    schema: string;
    subjectId: string;
    payloadHash: string;
    leaves: ReadonlyArray<string>;
  }>,
): Promise<Readonly<{ docHash: string; registered: boolean; hooksQueued: number; reason: string }>> => {
  const res = await registerDocument(client, {
    docHash: args.payloadHash,
    schema: args.schema,
    cid: args.payloadHash,
    issuerId: ISSUER_ID,
    subjectId: args.subjectId,
    commitments: {
      scheme: "poseidon",
      root: args.payloadHash,
      leaves: args.leaves,
    },
    revocation: {},
  });
  const registered = res.status === "registered";
  return {
    docHash: res.docHash,
    registered,
    hooksQueued: res.hooksQueued ?? 0,
    reason: registered
      ? "Binding registered as a Lemma document."
      : `Lemma did not register the document (status: ${res.status}).`,
  };
};

export const submitToLemma = async (
  client: LemmaClient,
  attestation: ModelAttestationResult,
  claim: string,
  inference: InferenceResult,
): Promise<ProofSubmission> => {
  const binding = buildBinding(attestation, claim, inference);
  const reg = await registerBinding(client, {
    schema: CLAIM_SCHEMA_ID,
    subjectId: subjectIdOf(attestation),
    payloadHash: binding.payloadHash,
    leaves: [toScalar(binding.modelDigest).toString(), binding.claimHash, binding.outputHash],
  });
  
  if (reg.registered) {
    const witness = {
      modelDigest: toScalar(binding.modelDigest).toString(),
      attestationToken: toScalar(attestation.attestationToken || "").toString(),
      claimHash: binding.claimHash,
      outputHash: binding.outputHash,
      nonce: toScalar(binding.nonce).toString(),
      claimedRoot: binding.payloadHash,
      timestampMin: "0",
      timestampMax: "0",
    };

    // Generate actual ZK proof with snarkjs
    try {
      const snarkjs = await import("snarkjs" as any);
      const { resolve } = await import("node:path");

      const wasmPath = resolve(process.cwd(), "circuits/build/claimCheckCommitmentV1_js/claimCheckCommitmentV1.wasm");
      const zkeyPath = resolve(process.cwd(), "circuits/build/claimCheckCommitmentV1_final.zkey");

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, wasmPath, zkeyPath);

      await submitProof(client, {
        docHash: binding.payloadHash,
        circuitId: "claim-check-commitment-v1",
        proof: Buffer.from(JSON.stringify(proof)).toString("base64"),
        inputs: publicSignals,
      });
    } catch (e) {
      console.warn("Failed to submit proof:", e);
    }
  }

  return { binding, ...reg };
};

export const submitAttributeToLemma = async (
  client: LemmaClient,
  attestation: AttributeAttestationResult,
  verify: AttributeVerifyResult,
): Promise<AttributeProofSubmission> => {
  const binding = buildAttributeBinding(attestation);
  const validityLeaf = toScalar(
    canonicalize({ ok: verify.ok, expiresAt: verify.expiresAt }),
  ).toString();
  const reg = await registerBinding(client, {
    schema: ATTRIBUTE_SCHEMA_ID,
    subjectId: subjectIdOf(attestation),
    payloadHash: binding.payloadHash,
    leaves: [toScalar(binding.attributeDigest).toString(), validityLeaf],
  });
  
  if (reg.registered) {
    const witness = {
      modelDigest: toScalar(binding.attributeKey).toString(),
      attestationToken: toScalar(attestation.observedDigest).toString(),
      claimHash: toScalar(attestation.attestationToken || "").toString(),
      outputHash: toScalar(attestation.issuer).toString(),
      nonce: toScalar(binding.nonce).toString(),
      claimedRoot: binding.payloadHash,
      timestampMin: "0",
      timestampMax: "0",
    };

    try {
      const snarkjs = await import("snarkjs" as any);
      const { resolve } = await import("node:path");

      const wasmPath = resolve(process.cwd(), "circuits/build/claimCheckCommitmentV1_js/claimCheckCommitmentV1.wasm");
      const zkeyPath = resolve(process.cwd(), "circuits/build/claimCheckCommitmentV1_final.zkey");

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, wasmPath, zkeyPath);

      await submitProof(client, {
        docHash: binding.payloadHash,
        circuitId: "claim-check-commitment-v1",
        proof: Buffer.from(JSON.stringify(proof)).toString("base64"),
        inputs: publicSignals,
      });
    } catch (e) {
      console.warn("Failed to submit attribute proof:", e);
    }
  }
  
  return { binding, ...reg };
};

/**
 * Tagged union returned to the UI so a single state slot can hold either
 * domain's proof submission.
 */
export type AnyProofSubmission =
  | Readonly<{ type: "model"; value: ProofSubmission }>
  | Readonly<{ type: "attribute"; value: AttributeProofSubmission }>;

/** Type guard for callers that hold the parent attestation already. */
export const proofMatches = (
  attestation: AttestationResult,
  proof: AnyProofSubmission,
): boolean => attestation.type === proof.type;
