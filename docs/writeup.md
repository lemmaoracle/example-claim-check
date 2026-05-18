# Verifiable Claim-Check Assistant: On-Device AI with Cryptographic Trust

**Subtitle:** Bringing verifiable integrity to AI-generated claims through Gemma 4, on-device Groth16 zero-knowledge proofs, and Lemma anchoring

**Track:** Safety & Trust (also eligible for Special Technology Track: Ollama)

---

## The Problem: When AI Claims Can't Be Trusted

AI models generate millions of claims daily: news summaries, medical interpretations, financial analyses, legal advice. But how do you verify that the model producing those claims hasn't been tampered with? How do you know the weights are authentic, and the output you see came from the model you think it did?

Today, the answer is: you can't. AI systems operate as black boxes, and their outputs are taken on faith. This creates an asymmetric trust problem, especially for vulnerable populations who lack the technical resources to independently verify what an AI tells them.

Consider a clinician in a rural hospital using an AI assistant to triage cases. If the model's weights were silently swapped (a supply-chain attack, an unauthorised update, a corrupted local cache), the clinician would have no way to know. The interface looks the same. The answers still arrive. But the trust is gone, and so is patient safety.

This is not a hypothetical risk. Model supply-chain attacks, weight tampering, and output manipulation are documented threat vectors that grow as AI deployment expands into safety-critical domains.

## Our Solution: Verifiable Claim-Check Assistant

We built a claim-verification assistant that doesn't just check claims. It **cryptographically proves** that the checking process itself is trustworthy. Every answer comes with a zero-knowledge proof that anyone, anywhere, can verify, without ever seeing the model, the input, or the user.

The architecture is three layers, all running on-device except for the final anchoring step:

1. **On-device inference with Gemma 4 via Ollama.** Claims are analysed locally. No data leaves the device: not the claim, not the user identity, not the answer.

2. **Model attestation.** Before each inference, the system reads Gemma 4's manifest digest from Ollama's `/api/tags` and compares it to a pinned, known-good hash. Any drift triggers an immediate TAMPERED verdict.

3. **Zero-knowledge proof.** A Poseidon commitment binds the model digest, the claim, the output, and a nonce. A Groth16 zero-knowledge proof, generated locally via snarkjs against our circom circuit `claimCheckCommitmentV1`, proves the commitment is well-formed without revealing any of the inputs. The proof and the binding hash are anchored on Lemma as a permanent, publicly auditable record.

The same primitive runs a second mode: **verifiable credentials**. The same Poseidon circuit binds a KYC attestation, and the same Groth16 prover produces a proof that "this credential is valid" without revealing identity, issuer details, or the credential payload. One ZK primitive, two domains, one shared audit trail.

### How Gemma 4 Enables This

- **On-device inference via Ollama.** The entire pipeline (inference, commitment, proof generation) runs locally. No claim is exposed to a cloud provider. This is essential for clinicians under HIPAA-like obligations, journalists working under surveillance, or aid workers in regions with hostile network environments.

- **Low latency.** Gemma 4 returns a fact-check in seconds on commodity hardware; the proof generation adds a small constant overhead. Total round-trip is comparable to or faster than many cloud APIs, and works fully offline once the model is pulled.

- **JSON-constrained output.** Ollama's `format=json` constraint gives us a stable, parseable verdict structure (`verdict`, `rationale`) that we hash into the commitment. The output is what the model said, byte-for-byte, and the proof binds to exactly that.

- **Manifest-digest attestation.** Ollama's content-addressed model storage makes attestation possible without re-hashing multi-gigabyte weights at every call. The manifest digest is itself a cryptographic commitment to the weights.

## Technical Architecture

```
[Claim Input]
    ↓
[Model Attestation] : Ollama /api/tags manifest digest vs. pinned known-good
    ↓ (verified)
[Gemma 4 Inference] : local /api/generate, JSON-constrained output
    ↓
[Poseidon Commitment] : model digest + claim hash + output hash + nonce
    ↓
[Groth16 Proof] : snarkjs.groth16.fullProve against claimCheckCommitmentV1 circuit
    ↓
[Lemma Anchoring] : POST /v1/documents (binding) + POST /v1/proofs (Groth16 proof)
    ↓
[Verdict: VERIFIED · TAMPERED · UNVERIFIED]
```

In attribute (KYC) mode, the inference step is replaced by attestation against a pinned credential hash; the commitment, the circuit, and the anchoring are identical. This is what "one primitive, two domains" means in practice.

## The WOW Moment: When Trust Breaks

The most powerful demonstration is what happens when trust is violated.

1. **Verified.** A claim is fact-checked. Gemma 4 returns its answer. The Groth16 proof is generated, the binding is anchored on Lemma. Green verdict.

2. **Tamper.** A simulated supply-chain attack flips the expected model digest. No weights are touched; only the *expected state* the circuit checks against. This mirrors exactly how a real swap would manifest.

3. **Same claim, same interface: TAMPERED, instantly.** The model state no longer matches what the proof commits to. The circuit constraints fail. The proof never validates, and Lemma refuses to anchor it. The verdict flips to TAMPERED, not because we compared two strings, but because the cryptography itself broke.

The same demo runs in attribute mode: a stale KYC credential triggers the same instant TAMPERED verdict from the same circuit. Then "both mode" runs them back-to-back, against the same Lemma audit trail.

This isn't a theoretical capability. It's a working, on-device demo that makes an abstract threat (silent AI tampering, forged credentials) viscerally tangible. The moment the verdict flips from green to red is the moment the problem becomes undeniable.

## Beyond AI Trust: Verifiable Credentials and DeFi Compliance

The attribute mode is where Gemma 4 Good's Impact dimension multiplies. The same on-device circuit that attests an AI model can attest a credential: proof of eligibility without revealing identity.

- **A licensed clinician** proving accreditation to access a patient database, without exposing their name to the database operator.
- **An accredited journalist** proving institutional affiliation to query a public records API, without surveilling who they are.
- **A verified adult learner** enrolling in a regulated course in a foreign jurisdiction, without surrendering their full identity to the platform.
- **A regulated DeFi protocol** proving a user has completed KYC, satisfying MiCA or PPSI compliance, without exposing personal data on-chain.

One ZK primitive serves AI trust and DeFi compliance through a single, shared, permanent audit trail on Lemma. Wherever AI meets trust, the proof comes with it.

## Challenges & Limitations

We want to be transparent about what this system does and doesn't do today:

- **Model attestation covers weight integrity, not training-data provenance.** A model trained on biased data will still produce biased outputs. Our system detects post-training tampering, not biases baked in before tampering would matter.

- **Source verification is out of scope.** The system attests the model, not the corpus the model relies on internally. Fact-checking quality depends on Gemma 4's training, not on our proof layer.

- **Revocation lists are stubbed.** Attribute mode checks `expiresAt` but does not yet walk an issuer revocation registry. A production deployment would.

- **Proof verification is asynchronous on Lemma.** The Groth16 proof is generated on-device synchronously, but Lemma's verifier runs asynchronously. For real-time gating, a local verifier would need to be added on the relying-party side; this is straightforward but not part of the demo.

## Impact

For the **2 billion people** living in regions with limited press freedom or fragile institutional trust, AI-assisted fact-checking could be transformative, but only if the AI itself can be trusted. Our system makes that trust verifiable, not assumable.

For **clinicians in resource-constrained settings**, an attestable AI triage assistant is the difference between a tool they can rely on and a black box they cannot. The same Groth16 proof that protects the model also protects the patient.

For **the broader AI community**, we demonstrate that on-device inference and cryptographic verification are not competing priorities. They are complementary. Gemma 4's local-first architecture makes verification practical, and verification makes local AI genuinely useful in safety-critical domains.

One circuit today. Tomorrow: medical advice you can audit. Educational credentials no one can forge. Climate-data attestations from any device, anywhere. Wherever AI meets trust, the proof comes with it.

---

**Team:** FRAME00, INC. / LemmaOracle
**Repository:** https://github.com/lemmaoracle/example-claim-check
**Demo video:** [YouTube link to be added]
**License:** Apache 2.0
