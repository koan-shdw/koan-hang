<script lang="ts">
  // HANG: the widget (gate 1, unchanged): snap line, height, gap, guide, snap all
  import Card from './Card.svelte'
  import Chips from './Chips.svelte'
  import Row from './Row.svelte'
  import { bus } from '../bus'
  import { ui } from './state.svelte'
  import type { SnapLine, Guides } from '../world/art/art'
  const snaps: { id: SnapLine; label: string; tip: string }[] = [
    { id: 'top', label: 'top', tip: 'the top edge sits on the line' }, { id: 'centre', label: 'centre', tip: 'the centre sits on the line' },
    { id: 'bottom', label: 'bottom', tip: 'the bottom edge sits on the line' }, { id: 'free', label: 'free', tip: 'hang it where the crosshair is' },
  ]
  const g = $derived(ui.art?.layout.guides ?? null)
  const held = $derived(ui.art && ui.art.held ? ui.art.library.find((a) => a.id === ui.art?.held) ?? null : null)
  const height = $derived(g && g.snap !== 'free' ? g[g.snap] : 0)
  const setHeight = (v: number) => { if (!g || g.snap === 'free') return; const patch: Partial<Guides> = {}; patch[g.snap] = v; bus.emit('set_guides', { patch }) }
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value)
</script>

<Card id="hang" title="hang" x={12} y={52} anchor="right" status={ui.art ? `${ui.art.layout.items.length} on walls` : ''}>
  <div class="note">{held ? `holding ${held.title} · ${held.w} × ${held.h} cm` : 'holding nothing · click a thumbnail'}</div>
  <div class="legend">snap line</div>
  {#if g}
    <Chips options={snaps} value={g.snap} onpick={(v) => bus.emit('set_guides', { patch: { snap: v } })} />
    <Row label="height cm" tip="the line, in cm above this floor">
      <input type="number" min="0" max="400" step="1" value={height} disabled={g.snap === 'free'} onchange={(e) => setHeight(num(e))} />
    </Row>
    <input type="range" min="0" max="400" step="1" value={height} disabled={g.snap === 'free'} oninput={(e) => setHeight(num(e))} />
    <Row label="gap cm" tip="edge-to-edge snap distance between neighbours">
      <input type="number" min="0" max="200" step="1" value={g.gap} onchange={(e) => bus.emit('set_guides', { patch: { gap: num(e) } })} />
    </Row>
    <Row label="show guide"><input type="checkbox" checked={g.show} onchange={(e) => bus.emit('set_guides', { patch: { show: (e.currentTarget as HTMLInputElement).checked } })} /></Row>
    <div class="chips">
      <button class="chip" onclick={() => bus.emit('snap_all', { wall: 'looked' })}>snap all on this wall</button>
      <button class="chip" onclick={() => bus.emit('snap_all', { wall: 'all' })}>snap all</button>
    </div>
  {/if}
</Card>
