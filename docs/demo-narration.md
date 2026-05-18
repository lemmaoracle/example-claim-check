# example-claim-check — Demo Narration Script (v6 — compressed)

Target: Gemma 4 Good Hackathon submission video (Kaggle, ≤3 min cap).
Tape: `demo.tape` (vhs). v6 compresses `pnpm dev` sections to leave more margin
under the 3-minute cap.
Voice: ElevenLabs `rk9BD4xwuG39syvDIBQy`, `eleven_multilingual_v2`.

Aim: ~1:57 speech, ~2:21 final video. ~40s headroom under the 3:00 cap.

---

## Section 0 — Intro, static screen (banner step)

> AI generates millions of claims a day — medical, legal, news. We act on them, and we have no way to verify which model is behind the answer. We built a fix: Gemma 4 on-device, with zero-knowledge proofs anchored on Lemma.

## Section 1 — Claim mode, VERIFIED (Step 1)

> Gemma 4 fact-checks the claim on-device. The answer arrives, and a zero-knowledge proof is built and anchored on Lemma — verifiable by anyone, revealing nothing about the model itself.

## Section 2a — Tamper (Step 2a)

> Now we tamper with the model.

## Section 2b — Claim mode, TAMPERED (Step 2b)

> Same claim — verdict instantly. The model no longer matches what the proof commits to, so the circuit rejects it. TAMPERED — not a string compare, but the cryptography itself breaking. If a medical-triage AI were silently swapped tomorrow, a clinician in a rural hospital would know the moment it happened.

## Section 3 — Untamper (Step 3)

> Trust restored. Now a second domain.

## Section 4 — Attribute mode, VERIFIED (Step 4)

> Same proof system, different payload. The circuit binds a KYC attestation — eligibility proven, identity withheld. A licensed clinician, an accredited journalist, a verified adult learner — anchored on Lemma alongside the AI proof. One audit trail, two trust problems.

## Section 5a — Tamper attribute (Step 5a)

> Now imagine a stale credential.

## Section 5b — Attribute mode, TAMPERED (Step 5b)

> The credential no longer satisfies the circuit. Same primitive, same audit log, same instant breakage signal — tampered model or forged credential. That matters when AI and credentials together reach a refugee learner, an aid worker, a patient seeking a verifiable second opinion. With Gemma 4 on-device and proofs on Lemma, the trust layer is not a black box.

## Section 6 — Both mode + Vision (Step 6)

> One pipeline, both flows. Same circuit, same prover, same Lemma audit trail — one ZK primitive serving AI trust and DeFi compliance. One circuit today. Tomorrow: medical advice you can audit. Educational credentials no one can forge. Climate-data attestations from any device, anywhere. Verifiable AI, on-device with Gemma 4, anchored on Lemma. Wherever AI meets trust, the proof comes with it.

---

## Final speech timing (rk9BD4xwuG39syvDIBQy, v6)

| Section | Duration |
|--------:|:--------:|
| s0      | 15.78 s  |
| s1      | 11.10 s  |
| s2a     |  1.70 s  |
| s2b     | 18.57 s  |
| s3      |  2.40 s  |
| s4      | 17.45 s  |
| s5a     |  2.04 s  |
| s5b     | 22.00 s  |
| s6      | 26.78 s  |
| **Total** | **1:57** |

## Final vhs `Sleep` adjustments

```
Step 0  (intro banner):        Sleep 18s
Step 1  (claim verified):      Sleep  2s   # pipeline ~13s covers most of s1 (11s)
Step 2a (tamper):              Sleep  3s
Step 2b (claim tampered):      Sleep 20s
Step 3  (untamper):            Sleep  3s
Step 4  (attribute verified):  Sleep 17s
Step 5a (tamper attribute):    Sleep  3s
Step 5b (attribute tampered):  Sleep 23s
Step 6 untamper:               Sleep  3s
Step 6 (both mode):            Sleep 15s   # pipeline ~14s + buffer
```

Estimated final video: ~2:21 (within the 3:00 cap with ~40s headroom).
