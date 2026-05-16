import React from "react";
import { Box, Text } from "ink";
import type { PipelineState, Mode } from "./types.js";

type Verdict = Readonly<{
  badge: string;
  color: string;
  headline: string;
  kind: "verified" | "tampered" | "unverified" | "running";
}>;

const HASH_TAIL_LEN = 40;

/**
 * Hashes are presented with the leading `sha256:` and an ellipsis followed by
 * the *trailing* chars — the part that actually differs between two hashes.
 * Showing the prefix wastes screen width because every sha256 hex digest is
 * structurally identical at the head.
 */
const tail = (hash: string | null | undefined, len: number = HASH_TAIL_LEN): string => {
  if (hash === null || hash === undefined || hash.length === 0) return "(none pinned)";
  const [scheme, hex] = hash.includes(":") ? hash.split(":", 2) : ["sha256", hash];
  if ((hex ?? "").length <= len) return `${scheme}:${hex}`;
  return `${scheme}:…${(hex ?? "").slice(-len)}`;
};

const matchLine = (
  observed: string | null | undefined,
  expected: string | null | undefined,
): Readonly<{ text: string; color: string }> => {
  if (expected === null || expected === undefined || expected.length === 0) {
    return { text: "(no known-good pinned — cannot prove tampering)", color: "yellow" };
  }
  return observed === expected
    ? { text: "✅ identical → bytes match known-good attestation", color: "green" }
    : { text: "❌ MISMATCH → bytes differ from known-good attestation", color: "red" };
};

// --- Claim mode result -----------------------------------------------------

const computeClaimVerdict = (state: PipelineState): Verdict => {
  if (state.attest.status === "fail" && state.attestation?.verdict === "tampered") {
    return {
      badge: "✘ TAMPERED",
      color: "red",
      headline: "Model attestation FAILED — the local weights do not match the pinned digest.",
      kind: "tampered",
    };
  }
  if (state.attest.status === "fail" || (state.error !== undefined && state.proof === undefined)) {
    return {
      badge: "! UNVERIFIED",
      color: "yellow",
      headline: state.error ?? state.attestation?.reason ?? "Pipeline could not complete.",
      kind: "unverified",
    };
  }
  if (state.proof?.registered === true && state.inference?.verdict === "supported") {
    return {
      badge: "✔ VERIFIED — SUPPORTED",
      color: "green",
      headline: "Binding registered with Lemma. Claim is supported by the attested model.",
      kind: "verified",
    };
  }
  if (state.proof?.registered === true && state.inference?.verdict === "refuted") {
    return {
      badge: "✔ VERIFIED — REFUTED",
      color: "green",
      headline: "Binding registered with Lemma. Claim is refuted by the attested model.",
      kind: "verified",
    };
  }
  if (state.proof?.registered === true) {
    return {
      badge: "✔ VERIFIED — UNCERTAIN",
      color: "green",
      headline: "Binding registered with Lemma. Model could not confidently judge the claim.",
      kind: "verified",
    };
  }
  return { badge: "… IN PROGRESS", color: "cyan", headline: "Pipeline running.", kind: "running" };
};

const ClaimResult: React.FC<Readonly<{ state: PipelineState }>> = ({ state }) => {
  const verdict = computeClaimVerdict(state);
  const att = state.attestation;
  const inf = state.inference;
  const proof = state.proof;
  const match = att !== undefined ? matchLine(att.observedDigest, att.expectedDigest) : undefined;
  const showGenerated = inf !== undefined && verdict.kind === "verified";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={verdict.color} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={verdict.color}>
          {verdict.badge}
        </Text>
        <Text dimColor>  · Claim-check (AI trust)</Text>
      </Box>
      <Text color={verdict.color}>{verdict.headline}</Text>

      {showGenerated && inf !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Generated:</Text>
          <Text dimColor>  Model verdict : <Text color="white">{inf.verdict}</Text></Text>
          <Text dimColor>  Rationale     : <Text color="white">"{inf.rationale}"</Text></Text>
          {inf.subClaims.length > 0 && (
            <Box flexDirection="column">
              <Text dimColor>  Sub-claims    :</Text>
              {inf.subClaims.slice(0, 5).map((c, i) => (
                <Text key={i} dimColor>
                  {"    - "}
                  <Text color="white">{c}</Text>
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {att !== undefined && match !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={verdict.kind === "tampered" ? "red" : undefined}>
            {verdict.kind === "tampered" ? "Attestation FAILED:" : "Attestation:"}
          </Text>
          <Text dimColor>  Model         : <Text color="white">{att.modelTag}</Text></Text>
          <Text dimColor>  Observed hash : <Text color="white">{tail(att.observedDigest)}</Text></Text>
          <Text dimColor>  Expected hash : <Text color="white">{tail(att.expectedDigest)}</Text></Text>
          <Text dimColor>
            {"  Match         : "}
            <Text color={match.color}>{match.text}</Text>
          </Text>
        </Box>
      )}

      {verdict.kind === "tampered" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="red">Why this proves tampering:</Text>
          <Text dimColor>
            The model producing outputs on this machine has a different content
          </Text>
          <Text dimColor>
            hash than the one originally attested. Either the weights were
          </Text>
          <Text dimColor>
            modified after the known-good hash was recorded, or a different
          </Text>
          <Text dimColor>model version is running.</Text>
          <Box marginTop={1}>
            <Text color="yellow">Skipped: Infer, Prove (attestation is prerequisite)</Text>
          </Box>
        </Box>
      )}

      {proof !== undefined && verdict.kind === "verified" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Proof binding:</Text>
          <Text dimColor>  Lemma doc     : <Text color="white">{tail(proof.docHash)}</Text></Text>
          <Text dimColor>
            {"  Bound to      : "}
            <Text color="white">model digest + claim hash + output hash + nonce</Text>
          </Text>
          <Text dimColor>  Payload hash  : <Text color="white">{tail(proof.binding.payloadHash)}</Text></Text>
        </Box>
      )}
    </Box>
  );
};

// --- Attribute mode result -------------------------------------------------

const computeAttributeVerdict = (state: PipelineState): Verdict => {
  if (state.attestAttr.status === "fail" && state.attestationAttr?.verdict === "tampered") {
    return {
      badge: "✘ TAMPERED",
      color: "red",
      headline:
        "Attribute hash mismatch — held credential does not match the pinned issuer attestation.",
      kind: "tampered",
    };
  }
  if (
    state.attestAttr.status === "fail" ||
    state.verifyAttr.status === "fail" ||
    (state.error !== undefined && state.proofAttr === undefined)
  ) {
    return {
      badge: "! UNVERIFIED",
      color: "yellow",
      headline: state.error ?? state.attestationAttr?.reason ?? "Pipeline could not complete.",
      kind: "unverified",
    };
  }
  if (state.proofAttr?.registered === true) {
    return {
      badge: "✔ VERIFIED — ATTRIBUTE",
      color: "green",
      headline: "Binding registered with Lemma. KYC credential matches the issuer attestation.",
      kind: "verified",
    };
  }
  return { badge: "… IN PROGRESS", color: "cyan", headline: "Pipeline running.", kind: "running" };
};

const AttributeResult: React.FC<Readonly<{ state: PipelineState }>> = ({ state }) => {
  const verdict = computeAttributeVerdict(state);
  const att = state.attestationAttr;
  const verify = state.verifyResult;
  const proof = state.proofAttr;
  const match = att !== undefined ? matchLine(att.observedDigest, att.expectedDigest) : undefined;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={verdict.color} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={verdict.color}>
          {verdict.badge}
        </Text>
        <Text dimColor>  · Attribute proof (DeFi / KYC compliance)</Text>
      </Box>
      <Text color={verdict.color}>{verdict.headline}</Text>

      {att !== undefined && verdict.kind === "verified" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Credential:</Text>
          <Text dimColor>
            {"  Attribute     : "}
            <Text color="white">{att.label}</Text>
            <Text dimColor> ({att.attributeKey})</Text>
          </Text>
          <Text dimColor>  Issuer        : <Text color="white">{att.issuer}</Text></Text>
          {verify?.expiresAt !== undefined && verify.expiresAt !== null && (
            <Text dimColor>  Expires       : <Text color="white">{verify.expiresAt}</Text></Text>
          )}
        </Box>
      )}

      {att !== undefined && match !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={verdict.kind === "tampered" ? "red" : undefined}>
            {verdict.kind === "tampered" ? "Attestation FAILED:" : "Attestation:"}
          </Text>
          {verdict.kind === "tampered" && (
            <>
              <Text dimColor>  Attribute     : <Text color="white">{att.label}</Text></Text>
              <Text dimColor>  Issuer        : <Text color="white">{att.issuer}</Text></Text>
            </>
          )}
          <Text dimColor>  Observed hash : <Text color="white">{tail(att.observedDigest)}</Text></Text>
          <Text dimColor>  Expected hash : <Text color="white">{tail(att.expectedDigest)}</Text></Text>
          <Text dimColor>
            {"  Match         : "}
            <Text color={match.color}>{match.text}</Text>
          </Text>
        </Box>
      )}

      {verify !== undefined && verdict.kind === "verified" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Validity:</Text>
          <Text dimColor>
            {"  Expiry check  : "}
            <Text color={verify.ok ? "green" : "red"}>
              {verify.ok
                ? `✅ valid${verify.expiresAt !== undefined && verify.expiresAt !== null ? ` (expires ${verify.expiresAt})` : ""}`
                : "❌ invalid"}
            </Text>
          </Text>
        </Box>
      )}

      {verdict.kind === "tampered" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="red">Why this proves tampering:</Text>
          <Text dimColor>
            The credential presented by this holder produces a different hash
          </Text>
          <Text dimColor>
            than the one the issuer originally attested. Either the credential
          </Text>
          <Text dimColor>
            was modified, or a different (potentially fraudulent) credential is
          </Text>
          <Text dimColor>being presented.</Text>
          <Box marginTop={1}>
            <Text color="yellow">
              Skipped: VerifyAttr, ProveAttr (attestation is prerequisite)
            </Text>
          </Box>
        </Box>
      )}

      {proof !== undefined && verdict.kind === "verified" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Proof binding:</Text>
          <Text dimColor>  Lemma doc     : <Text color="white">{tail(proof.docHash)}</Text></Text>
          <Text dimColor>
            {"  Bound to      : "}
            <Text color="white">attribute digest + validity hash + nonce</Text>
          </Text>
          <Text dimColor>  Payload hash  : <Text color="white">{tail(proof.binding.payloadHash)}</Text></Text>
        </Box>
      )}
    </Box>
  );
};

// --- Top-level dispatcher --------------------------------------------------

type Props = Readonly<{
  mode: Mode;
  state: PipelineState;
}>;

export const Result: React.FC<Props> = ({ mode, state }) => {
  if (mode === "claim") {
    return <ClaimResult state={state} />;
  }
  if (mode === "attribute") {
    return <AttributeResult state={state} />;
  }
  return (
    <Box flexDirection="column">
      <ClaimResult state={state} />
      <Box marginY={1} paddingX={1}>
        <Text color="magentaBright">
          Same ZK primitive, different domain — AI trust &amp; DeFi compliance, unified.
        </Text>
      </Box>
      <AttributeResult state={state} />
    </Box>
  );
};
