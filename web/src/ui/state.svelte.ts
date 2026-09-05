// UI state (REMAKE.md §2): what the UI knows, fed by the bus. Svelte 5 runes. The UI never imports world/.
import { bus, type Mode, type Look, type FxState, type Quality, type RoomInfo, type WalkSnapshot, type HudSnapshot, type ArtSnapshot, type LoaderState, type ToastKind } from '../bus'

export interface Toast { id: number; msg: string; kind: ToastKind }

export const ui = $state({
  mode: 'walk' as Mode,
  look: 'textured' as Look,
  fx: null as FxState | null,
  quality: 'full' as Quality,
  room: null as RoomInfo | null,
  failed: null as string | null,
  walk: null as WalkSnapshot | null,
  hud: { hint: 'walk', cross: false, doorTip: null, hangTip: null } as HudSnapshot,
  art: null as ArtSnapshot | null,
  loader: { active: false, done: 0, total: 0, text: '' } as LoaderState,
  mapShown: false,
  helpShown: false,
  debugShown: false,
  toasts: [] as Toast[],
})

let toastSeq = 0
bus.on('mode', ({ mode }) => { ui.mode = mode })
bus.on('look', ({ look }) => { ui.look = look })
bus.on('fx', ({ state }) => { ui.fx = state })
bus.on('quality', ({ quality }) => { ui.quality = quality })
bus.on('world_ready', (r) => { ui.room = r })
bus.on('world_failed', ({ message }) => { ui.failed = message })
bus.on('walk_state', (w) => { ui.walk = w })
bus.on('hud', (h) => { ui.hud = h })
bus.on('art_state', (a) => { ui.art = a })
bus.on('loader', (l) => { ui.loader = l })
bus.on('map_show', ({ show }) => { ui.mapShown = show })
bus.on('help_toggle', () => { ui.helpShown = !ui.helpShown })
bus.on('overlays_close', () => { ui.helpShown = false; ui.debugShown = false })
bus.on('debug_toggle', () => { ui.debugShown = !ui.debugShown })
bus.on('toast', ({ msg, kind, ms }) => {
  const t: Toast = { id: toastSeq++, msg, kind: kind ?? 'ok' }
  ui.toasts.push(t)
  setTimeout(() => { const i = ui.toasts.findIndex((x) => x.id === t.id); if (i >= 0) ui.toasts.splice(i, 1) }, ms ?? 4000)
})

export const nameOf = (id: string): string => ui.art?.library.find((x) => x.id === id)?.title ?? 'work'
