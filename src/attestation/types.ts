export type AttestationVerdict = "verified" | "tampered" | "unknown";

/**
 * Which subject the attestation event is about. The pipeline supports two
 * domains today; both share the same hash-compare verdict logic so the WOW
 * demo can show "AI trust" and "DeFi/KYC compliance" using one primitive.
 */
export type AttestationSubject = "model" | "attribute";

type CommonAttestationFields = Readonly<{
  verdict: AttestationVerdict;
  observedDigest: string;
  expectedDigest: string | null;
  /**
   * Token bound to the verified subject — passed to the proof step so the
   * binding is anchored to *this specific attestation event*. Empty when
   * the verdict is not "verified".
   */
  attestationToken: string;
  /** Human-readable reason for the verdict (shown in TUI). */
  reason: string;
}>;

export type ModelAttestationResult = CommonAttestationFields &
  Readonly<{
    type: "model";
    /** Ollama tag of the attested model, e.g. "gemma4:latest". */
    modelTag: string;
  }>;

export type AttributeAttestationResult = CommonAttestationFields &
  Readonly<{
    type: "attribute";
    /** Stable key of the attested attribute, e.g. "kyc-verified". */
    attributeKey: string;
    /** Human-readable label shown in the TUI. */
    label: string;
    /** Identifier of the credential issuer (compliance provider). */
    issuer: string;
  }>;

export type AttestationResult = ModelAttestationResult | AttributeAttestationResult;

/**
 * Return the identifier of the subject this attestation is about. Used by
 * the proof step to populate `subjectId` in the Lemma document registration.
 */
export const subjectIdOf = (a: AttestationResult): string =>
  a.type === "model" ? a.modelTag : a.attributeKey;

/** Render the subject as a short human-readable label for the TUI. */
export const subjectLabelOf = (a: AttestationResult): string =>
  a.type === "model" ? a.modelTag : a.label;

export type KnownGoodEntry = Readonly<{
  digest: string;
  description: string;
  addedAt: string;
}>;

export type KnownGoodTable = Readonly<{
  models: Readonly<Record<string, KnownGoodEntry>>;
}>;

export type KnownGoodAttributeEntry = Readonly<{
  hash: string;
  label: string;
  issuer: string;
  /** ISO 8601 expiry of the issuer attestation; checked by the Verify step. */
  expiresAt: string;
}>;

export type KnownGoodAttributeTable = Readonly<{
  attributes: Readonly<Record<string, KnownGoodAttributeEntry>>;
}>;

/**
 * Tamper state file shape. Each override field corresponds to one demo flow;
 * a single file can hold both so `--mode both` is supported.
 */
export type TamperState = Readonly<{
  /** Override expected model digest. Used by `attestModel`. */
  expectedDigestOverride?: string;
  /** Override expected attribute hash. Used by `attestAttribute`. */
  attributeHashOverride?: string;
  appliedAt?: string;
  note?: string;
}>;
