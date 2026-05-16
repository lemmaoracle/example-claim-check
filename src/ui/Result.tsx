import React from "react";
import { Box, Text } from "ink";
import type { PipelineState } from "./types.js";

type Props = Readonly<{
  state: PipelineState;
}>;

type Verdict = Readonly<{
  badge: string;
  color: string;
  headline: string;
}>;

const computeVerdict = (state: PipelineState): Verdict => {
  if (state.attest.status === "fail" && state.attestation?.verdict === "tampered") {
    return {
      badge: "✘ TAMPERED",
      color: "red",
      headline: "Model attestation FAILED — the local weights do not match the pinned digest.",
    };
  }
  if (state.error !== undefined || state.attest.status === "fail") {
    return {
      badge: "! UNVERIFIED",
      color: "yellow",
      headline: state.error ?? state.attestation?.reason ?? "Pipeline could not complete.",
    };
  }
  if (state.proof?.registered === true && state.inference?.verdict === "supported") {
    return { badge: "✔ VERIFIED — SUPPORTED", color: "green", headline: "Binding registered with Lemma. Claim is supported by the attested model." };
  }
  if (state.proof?.registered === true && state.inference?.verdict === "refuted") {
    return { badge: "✔ VERIFIED — REFUTED", color: "green", headline: "Binding registered with Lemma. Claim is refuted by the attested model." };
  }
  if (state.proof?.registered === true) {
    return { badge: "✔ VERIFIED — UNCERTAIN", color: "green", headline: "Binding registered with Lemma. Model could not confidently judge the claim." };
  }
  return {
    badge: "… IN PROGRESS",
    color: "cyan",
    headline: "Pipeline running.",
  };
};

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export const Result: React.FC<Props> = ({ state }) => {
  const verdict = computeVerdict(state);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={verdict.color} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={verdict.color}>
          {verdict.badge}
        </Text>
      </Box>
      <Text color={verdict.color}>{verdict.headline}</Text>

      {state.attestation !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Model: <Text color="white">{state.attestation.modelTag}</Text></Text>
          <Text dimColor>Observed digest: <Text color="white">{truncate(state.attestation.observedDigest, 32)}</Text></Text>
          <Text dimColor>Expected digest: <Text color="white">{state.attestation.expectedDigest ? truncate(state.attestation.expectedDigest, 32) : "(none pinned)"}</Text></Text>
        </Box>
      )}

      {state.inference !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Model verdict: <Text color="white">{state.inference.verdict}</Text></Text>
          <Text dimColor>Rationale: <Text color="white">{state.inference.rationale}</Text></Text>
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
          <Text dimColor>Lemma document: <Text color="white">{truncate(state.proof.docHash, 48)}</Text></Text>
          <Text dimColor>Payload hash:   <Text color="white">{truncate(state.proof.binding.payloadHash, 48)}</Text></Text>
        </Box>
      )}
    </Box>
  );
};
