<script>
  let { history, players } = $props();

  function playerName(id) {
    return players.find((p) => p.id === id)?.name ?? "?";
  }
</script>

<section>
  {#if history.length === 0}
    <p class="rounded-lg bg-slate-50 px-3 py-4 text-center text-slate-500">Aucune modification pour le moment.</p>
  {:else}
    <ul class="space-y-2">
      {#each [...history].reverse() as entry (entry.seq)}
        <li class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span class="font-semibold">{playerName(entry.playerId)}</span>
          <span class={`font-semibold ${entry.delta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
          </span>
          <span class="text-slate-500">{`→ ${entry.resultingScore}`}</span>
          {#if entry.source === "steal" && entry.delta > 0}
            <span class="text-slate-500">{`a volé ${entry.delta} point(s) à ${playerName(entry.opponentPlayerId)}`}</span>
          {:else if entry.source === "steal"}
            <span class="text-slate-500">{`s'est fait voler ${-entry.delta} point(s) par ${playerName(entry.actorPlayerId)}`}</span>
          {:else if entry.source === "group_penalty"}
            <span class="text-slate-500">{`perte collective infligée par ${playerName(entry.actorPlayerId)}`}</span>
          {:else if entry.source === "final_count"}
            <span class="text-slate-500">{`décompte final — ${entry.cardName}`}</span>
          {:else if entry.source === "final_count_removal"}
            <span class="text-slate-500">{`décompte final (retrait) — ${entry.cardName}`}</span>
          {:else}
            <span class="text-slate-500">ajustement manuel</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
