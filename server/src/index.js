import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { createInitialState } from "./gameState.js";
import { loadCardsFromFile } from "./cards.js";
import { loadState } from "./persistence.js";
import { createWsServer } from "./wsServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, "..", "data", "game-state.json");
const CARDS_PATH = path.join(__dirname, "cards.json");
const CLIENT_DIST = path.join(__dirname, "..", "..", "client", "dist");

async function main() {
  const cards = loadCardsFromFile(CARDS_PATH);
  const persisted = await loadState(STATE_PATH);
  const initialState = persisted ?? createInitialState();

  const app = express();
  app.use(express.static(CLIENT_DIST));
  app.get("/api/cards", (req, res) => {
    res.json([...cards.values()]);
  });
  app.get("*", (req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));

  const server = createServer(app);
  createWsServer(server, { cards, statePath: STATE_PATH, initialState });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Seasons Companion listening on port ${port}`);
    console.log(`Join code: ${initialState.joinCode}`);
  });
}

main().catch((err) => {
  console.error("Failed to start Seasons Companion server:", err);
  process.exit(1);
});
