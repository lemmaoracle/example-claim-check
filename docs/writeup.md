# Verifiable Claim-Check Assistant: On-Device AI with Cryptographic Trust

**Subtitle:** Bringing verifiable integrity to AI-generated claims through Gemma 4 and zero-knowledge proofs

**Track:** Safety & Trust (also eligible for Special Technology Track: Ollama / llama.cpp)

---

## The Problem: When AI Claims Can't Be Trusted

AI models generate millions of claims daily — news summaries, medical interpretations, financial analyses. But how do you verify that the model producing those claims hasn't been tampered with? How do you know the weights are authentic, the reasoning chain is intact, and the output hasn't been modified in transit?

Today, the answer is: you can't. AI systems operate as black boxes, and their outputs are taken on faith. This creates an asymmetric trust problem — especially for vulnerable populations who lack the technical resources to independently verify what an AI tells them.

Consider a local journalist in a resource-constrained environment. They use an AI assistant to fact-check claims circulating on social media. If the model's weights have been modified — even subtly — the "fact-checks" it produces could be systematically biased, and neither the journalist nor their readers would ever know.

This is not a hypothetical risk. Model supply chain attacks, weight tampering, and output manipulation are documented threat vectors that grow as AI deployment expands.

## Our Solution: Verifiable Claim-Check Assistant

We built a claim verification assistant that doesn't just check claims — it **proves** that the checking process itself is trustworthy, using cryptographic verification anchored to the model's integrity.

The architecture combines three layers:

1. **On-device inference with Gemma 4**: Claims are analyzed locally using Gemma 4's multilingual and long-context capabilities, ensuring privacy and low-latency operation even in bandwidth-constrained environments.

2. **Cryptographic model attestation**: Before any inference runs, the system verifies that the Gemma 4 model weights match a known-good hash. This creates a chain of trust from model identity to output reliability.

3. **Verifiable claim proofs**: Each fact-check result is accompanied by a cryptographic proof that binds the output to the specific, verified model that produced it. If the model changes, the proof breaks — immediately and visibly.

### How Gemma 4 Enables This

Gemma 4's four core capabilities are not just features we use — they are structural requirements for the system to work:

- **Native function calling**: The verification pipeline is orchestrated through Gemma 4's tool use. The model itself decides when to invoke cryptographic verification, claim decomposition, and source cross-referencing — making the trust layer an integral part of reasoning, not an external bolt-on.

- **Long context window (128K)**: Real-world claim verification requires synthesizing multiple source documents, sometimes lengthy regulatory texts or historical records. Gemma 4 processes these in a single pass, maintaining cross-reference coherence across the full context.

- **Multimodal input**: Claims often arrive as screenshots, infographics, or video stills. Gemma 4 processes both text and images natively, eliminating fragile OCR preprocessing that introduces trust gaps.

- **On-device inference**: The entire pipeline runs locally via Ollama/llama.cpp. No data leaves the device — not the claims, not the sources, not the verification results. This is critical for journalists working under surveillance or in regions with hostile press environments.

## Technical Architecture

```
[Claim Input (text/image)]
        ↓
[Model Attestation] → hash(model weights) vs. known-good hash
        ↓ (verified)
[Gemma 4 Inference (local)]
  ├── Claim decomposition (function call)
  ├── Source retrieval & cross-reference
  └── Verification assessment
        ↓
[Proof Generation] → bind(output, model_hash, timestamp)
        ↓
[Verifiable Result: ✅ Verified / ❌ Unverified / ⚠️ Tampered]
```

The proof generation layer uses BBS+ signature schemes to create selectively-disclosable attestations. This means the proof can confirm "this output came from verified Gemma 4 weights at time T" without revealing the full model hash or any user data — a zero-knowledge approach to AI trust.

## The WOW Moment: When Trust Breaks

The most powerful demonstration of our system is what happens when trust is violated:

1. A claim is checked — verification succeeds with a green ✅ and a valid cryptographic proof.
2. The model weights are modified (simulating a supply chain attack).
3. The same claim is checked again — verification **immediately fails** with a red ❌. The proof is broken. The tampering is detected in real-time.

This isn't a theoretical capability. It's a working demo that makes an abstract threat (model tampering) viscerally tangible. For judges, for journalists, for anyone — the moment the checkmark flips from green to red is the moment the problem becomes undeniable.

## Challenges & Limitations

We want to be transparent about what this system does and doesn't do today:

- **Edge proving is not yet implemented.** Cryptographic proof generation currently runs on the cloud side, with the on-device component handling inference and attestation only. Full on-device proving is an active research area — BBS+ signatures are computationally feasible on-device, but the full zero-knowledge proof pipeline requires optimization for resource-constrained hardware.

- **Source verification relies on external data.** The system can verify that the *model* is trustworthy, but verifying the *sources* it references is a separate (and complementary) challenge. We see this as future work, potentially integrating with existing fact-checking APIs.

- **Scope of attestation.** Current model attestation covers weight integrity but not training data provenance. A model trained on biased data would still produce biased outputs — our system detects tampering after training, not biases within training. This is a known limitation of the model supply chain trust model.

## What's Next: One Primitive, Many Domains

The cryptographic trust layer we built for AI claim verification is not domain-specific. The same BBS+ signature primitive that proves "this AI output came from verified weights" can also prove "this user completed KYC verification" or "this transaction meets compliance requirements" — without revealing the underlying data.

This means the architecture extends naturally to:

- **DeFi and stablecoin compliance**: Verifiable attribute proofs for regulatory requirements (MiCA, PPSI) without exposing personal data on-chain.
- **AI agent payments (x402 protocol)**: Proving agent identity and authorization cryptographically before processing autonomous transactions.
- **Supply chain integrity**: Verifying that any computational pipeline — not just AI inference — has not been tampered with.

We chose AI claim-checking as our first application because the trust problem is intuitive and the social impact is immediate. But the underlying infrastructure is designed to be a general-purpose verifiable trust layer — for AI, for finance, for any domain where "prove it" matters more than "trust me."

## Impact

For the 2 billion people living in regions with limited press freedom, AI-assisted fact-checking could be transformative — but only if the AI itself can be trusted. Our system makes that trust verifiable, not assumable.

For the broader AI community, we demonstrate that on-device inference and cryptographic verification are not competing priorities — they are complementary. Gemma 4's local-first architecture makes trust verification practical, and trust verification makes local AI genuinely useful.

---

**Team:** FRAME00 / LemmaOracle
**Repository:** [example-claim-check](../README.md)
**Demo:** [Live demo link — to be added]
**Video:** [YouTube link — to be added]
