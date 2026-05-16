/**
 * Proof binding step.
 *
 * Two flavours, one Lemma endpoint:
 *   - submitToLemma          — claim-check mode (model attestation + inference)
 *   - submitAttributeToLemma — attribute mode  (KYC / DeFi compliance)
 *
 * Both canonicalise a small payload that commits to the attestation digest,
 * the relevant domain-specific hash, a nonce, and a UTC timestamp; both hash
 * the canonical payload and register the result as a Lemma document via
 * POST /v1/documents. Per the writeup's "Edge proving is not yet implemented"
 * disclosure, the client performs only the binding hash and document
 * registration; full circuit proof generation is delegated to Lemma and is
 * out of scope for this reference implementation.
 */
import { canonicalize, randomNonce, sha256Hex, sha256Prefixed } from "../attestation/hash.js";
import { subjectIdOf } from "../attestation/types.js";
import { registerDocument, type LemmaClient } from "../sdk/index.js";
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

const CLAIM_SCHEMA_ID = "claim-check.v1";
const ATTRIBUTE_SCHEMA_ID = "attribute-check.v1";
const ISSUER_ID = "example-claim-check";

export const buildBinding = (
  attestation: ModelAttestationResult,
  claim: string,
  inference: InferenceResult,
): ProofBinding => {
  const claimHash = sha256Hex(claim);
  const outputHash = sha256Hex(
    canonicalize({ verdict: inference.verdict, rationale: inference.rationale }),
  );
  const nonce = randomNonce();
  const timestamp = new Date().toISOString();
  const payload = canonicalize({
    modelDigest: attestation.observedDigest,
    attestationToken: attestation.attestationToken,
    claimHash,
    outputHash,
    nonce,
    timestamp,
  });
  return {
    payloadHash: sha256Prefixed(payload),
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
  const payload = canonicalize({
    attributeKey: attestation.attributeKey,
    attributeDigest: attestation.observedDigest,
    attestationToken: attestation.attestationToken,
    issuer: attestation.issuer,
    nonce,
    timestamp,
  });
  return {
    payloadHash: sha256Prefixed(payload),
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
      scheme: "sha256-placeholder",
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
    leaves: [binding.modelDigest, binding.claimHash, binding.outputHash],
  });
  return { binding, ...reg };
};

export const submitAttributeToLemma = async (
  client: LemmaClient,
  attestation: AttributeAttestationResult,
  verify: AttributeVerifyResult,
): Promise<AttributeProofSubmission> => {
  const binding = buildAttributeBinding(attestation);
  const validityLeaf = sha256Hex(
    canonicalize({ ok: verify.ok, expiresAt: verify.expiresAt }),
  );
  const reg = await registerBinding(client, {
    schema: ATTRIBUTE_SCHEMA_ID,
    subjectId: subjectIdOf(attestation),
    payloadHash: binding.payloadHash,
    leaves: [binding.attributeDigest, validityLeaf],
  });
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
