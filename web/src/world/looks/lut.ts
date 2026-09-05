// LUT grade (REMAKE.md §4.1): one 3D LUT, one pass at the end of the composer, one film look for the whole frame.
// A neutral LUT ships first (owner). He grades later: drop `textures/lut.cube` in the repo, it loads over the neutral one.
import * as THREE from 'three'
import { LUTPass } from 'three/examples/jsm/postprocessing/LUTPass.js'
import { LUTCubeLoader } from 'three/examples/jsm/loaders/LUTCubeLoader.js'

/** an identity LUT: every colour maps to itself */
export function neutralLUT(size = 32): THREE.Data3DTexture {
  const data = new Uint8Array(size * size * size * 4)
  let i = 0
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    data[i++] = Math.round(r / (size - 1) * 255); data[i++] = Math.round(g / (size - 1) * 255); data[i++] = Math.round(b / (size - 1) * 255); data[i++] = 255
  }
  const t = new THREE.Data3DTexture(data, size, size, size)
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType
  t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping
  t.generateMipmaps = false; t.needsUpdate = true
  return t
}

export function makeLUTPass(): LUTPass {
  return new LUTPass({ lut: neutralLUT(), intensity: 1 })
}

/** his .cube, when it exists; resolves false when there is none (the neutral LUT stays) */
export async function loadCube(pass: LUTPass, url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD' })
    if (!head.ok) return false
    const r = await new LUTCubeLoader().loadAsync(url)
    pass.lut = r.texture3D
    return true
  } catch { return false }
}
