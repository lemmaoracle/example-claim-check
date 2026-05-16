/**
 * Proof binding step.
 *
 * For the demo we construct a payload that commits to:
 *   - the attested model digest (so a different model breaks the binding),
 *   - the claim text,
 *   - the inference output (verdict + rationale),
 *   - a UTC timestamp,
 *   - a fresh nonce.
 *
 * The canonicalized payload hash is registered as a Lemma document via
 * POST /v1/documents. Per the writeup's "Edge proving is not yet implemented"
 * disclosure, the client performs only the binding hash and document
 * registration; full circuit proof generation is delegated to Lemma and is
 * out of scope for this reference implementation.
 */
import { canonicalize, randomNonce, sha256Hex, sha256Prefixed } from "../attestation/hash.js";
import { registerDocument, type LemmaClient } from "../sdk/index.js";
import type { InferenceResult } from "../inference/index.js";
import type { AttestationResult } from "../attestation/types.js";

export type ProofBinding = Readonly<{
  payloadHash: string;
  modelDigest: string;
  claimHash: string;
  outputHash: string;
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

const SCHEMA_ID = "claim-check.v1";
const ISSUER_ID = "example-claim-check";

export const buildBinding = (
  attestation: AttestationResult,
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

export const submitToLemma = async (
  client: LemmaClient,
  attestation: AttestationResult,
  claim: string,
  inference: InferenceResult,
): Promise<ProofSubmission> => {
  const binding = buildBinding(attestation, claim, inference);

  const res = await registerDocument(client, {
    docHash: binding.payloadHash,
    schema: SCHEMA_ID,
    // No off-chain blob is pinned: the document is fully described by its
    // content hash, so the payload hash doubles as the content identifier.
    cid: binding.payloadHash,
    issuerId: ISSUER_ID,
    subjectId: attestation.modelTag,
    commitments: {
      scheme: "sha256-placeholder",
      root: binding.payloadHash,
      leaves: [binding.modelDigest, binding.claimHash, binding.outputHash],
    },
    revocation: {},
  });

  const registered = res.status === "registered";
  return {
    binding,
    docHash: res.docHash,
    registered,
    hooksQueued: res.hooksQueued ?? 0,
    reason: registered
      ? "Claim-check binding registered as a Lemma document."
      : `Lemma did not register the document (status: ${res.status}).`,
  };
};
