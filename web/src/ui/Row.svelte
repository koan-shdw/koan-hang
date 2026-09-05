<script lang="ts">
  import type { Snippet } from 'svelte'
  let { label, tip, children }: { label: string; tip?: string; children: Snippet } = $props()
</script>

<!-- svelte-ignore a11y_label_has_associated_control -->
<div class="row" title={tip}><label>{label}</label>{@render children()}</div>
