import { describe, it, expect, beforeEach, vi } from "vitest";
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

  it("reconnects after the socket closes", () => {
    createConnection({ url: "ws://x", onMessage: () => {} });
    expect(FakeWebSocket.instances).toHaveLength(1);
    FakeWebSocket.instances[0].emitClose();
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
