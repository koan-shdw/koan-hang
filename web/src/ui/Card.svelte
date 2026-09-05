<script lang="ts">
  // A floating card (KOAN.live NODE shell, floating mode). Drag by the head, fold, position remembered per id.
  import type { Snippet } from 'svelte'
  const CARD_KEY = 'koan-hang-cards'
  type Pos = { x: number; y: number; folded: boolean }
  let { id, title, x = 12, y = 52, anchor = 'left', status = '', children }: { id: string; title: string; x?: number; y?: number; anchor?: 'left' | 'right'; status?: string; children: Snippet } = $props()
  const load = (): Record<string, Pos> => { try { return JSON.parse(localStorage.getItem(CARD_KEY) ?? '{}') } catch { return {} } }
  // svelte-ignore state_referenced_locally
  const stored = load()[id]
  let placed = $state(!!stored)
  // svelte-ignore state_referenced_locally
  let p = $state<Pos>(stored ?? { x: 0, y, folded: false })
  let winW = $state(window.innerWidth), winH = $state(window.innerHeight)
  const left = $derived(Math.max(0, Math.min(winW - 80, placed ? p.x : anchor === 'right' ? winW - x - 260 : x)))
  const top = $derived(Math.max(40, Math.min(winH - 40, p.y)))
  const persist = () => { const all = load(); all[id] = { x: left, y: p.y, folded: p.folded }; try { localStorage.setItem(CARD_KEY, JSON.stringify(all)) } catch { /* private */ } }
  let drag: { dx: number; dy: number } | null = null
  const down = (e: MouseEvent) => { if ((e.target as HTMLElement).tagName === 'BUTTON') return; drag = { dx: e.clientX - left, dy: e.clientY - top }; placed = true; p.x = left; e.preventDefault() }
  const move = (e: MouseEvent) => { if (drag) { p.x = e.clientX - drag.dx; p.y = e.clientY - drag.dy } }
  const up = () => { if (drag) { drag = null; persist() } }
  const fold = () => { p.folded = !p.folded; if (placed) persist() }
</script>

<svelte:window onmousemove={move} onmouseup={up} onresize={() => { winW = window.innerWidth; winH = window.innerHeight }} />

<div class="card" data-id={id} style="left:{left}px; top:{top}px">
  <div class="card-head" onmousedown={down} role="presentation">
    <button class="fold" title="fold · click = fold or open" onclick={fold}>{p.folded ? '▸' : '▾'}</button>
    <span class="card-title">{title}</span>
    <span class="card-status">{status}</span>
  </div>
  <div class="card-body" hidden={p.folded}>{@render children()}</div>
</div>
