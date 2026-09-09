<script>
  const COLOR_PALETTE = ["red", "blue", "green", "yellow"];

  let { takenColors = [], selected = null, onSelect } = $props();
</script>

<div class="color-picker">
  {#each COLOR_PALETTE as color}
    <button
      type="button"
      aria-label={color}
      class:selected={selected === color}
      disabled={takenColors.includes(color)}
      onclick={() => onSelect(color)}
    >
      {color}
    </button>
  {/each}
</div>
