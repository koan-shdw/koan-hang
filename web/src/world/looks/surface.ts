// Surface (REMAKE.md §4, "noise over the scan textures, no bigger images"): a slow world-space noise tints every tiled
// material so the repeat never reads as a repeat. onBeforeCompile on the tiled materials; `strength` 0 = the plain tile.
import * as THREE from 'three'

export class Surface {
  readonly uniforms = { uNoise: { value: 1.0 } }
  constructor(materials: THREE.MeshStandardMaterial[]) {
    for (const m of materials) {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uNoise = this.uniforms.uNoise
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vSurfW;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvSurfW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec3 vSurfW; uniform float uNoise;
            float sHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
            float sNoise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
              float a = mix(mix(sHash(i), sHash(i + vec3(1,0,0)), f.x), mix(sHash(i + vec3(0,1,0)), sHash(i + vec3(1,1,0)), f.x), f.y);
              float b = mix(mix(sHash(i + vec3(0,0,1)), sHash(i + vec3(1,0,1)), f.x), mix(sHash(i + vec3(0,1,1)), sHash(i + vec3(1,1,1)), f.x), f.y);
              return mix(a, b, f.z); }`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            float sn = sNoise(vSurfW * 0.45) * 0.6 + sNoise(vSurfW * 1.7) * 0.4;
            diffuseColor.rgb *= mix(1.0, 0.9 + sn * 0.2, uNoise);`)
      }
      m.needsUpdate = true
    }
  }
  set(on: boolean): void { this.uniforms.uNoise.value = on ? 1 : 0 }
}
