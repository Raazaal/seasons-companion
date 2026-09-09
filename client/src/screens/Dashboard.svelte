<script>
  let { game, selfPlayerId, onAdjustScore, onNextTurn } = $props();
</script>

<section>
  <ul class="mb-6 space-y-2">
    {#each game.players as player (player.id)}
      <li
        data-testid={`player-${player.id}`}
        class:active={player.id === game.activePlayerId}
        style={`color: ${player.color}`}
        class="flex items-center justify-between rounded-lg border-l-4 border-transparent bg-slate-50 px-3 py-2"
      >
        <span class="font-medium">{player.name}</span>
        <span class="text-lg font-semibold">{player.score}</span>
      </li>
    {/each}
  </ul>

  <div class="mb-4 flex gap-3">
    <button
      type="button"
      onclick={() => onAdjustScore(-1)}
      class="flex-1 rounded-lg bg-rose-100 py-2.5 text-lg font-semibold text-rose-800 transition hover:bg-rose-200"
    >
      -1
    </button>
    <button
      type="button"
      onclick={() => onAdjustScore(1)}
      class="flex-1 rounded-lg bg-emerald-100 py-2.5 text-lg font-semibold text-emerald-800 transition hover:bg-emerald-200"
    >
      +1
    </button>
  </div>

  <button
    type="button"
    onclick={onNextTurn}
    class="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700"
  >
    Joueur suivant
  </button>
</section>

<style>
  li.active {
    border-left-color: var(--player-color, #333);
    font-weight: bold;
    background: rgba(0, 0, 0, 0.05);
  }
</style>
