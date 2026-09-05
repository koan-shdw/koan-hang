<script lang="ts">
  import Card from './Card.svelte'
  import Chips from './Chips.svelte'
  import Row from './Row.svelte'
  import { bus, type Look, type FxKey, type Quality } from '../bus'
  import { ui } from './state.svelte'
  const looks: { id: Look; label: string; tip: string }[] = [
    { id: 'clean', label: 'clean', tip: 'the rebuilt level, plain materials' },
    { id: 'wire', label: 'wire', tip: 'clean level with its edges drawn' },
    { id: 'textured', label: 'textured', tip: "the scan's own surfaces, baked and tiled" },
  ]
  const fxList: { id: FxKey; label: string; tip: string }[] = [
    { id: 'lut', label: 'lut', tip: 'the film grade · neutral until you drop textures/lut.cube' },
    { id: 'sky', label: 'sky', tip: 'the sky dome with drifting clouds · off = the flat sky' },
    { id: 'plants', label: 'plants', tip: 'the yard plants as swaying cards · off = the spheres' },
    { id: 'glass', label: 'glass', tip: 'fresnel on the street glass · grazing angles reflect the sky' },
    { id: 'surface', label: 'surface', tip: 'slow noise over the tiles so the repeat never shows' },
    { id: 'outline', label: 'outline', tip: 'ink edges on depth and contrast' },
    { id: 'dither', label: 'dither', tip: 'ordered dither on the tones' },
    { id: 'smaa', label: 'smaa', tip: 'edge anti-aliasing' },
  ]
  const qualities: { id: Quality; label: string; tip: string }[] = [
    { id: 'full', label: 'full', tip: 'full pixel ratio, every look on' }, { id: 'balanced', label: 'balanced', tip: '1.5 pixel ratio' }, { id: 'low', label: 'low', tip: '1 pixel ratio, no smaa' },
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
  {#if ui.fx}
    <div class="legend">looks</div>
    <div class="fx">
      {#each fxList as f (f.id)}
        <label class="fxrow" title={f.tip}><input type="checkbox" checked={ui.fx[f.id]} onchange={(e) => bus.emit('set_fx', { key: f.id, on: (e.currentTarget as HTMLInputElement).checked })} />{f.label}</label>
      {/each}
    </div>
    <div class="legend">quality</div>
    <Chips options={qualities} value={ui.quality} onpick={(q) => bus.emit('set_quality', { quality: q })} />
  {/if}
  <div class="note">{where}</div>
  {#if ui.room}<div class="note">{ui.room.hangWalls} hang walls · {ui.room.stairs} stairs · {ui.room.doors} doors · {ui.room.floors} floors</div>{/if}
</Card>
