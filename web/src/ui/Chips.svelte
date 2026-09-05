<script lang="ts" generics="T extends string">
  // A chip row: one on at a time. Tooltips on every chip, all lowercase (UI cards law 2026-09).
  let { options, value, onpick }: { options: { id: T; label: string; tip: string; disabled?: string }[]; value: T; onpick: (v: T) => void } = $props()
</script>

<div class="chips">
  {#each options as o (o.id)}
    <button class="chip" class:on={o.id === value} title={o.disabled ? `${o.tip} · ${o.disabled}` : o.tip} disabled={!!o.disabled} onclick={() => onpick(o.id)}>{o.label}</button>
  {/each}
</div>
