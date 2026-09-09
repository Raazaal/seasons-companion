<script>
  import { onMount } from "svelte";
  import { createGameStore } from "./lib/store.js";
  import { rankPlayers, ordinal } from "./lib/ranking.js";
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

<main data-testid="app-root" style={rootStyle} class="min-h-screen flex flex-col items-center px-4 py-8 sm:py-12">
  <div class="w-full max-w-2xl">
    <h1 class="text-3xl font-bold tracking-tight text-center mb-6 text-[var(--player-color,var(--color-slate-800))]">
      Seasons Companion
    </h1>

    {#if $error}
      <p role="alert" class="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
        {$error}
      </p>
    {/if}

    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      {#if !$gameState || !selfPlayer}
        <JoinScreen
          {takenColors}
          joinCode={$gameState?.joinCode}
          onJoin={(name, color) => send({ type: "JOIN_GAME", name, color })}
        />
      {:else if $gameState.phase === "lobby"}
        <section>
          <h2 class="mb-4 text-lg font-semibold text-slate-800">Salle d'attente</h2>
          <ul class="mb-6 space-y-2">
            {#each $gameState.players as player (player.id)}
              <li class="rounded-lg bg-slate-50 px-3 py-2 font-medium" style={`color: ${player.color}`}>
                {player.name}
              </li>
            {/each}
          </ul>
          <button
            type="button"
            disabled={$gameState.players.length < 2}
            onclick={() => send({ type: "START_GAME" })}
            class="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Démarrer la partie
          </button>
        </section>
      {:else if $gameState.phase === "final_count"}
        <FinalCountScreen
          {allCards}
          players={$gameState.players}
          selfPlayerId={$selfPlayerId}
          onAddFinalCard={(cardId) => send({ type: "ADD_FINAL_CARD", playerId: $selfPlayerId, cardId })}
          onRemoveFinalCard={(instanceId) => send({ type: "REMOVE_FINAL_CARD", playerId: $selfPlayerId, instanceId })}
          onSetReady={(ready) => send({ type: "SET_FINAL_COUNT_READY", playerId: $selfPlayerId, ready })}
          onEndGame={() => send({ type: "END_GAME" })}
        />
      {:else if $gameState.phase === "ended"}
        <section>
          <h2 class="mb-4 text-lg font-semibold text-slate-800">Classement final</h2>
          <ul class="mb-6 space-y-2">
            {#each rankPlayers($gameState.players) as player (player.id)}
              <li
                class="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 font-medium"
                style={`color: ${player.color}`}
              >
                <span>{`${ordinal(player.rank)} — ${player.name}`}</span>
                <span class="text-lg font-semibold">{player.score}</span>
              </li>
            {/each}
          </ul>
          <button
            type="button"
            onclick={() => {
              if (confirm("Démarrer une nouvelle partie ? Cette action efface la partie actuelle.")) {
                send({ type: "NEW_GAME" });
              }
            }}
            class="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700"
          >
            Nouvelle partie
          </button>
        </section>
      {:else}
        <nav class="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onclick={() => (view = "dashboard")}
            class={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === "dashboard" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Score
          </button>
          <button
            type="button"
            onclick={() => (view = "cards")}
            class={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === "cards" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Cartes
          </button>
          <button
            type="button"
            onclick={() => (view = "history")}
            class={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === "history" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Historique
          </button>
          <button
            type="button"
            onclick={() => {
              if (confirm("Passer au décompte final ? Cette action est définitive pour cette partie.")) {
                send({ type: "START_FINAL_COUNT" });
              }
            }}
            class="ml-auto rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-200"
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
    </div>
  </div>
</main>
