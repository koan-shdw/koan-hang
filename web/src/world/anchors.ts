// Anchors (REMAKE.md §5): world points the UI may follow. Published on the bus each frame; R3 makes the HANG widget ride them.
import * as THREE from 'three'
import { bus } from '../bus'

export class Anchors {
  private points = new Map<string, { p: THREE.Vector3; text?: string }>()
  private last = new Map<string, string>()
  private v = new THREE.Vector3()
  set(id: string, p: THREE.Vector3 | null, text?: string): void { if (p) this.points.set(id, { p: p.clone(), text }); else this.points.delete(id) }
  /** project every anchor to viewport pixels; emit only when a pixel moved */
  publish(camera: THREE.Camera, width: number, height: number): void {
    for (const id of this.last.keys()) if (!this.points.has(id) && this.last.get(id) !== 'gone') { this.last.set(id, 'gone'); bus.emit('anchor', { id, x: 0, y: 0, visible: false }) }
    for (const [id, { p, text }] of this.points) {
      this.v.copy(p).project(camera)
      const visible = this.v.z < 1 && Math.abs(this.v.x) <= 1.2 && Math.abs(this.v.y) <= 1.2
      const x = Math.round((this.v.x + 1) / 2 * width), y = Math.round((1 - this.v.y) / 2 * height)
      const key = `${x},${y},${visible},${text ?? ''}`
      if (this.last.get(id) === key) continue
      this.last.set(id, key); bus.emit('anchor', { id, x, y, visible, text })
    }
  }
}
