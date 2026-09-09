import { describe, it, expect, vi, beforeEach } from "vitest";
import { get } from "svelte/store";

vi.mock("./ws.js", () => {
  return {
    createConnection: vi.fn(({ onMessage }) => {
      globalThis.__lastOnMessage = onMessage;
      return { send: vi.fn() };
    }),
  };
});

import { createGameStore } from "./store.js";

beforeEach(() => {
  globalThis.__lastOnMessage = null;
});

describe("createGameStore", () => {
  it("updates state on a STATE message", () => {
    const store = createGameStore("ws://x");
    globalThis.__lastOnMessage({ type: "STATE", state: { phase: "lobby" } });
    expect(get(store.state)).toEqual({ phase: "lobby" });
  });

  it("sets selfPlayerId on a JOINED message", () => {
    const store = createGameStore("ws://x");
    globalThis.__lastOnMessage({ type: "JOINED", playerId: "p1", token: "t1" });
    expect(get(store.selfPlayerId)).toBe("p1");
  });

  it("sets error on an ERROR message", () => {
    const store = createGameStore("ws://x");
    globalThis.__lastOnMessage({ type: "ERROR", message: "boom" });
    expect(get(store.error)).toBe("boom");
  });

  it("clears a previous error once a STATE message arrives", () => {
    const store = createGameStore("ws://x");
    globalThis.__lastOnMessage({ type: "ERROR", message: "boom" });
    expect(get(store.error)).toBe("boom");
    globalThis.__lastOnMessage({ type: "STATE", state: { phase: "lobby" } });
    expect(get(store.error)).toBeNull();
  });
});
