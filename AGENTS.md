# AGENTS.md — example-claim-check

Local rules and reasoning map for the **Verifiable Claim-Check Assistant**: an
on-device Gemma 4 fact-check TUI with cryptographic model attestation, anchored
to the Lemma workers API.

This file is the SSoT for working in this repository. Read `README.md` for the
user-facing story and `docs/writeup.md` for the hackathon submission narrative.

## What this is

A standalone reference implementation (Apache-2.0). It binds an AI-generated
verdict to the *specific model that produced it*: if local model weights are
swapped, attestation fails visibly. It performs **edge proving** — Groth16
proof generation on-device via snarkjs (Poseidon-commitment circuit
`claimCheckCommitmentV1`) — and submits both the document binding and the proof
to the Lemma workers API. Runtime crypto dependencies are `@lemmaoracle/sdk`
(`toScalar`), `poseidon-lite` (`poseidon5`), and `snarkjs` (Groth16 `fullProve`).

## Commands

| Command          | Purpose                                             |
|:-----------------|:----------------------------------------------------|
| `pnpm dev`       | Launch the Ink TUI (`tsx src/cli.tsx`)              |
| `pnpm dev --claim "<text>"` | Run the pipeline non-interactively       |
| `pnpm dev --offline`        | Skip the Lemma submission step           |
| `pnpm dev -- --mode attribute` | Run the attribute (KYC) flow          |
| `pnpm dev -- --mode both --claim "<text>"` | Run both flows back-to-back  |
| `pnpm tamper` / `pnpm untamper` | Apply / restore the WOW-demo tamper (model mode default) |
| `pnpm tamper:attribute` / `pnpm tamper:both` | Tamper for attribute / both modes |
| `pnpm typecheck` | `tsc --noEmit`                                      |
| `pnpm test`      | `vitest run`                                        |
| `pnpm build`     | `tsc` → `dist/`                                     |

Requires Node ≥ 20, pnpm, and a local Ollama daemon with a pulled Gemma 4 tag.

## Pipelines

Two modes, one Lemma endpoint. Selected via `--mode` (default: `claim`).

### Claim mode (default)

```
Claim → Attest → Infer → Prove → Verdict
```

1. **Attest** (`src/attestation/verify.ts`) — reads the local model's manifest
   digest from Ollama `/api/tags` and compares it to
   `config/known-good-hashes.json`.
2. **Infer** (`src/inference/`) — runs Gemma 4 via Ollama `/api/generate`,
   JSON-constrained output.
3. **Prove** (`src/proof/submitToLemma`) — builds a Poseidon commitment
   (`poseidon5`) over the attestation digest, claim hash, output hash, and
   nonce; generates a Groth16 proof on-device via snarkjs; registers the
   binding as a Lemma document via `POST /v1/documents`; and submits the
   proof via `POST /v1/proofs`.

### Attribute mode (`--mode attribute`)

```
AttestAttr → VerifyAttr → ProveAttr → Verdict
```

1. **AttestAttr** (`src/attestation/attribute.ts`) — hashes the canonical
   credential payload for the attribute key and compares it to
   `config/known-good-attributes.json`. Ollama / Gemma 4 are **not** used.
2. **VerifyAttr** — checks `expiresAt` from the pinned entry (and would walk
   a revocation list in a real implementation; out of scope here).
3. **ProveAttr** (`src/proof/submitAttributeToLemma`) — same Poseidon-commitment
   binding and Groth16 proving as claim mode, registered with schema
   `passthrough-v1`.

### Both mode (`--mode both`)

Runs claim mode, then attribute mode, then renders the banner
`Same ZK primitive, different domain — AI trust & DeFi compliance, unified.`
between the two result panels.

## Module map

| Path                | Role                                                  |
|:--------------------|:------------------------------------------------------|
| `src/cli.tsx`       | Entry point. Imperative arg parsing (FP-exempt).      |
| `src/ui/`           | Ink TUI components.                                   |
| `src/ollama/`       | Ollama HTTP client — `/api/{tags,show,generate}`.     |
| `src/attestation/verify.ts`    | Model digest readback + known-good comparison. |
| `src/attestation/attribute.ts` | Attribute hash readback + verify (KYC mode). No Ollama. |
| `src/attestation/types.ts`     | Discriminated union `AttestationResult = Model | Attribute`. |
| `src/inference/`    | Gemma 4 claim-check prompting.                        |
| `src/proof/`        | Poseidon binding + snarkjs Groth16 proving + Lemma document/proof submission (both modes). |
| `src/sdk/`          | Thin Lemma API wrapper (fetch + types; also exports `submitProof`). |
| `src/attestation/hash.ts`    | SHA-256, canonicalise, nonce utilities.          |
| `scripts/tamper.ts` | WOW-demo helper — writes `.tamper-state.json` with `expectedDigestOverride` and/or `attributeHashOverride`. |
| `config/known-good-hashes.json` | Pinned model manifest digests.            |
| `config/known-good-attributes.json` | Pinned attribute credential hashes.   |

## Lemma API contract

The Lemma workers API is the SSoT for request shapes — see
`workers/packages/api/src/routes/`. Notes that are easy to get wrong:

- **Scope is derived server-side from the API key.** Do not send `X-Scope-Id`.
- `POST /v1/documents` requires `docHash, schema, cid, issuerId, subjectId,
  commitments, revocation`. `commitments.scheme` must be one of `poseidon`,
  `poseidon2`, `rescue-prime`, `sha256-placeholder` (this demo uses
  `poseidon`). Response: `{ status: "registered", docHash, ... }`.
- `POST /v1/proofs` submits a Groth16 proof generated on-device via snarkjs
  for the `claim-check-commitment-v1` circuit. The circuit must be
  registered with Lemma first (see `scripts/register-circuit.ts`).
- Both claim mode and attribute mode use `schema: "passthrough-v1"`. Both
  flows go through `registerBinding()` in `src/proof/index.ts` and produce
  identical document shapes (only `subjectId` and `commitments.leaves` differ).
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

- Training-data provenance — attestation covers weight integrity only.
- Source/corpus verification.
- Revocation lists for attribute mode — `verifyAttribute()` only checks
  `expiresAt`. A production implementation would walk the issuer's revocation
  registry; the demo skips it.
