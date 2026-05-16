export type AttestationVerdict = "verified" | "tampered" | "unknown";

export type AttestationResult = Readonly<{
  verdict: AttestationVerdict;
  modelTag: string;
  observedDigest: string;
  expectedDigest: string | null;
  /**
   * Token bound to the verified model — passed to the proof step so the proof
   * is anchored to *this specific attestation event*. Empty when tampered.
   */
  attestationToken: string;
  /** Human-readable reason for the verdict (shown in TUI). */
  reason: string;
}>;

export type KnownGoodEntry = Readonly<{
  digest: string;
  description: string;
  addedAt: string;
}>;

export type KnownGoodTable = Readonly<{
  models: Readonly<Record<string, KnownGoodEntry>>;
}>;
