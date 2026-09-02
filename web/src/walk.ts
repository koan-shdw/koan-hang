// Walk mode (SPEC s5.2): pointer-lock first person, WASD, collision against the clean layer only.
import * as THREE from 'three'
import { type Level, type Wall, type Stair, floorOf, pointInPoly, stairRect, stairProgress, inRect, wallLength, wallDir } from './level'

const RADIUS = 0.25
const SPEED = 2.2, RUN = 4.2
const LOOK = 0.0022

export interface WalkState { level: string; x: number; z: number; feetY: number; yaw: number; pitch: number; onStair: string | null; locked: boolean }

export class Walker {
  readonly camera: THREE.PerspectiveCamera
  state: WalkState
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
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return
      this.keys.add(e.code)
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
    this.applyCamera()
  }

  setLevel(lv: Level): void { this.lv = lv }

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
        // camera looks along (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw)
        const dx = (-Math.sin(s.yaw) * fwd + Math.cos(s.yaw) * side) * speed * dt
        const dz = (-Math.cos(s.yaw) * fwd - Math.sin(s.yaw) * side) * speed * dt
        this.tryMove(dx, dz)
      }
    }
    this.updateHeight()
    this.smoothY += (s.feetY - this.smoothY) * Math.min(1, dt * 14)
    this.applyCamera()
  }

  /** move by a world-space delta with wall push-out and floor check (public for tests and teleport helpers) */
  tryMove(dx: number, dz: number): void {
    const s = this.state
    if (this.step(s.x + dx, s.z + dz)) return
    if (this.step(s.x + dx, s.z)) return
    this.step(s.x, s.z + dz)
  }

  /** move to (x,z) if allowed: not through walls, and over a floor or stair of the current level */
  private step(x: number, z: number): boolean {
    const s = this.state
    let px = x, pz = z
    // push out of walls
    for (let iter = 0; iter < 3; iter++) {
      let moved = false
      for (const w of this.lv.walls) {
        if (!this.wallActive(w)) continue
        const r = this.pushOut(px, pz, w)
        if (r) { px = r[0]; pz = r[1]; moved = true }
      }
      if (!moved) break
    }
    // blockers
    for (const b of this.lv.blockers) {
      if (b.level !== s.level) continue
      if (pointInPoly(px, pz, b.poly)) return false
    }
    if (!this.onGround(px, pz)) return false
    s.x = px; s.z = pz
    this.onChange?.(s)
    return true
  }

  private wallActive(w: Wall): boolean {
    const s = this.state
    if (w.level !== s.level) return false
    // a wall over the current floor only if it spans the walker's height band
    return w.topY > s.feetY + 0.3 && w.baseY < s.feetY + 1.5
  }

  /** circle vs segment; returns corrected position or null. Door openings let the walker through. */
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
      if (u > o.u + RADIUS * 0.6 && u < o.u + o.w - RADIUS * 0.6 && o.h > 1.6) return null
    }
    if (d < 1e-6) {
      // exactly on the line: push toward the room-facing side
      const nx = w.facing === '+x' ? 1 : w.facing === '-x' ? -1 : 0
      const nz = w.facing === '+z' ? 1 : w.facing === '-z' ? -1 : 0
      return [cx + nx * pad, cz + nz * pad]
    }
    return [cx + (ox / d) * pad, cz + (oz / d) * pad]
  }

  private onGround(x: number, z: number): boolean {
    const s = this.state
    for (const st of this.lv.stairs) {
      if (!inRect(x, z, stairRect(st), 0.05)) continue
      if (s.onStair === st.id) return true // already on it: anywhere along it
      // stepping on from the floor only at the matching end (never from the side of the void)
      const p = stairProgress(st, x, z)
      if (st.level === s.level && p < 0.2) return true
      if (st.to === s.level && p > 0.8) return true
    }
    for (const f of this.lv.floors) if (f.level === s.level && pointInPoly(x, z, f.poly)) return true
    return false
  }

  private updateHeight(): void {
    const s = this.state
    let st: Stair | null = null
    for (const c of this.lv.stairs) {
      if ((c.level === s.level || c.to === s.level) && inRect(s.x, s.z, stairRect(c), 0.05)) { st = c; break }
    }
    if (st) {
      const p = THREE.MathUtils.clamp(stairProgress(st, s.x, s.z), 0, 1)
      s.feetY = st.bottomY + (st.topY - st.bottomY) * p
      s.onStair = st.id
      const newLevel = p > 0.97 ? st.to : p < 0.03 ? st.level : s.level
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
