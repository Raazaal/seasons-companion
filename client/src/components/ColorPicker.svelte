<script>
  const COLOR_PALETTE = ["red", "blue", "green", "yellow"];

  let { takenColors = [], selected = null, onSelect } = $props();
</script>

<div class="color-picker flex gap-2">
  {#each COLOR_PALETTE as color}
    <button
      type="button"
      aria-label={color}
      class:selected={selected === color}
      disabled={takenColors.includes(color)}
      onclick={() => onSelect(color)}
      style={`background-color: ${color};`}
      class="h-10 w-10 rounded-full ring-offset-2 transition disabled:cursor-not-allowed disabled:opacity-30"
    ></button>
  {/each}
</div>

<style>
  button.selected {
    box-shadow: 0 0 0 3px white, 0 0 0 5px var(--color-slate-900, #0f172a);
  }
</style>
