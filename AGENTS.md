# AGENTS.md — example-claim-check

Local rules and reasoning map for the **Verifiable Claim-Check Assistant**: an
on-device Gemma 4 fact-check TUI with cryptographic model attestation, anchored
to the Lemma workers API.

This file is the SSoT for working in this repository. Read `README.md` for the
user-facing story and `docs/writeup.md` for the hackathon submission narrative.

## What this is

A standalone reference implementation (Apache-2.0). It binds an AI-generated
verdict to the *specific model that produced it*: if local model weights are
swapped, attestation fails visibly. It is **external-API-only** — it does not
import `@lemmaoracle/sdk` or any crypto package; all proof-side work is an HTTP
call to the Lemma workers API.

## Commands

| Command          | Purpose                                             |
|:-----------------|:----------------------------------------------------|
| `pnpm dev`       | Launch the Ink TUI (`tsx src/cli.tsx`)              |
| `pnpm dev --claim "<text>"` | Run the pipeline non-interactively       |
| `pnpm dev --offline`        | Skip the Lemma submission step           |
| `pnpm tamper` / `pnpm untamper` | Apply / restore the WOW-demo tamper  |
| `pnpm typecheck` | `tsc --noEmit`                                      |
| `pnpm test`      | `vitest run`                                        |
| `pnpm build`     | `tsc` → `dist/`                                     |

Requires Node ≥ 20, pnpm, and a local Ollama daemon with a pulled Gemma 4 tag.

## Pipeline

```
Claim → Attest → Infer → Prove → Verdict
```

1. **Attest** (`src/attestation/`) — reads the local model's manifest digest
   from Ollama `/api/tags` and compares it to `config/known-good-hashes.json`.
2. **Infer** (`src/inference/`) — runs Gemma 4 via Ollama `/api/generate`,
   JSON-constrained output.
3. **Prove** (`src/proof/`) — canonicalises a binding payload (model digest +
   claim + output + nonce + timestamp), hashes it, and registers it as a Lemma
   document via `POST /v1/documents`.

## Module map

| Path                | Role                                                  |
|:--------------------|:------------------------------------------------------|
| `src/cli.tsx`       | Entry point. Imperative arg parsing (FP-exempt).      |
| `src/ui/`           | Ink TUI components.                                   |
| `src/ollama/`       | Ollama HTTP client — `/api/{tags,show,generate}`.     |
| `src/attestation/`  | Digest readback + known-good comparison + tamper state.|
| `src/inference/`    | Gemma 4 claim-check prompting.                        |
| `src/proof/`        | Payload binding + Lemma document registration.        |
| `src/sdk/`          | Thin Lemma API wrapper (fetch + types only).          |
| `scripts/tamper.ts` | WOW-demo helper — writes `.tamper-state.json`.        |
| `config/known-good-hashes.json` | Pinned model manifest digests.            |

## Lemma API contract

The Lemma workers API is the SSoT for request shapes — see
`workers/packages/api/src/routes/`. Notes that are easy to get wrong:

- **Scope is derived server-side from the API key.** Do not send `X-Scope-Id`.
- `POST /v1/documents` requires `docHash, schema, cid, issuerId, subjectId,
  commitments, revocation`. `commitments.scheme` must be one of `poseidon`,
  `poseidon2`, `rescue-prime`, `sha256-placeholder` (this demo uses
  `sha256-placeholder`). Response: `{ status: "registered", docHash, ... }`.
- `POST /v1/proofs` requires a **registered ZK circuit** and a real proof, and
  verification is asynchronous. It is **out of scope** for this demo — the Prove
  step only registers the binding as a document.
- Base URL defaults to the public deployment (`https://workers.lemma.workers.dev`).
  Override with `LEMMA_API_BASE`. The Prove step needs `LEMMA_API_KEY`; without
  it, Attest and Infer still run and Prove reports a 401.

## Conventions

- TypeScript strict mode. ESM (`"type": "module"`) — imports use `.js` suffixes.
- Functional style: prefer pure functions, `const` arrows, `Readonly<>`,
  ternaries. Pragmatic exceptions exist (`let`/`try` in `verify.ts`, React
  hooks in `src/ui/`, imperative `cli.tsx`) — match the surrounding file.
- Tests are Vitest, co-located (`foo.ts` → `foo.test.ts`); FP rules are relaxed
  in tests.
- No marketing terms or buzzwords in code (10-year naming).

## Secrets

- Never commit credentials. `.env` / `.env.local` are gitignored; `.env.example`
  is the committed template.
- `LEMMA_API_KEY` belongs only in a local `.env`.

## Out of scope (see writeup)

- On-device ZK proving — not implemented; proofs are delegated to Lemma.
- Training-data provenance — attestation covers weight integrity only.
- Source/corpus verification.
