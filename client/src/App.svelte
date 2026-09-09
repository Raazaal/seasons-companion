<script>
  import { onMount } from "svelte";
  import { createGameStore } from "./lib/store.js";
  import JoinScreen from "./screens/JoinScreen.svelte";
  import Dashboard from "./screens/Dashboard.svelte";
  import CardPicker from "./screens/CardPicker.svelte";
  import HistoryScreen from "./screens/HistoryScreen.svelte";
  import FinalCountScreen from "./screens/FinalCountScreen.svelte";

  const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  // `state` is destructured under an alias because Svelte 5 reserves the bare
  // identifier `$state` for the reactive-state rune used below.
  const { state: gameState, selfPlayerId, error, send } = createGameStore(wsUrl);

  let allCards = $state([]);
  let view = $state("dashboard"); // "dashboard" | "cards" | "history" | "final"

  onMount(async () => {
    const res = await fetch("/api/cards");
    allCards = await res.json();
  });

  let takenColors = $derived($gameState?.players.map((p) => p.color) ?? []);
  let selfPlayer = $derived($gameState?.players.find((p) => p.id === $selfPlayerId) ?? null);
  let rootStyle = $derived(selfPlayer ? `--player-color: ${selfPlayer.color};` : "");
</script>

<main data-testid="app-root" style={rootStyle}>
  <h1>Seasons Companion</h1>

  {#if $error}
    <p role="alert">{$error}</p>
  {/if}

  {#if !$gameState || !selfPlayer}
    <JoinScreen
      {takenColors}
      joinCode={$gameState?.joinCode}
      onJoin={(name, color) => send({ type: "JOIN_GAME", name, color })}
    />
  {:else if $gameState.phase === "lobby"}
    <section>
      <h2>Salle d'attente</h2>
      <ul>
        {#each $gameState.players as player (player.id)}
          <li style={`color: ${player.color}`}>{player.name}</li>
        {/each}
      </ul>
      <button
        type="button"
        disabled={$gameState.players.length < 2}
        onclick={() => send({ type: "START_GAME" })}
      >
        Démarrer la partie
      </button>
    </section>
  {:else if $gameState.phase === "final_count"}
    <FinalCountScreen
      {allCards}
      players={$gameState.players}
      onAddFinalCrystals={(playerId, cardId) => send({ type: "ADD_FINAL_CRYSTALS", playerId, cardId })}
      onEndGame={() => send({ type: "END_GAME" })}
    />
  {:else if $gameState.phase === "ended"}
    <section>
      <h2>Partie terminée</h2>
      <ul>
        {#each [...$gameState.players].sort((a, b) => b.score - a.score) as player (player.id)}
          <li style={`color: ${player.color}`}>{`${player.name} — ${player.score}`}</li>
        {/each}
      </ul>
      <button
        type="button"
        onclick={() => {
          if (confirm("Démarrer une nouvelle partie ? Cette action efface la partie actuelle.")) {
            send({ type: "NEW_GAME" });
          }
        }}
      >
        Nouvelle partie
      </button>
    </section>
  {:else}
    <nav>
      <button type="button" onclick={() => (view = "dashboard")}>Score</button>
      <button type="button" onclick={() => (view = "cards")}>Cartes</button>
      <button type="button" onclick={() => (view = "history")}>Historique</button>
      <button
        type="button"
        onclick={() => {
          if (confirm("Passer au décompte final ? Cette action est définitive pour cette partie.")) {
            send({ type: "START_FINAL_COUNT" });
          }
        }}
      >
        Décompte final
      </button>
    </nav>

    {#if view === "dashboard"}
      <Dashboard
        game={$gameState}
        selfPlayerId={$selfPlayerId}
        onAdjustScore={(delta) => send({ type: "ADJUST_SCORE", playerId: $selfPlayerId, delta })}
        onNextTurn={() => send({ type: "NEXT_TURN" })}
      />
    {:else if view === "cards"}
      <CardPicker
        {allCards}
        hand={selfPlayer.hand}
        onAddCard={(cardId) => send({ type: "ADD_CARD_TO_HAND", playerId: $selfPlayerId, cardId })}
        onActivateCard={(cardId) => send({ type: "ACTIVATE_CARD", actorPlayerId: $selfPlayerId, cardId })}
        onRemoveCard={(instanceId) => send({ type: "REMOVE_CARD_FROM_HAND", playerId: $selfPlayerId, instanceId })}
      />
    {:else if view === "history"}
      <HistoryScreen history={$gameState.history} players={$gameState.players} />
    {/if}
  {/if}
</main>

<style>
  :global(button) {
    border: 2px solid var(--player-color, #ccc);
  }
  h1 {
    color: var(--player-color, inherit);
  }
</style>
