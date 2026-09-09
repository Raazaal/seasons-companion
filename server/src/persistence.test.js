import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
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
    expect(existsSync(`${filePath}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({ a: 1 });
  });
});
