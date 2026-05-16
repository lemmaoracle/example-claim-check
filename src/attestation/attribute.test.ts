/**
 * attestAttribute regression tests.
 *
 * Three scenarios from the spec: verified / tampered / unknown. The tests
 * touch the on-disk `.tamper-state.json` because `attestAttribute` reads from
 * the filesystem; afterEach restores a clean state so dev-time tampering is
 * not mistakenly wiped out by an interrupted test run, we snapshot any
 * pre-existing tamper-state up front and restore it on teardown.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile, writeFile, stat, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { attestAttribute, attributeObservedDigest } from "./attribute.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const TAMPER_STATE_PATH = resolve(REPO_ROOT, ".tamper-state.json");

let preExistingTamperState: string | null = null;

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

beforeAll(async () => {
  if (await fileExists(TAMPER_STATE_PATH)) {
    preExistingTamperState = await readFile(TAMPER_STATE_PATH, "utf-8");
    await unlink(TAMPER_STATE_PATH);
  }
});

beforeEach(async () => {
  if (await fileExists(TAMPER_STATE_PATH)) {
    await unlink(TAMPER_STATE_PATH);
  }
});

afterEach(async () => {
  if (await fileExists(TAMPER_STATE_PATH)) {
    await unlink(TAMPER_STATE_PATH);
  }
  // Restore any pre-existing tamper-state so a dev demo is not destroyed
  // by an interrupted test run.
  if (preExistingTamperState !== null) {
    await writeFile(TAMPER_STATE_PATH, preExistingTamperState, "utf-8");
  }
});

describe("attestAttribute", () => {
  it("returns verdict=verified when the observed hash matches the pinned hash", async () => {
    const result = await attestAttribute("kyc-verified");
    expect(result.type).toBe("attribute");
    expect(result.attributeKey).toBe("kyc-verified");
    expect(result.verdict).toBe("verified");
    expect(result.observedDigest).toBe(attributeObservedDigest("kyc-verified"));
    expect(result.expectedDigest).toBe(result.observedDigest);
    expect(result.attestationToken.length).toBeGreaterThan(0);
  });

  it("returns verdict=tampered when .tamper-state.json overrides the expected hash", async () => {
    await writeFile(
      TAMPER_STATE_PATH,
      JSON.stringify({
        attributeHashOverride: "sha256:deadbeef".padEnd(70, "0"),
        appliedAt: "2026-05-16T00:00:00.000Z",
        note: "test override",
      }),
      "utf-8",
    );
    const result = await attestAttribute("kyc-verified");
    expect(result.verdict).toBe("tampered");
    expect(result.attestationToken).toBe("");
    expect(result.reason).toContain("test override");
  });

  it("returns verdict=unknown for an attribute that is not in the table", async () => {
    const result = await attestAttribute("not-a-real-attribute");
    expect(result.verdict).toBe("unknown");
    expect(result.attestationToken).toBe("");
    expect(result.reason).toContain("not-a-real-attribute");
  });
});
