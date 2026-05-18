#!/usr/bin/env node
/**
 * CLI entry point. Imperative pattern is fine here per project convention
 * (CLI entry files are exempt from the FP rule).
 */
import React from "react";
import { render } from "ink";
import { App } from "./ui/App.js";
import type { Mode } from "./ui/types.js";

type Args = Readonly<{
  mode: Mode;
  claim?: string;
  attribute: string;
  apiBase?: string;
  apiKey?: string;
  model?: string;
  ollamaBaseUrl?: string;
  offline: boolean;
  help: boolean;
}>;

const isMode = (s: string): s is Mode => s === "claim" || s === "attribute" || s === "both";

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  const out = {
    mode: "claim" as Mode,
    attribute: "kyc-verified",
    offline: false,
    help: false,
  } as { -readonly [K in keyof Args]: Args[K] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--offline") out.offline = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--claim") out.claim = argv[++i];
    else if (a === "--mode") {
      const v = argv[++i] ?? "";
      if (isMode(v)) out.mode = v;
    } else if (a === "--attribute") out.attribute = argv[++i] ?? out.attribute;
    else if (a === "--api-base") out.apiBase = argv[++i];
    else if (a === "--api-key") out.apiKey = argv[++i];
    else if (a === "--model") out.model = argv[++i];
    else if (a === "--ollama-base") out.ollamaBaseUrl = argv[++i];
  }
  return out;
};

const HELP = `Verifiable Claim-Check Assistant (Gemma 4 + Lemma)

Usage:
  claim-check                                launch the TUI in claim mode
  claim-check --mode attribute               run the attribute (KYC) flow
  claim-check --mode both --claim "<text>"   run both flows back-to-back
  claim-check --offline                      skip the Lemma submission step

Options:
  --mode <claim|attribute|both>   Pipeline to run (default: claim)
  --claim <text>                  Claim text for claim/both modes
  --attribute <key>               Attribute key for attribute/both modes (default: kyc-verified)
  --api-base <url>                Lemma workers base URL (default: LEMMA_API_BASE env or public deployment)
  --api-key <key>                 Lemma API key (default: LEMMA_API_KEY env)
  --model <tag>                   Ollama model tag (default: OLLAMA_MODEL env or gemma4:latest)
  --ollama-base <url>             Ollama base URL (default: OLLAMA_BASE_URL env or http://127.0.0.1:11434)

Demo flow (claim mode):
  1. pnpm tamper             — apply a simulated model supply-chain tamper
  2. pnpm dev                — observe the red ✘ TAMPERED verdict
  3. pnpm untamper           — restore trust
  4. pnpm dev                — observe the green ✔ VERIFIED verdict

Demo flow (attribute mode):
  1. pnpm dev -- --mode attribute             ✔ VERIFIED (KYC credential matches)
  2. pnpm tamper -- --mode attribute          rotate the expected attribute hash
  3. pnpm dev -- --mode attribute             ✘ TAMPERED (KYC credential mismatch)
  4. pnpm untamper                            restore trust

Demo flow (both mode):
  pnpm dev -- --mode both --claim "<text>"
    Runs the AI claim-check pipeline, then the KYC attribute pipeline, and
    surfaces the banner "Same ZK primitive, different domain — AI trust &
    DeFi compliance, unified." between the two verdicts.
`;

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  const instance = render(
    <App
      mode={args.mode}
      initialClaim={args.claim}
      attributeKey={args.attribute}
      apiBase={args.apiBase ?? process.env.LEMMA_API_BASE}
      apiKey={args.apiKey ?? process.env.LEMMA_API_KEY}
      model={args.model}
      ollamaBaseUrl={args.ollamaBaseUrl}
      offline={args.offline}
    />,
  );
  instance.waitUntilExit().then(() => process.exit(0));
};

main();
