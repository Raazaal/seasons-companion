<script>
  let { allCards, players, selfPlayerId, onAddFinalCard, onRemoveFinalCard, onSetReady, onEndGame } = $props();

  let crystalCards = $derived(allCards.filter((c) => c.endGameCrystals !== null));
  let selfPlayer = $derived(players.find((p) => p.id === selfPlayerId));
  let invokedCards = $derived(selfPlayer?.finalCards ?? []);
  let selfReady = $derived(selfPlayer?.finalCountReady ?? false);
  let notReadyPlayers = $derived(players.filter((p) => !p.finalCountReady));
  let allReady = $derived(notReadyPlayers.length === 0);

  function cardName(cardId) {
    return allCards.find((c) => c.id === cardId)?.name ?? cardId;
  }

  function cardCrystals(cardId) {
    return allCards.find((c) => c.id === cardId)?.endGameCrystals ?? 0;
  }

  function signed(amount) {
    return amount > 0 ? `+${amount}` : `${amount}`;
  }
</script>

<section>
  <h2 class="mb-3 text-lg font-semibold text-slate-800">Scores</h2>
  <ul class="mb-6 space-y-2">
    {#each players as player (player.id)}
      <li class="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 font-medium" style={`color: ${player.color}`}>
        <span>{`${player.name} — ${player.score}`}</span>
        <span class={`text-xs font-semibold ${player.finalCountReady ? "text-emerald-600" : "text-slate-400"}`}>
          {player.finalCountReady ? "Prêt" : "En cours"}
        </span>
      </li>
    {/each}
  </ul>

  <h2 class="mb-3 text-lg font-semibold text-slate-800">Cartes invoquées</h2>
  {#if invokedCards.length === 0}
    <p class="mb-6 rounded-lg bg-slate-50 px-3 py-4 text-center text-slate-500">Aucune carte invoquée pour le moment.</p>
  {:else}
    <ul class="mb-6 space-y-2">
      {#each invokedCards as entry (entry.instanceId)}
        <li class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span class="font-medium">{`${cardName(entry.cardId)} (${signed(cardCrystals(entry.cardId))})`}</span>
          <button
            type="button"
            onclick={() => onRemoveFinalCard(entry.instanceId)}
            class="rounded-md bg-rose-100 px-3 py-1 text-sm font-medium text-rose-800 transition hover:bg-rose-200"
          >
            {`Retirer ${cardName(entry.cardId)}`}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <h2 class="mb-3 text-lg font-semibold text-slate-800">Cartes de fin de partie</h2>
  <ul class="mb-6 flex flex-wrap gap-2">
    {#each crystalCards as card (card.id)}
      <li>
        <button
          type="button"
          onclick={() => onAddFinalCard(card.id)}
          class="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
        >
          {`Ajouter ${card.name} (${signed(card.endGameCrystals)})`}
        </button>
      </li>
    {/each}
  </ul>

  <button
    type="button"
    onclick={() => onSetReady(!selfReady)}
    class={`mb-3 w-full rounded-lg px-4 py-2.5 font-medium transition ${selfReady ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
  >
    {selfReady ? "J'ai terminé mon décompte (annuler)" : "J'ai terminé mon décompte"}
  </button>

  <button
    type="button"
    onclick={onEndGame}
    disabled={!allReady}
    class="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
  >
    Terminer la partie
  </button>
  {#if !allReady}
    <p class="mt-2 text-center text-sm text-slate-500">
      {`En attente de : ${notReadyPlayers.map((p) => p.name).join(", ")}`}
    </p>
  {/if}
</section>
