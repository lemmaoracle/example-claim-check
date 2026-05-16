#!/usr/bin/env node
/**
 * CLI entry point. Imperative pattern is fine here per project convention
 * (CLI entry files are exempt from the FP rule).
 */
import React from "react";
import { render } from "ink";
import { App } from "./ui/App.js";

type Args = Readonly<{
  claim?: string;
  apiBase?: string;
  apiKey?: string;
  model?: string;
  ollamaBaseUrl?: string;
  offline: boolean;
  help: boolean;
}>;

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  const out = {
    offline: false,
    help: false,
  } as { -readonly [K in keyof Args]: Args[K] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--offline") out.offline = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--claim") out.claim = argv[++i];
    else if (a === "--api-base") out.apiBase = argv[++i];
    else if (a === "--api-key") out.apiKey = argv[++i];
    else if (a === "--model") out.model = argv[++i];
    else if (a === "--ollama-base") out.ollamaBaseUrl = argv[++i];
  }
  return out;
};

const HELP = `Verifiable Claim-Check Assistant (Gemma 4 + Lemma)

Usage:
  claim-check                          launch the TUI
  claim-check --claim "<text>"         run pipeline non-interactively
  claim-check --offline                skip the Lemma proof submission

Options:
  --api-base <url>      Lemma workers base URL (default: LEMMA_API_BASE env or public deployment)
  --api-key <key>       Lemma API key (default: LEMMA_API_KEY env)
  --model <tag>         Ollama model tag (default: OLLAMA_MODEL env or gemma4:latest)
  --ollama-base <url>   Ollama base URL (default: OLLAMA_BASE_URL env or http://127.0.0.1:11434)

Demo flow:
  1. pnpm tamper           — apply a simulated supply-chain tamper
  2. pnpm dev              — observe the red ✘ TAMPERED verdict
  3. pnpm untamper         — restore trust
  4. pnpm dev              — observe the green ✔ VERIFIED verdict
`;

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  render(
    <App
      initialClaim={args.claim}
      apiBase={args.apiBase ?? process.env.LEMMA_API_BASE}
      apiKey={args.apiKey ?? process.env.LEMMA_API_KEY}
      model={args.model}
      ollamaBaseUrl={args.ollamaBaseUrl}
      offline={args.offline}
    />,
  );
};

main();
