#!/usr/bin/env tsx
/**
 * WOW: simulate a model supply-chain tamper without actually modifying the
 * Gemma weights on disk.
 *
 * What it does:
 *   - writes a `.tamper-state.json` in the repo root that overrides the
 *     "known-good" digest the attestation step compares against.
 *   - the override is a deterministic hash of a banner string, so the demo
 *     reliably *fails* attestation when tamper is on.
 *
 * Restore with `pnpm untamper` (or pass --restore) to remove the override.
 *
 * This is intentionally non-destructive: real-world supply-chain attacks
 * mutate the model file itself, but for a demo we keep the user's Ollama
 * cache untouched and flip the expected digest instead. The verdict change
 * the user sees is identical.
 */
import { writeFile, unlink, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const STATE_PATH = resolve(process.cwd(), ".tamper-state.json");

const banner = (label: string): string => `${label} :: example-claim-check :: 2026-05-16`;

const sha256 = (s: string): string =>
  `sha256:${createHash("sha256").update(s).digest("hex")}`;

const applyTamper = async (): Promise<void> => {
  const payload = {
    expectedDigestOverride: sha256(banner("tampered-known-good")),
    appliedAt: new Date().toISOString(),
    note: "Demo tamper applied — expected digest rotated by scripts/tamper.ts.",
  };
  await writeFile(STATE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log(`[tamper] applied — expected digest now ${payload.expectedDigestOverride}`);
  console.log(`[tamper] state file: ${STATE_PATH}`);
  console.log(`[tamper] restore with: pnpm untamper`);
};

const restore = async (): Promise<void> => {
  try {
    await stat(STATE_PATH);
    await unlink(STATE_PATH);
    console.log(`[tamper] restored — ${STATE_PATH} removed.`);
  } catch {
    console.log(`[tamper] no tamper state to restore.`);
  }
};

const main = async (): Promise<void> => {
  const flag = process.argv[2];
  if (flag === "--restore" || flag === "restore") {
    await restore();
    return;
  }
  await applyTamper();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
