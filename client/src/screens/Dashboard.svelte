<script>
  let { game, selfPlayerId, onAdjustScore, onStealAllOpponents, onPenaltyAllOpponents, onNextTurn } = $props();

  const tiers = [1, 2, 3];
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

  <div class="mb-4 space-y-2">
    {#each tiers as tier (tier)}
      <div class="flex gap-3">
        <button
          type="button"
          onclick={() => onAdjustScore(-tier)}
          class="flex-1 rounded-lg bg-rose-100 py-2.5 text-lg font-semibold text-rose-800 transition hover:bg-rose-200"
        >
          {`-${tier}`}
        </button>
        <button
          type="button"
          onclick={() => onAdjustScore(tier)}
          class="flex-1 rounded-lg bg-emerald-100 py-2.5 text-lg font-semibold text-emerald-800 transition hover:bg-emerald-200"
        >
          {`+${tier}`}
        </button>
      </div>
    {/each}
  </div>

  <p class="mb-2 text-sm font-medium text-slate-500">Voler des points à tous les adversaires</p>
  <div class="mb-4 flex gap-2">
    {#each tiers as tier (tier)}
      <button
        type="button"
        onclick={() => onStealAllOpponents(tier)}
        class="flex-1 rounded-lg bg-amber-100 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-200"
      >
        {`Voler ${tier}`}
      </button>
    {/each}
  </div>

  <p class="mb-2 text-sm font-medium text-slate-500">Faire perdre des points à tous les adversaires</p>
  <div class="mb-6 flex gap-2">
    {#each tiers as tier (tier)}
      <button
        type="button"
        onclick={() => onPenaltyAllOpponents(tier)}
        class="flex-1 rounded-lg bg-slate-200 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
      >
        {`-${tier} à tous`}
      </button>
    {/each}
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
