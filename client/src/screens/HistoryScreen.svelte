<!-- client/src/screens/HistoryScreen.svelte -->
<script>
  let { history, players } = $props();

  function playerName(id) {
    return players.find((p) => p.id === id)?.name ?? "?";
  }
</script>

<section>
  {#if history.length === 0}
    <p>Aucune modification pour le moment.</p>
  {:else}
    <ul>
      {#each [...history].reverse() as entry (entry.timestamp + entry.playerId + entry.delta)}
        <li>
          <span>{playerName(entry.playerId)}</span>
          <span>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span>
          <span>{`→ ${entry.resultingScore}`}</span>
          {#if entry.source === "card_effect"}
            <span>{`carte ${entry.cardName} déclenché par ${playerName(entry.actorPlayerId)}`}</span>
          {:else if entry.source === "final_count"}
            <span>{`décompte final — ${entry.cardName}`}</span>
          {:else}
            <span>ajustement manuel</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
