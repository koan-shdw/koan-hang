<script lang="ts">
  import Card from './Card.svelte'
  import Chips from './Chips.svelte'
  import Row from './Row.svelte'
  import { bus, type Look } from '../bus'
  import { ui } from './state.svelte'
  const looks: { id: Look; label: string; tip: string }[] = [
    { id: 'clean', label: 'clean', tip: 'the rebuilt level, plain materials' },
    { id: 'wire', label: 'wire', tip: 'clean level with its edges drawn' },
    { id: 'textured', label: 'textured', tip: "the scan's own surfaces, baked and tiled" },
  ]
  let eye = $state(160)
  $effect(() => { if (ui.room) eye = ui.room.eyeCm })
  const where = $derived(ui.walk ? `${ui.walk.levelName} · x ${ui.walk.x.toFixed(2)} z ${ui.walk.z.toFixed(2)}${ui.walk.onStair ? ' · stair' : ''}` : '')
</script>

<Card id="level" title="level" x={12} y={52}>
  <div class="legend">look</div>
  <Chips options={looks} value={ui.look} onpick={(v) => bus.emit('set_look', { look: v })} />
  <Row label="eye height cm" tip="camera height above the floor · 160 = average eye">
    <input type="number" min="100" max="220" step="1" bind:value={eye} onchange={() => bus.emit('set_eye', { cm: Number(eye) })} />
  </Row>
  <div class="note">{where}</div>
  {#if ui.room}<div class="note">{ui.room.hangWalls} hang walls · {ui.room.stairs} stairs · {ui.room.doors} doors · {ui.room.floors} floors</div>{/if}
</Card>
