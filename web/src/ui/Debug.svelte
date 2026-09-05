<script lang="ts">
  // Tweakpane debug panel (REMAKE.md §2): off by default, backtick opens it. Never part of the shipped look.
  import { onMount } from 'svelte'
  import { Pane } from 'tweakpane'
  import { ui } from './state.svelte'
  let host: HTMLElement
  onMount(() => {
    const pane = new Pane({ container: host, title: 'KOAN.hang · debug' })
    const k = (window as unknown as { koanHang?: Record<string, unknown> }).koanHang
    const params = { quality: (k?.getQuality as (() => string) | undefined)?.() ?? 'full', smaa: true, exposure: 1.0, fps: 0, walk: '', works: 0 }
    pane.addBinding(params, 'quality', { options: { full: 'full', balanced: 'balanced', low: 'low' } }).on('change', (ev) => (k?.quality as ((q: string) => void) | undefined)?.(ev.value))
    pane.addBinding(params, 'smaa').on('change', (ev) => { const s = k?.smaa as { enabled: boolean } | undefined; if (s) s.enabled = ev.value })
    pane.addBinding(params, 'exposure', { min: 0.2, max: 2.5 }).on('change', (ev) => { const r = k?.renderer as { toneMappingExposure: number } | undefined; if (r) r.toneMappingExposure = ev.value })
    pane.addBinding(params, 'fps', { readonly: true, view: 'graph', min: 0, max: 144 })
    pane.addBinding(params, 'walk', { readonly: true })
    pane.addBinding(params, 'works', { readonly: true })
    let frames = 0, t0 = performance.now(), raf = 0
    const tick = () => {
      frames++; const now = performance.now()
      if (now - t0 >= 500) { params.fps = Math.round(frames * 1000 / (now - t0)); frames = 0; t0 = now }
      params.walk = ui.walk ? `${ui.walk.levelName} ${ui.walk.x.toFixed(2)} ${ui.walk.z.toFixed(2)}` : ''
      params.works = ui.art?.layout.items.length ?? 0
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); pane.dispose() }
  })
</script>

<div class="debug" bind:this={host}></div>
