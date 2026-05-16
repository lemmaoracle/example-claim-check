import React from "react";
import { Box, Text } from "ink";
import type { PipelineState, Mode } from "./types.js";

type Verdict = Readonly<{
  badge: string;
  color: string;
  headline: string;
}>;

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);

// --- Claim mode result -----------------------------------------------------

const computeClaimVerdict = (state: PipelineState): Verdict => {
  if (state.attest.status === "fail" && state.attestation?.verdict === "tampered") {
    return {
      badge: "✘ TAMPERED",
      color: "red",
      headline: "Model attestation FAILED — the local weights do not match the pinned digest.",
    };
  }
  if (state.attest.status === "fail" || (state.error !== undefined && state.proof === undefined)) {
    return {
      badge: "! UNVERIFIED",
      color: "yellow",
      headline: state.error ?? state.attestation?.reason ?? "Pipeline could not complete.",
    };
  }
  if (state.proof?.registered === true && state.inference?.verdict === "supported") {
    return {
      badge: "✔ VERIFIED — SUPPORTED",
      color: "green",
      headline: "Binding registered with Lemma. Claim is supported by the attested model.",
    };
  }
  if (state.proof?.registered === true && state.inference?.verdict === "refuted") {
    return {
      badge: "✔ VERIFIED — REFUTED",
      color: "green",
      headline: "Binding registered with Lemma. Claim is refuted by the attested model.",
    };
  }
  if (state.proof?.registered === true) {
    return {
      badge: "✔ VERIFIED — UNCERTAIN",
      color: "green",
      headline: "Binding registered with Lemma. Model could not confidently judge the claim.",
    };
  }
  return { badge: "… IN PROGRESS", color: "cyan", headline: "Pipeline running." };
};

const ClaimResult: React.FC<Readonly<{ state: PipelineState }>> = ({ state }) => {
  const verdict = computeClaimVerdict(state);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={verdict.color} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={verdict.color}>
          {verdict.badge}
        </Text>
        <Text dimColor>  · Claim-check (AI trust)</Text>
      </Box>
      <Text color={verdict.color}>{verdict.headline}</Text>

      {state.attestation !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Model: <Text color="white">{state.attestation.modelTag}</Text></Text>
          <Text dimColor>
            Observed digest: <Text color="white">{truncate(state.attestation.observedDigest, 32)}</Text>
          </Text>
          <Text dimColor>
            Expected digest:{" "}
            <Text color="white">
              {state.attestation.expectedDigest ? truncate(state.attestation.expectedDigest, 32) : "(none pinned)"}
            </Text>
          </Text>
        </Box>
      )}

      {state.inference !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            Model verdict: <Text color="white">{state.inference.verdict}</Text>
          </Text>
          <Text dimColor>
            Rationale: <Text color="white">{state.inference.rationale}</Text>
          </Text>
          {state.inference.subClaims.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>Sub-claims:</Text>
              {state.inference.subClaims.slice(0, 5).map((c, i) => (
                <Text key={i} dimColor>
                  {" "}
                  - {c}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {state.proof !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            Lemma document: <Text color="white">{truncate(state.proof.docHash, 48)}</Text>
          </Text>
          <Text dimColor>
            Payload hash:   <Text color="white">{truncate(state.proof.binding.payloadHash, 48)}</Text>
          </Text>
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
      headline: "Attribute hash mismatch — held credential does not match the pinned issuer attestation.",
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
    };
  }
  if (state.proofAttr?.registered === true) {
    return {
      badge: "✔ VERIFIED — ATTRIBUTE",
      color: "green",
      headline: "Binding registered with Lemma. KYC credential matches the issuer attestation.",
    };
  }
  return { badge: "… IN PROGRESS", color: "cyan", headline: "Pipeline running." };
};

const AttributeResult: React.FC<Readonly<{ state: PipelineState }>> = ({ state }) => {
  const verdict = computeAttributeVerdict(state);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={verdict.color} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={verdict.color}>
          {verdict.badge}
        </Text>
        <Text dimColor>  · Attribute proof (DeFi / KYC compliance)</Text>
      </Box>
      <Text color={verdict.color}>{verdict.headline}</Text>

      {state.attestationAttr !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            Attribute: <Text color="white">{state.attestationAttr.label}</Text>{" "}
            <Text dimColor>({state.attestationAttr.attributeKey})</Text>
          </Text>
          <Text dimColor>
            Issuer: <Text color="white">{state.attestationAttr.issuer}</Text>
          </Text>
          <Text dimColor>
            Observed hash: <Text color="white">{truncate(state.attestationAttr.observedDigest, 32)}</Text>
          </Text>
          <Text dimColor>
            Expected hash:{" "}
            <Text color="white">
              {state.attestationAttr.expectedDigest
                ? truncate(state.attestationAttr.expectedDigest, 32)
                : "(none pinned)"}
            </Text>
          </Text>
        </Box>
      )}

      {state.verifyResult !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            Validity: <Text color="white">{state.verifyResult.ok ? "valid" : "invalid"}</Text>
          </Text>
          <Text dimColor>
            Expires:  <Text color="white">{state.verifyResult.expiresAt ?? "(unknown)"}</Text>
          </Text>
        </Box>
      )}

      {state.proofAttr !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            Lemma document: <Text color="white">{truncate(state.proofAttr.docHash, 48)}</Text>
          </Text>
          <Text dimColor>
            Payload hash:   <Text color="white">{truncate(state.proofAttr.binding.payloadHash, 48)}</Text>
          </Text>
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
