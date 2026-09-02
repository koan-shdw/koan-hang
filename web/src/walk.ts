// Walk mode (SPEC s5.2): pointer-lock first person, WASD, collision against the level's nav data only
// (walls with openings + door state, floors, stairs, blockers). Never the render meshes.
import * as THREE from 'three'
import { type Level, type Wall, type Stair, type DoorRuntime, floorOf, pointInPoly, stairRect, stairProgress, inRect, wallLength, wallDir, doorCentre } from './level'

const RADIUS = 0.25
const SPEED = 2.2, RUN = 4.2
const LOOK = 0.0022

export interface WalkState { level: string; x: number; z: number; feetY: number; yaw: number; pitch: number; onStair: string | null; locked: boolean }

export class Walker {
  readonly camera: THREE.PerspectiveCamera
  state: WalkState
  doors: DoorRuntime[] = []
  private keys = new Set<string>()
  private lv: Level
  private dom: HTMLElement
  private smoothY: number
  onChange: ((s: WalkState) => void) | null = null

  constructor(lv: Level, camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.lv = lv; this.camera = camera; this.dom = dom
    const sp = lv.spawn ?? { level: lv.levels[0].id, x: 0, z: 0, yawDeg: 0 }
    const y = floorOf(lv, sp.level).floorY
    this.state = { level: sp.level, x: sp.x, z: sp.z, feetY: y, yaw: THREE.MathUtils.degToRad(sp.yawDeg), pitch: 0, onStair: null, locked: false }
    this.smoothY = y
    dom.addEventListener('click', () => { if (!this.state.locked) dom.requestPointerLock() })
    document.addEventListener('pointerlockchange', () => {
      this.state.locked = document.pointerLockElement === dom
      if (!this.state.locked) this.keys.clear()
      this.onChange?.(this.state)
    })
    document.addEventListener('mousemove', (e) => {
      if (!this.state.locked) return
      this.state.yaw -= e.movementX * LOOK
      this.state.pitch = THREE.MathUtils.clamp(this.state.pitch - e.movementY * LOOK, -1.45, 1.45)
    })
    window.addEventListener('keydown', (e) => { if (!isTyping(e)) this.keys.add(e.code) })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
    this.applyCamera()
  }

  teleport(level: string, x: number, z: number): void {
    this.state.level = level; this.state.x = x; this.state.z = z; this.state.onStair = null
    this.state.feetY = floorOf(this.lv, level).floorY; this.smoothY = this.state.feetY
    this.applyCamera(); this.onChange?.(this.state)
  }

  update(dt: number): void {
    const s = this.state
    if (s.locked) {
      let fwd = 0, side = 0
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) side += 1
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) side -= 1
      if (fwd || side) {
        const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN : SPEED
        const len = Math.hypot(fwd, side); fwd /= len; side /= len
        const dx = (-Math.sin(s.yaw) * fwd + Math.cos(s.yaw) * side) * speed * dt
        const dz = (-Math.cos(s.yaw) * fwd - Math.sin(s.yaw) * side) * speed * dt
        this.tryMove(dx, dz)
      }
    }
    this.updateHeight()
    this.smoothY += (s.feetY - this.smoothY) * Math.min(1, dt * 14)
    this.applyCamera()
  }

  /** the nearest door with a leaf within reach, for the E key */
  nearestDoor(maxDist = 1.6): DoorRuntime | null {
    const s = this.state
    let best: DoorRuntime | null = null, bd = maxDist
    for (const d of this.doors) {
      if (d.wall.level !== s.level) continue
      const c = doorCentre(d)
      const dist = Math.hypot(c.x - s.x, c.z - s.z)
      if (dist < bd) { bd = dist; best = d }
    }
    return best
  }

  tryMove(dx: number, dz: number): void {
    const s = this.state
    if (this.step(s.x + dx, s.z + dz)) return
    if (this.step(s.x + dx, s.z)) return
    this.step(s.x, s.z + dz)
  }

  private step(x: number, z: number): boolean {
    const s = this.state
    let px = x, pz = z
    for (let iter = 0; iter < 3; iter++) {
      let moved = false
      for (const w of this.lv.walls) {
        if (!this.wallActive(w)) continue
        const r = this.pushOut(px, pz, w)
        if (r) { px = r[0]; pz = r[1]; moved = true }
      }
      if (!moved) break
    }
    for (const b of this.lv.blockers) if (b.level === s.level && pointInPoly(px, pz, b.poly)) return false
    if (!this.onGround(px, pz)) return false
    s.x = px; s.z = pz
    this.onChange?.(s)
    return true
  }

  private wallActive(w: Wall): boolean {
    const s = this.state
    if (w.level !== s.level) return false
    return w.topY > s.feetY + 0.3 && w.baseY < s.feetY + 1.5
  }

  private doorOpen(w: Wall, u: number): boolean {
    const d = this.doors.find((dr) => dr.wall === w && Math.abs(dr.opening.u - u) < 1e-6)
    return d ? d.open && d.t > 0.7 : true
  }

  private pushOut(x: number, z: number, w: Wall): [number, number] | null {
    const L = wallLength(w), [dx, dz] = wallDir(w)
    const rx = x - w.a[0], rz = z - w.a[1]
    const u = Math.max(0, Math.min(L, rx * dx + rz * dz))
    const cx = w.a[0] + dx * u, cz = w.a[1] + dz * u
    const ox = x - cx, oz = z - cz
    const d = Math.hypot(ox, oz)
    const pad = RADIUS + w.thickness / 2
    if (d >= pad) return null
    for (const o of w.openings) {
      if (o.kind !== 'door') continue
      if (u > o.u + RADIUS * 0.6 && u < o.u + o.w - RADIUS * 0.6 && o.h > 1.6 && this.doorOpen(w, o.u)) return null
    }
    if (d < 1e-6) {
      const nx = w.facing === '+x' ? 1 : w.facing === '-x' ? -1 : 0
      const nz = w.facing === '+z' ? 1 : w.facing === '-z' ? -1 : 0
      return [cx + nx * pad, cz + nz * pad]
    }
    return [cx + (ox / d) * pad, cz + (oz / d) * pad]
  }

  /** the stair the walker is on or may step onto at (x,z). Stacked flights share a footprint, so pick by
   *  state: the one already underfoot, else the one leaving this level at its bottom, else the one arriving
   *  at this level at its top. Over a footprint but not at an end = the void. */
  private stairHere(x: number, z: number): { st: Stair; p: number } | null {
    const s = this.state
    const cands = this.lv.stairs.filter((st) => inRect(x, z, stairRect(st), 0.05)).map((st) => ({ st, p: stairProgress(st, x, z) }))
    if (!cands.length) return null
    return cands.find((c) => c.st.id === s.onStair)
      ?? cands.find((c) => c.st.level === s.level && c.p < 0.2)
      ?? cands.find((c) => c.st.to === s.level && c.p > 0.8)
      ?? null
  }

  private onGround(x: number, z: number): boolean {
    const s = this.state
    const c = this.stairHere(x, z)
    if (c) return !(c.st.topBlocked !== undefined && c.p > c.st.topBlocked)
    const floorY = floorOf(this.lv, s.level).floorY
    for (const st of this.lv.stairs) {
      if (!inRect(x, z, stairRect(st), -0.05)) continue
      if (st.to === s.level) return false // the hole where a flight arrives on this level
      const h = st.bottomY + (st.topY - st.bottomY) * THREE.MathUtils.clamp(stairProgress(st, x, z), 0, 1)
      if (st.level === s.level && h - floorY < 1.9) return false // treads too low to walk under
    }
    for (const f of this.lv.floors) if (f.level === s.level && pointInPoly(x, z, f.poly)) return true
    return false
  }

  private updateHeight(): void {
    const s = this.state
    const c = this.stairHere(s.x, s.z)
    if (c) {
      const p = THREE.MathUtils.clamp(c.p, 0, 1)
      s.feetY = c.st.bottomY + (c.st.topY - c.st.bottomY) * p
      s.onStair = c.st.id
      const newLevel = p > 0.97 && c.st.to ? c.st.to : p < 0.03 ? c.st.level : s.level
      if (newLevel !== s.level) { s.level = newLevel; this.onChange?.(s) }
    } else {
      s.onStair = null
      s.feetY = floorOf(this.lv, s.level).floorY
    }
  }

  private applyCamera(): void {
    const s = this.state
    this.camera.position.set(s.x, this.smoothY + this.lv.eyeHeight, s.z)
    this.camera.rotation.set(0, 0, 0, 'YXZ')
    this.camera.rotation.y = s.yaw
    this.camera.rotation.x = s.pitch
  }

  release(): void { if (document.pointerLockElement === this.dom) document.exitPointerLock() }
}

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}
