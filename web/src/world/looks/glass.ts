// Glass (REMAKE.md §4.6): a fresnel on the street glass. Grazing angles reflect the sky tint and go opaque, head-on stays clear.
// No reflection geometry. onBeforeCompile on the one shared 'glass' material; `strength` 0 = the plain pane.
import * as THREE from 'three'

export class Glass {
  readonly uniforms = { uFresnel: { value: 1.0 }, uSkyTint: { value: new THREE.Color(0x8fa3b8) } }
  constructor(m: THREE.MeshStandardMaterial) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFresnel = this.uniforms.uFresnel; sh.uniforms.uSkyTint = this.uniforms.uSkyTint
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFresnel; uniform vec3 uSkyTint;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0) * uFresnel;
          diffuseColor.a = clamp(diffuseColor.a + fres * 0.6, 0.0, 0.85);
          totalEmissiveRadiance += uSkyTint * fres * 0.5;`)
    }
    m.needsUpdate = true
  }
  set(on: boolean): void { this.uniforms.uFresnel.value = on ? 1 : 0 }
}
