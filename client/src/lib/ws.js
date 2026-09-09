const TOKEN_KEY = "seasons-companion-token";
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10000;

export function createConnection({ url, onMessage }) {
  let ws;
  let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

  function scheduleReconnect() {
    // Capped exponential backoff with jitter: avoids a tight reconnect loop
    // hammering the host's phone (battery/CPU) when the server is dead or
    // unreachable, while still reconnecting reasonably quickly once it's
    // back. Jitter (0.5x-1.5x of the current delay) avoids every client
    // retrying in lockstep.
    const jitteredDelay = reconnectDelay * (0.5 + Math.random());
    setTimeout(connect, jitteredDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  function connect() {
    ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) send({ type: "RECONNECT", token });
    });

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "JOINED") {
        localStorage.setItem(TOKEN_KEY, message.token);
      } else if (message.type === "ERROR" && message.message?.includes("Invalid reconnection token")) {
        // The stored token no longer matches any player (e.g. the host ran
        // NEW_GAME since we last connected) — clear it so future reconnect
        // attempts don't keep repeating the same failure. The player will
        // need to rejoin via JoinScreen, which is the correct behavior here.
        localStorage.removeItem(TOKEN_KEY);
      }
      onMessage(message);
    });

    ws.addEventListener("close", () => {
      scheduleReconnect();
    });
  }

  function send(action) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(action));
    }
  }

  connect();
  return { send };
}
