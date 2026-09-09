<!-- client/src/screens/Dashboard.svelte -->
<script>
  let { game, selfPlayerId, onAdjustScore, onNextTurn } = $props();
</script>

<section>
  <ul>
    {#each game.players as player (player.id)}
      <li data-testid={`player-${player.id}`} class:active={player.id === game.activePlayerId} style={`color: ${player.color}`}>
        <span>{player.name}</span>
        <span>{player.score}</span>
      </li>
    {/each}
  </ul>

  <div class="controls">
    <button type="button" onclick={() => onAdjustScore(1)}>+1</button>
    <button type="button" onclick={() => onAdjustScore(-1)}>-1</button>
  </div>

  <button type="button" onclick={onNextTurn}>Joueur suivant</button>
</section>
