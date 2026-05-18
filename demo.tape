Output demo.mp4

Set Shell "bash"
Set Width 2100
Set Height 1200
Set Framerate 30
Set FontSize 24

Hide
Type "cd $HOME/Projects/lemmaoracle/example-claim-check" Enter
Sleep 500ms
Show

# ============================================================
# Step 0: Intro banner — static terminal frame (s0 narration plays here)
# ============================================================
Type "echo 'Verifiable Claim-Check Assistant — Gemma 4 + Lemma'" Enter
Sleep 18s

# ============================================================
# Step 1: Claim mode — VERIFIED (first proof)
# ============================================================
Type "pnpm dev --claim 'The Eiffel Tower is in Berlin'" Enter
Wait+Screen@30s /Press n for/
Sleep 2s
Type "q"

# ============================================================
# Step 2a: tamper
# ============================================================
Type "pnpm tamper" Enter
Sleep 3s

# Step 2b: Claim mode — TAMPERED
Type "pnpm dev --claim 'The Eiffel Tower is in Berlin'" Enter
Wait+Screen@30s /Press n for/
Sleep 20s
Type "q"

# ============================================================
# Step 3: untamper
# ============================================================
Type "pnpm untamper" Enter
Sleep 3s

# ============================================================
# Step 4: attribute mode — VERIFIED
# ============================================================
Type "pnpm dev -- --mode attribute" Enter
Wait+Screen@30s /Press n for/
Sleep 17s
Type "q"

# ============================================================
# Step 5a: tamper attribute
# ============================================================
Type "pnpm tamper:attribute" Enter
Sleep 3s

# Step 5b: attribute mode — TAMPERED
Type "pnpm dev -- --mode attribute" Enter
Wait+Screen@30s /Press n for/
Sleep 23s
Type "q"

# ============================================================
# Step 6: untamper → both mode
# ============================================================
Type "pnpm untamper" Enter
Sleep 3s

Type "pnpm dev -- --mode both --claim 'Water boils at 100C at sea level'" Enter
Sleep 15s
