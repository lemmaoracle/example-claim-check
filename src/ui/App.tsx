import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { attestModel } from "../attestation/index.js";
import { runInference } from "../inference/index.js";
import { submitToLemma } from "../proof/index.js";
import { createClient } from "../sdk/index.js";
import { createOllama } from "../ollama/index.js";
import { StepIndicator } from "./StepIndicator.js";
import { Result } from "./Result.js";
import { initialPipeline, type PipelineState, type StepName, type StepState } from "./types.js";

type Phase = "input" | "running" | "done";

type Props = Readonly<{
  initialClaim?: string;
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
): PipelineState => ({
  ...prev,
  [name]: { ...prev[name], ...patch },
});

export const App: React.FC<Props> = ({
  initialClaim,
  apiBase,
  apiKey,
  model,
  ollamaBaseUrl,
  offline,
}) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>(initialClaim ? "running" : "input");
  const [claim, setClaim] = useState<string>(initialClaim ?? "");
  const [draft, setDraft] = useState<string>("");
  const [pipeline, setPipeline] = useState<PipelineState>(initialPipeline);

  const runPipeline = useCallback(
    async (text: string) => {
      const ollama = createOllama({ baseUrl: ollamaBaseUrl, model });
      const lemma = createClient({ apiBase, apiKey });

      // Step 1: attestation
      setPipeline((p) =>
        setStep(p, "attest", { status: "running", message: "Querying Ollama for model digest…", startedAt: Date.now() }),
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
          ...{},
          ...setStep(p, "prove", { status: "skipped", message: "Skipped — attestation failed" }),
        }));
        setPhase("done");
        return;
      }

      // Step 2: inference
      setPipeline((p) =>
        setStep(p, "infer", { status: "running", message: "Running Gemma 4 locally…", startedAt: Date.now() }),
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
        setPhase("done");
        return;
      }
      setPipeline((p) => ({
        ...setStep(p, "infer", {
          status: "ok",
          message: `Verdict: ${inference!.verdict}`,
          finishedAt: Date.now(),
        }),
        inference,
      }));

      // Step 3: proof submission
      if (offline) {
        setPipeline((p) =>
          setStep(p, "prove", { status: "skipped", message: "Offline mode — proof submission skipped" }),
        );
        setPhase("done");
        return;
      }
      setPipeline((p) =>
        setStep(p, "prove", { status: "running", message: "Binding output and submitting to Lemma…", startedAt: Date.now() }),
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
      } catch (e) {
        setPipeline((p) => ({
          ...setStep(p, "prove", {
            status: "fail",
            message: (e as Error).message,
            finishedAt: Date.now(),
          }),
          error: (e as Error).message,
        }));
      }
      setPhase("done");
    },
    [apiBase, apiKey, model, offline, ollamaBaseUrl],
  );

  useEffect(() => {
    if (phase === "running" && claim.length > 0) {
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
        setPhase("input");
      }
    }
  });

  const onSubmit = (value: string): void => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    setClaim(trimmed);
    setPhase("running");
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="magentaBright">
          Verifiable Claim-Check Assistant
        </Text>
        <Text dimColor>  · Gemma 4 + Lemma BBS+ attestation</Text>
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
          <Box marginBottom={1}>
            <Text dimColor>Claim: </Text>
            <Text color="white">{claim}</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <StepIndicator label="Attest" state={pipeline.attest} />
            <StepIndicator label="Infer" state={pipeline.infer} />
            <StepIndicator label="Prove" state={pipeline.prove} />
          </Box>
        </Box>
      )}

      {phase === "done" && (
        <Box flexDirection="column" marginTop={1}>
          <Result state={pipeline} />
          <Box marginTop={1}>
            <Text dimColor>Press </Text>
            <Text>n</Text>
            <Text dimColor> for a new claim · </Text>
            <Text>q</Text>
            <Text dimColor> to quit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
