// Plants (REMAKE.md §4.5): the hedge spheres become card sprites, instanced, a wind shader sways them. Shaders, not geometry.
// The leaf card is drawn once on a canvas (no asset to ship). Dial: off = the spheres come back.
import * as THREE from 'three'

function leafCard(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 256, 256)
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * 112
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.85 + 8
    const s = 7 + rnd() * 11, t = rnd()
    g.fillStyle = `rgb(${Math.round(60 + t * 40)}, ${Math.round(105 + t * 50)}, ${Math.round(50 + t * 30)})`
    g.beginPath(); g.ellipse(x, y, s, s * 0.6, a, 0, Math.PI * 2); g.fill()
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
  return tex
}

export class Plants {
  readonly group = new THREE.Group()
  private hidden: THREE.Mesh[] = []
  private uniforms = { time: { value: 0 } }
  private on = true
  constructor(room: THREE.Group) {
    const spheres: THREE.Mesh[] = []
    room.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.type === 'SphereGeometry' && (m.material as THREE.Material).name === 'foliage') spheres.push(m) })
    if (!spheres.length) return
    const mat = new THREE.MeshStandardMaterial({ map: leafCard(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, metalness: 0 })
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uniforms.time
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 1.3 + wp.x * 2.1 + wp.z * 1.7) * 0.5 + sin(uTime * 2.9 + wp.z * 3.3) * 0.25;
          transformed.x += sway * 0.05 * uv.y; transformed.z += sway * 0.03 * uv.y;`)
    }
    // two crossed quads per sphere
    const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, 0.5, 0)
    const quads = [quad, quad.clone().rotateY(Math.PI / 2)]
    for (const q of quads) {
      const im = new THREE.InstancedMesh(q, mat, spheres.length)
      const mtx = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), r = new THREE.Quaternion()
      spheres.forEach((sp, i) => {
        sp.updateWorldMatrix(true, false); sp.matrixWorld.decompose(p, r, s)
        const geo = sp.geometry as THREE.SphereGeometry; const rad = geo.parameters.radius * s.x
        const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 0.73) % 1.4)
        mtx.compose(new THREE.Vector3(p.x, p.y - rad * 0.7 * s.y / s.x, p.z), twist, new THREE.Vector3(rad * 2.2, rad * 2.2 * 0.85, 1))
        im.setMatrixAt(i, mtx)
      })
      im.instanceMatrix.needsUpdate = true; im.userData = { kind: 'plants' }
      this.group.add(im)
    }
    this.hidden = spheres
    this.set(true)
  }
  set(on: boolean): void { this.on = on; this.group.visible = on; for (const m of this.hidden) m.visible = !on }
  get enabled(): boolean { return this.on }
  update(t: number): void { this.uniforms.time.value = t }
}
