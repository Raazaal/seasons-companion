import { generateId, generateToken, generateJoinCode } from "./ids.js";

export class GameActionError extends Error {}

export function createInitialState() {
  return {
    joinCode: generateJoinCode(),
    players: [],
    turnOrder: [],
    activePlayerId: null,
    phase: "lobby",
    history: [],
  };
}

function assertPhase(state, allowed) {
  if (!allowed.includes(state.phase)) {
    throw new GameActionError(`Action not allowed in phase "${state.phase}"`);
  }
}

function findPlayer(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new GameActionError(`Unknown player: ${playerId}`);
  return player;
}

function joinGame(state, action) {
  assertPhase(state, ["lobby"]);
  const { name, color } = action;
  if (state.players.some((p) => p.name === name)) {
    throw new GameActionError(`Name already taken: ${name}`);
  }
  if (state.players.some((p) => p.color === color)) {
    throw new GameActionError(`Color already taken: ${color}`);
  }
  const player = {
    id: generateId(),
    token: generateToken(),
    name,
    color,
    score: 0,
    hand: [],
    connected: true,
  };
  const nextState = { ...state, players: [...state.players, player] };
  return { state: nextState, result: { playerId: player.id, token: player.token } };
}

function startGame(state) {
  assertPhase(state, ["lobby"]);
  if (state.players.length < 2) {
    throw new GameActionError("At least 2 players are required to start");
  }
  const turnOrder = state.players.map((p) => p.id);
  return {
    state: { ...state, phase: "playing", turnOrder, activePlayerId: turnOrder[0] },
  };
}

export function applyAction(state, action, context = {}) {
  switch (action.type) {
    case "JOIN_GAME":
      return joinGame(state, action);
    case "START_GAME":
      return startGame(state, action);
    default:
      throw new GameActionError(`Unknown action type: ${action.type}`);
  }
}

export { findPlayer, assertPhase };
