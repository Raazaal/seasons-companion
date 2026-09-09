const TOKEN_KEY = "seasons-companion-token";

export function createConnection({ url, onMessage }) {
  let ws;

  function connect() {
    ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) send({ type: "RECONNECT", token });
    });

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "JOINED") {
        localStorage.setItem(TOKEN_KEY, message.token);
      }
      onMessage(message);
    });

    ws.addEventListener("close", () => {
      connect();
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
