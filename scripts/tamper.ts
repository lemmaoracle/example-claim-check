#!/usr/bin/env tsx
/**
 * WOW: simulate a supply-chain tamper without actually modifying the local
 * model or the held credential.
 *
 * Modes:
 *   --mode model      (default)  Override the expected MODEL digest.
 *                                Causes claim-mode attestation to fail.
 *   --mode attribute              Override the expected ATTRIBUTE hash.
 *                                Causes attribute-mode attestation to fail.
 *   --mode both                  Override both — useful with `--mode both`
 *                                in the TUI to show both verdicts flip red
 *                                in a single screen.
 *
 * Restore with `pnpm untamper` (or pass --restore) to remove the override.
 *
 * This is intentionally non-destructive: real-world attacks mutate the model
 * file or the credential itself, but for a demo we keep the user's filesystem
 * untouched and flip the expected digest instead. The verdict change the user
 * sees is identical.
 */
import { writeFile, unlink, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const STATE_PATH = resolve(process.cwd(), ".tamper-state.json");

type TamperMode = "model" | "attribute" | "both";

const banner = (label: string): string => `${label} :: example-claim-check :: 2026-05-16`;

const sha256 = (s: string): string =>
  `sha256:${createHash("sha256").update(s).digest("hex")}`;

const parseMode = (argv: ReadonlyArray<string>): TamperMode => {
  const i = argv.indexOf("--mode");
  if (i < 0) return "model";
  const v = argv[i + 1] ?? "";
  return v === "attribute" || v === "both" ? v : "model";
};

const applyTamper = async (mode: TamperMode): Promise<void> => {
  const payload: Record<string, string> = {
    appliedAt: new Date().toISOString(),
    note: `Demo tamper applied (mode=${mode}) by scripts/tamper.ts.`,
  };
  if (mode === "model" || mode === "both") {
    payload.expectedDigestOverride = sha256(banner("tampered-known-good"));
  }
  if (mode === "attribute" || mode === "both") {
    payload.attributeHashOverride = sha256(banner("tampered-attribute"));
  }
  await writeFile(STATE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log(`[tamper] applied (mode=${mode}).`);
  if (payload.expectedDigestOverride) {
    console.log(`[tamper]   expected model digest now ${payload.expectedDigestOverride}`);
  }
  if (payload.attributeHashOverride) {
    console.log(`[tamper]   expected attribute hash now ${payload.attributeHashOverride}`);
  }
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
  const argv = process.argv.slice(2);
  if (argv.includes("--restore") || argv.includes("restore")) {
    await restore();
    return;
  }
  await applyTamper(parseMode(argv));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
