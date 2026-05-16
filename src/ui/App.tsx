import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { attestModel, attestAttribute, verifyAttribute } from "../attestation/index.js";
import { runInference } from "../inference/index.js";
import { submitToLemma, submitAttributeToLemma } from "../proof/index.js";
import { createClient } from "../sdk/index.js";
import { createOllama } from "../ollama/index.js";
import { StepIndicator } from "./StepIndicator.js";
import { Result } from "./Result.js";
import {
  initialPipeline,
  type Mode,
  type PipelineState,
  type StepName,
  type StepState,
} from "./types.js";

type Phase = "input" | "running" | "done";

type Props = Readonly<{
  mode: Mode;
  initialClaim?: string;
  attributeKey?: string;
  apiBase?: string;
  apiKey?: string;
  model?: string;
  ollamaBaseUrl?: string;
  /** When true, skip the Lemma submission step (useful for offline demos). */
  offline?: boolean;
}>;

const setStep = (
  prev: PipelineState,
  name: StepName,
  patch: Partial<StepState>,
): PipelineState => {
  // Map kebab-case StepName -> camelCase state key for ergonomic lookup.
  const keyMap: Readonly<Record<StepName, keyof PipelineState>> = {
    attest: "attest",
    infer: "infer",
    prove: "prove",
    "attest-attr": "attestAttr",
    "verify-attr": "verifyAttr",
    "prove-attr": "proveAttr",
  };
  const key = keyMap[name];
  const current = prev[key] as StepState;
  return { ...prev, [key]: { ...current, ...patch } };
};

const needsClaimInput = (mode: Mode): boolean => mode === "claim" || mode === "both";
const runsClaim = (mode: Mode): boolean => mode === "claim" || mode === "both";
const runsAttribute = (mode: Mode): boolean => mode === "attribute" || mode === "both";

export const App: React.FC<Props> = ({
  mode,
  initialClaim,
  attributeKey = "kyc-verified",
  apiBase,
  apiKey,
  model,
  ollamaBaseUrl,
  offline,
}) => {
  const { exit } = useApp();
  const initialPhase: Phase =
    needsClaimInput(mode) && initialClaim === undefined ? "input" : "running";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [claim, setClaim] = useState<string>(initialClaim ?? "");
  const [draft, setDraft] = useState<string>("");
  const [pipeline, setPipeline] = useState<PipelineState>(initialPipeline);

  const runClaimFlow = useCallback(
    async (text: string): Promise<boolean> => {
      const ollama = createOllama({ baseUrl: ollamaBaseUrl, model });
      const lemma = createClient({ apiBase, apiKey });

      setPipeline((p) =>
        setStep(p, "attest", {
          status: "running",
          message: "Querying Ollama for model digest…",
          startedAt: Date.now(),
        }),
      );
      const attestation = await attestModel(ollama);
      setPipeline((p) => ({
        ...setStep(p, "attest", {
          status: attestation.verdict === "verified" ? "ok" : "fail",
          message:
            attestation.verdict === "verified"
              ? "Model digest matches pinned hash"
              : attestation.reason,
          finishedAt: Date.now(),
        }),
        attestation,
      }));
      if (attestation.verdict !== "verified") {
        setPipeline((p) => ({
          ...setStep(p, "infer", { status: "skipped", message: "Skipped — attestation failed" }),
          ...setStep(p, "prove", { status: "skipped", message: "Skipped — attestation failed" }),
        }));
        return false;
      }

      setPipeline((p) =>
        setStep(p, "infer", {
          status: "running",
          message: "Running Gemma 4 locally…",
          startedAt: Date.now(),
        }),
      );
      let inference;
      try {
        inference = await runInference(ollama, text);
      } catch (e) {
        setPipeline((p) => ({
          ...setStep(p, "infer", {
            status: "fail",
            message: (e as Error).message,
            finishedAt: Date.now(),
          }),
          ...setStep(p, "prove", { status: "skipped", message: "Skipped — inference failed" }),
          error: (e as Error).message,
        }));
        return false;
      }
      setPipeline((p) => ({
        ...setStep(p, "infer", {
          status: "ok",
          message: `Verdict: ${inference!.verdict}`,
          finishedAt: Date.now(),
        }),
        inference,
      }));

      if (offline) {
        setPipeline((p) =>
          setStep(p, "prove", { status: "skipped", message: "Offline mode — proof submission skipped" }),
        );
        return true;
      }
      setPipeline((p) =>
        setStep(p, "prove", {
          status: "running",
          message: "Binding output and submitting to Lemma…",
          startedAt: Date.now(),
        }),
      );
      try {
        const proof = await submitToLemma(lemma, attestation, text, inference);
        setPipeline((p) => ({
          ...setStep(p, "prove", {
            status: proof.registered ? "ok" : "fail",
            message: proof.reason,
            finishedAt: Date.now(),
          }),
          proof,
        }));
        return proof.registered;
      } catch (e) {
        setPipeline((p) => ({
          ...setStep(p, "prove", {
            status: "fail",
            message: (e as Error).message,
            finishedAt: Date.now(),
          }),
          error: (e as Error).message,
        }));
        return false;
      }
    },
    [apiBase, apiKey, model, offline, ollamaBaseUrl],
  );

  const runAttributeFlow = useCallback(
    async (key: string): Promise<boolean> => {
      const lemma = createClient({ apiBase, apiKey });

      setPipeline((p) =>
        setStep(p, "attest-attr", {
          status: "running",
          message: "Hashing held credential and comparing to pinned issuer attestation…",
          startedAt: Date.now(),
        }),
      );
      const attestation = await attestAttribute(key);
      setPipeline((p) => ({
        ...setStep(p, "attest-attr", {
          status: attestation.verdict === "verified" ? "ok" : "fail",
          message:
            attestation.verdict === "verified"
              ? `Attribute hash matches (${attestation.label})`
              : attestation.reason,
          finishedAt: Date.now(),
        }),
        attestationAttr: attestation,
      }));
      if (attestation.verdict !== "verified") {
        setPipeline((p) => ({
          ...setStep(p, "verify-attr", {
            status: "skipped",
            message: "Skipped — attestation failed",
          }),
          ...setStep(p, "prove-attr", { status: "skipped", message: "Skipped — attestation failed" }),
        }));
        return false;
      }

      setPipeline((p) =>
        setStep(p, "verify-attr", {
          status: "running",
          message: "Checking credential validity (expiry, revocation)…",
          startedAt: Date.now(),
        }),
      );
      const verifyResult = await verifyAttribute(key);
      setPipeline((p) => ({
        ...setStep(p, "verify-attr", {
          status: verifyResult.ok ? "ok" : "fail",
          message: verifyResult.reason,
          finishedAt: Date.now(),
        }),
        verifyResult,
      }));
      if (!verifyResult.ok) {
        setPipeline((p) =>
          setStep(p, "prove-attr", { status: "skipped", message: "Skipped — credential invalid" }),
        );
        return false;
      }

      if (offline) {
        setPipeline((p) =>
          setStep(p, "prove-attr", {
            status: "skipped",
            message: "Offline mode — proof submission skipped",
          }),
        );
        return true;
      }
      setPipeline((p) =>
        setStep(p, "prove-attr", {
          status: "running",
          message: "Binding attribute proof and submitting to Lemma…",
          startedAt: Date.now(),
        }),
      );
      try {
        const proof = await submitAttributeToLemma(lemma, attestation, verifyResult);
        setPipeline((p) => ({
          ...setStep(p, "prove-attr", {
            status: proof.registered ? "ok" : "fail",
            message: proof.reason,
            finishedAt: Date.now(),
          }),
          proofAttr: proof,
        }));
        return proof.registered;
      } catch (e) {
        setPipeline((p) => ({
          ...setStep(p, "prove-attr", {
            status: "fail",
            message: (e as Error).message,
            finishedAt: Date.now(),
          }),
          error: (e as Error).message,
        }));
        return false;
      }
    },
    [apiBase, apiKey, offline],
  );

  const runPipeline = useCallback(
    async (text: string) => {
      if (runsClaim(mode)) {
        await runClaimFlow(text);
      }
      if (runsAttribute(mode)) {
        await runAttributeFlow(attributeKey);
      }
      setPhase("done");
    },
    [mode, attributeKey, runClaimFlow, runAttributeFlow],
  );

  useEffect(() => {
    if (phase === "running") {
      void runPipeline(claim);
    }
  }, [phase, claim, runPipeline]);

  useInput((input, key) => {
    if (phase === "done") {
      if (input === "q" || key.escape) exit();
      if (input === "n") {
        setPipeline(initialPipeline);
        setDraft("");
        setClaim("");
        setPhase(needsClaimInput(mode) ? "input" : "running");
      }
    }
  });

  const onSubmit = (value: string): void => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    setClaim(trimmed);
    setPhase("running");
  };

  const subtitleByMode: Record<Mode, string> = {
    claim: " · Gemma 4 + Lemma BBS+ attestation",
    attribute: " · KYC / DeFi compliance via Lemma BBS+ attribute proofs",
    both: " · One ZK primitive — AI trust + DeFi compliance",
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="magentaBright">
          Verifiable Claim-Check Assistant
        </Text>
        <Text dimColor>{subtitleByMode[mode]}</Text>
      </Box>

      {phase === "input" && (
        <Box flexDirection="column">
          <Text>Enter a claim to fact-check:</Text>
          <Box>
            <Text color="cyan">› </Text>
            <TextInput value={draft} onChange={setDraft} onSubmit={onSubmit} />
          </Box>
          <Text dimColor>(Enter to run · Ctrl+C to quit)</Text>
        </Box>
      )}

      {phase !== "input" && (
        <Box flexDirection="column">
          {runsClaim(mode) && (
            <Box marginBottom={1}>
              <Text dimColor>Claim: </Text>
              <Text color="white">{claim}</Text>
            </Box>
          )}
          {runsAttribute(mode) && (
            <Box marginBottom={1}>
              <Text dimColor>Attribute: </Text>
              <Text color="white">{attributeKey}</Text>
            </Box>
          )}
          {runsClaim(mode) && (
            <Box flexDirection="column" marginBottom={1}>
              <StepIndicator label="Attest" state={pipeline.attest} />
              <StepIndicator label="Infer" state={pipeline.infer} />
              <StepIndicator label="Prove" state={pipeline.prove} />
            </Box>
          )}
          {runsAttribute(mode) && (
            <Box flexDirection="column" marginBottom={1}>
              <StepIndicator label="AttestAttr" state={pipeline.attestAttr} />
              <StepIndicator label="VerifyAttr" state={pipeline.verifyAttr} />
              <StepIndicator label="ProveAttr" state={pipeline.proveAttr} />
            </Box>
          )}
        </Box>
      )}

      {phase === "done" && (
        <Box flexDirection="column" marginTop={1}>
          <Result mode={mode} state={pipeline} />
          <Box marginTop={1}>
            <Text dimColor>Press </Text>
            <Text>n</Text>
            <Text dimColor> for a new run · </Text>
            <Text>q</Text>
            <Text dimColor> to quit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
