import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveState, loadState } from "./persistence.js";

let dir;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("saveState / loadState", () => {
  it("round-trips an object through disk", async () => {
    dir = mkdtempSync(join(tmpdir(), "persistence-test-"));
    const filePath = join(dir, "nested", "game-state.json");
    const state = { phase: "lobby", players: [] };
    await saveState(filePath, state);
    expect(existsSync(filePath)).toBe(true);
    const loaded = await loadState(filePath);
    expect(loaded).toEqual(state);
  });

  it("loadState returns null when the file does not exist", async () => {
    dir = mkdtempSync(join(tmpdir(), "persistence-test-"));
    const loaded = await loadState(join(dir, "missing.json"));
    expect(loaded).toBeNull();
  });

  it("does not leave a .tmp file behind after saving", async () => {
    dir = mkdtempSync(join(tmpdir(), "persistence-test-"));
    const filePath = join(dir, "game-state.json");
    await saveState(filePath, { a: 1 });
    // Temp filenames are now unique-per-call (e.g. `${filePath}.<uuid>.tmp`),
    // so check the directory for any leftover *.tmp artifact rather than the
    // single old hardcoded name.
    const leftoverTmpFiles = readdirSync(dir).filter((name) => name.endsWith(".tmp"));
    expect(leftoverTmpFiles).toEqual([]);
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({ a: 1 });
  });

  it("serializes concurrent saveState calls for the same path without racing on the temp file", async () => {
    dir = mkdtempSync(join(tmpdir(), "persistence-test-"));
    const filePath = join(dir, "game-state.json");
    const stateA = { phase: "lobby", players: ["a"] };
    const stateB = { phase: "summer", players: ["a", "b"] };

    // Fire both saves without awaiting the first before starting the second,
    // so they genuinely overlap in-flight.
    const results = await Promise.allSettled([
      saveState(filePath, stateA),
      saveState(filePath, stateB),
    ]);

    // (a) neither call rejects/throws.
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    // (b) the second call is chained after the first in the internal queue,
    // so it is guaranteed to be the last write to land on disk.
    const loaded = await loadState(filePath);
    expect(loaded).toEqual(stateB);

    // (c) no leftover .tmp-suffixed files remain in the directory.
    const leftoverTmpFiles = readdirSync(dir).filter((name) => name.endsWith(".tmp"));
    expect(leftoverTmpFiles).toEqual([]);
  });
});
