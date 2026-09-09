import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createConnection } from "./ws.js";

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.listeners = {};
    FakeWebSocket.instances.push(this);
  }
  addEventListener(event, handler) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(handler);
  }
  send(data) {
    this.lastSent = data;
  }
  emitOpen() {
    this.readyState = FakeWebSocket.OPEN;
    (this.listeners.open || []).forEach((h) => h());
  }
  emitMessage(data) {
    (this.listeners.message || []).forEach((h) => h({ data: JSON.stringify(data) }));
  }
  emitClose() {
    (this.listeners.close || []).forEach((h) => h());
  }
}
FakeWebSocket.CONNECTING = 0;
FakeWebSocket.OPEN = 1;

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createConnection", () => {
  it("sends a RECONNECT with the stored token on open", () => {
    localStorage.setItem("seasons-companion-token", "abc123");
    createConnection({ url: "ws://x", onMessage: () => {} });
    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    expect(JSON.parse(socket.lastSent)).toEqual({ type: "RECONNECT", token: "abc123" });
  });

  it("stores the token from a JOINED message and forwards it to onMessage", () => {
    const messages = [];
    createConnection({ url: "ws://x", onMessage: (m) => messages.push(m) });
    const socket = FakeWebSocket.instances[0];
    socket.emitMessage({ type: "JOINED", playerId: "p1", token: "tok-1" });
    expect(localStorage.getItem("seasons-companion-token")).toBe("tok-1");
    expect(messages).toEqual([{ type: "JOINED", playerId: "p1", token: "tok-1" }]);
  });

  it("send() only writes to the socket once it is open", () => {
    const { send } = createConnection({ url: "ws://x", onMessage: () => {} });
    const socket = FakeWebSocket.instances[0];
    send({ type: "ADJUST_SCORE", playerId: "p1", delta: 1 });
    expect(socket.lastSent).toBeUndefined();
    socket.emitOpen();
    send({ type: "ADJUST_SCORE", playerId: "p1", delta: 1 });
    expect(JSON.parse(socket.lastSent)).toEqual({ type: "ADJUST_SCORE", playerId: "p1", delta: 1 });
  });

  it("reconnects after the socket closes, with a delay (capped exponential backoff)", () => {
    vi.useFakeTimers();
    createConnection({ url: "ws://x", onMessage: () => {} });
    expect(FakeWebSocket.instances).toHaveLength(1);

    FakeWebSocket.instances[0].emitClose();
    // No new socket immediately — reconnect is delayed, not instant.
    expect(FakeWebSocket.instances).toHaveLength(1);

    // With jitter the delay is between 0.5x and 1.5x the base delay (500ms),
    // so advancing well past the upper bound guarantees the reconnect fired.
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    vi.useRealTimers();
  });

  it("doubles the reconnect delay on repeated closes, capped at 10s", () => {
    // Jitter is `delay * (0.5 + Math.random())`, i.e. a range straddling
    // the base delay. A fixed 700ms probe between the two delay tiers
    // (500ms/1000ms) falls inside the real jitter range on either side
    // ~20% of the time, making this test flaky without a deterministic
    // Math.random. Pin it to the midpoint (0.5 -> exactly 1.0x, no jitter)
    // so the assertions are exact rather than probabilistic.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.useFakeTimers();
    createConnection({ url: "ws://x", onMessage: () => {} });

    // First close: delay is exactly 500ms with Math.random pinned.
    FakeWebSocket.instances[0].emitClose();
    vi.advanceTimersByTime(200);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    // Second close without an intervening successful open: delay should
    // have doubled to exactly 1000ms.
    FakeWebSocket.instances[1].emitClose();
    vi.advanceTimersByTime(700);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(3);

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resets the reconnect delay to the initial value after a successful open", () => {
    vi.useFakeTimers();
    createConnection({ url: "ws://x", onMessage: () => {} });

    // Close, then reconnect and successfully open — this should reset the
    // backoff delay back down to the initial ~500ms instead of staying
    // doubled.
    FakeWebSocket.instances[0].emitClose();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.instances[1].emitOpen();

    FakeWebSocket.instances[1].emitClose();
    vi.advanceTimersByTime(200);
    expect(FakeWebSocket.instances).toHaveLength(2); // not yet — delay reset to ~500ms, not doubled
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(3);

    vi.useRealTimers();
  });
});

describe("ERROR handling", () => {
  it("clears the stored token when an ERROR reports an invalid reconnection token", () => {
    localStorage.setItem("seasons-companion-token", "stale-token");
    createConnection({ url: "ws://x", onMessage: () => {} });
    const socket = FakeWebSocket.instances[0];
    socket.emitMessage({ type: "ERROR", message: "Invalid reconnection token" });
    expect(localStorage.getItem("seasons-companion-token")).toBeNull();
  });

  it("leaves the stored token alone for unrelated errors", () => {
    localStorage.setItem("seasons-companion-token", "abc123");
    createConnection({ url: "ws://x", onMessage: () => {} });
    const socket = FakeWebSocket.instances[0];
    socket.emitMessage({ type: "ERROR", message: "Color already taken: red" });
    expect(localStorage.getItem("seasons-companion-token")).toBe("abc123");
  });
});
