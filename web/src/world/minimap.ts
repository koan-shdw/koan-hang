// Minimap (corner, always on) + full plan overlay (M): walls, floors, stairs of the current level, click = teleport.
import { type Level, floorOf, pointInPoly, stairRect } from './room/level'
import type { WalkState } from './walk'

const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()

export class Minimap {
  private lv: Level
  private bounds = { x0: 0, x1: 1, z0: 0, z1: 1 }
  constructor(lv: Level, private small: HTMLCanvasElement, private big: HTMLCanvasElement) {
    this.lv = lv
    this.computeBounds()
  }
  setLevel(lv: Level): void { this.lv = lv; this.computeBounds() }
  private computeBounds(): void {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const f of this.lv.floors) for (const [x, z] of f.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
    for (const w of this.lv.walls) for (const [x, z] of [w.a, w.b]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
    this.bounds = { x0: x0 - 0.5, x1: x1 + 0.5, z0: z0 - 0.5, z1: z1 + 0.5 }
  }
  /** world -> canvas. North (+z) is up on the map, so z flips. */
  private map(c: HTMLCanvasElement) {
    const b = this.bounds
    const sx = c.width / (b.x1 - b.x0), sz = c.height / (b.z1 - b.z0)
    const s = Math.min(sx, sz)
    const ox = (c.width - (b.x1 - b.x0) * s) / 2, oz = (c.height - (b.z1 - b.z0) * s) / 2
    return {
      s,
      toC: (x: number, z: number): [number, number] => [ox + (x - b.x0) * s, c.height - oz - (z - b.z0) * s],
      toW: (px: number, py: number): [number, number] => [b.x0 + (px - ox) / s, b.z0 + (c.height - oz - py) / s],
    }
  }
  draw(st: WalkState): void {
    this.paint(this.small, st, false)
    if (!this.big.hidden) this.paint(this.big, st, true)
  }
  private paint(c: HTMLCanvasElement, st: WalkState, labels: boolean): void {
    const ctx = c.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = c.clientWidth, H = c.clientHeight
    if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const m = this.map({ width: W, height: H } as HTMLCanvasElement)
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = cssVar('--bg0'); ctx.globalAlpha = labels ? 0.92 : 0.7; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1
    const accent = cssVar('--accent'), muted = cssVar('--muted'), dim = cssVar('--dim'), line2 = cssVar('--line2')
    // floors
    for (const f of this.lv.floors) {
      if (f.level !== st.level) continue
      ctx.beginPath(); f.poly.forEach(([x, z], i) => { const [px, py] = m.toC(x, z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) }); ctx.closePath()
      ctx.fillStyle = line2; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1
    }
    // stairs
    for (const s of this.lv.stairs) {
      if (s.level !== st.level && s.to !== st.level) continue
      const r = stairRect(s); const [x0, y0] = m.toC(r.x0, r.z1), [x1, y1] = m.toC(r.x1, r.z0)
      ctx.strokeStyle = dim; ctx.lineWidth = 1
      const n = s.treads
      for (let i = 0; i <= n; i++) {
        const t = i / n
        ctx.beginPath()
        if (s.dir === '+z' || s.dir === '-z') { const y = y0 + (y1 - y0) * t; ctx.moveTo(x0, y); ctx.lineTo(x1, y) }
        else { const x = x0 + (x1 - x0) * t; ctx.moveTo(x, y0); ctx.lineTo(x, y1) }
        ctx.stroke()
      }
    }
    // walls
    for (const w of this.lv.walls) {
      if (w.level !== st.level) continue
      const [ax, ay] = m.toC(w.a[0], w.a[1]), [bx, by] = m.toC(w.b[0], w.b[1])
      ctx.strokeStyle = w.hang === false ? dim : muted; ctx.lineWidth = w.hang === false ? 1 : 2
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
      // door openings drawn as gaps in accent
      const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1
      for (const o of w.openings) {
        const u0 = o.u / L, u1 = (o.u + o.w) / L
        const p0 = m.toC(w.a[0] + (w.b[0] - w.a[0]) * u0, w.a[1] + (w.b[1] - w.a[1]) * u0)
        const p1 = m.toC(w.a[0] + (w.b[0] - w.a[0]) * u1, w.a[1] + (w.b[1] - w.a[1]) * u1)
        ctx.strokeStyle = o.kind === 'door' ? accent : cssVar('--focus'); ctx.lineWidth = o.kind === 'door' ? 3 : 1
        ctx.setLineDash(o.kind === 'door' ? [] : [3, 3])
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.setLineDash([])
      }
      if (labels && w.hang !== false) {
        ctx.fillStyle = muted; ctx.font = '10px monospace'
        const [mx, my] = m.toC((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2)
        ctx.fillText(w.name, mx + 4, my - 4)
      }
    }
    // player
    const [px, py] = m.toC(st.x, st.z)
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.arc(px, py, labels ? 5 : 4, 0, Math.PI * 2); ctx.fill()
    // heading: look dir (-sin yaw, -cos yaw) in world; map flips z
    const hx = -Math.sin(st.yaw), hz = -Math.cos(st.yaw)
    ctx.strokeStyle = accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + hx * 14, py - hz * 14); ctx.stroke()
    if (labels) {
      ctx.fillStyle = cssVar('--txt'); ctx.font = '12px monospace'
      ctx.fillText(`${floorOf(this.lv, st.level).name} floor · click = go there · M or Esc = close`, 10, H - 10)
    }
  }
  /** canvas click on the big map -> world point if it is on a floor of the current level */
  hit(px: number, py: number, st: WalkState): [number, number] | null {
    const m = this.map({ width: this.big.clientWidth, height: this.big.clientHeight } as HTMLCanvasElement)
    const [x, z] = m.toW(px, py)
    for (const f of this.lv.floors) if (f.level === st.level && pointInPoly(x, z, f.poly)) return [x, z]
    return null
  }
}
