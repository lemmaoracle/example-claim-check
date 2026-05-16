# example-claim-check

**Verifiable Claim-Check Assistant** — on-device Gemma 4 inference with cryptographic model attestation via [Lemma](https://github.com/frame-00/lemma).

A reference implementation that demonstrates how to bind an AI-generated verdict to the *specific model that produced it*. If the local model weights are swapped out — even subtly — the cryptographic proof breaks immediately and visibly.

The same primitive runs a **second mode**: attribute attestation for KYC / DeFi compliance. The TUI ships with `--mode attribute` and `--mode both`, so the demo can show *one* hash-compare primitive cover *two* domains — AI trust and verifiable compliance — using the same Lemma BBS+ document-binding flow.

This repository is the public, Apache 2.0 sibling of the longer write-up; see [`docs/writeup.md`](./docs/writeup.md) for the full motivation and the WOW-moment demo script.

## Architecture

```
[Claim Input (text)]
       ↓
[Model Attestation] — Ollama /api/tags manifest digest vs. pinned known-good hash
       ↓ (verified)
[Gemma 4 Inference] — local /api/generate, JSON-constrained output
       ↓
[Proof Binding] — sha256(canonical(modelDigest, claimHash, outputHash, nonce, ts))
       ↓
[Lemma Submission] — POST /v1/documents (binding registered as a Lemma document)
       ↓
[Verdict] — ✔ VERIFIED · ✘ TAMPERED · ! UNVERIFIED
```

The core is **external-API-only**: it does not depend on `@lemmaoracle/sdk` or any cryptographic primitive package. All proof-side work is delegated to the Lemma workers API. The on-device pipeline only handles:

- model digest readback from Ollama,
- claim hashing and payload canonicalisation,
- HTTP requests to Lemma.

## Quick start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- [Ollama](https://ollama.com) running locally on `http://127.0.0.1:11434`
- A pulled Gemma 4 tag, e.g. `ollama pull gemma4:latest`

### Install and run

```bash
pnpm install
pnpm dev
```

The TUI launches, asks for a claim, and runs the three-step pipeline.

### Pin your local model digest

`gemma4:latest` ships pre-pinned in [`config/known-good-hashes.json`](./config/known-good-hashes.json) with its content-addressed manifest digest. To pin a different tag, read the digest from Ollama's `/api/tags`:

```bash
curl -s http://127.0.0.1:11434/api/tags \
  | jq -r '.models[] | select(.name=="gemma4:latest") | "sha256:" + .digest'
```

Paste the `sha256:…` output into `config/known-good-hashes.json` under the matching model tag. The manifest digest is content-addressed, so it is identical on any machine that pulled the same model version.

## The WOW demo

The point of this assistant is what happens **when trust breaks**. The same hash-compare primitive backs two domains, and the WOW moment shows up in both.

### Model attestation (claim mode)

```bash
# 1. Run a claim — observe ✔ VERIFIED
pnpm dev

# 2. Simulate a supply-chain tamper (non-destructive — flips the expected hash)
pnpm tamper

# 3. Run the same claim again — observe ✘ TAMPERED in red
pnpm dev

# 4. Restore trust
pnpm untamper
```

### Attribute attestation (KYC / DeFi compliance)

```bash
# 1. Verify a KYC credential — observe ✔ VERIFIED
pnpm dev -- --mode attribute

# 2. Simulate an issuer-attestation rotation (flips the expected attribute hash)
pnpm tamper:attribute

# 3. Re-run — observe ✘ TAMPERED with "Attribute hash mismatch"
pnpm dev -- --mode attribute

# 4. Restore trust
pnpm untamper
```

### Both — one primitive, two domains

```bash
# Runs the AI pipeline (Attest/Infer/Prove) then the attribute pipeline
# (AttestAttr/VerifyAttr/ProveAttr) back-to-back, with the banner
# "Same ZK primitive, different domain — AI trust & DeFi compliance, unified."
pnpm dev -- --mode both --claim "The Eiffel Tower is in Paris."

# Flip both expectations at once
pnpm tamper:both
pnpm dev -- --mode both --claim "<text>"   # both panels go red
pnpm untamper
```

The tamper script does not touch any model weights or credentials on disk. It writes `.tamper-state.json`, which overrides the expected digest used by the attestation steps (`expectedDigestOverride` for the model, `attributeHashOverride` for the attribute). The verdict change is identical to a real supply-chain compromise — no actual model file or credential is harmed.

## Configuration

| Env var            | Default                              | Purpose                                    |
| ------------------ | ------------------------------------ | ------------------------------------------ |
| `OLLAMA_BASE_URL`  | `http://127.0.0.1:11434`             | Ollama daemon endpoint                     |
| `OLLAMA_MODEL`     | `gemma4:latest`                      | Model tag to attest and run                |
| `LEMMA_API_BASE`   | `https://workers.lemma.workers.dev`  | Lemma workers REST API base                |
| `LEMMA_API_KEY`    | _(unset)_                            | API key for the Prove step (see note below)|

Copy [`.env.example`](./.env.example) to `.env` and fill in values as needed.

> **API key & the Prove step.** The Prove step submits to the live Lemma workers API (`POST /v1/documents`, `/v1/proofs`), which requires `LEMMA_API_KEY`. Without a key, **Attest** and **Infer** still run and **Prove** reports a `401` — or run `pnpm dev --offline` to skip Prove entirely.

CLI flags override env vars. See `pnpm dev -- --help` for the full list.

## Project layout

```
example-claim-check/
├── src/
│   ├── sdk/                # Thin Lemma API wrapper (fetch + types only)
│   ├── ollama/             # Ollama HTTP client (/api/{tags,show,generate})
│   ├── attestation/
│   │   ├── verify.ts       # Model digest readback + known-good comparison
│   │   └── attribute.ts    # Attribute hash readback + KYC verify
│   ├── inference/          # Gemma 4 claim-check prompting (JSON output)
│   ├── proof/              # Payload binding + Lemma submission (claim + attribute)
│   ├── ui/                 # Ink TUI components
│   └── cli.tsx             # Entry point — --mode claim | attribute | both
├── scripts/
│   └── tamper.ts           # WOW demo helper — --mode model | attribute | both
├── config/
│   ├── known-good-hashes.json       # Pinned model manifest digests
│   └── known-good-attributes.json   # Pinned attribute credential hashes
└── LICENSE                 # Apache 2.0
```

## Cross-references

- Lemma SDK (TypeScript, full crypto stack): [`lemma/packages/sdk`](../lemma/packages/sdk)
- Lemma OpenAPI spec: [`lemma/packages/spec/openapi.lemma.v2.json`](../lemma/packages/spec/openapi.lemma.v2.json)
- x402 reference integration: [`example-x402`](../example-x402)

## Known limitations

This is a hackathon-track reference. Per the writeup:

- **Edge proving is not yet implemented.** The proof step is a binding-hash submitted to the Lemma workers API; full on-device BBS+ proving is future work.
- **Model attestation covers weight integrity only.** A model trained on biased data would still produce biased verdicts — attestation detects post-training tampering, not training-data provenance.
- **Source verification is out of scope.** The system attests the model, not the corpus the model relies on internally.

## License

Apache 2.0 — see [`LICENSE`](./LICENSE).
