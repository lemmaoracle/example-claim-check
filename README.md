# example-claim-check

**Verifiable Claim-Check Assistant** — on-device Gemma 4 inference with cryptographic model attestation via [Lemma](https://github.com/frame-00/lemma).

A reference implementation that demonstrates how to bind an AI-generated verdict to the *specific model that produced it*. If the local model weights are swapped out — even subtly — the cryptographic proof breaks immediately and visibly.

The same primitive runs a **second mode**: attribute attestation for KYC / DeFi compliance. The TUI ships with `--mode attribute` and `--mode both`, so the demo can show *one* Groth16 circuit cover *two* domains — AI trust and verifiable compliance — using the same Lemma document-binding flow.

This repository is the public, Apache 2.0 sibling of the longer write-up; see [`docs/writeup.md`](./docs/writeup.md) for the full motivation and the WOW-moment demo script.

## Architecture

```
[Claim Input (text)]
       ↓
[Model Attestation] — Ollama /api/tags manifest digest vs. pinned known-good hash
       ↓ (verified)
[Gemma 4 Inference] — local /api/generate, JSON-constrained output
       ↓
[Proof Binding] — poseidon5(toScalar(modelDigest), toScalar(attestationToken), claimHash, outputHash, nonce)
       ↓
[Edge Proving] — Groth16 fullProve via snarkjs (claimCheckCommitmentV1 circuit)
       ↓
[Lemma Submission] — POST /v1/documents + POST /v1/proofs
       ↓
[Verdict] — ✔ VERIFIED · ✘ TAMPERED · ! UNVERIFIED
```

## Demo Video

[![Verifiable Claim-Check Demo](https://img.youtube.com/vi/c-i8EWVssYM/0.jpg)](https://www.youtube.com/watch?v=c-i8EWVssYM)

The on-device pipeline performs **edge proving** — it generates Groth16 zero-knowledge proofs locally using `snarkjs` with a Poseidon-commitment circuit (`claimCheckCommitmentV1`), then submits both the document binding and the proof to the Lemma workers API. The runtime dependencies for the proof step are:

- `@lemmaoracle/sdk` — `toScalar()` for field-element conversion,
- `poseidon-lite` — Poseidon hash for the commitment root,
- `snarkjs` — Groth16 `fullProve` and proof serialisation.

The on-device pipeline handles:

- model digest readback from Ollama,
- Poseidon commitment binding (not plain SHA-256),
- Groth16 proof generation on-device,
- document registration and proof submission to Lemma (`POST /v1/documents` + `POST /v1/proofs`).

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

### Circuit compilation

The Groth16 proof step requires compiled circuit artifacts (`.wasm` + `.zkey`). These live under `circuits/build/` and are built from the Circom source in `circuits/`:

```bash
cd circuits && pnpm build
```

The circuit (`claimCheckCommitmentV1`) takes 5 private inputs (modelDigest, attestationToken, claimHash, outputHash, nonce) and commits them under a single Poseidon root. To register the circuit with the Lemma workers API (IPFS upload + `circuits.register`), run:

```bash
npx tsx scripts/register-circuit.ts
```

## Configuration

| Env var            | Default                              | Purpose                                    |
| ------------------ | ------------------------------------ | ------------------------------------------ |
| `OLLAMA_BASE_URL`  | `http://127.0.0.1:11434`             | Ollama daemon endpoint                     |
| `OLLAMA_MODEL`     | `gemma4:latest`                      | Model tag to attest and run                |
| `LEMMA_API_BASE`   | `https://workers.lemma.workers.dev`  | Lemma workers REST API base                |
| `LEMMA_API_KEY`    | _(unset)_                            | API key for the Prove step (see note below)|

Copy [`.env.example`](./.env.example) to `.env` and fill in values as needed.

> **API key & the Prove step.** The Prove step registers the binding as a Lemma document (`POST /v1/documents`) and submits the on-device Groth16 proof (`POST /v1/proofs`), both of which require `LEMMA_API_KEY`. Without a key, **Attest** and **Infer** still run and **Prove** reports a `401` — or run `pnpm dev --offline` to skip Prove entirely. The proof generation itself (snarkjs) runs locally and does not need the API key, but submission does.

CLI flags override env vars. See `pnpm dev -- --help` for the full list.

## Project layout

```
example-claim-check/
├── src/
│   ├── sdk/                # Thin Lemma API wrapper (fetch + types; also exports submitProof)
│   ├── ollama/             # Ollama HTTP client (/api/{tags,show,generate})
│   ├── attestation/
│   │   ├── verify.ts       # Model digest readback + known-good comparison
│   │   ├── attribute.ts    # Attribute hash readback + KYC verify
│   │   └── hash.ts         # SHA-256, canonicalise, nonce utilities
│   ├── inference/          # Gemma 4 claim-check prompting (JSON output)
│   ├── proof/              # Poseidon binding + snarkjs Groth16 proving + Lemma submission
│   ├── ui/                 # Ink TUI components
│   └── cli.tsx             # Entry point — --mode claim | attribute | both
├── circuits/
│   └── src/                # Circom source for claimCheckCommitmentV1
│       └── build/          # Compiled .wasm + .zkey (built via pnpm build)
├── scripts/
│   ├── tamper.ts           # WOW demo helper — --mode model | attribute | both
│   └── register-circuit.ts # Upload circuit artifacts to IPFS + register with Lemma
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

- **Edge proving requires compiled circuit artifacts.** The proof step generates a Groth16 zero-knowledge proof on-device via snarkjs (Poseidon-commitment circuit `claimCheckCommitmentV1`). If the `circuits/build/` directory is missing, the proof submission is skipped gracefully with a console warning.
- **Commitments use the `poseidon` scheme.** Both claim and attribute modes submit documents with `commitments.scheme: "poseidon"` and a Poseidon root — not `sha256-placeholder`.
- **Both modes share a single schema.** Claim mode and attribute mode both use `schema: "passthrough-v1"`.
- **Model attestation covers weight integrity only.** A model trained on biased data would still produce biased verdicts — attestation detects post-training tampering, not training-data provenance.
- **Source verification is out of scope.** The system attests the model, not the corpus the model relies on internally.

## License

Apache 2.0 — see [`LICENSE`](./LICENSE).
