// Sky shader (REMAKE.md §4.2): a dome, noise in the shader, clouds drift with time. No cloud meshes.
// The horizon is the level's fog colour so the void stays the void; the zenith is a Tokyo overcast night.
// The jpg panorama (when it exists) and the flat colour stay as the fallback dial.
import * as THREE from 'three'

const vert = /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const frag = /* glsl */ `
uniform vec3 horizon; uniform vec3 zenith; uniform vec3 cloud; uniform float time; uniform float density;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
void main() {
  float up = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(horizon, zenith, pow(up, 0.6));
  if (vDir.y > 0.01) {
    vec2 uv = vDir.xz / (vDir.y + 0.15) * 1.6;
    float n = fbm(uv + vec2(time * 0.012, time * 0.004));
    float c = smoothstep(0.45 - density * 0.2, 0.75, n) * up;
    col = mix(col, cloud, c * 0.55);
  }
  gl_FragColor = vec4(col, 1.0);
}`

export class Sky {
  readonly mesh: THREE.Mesh
  readonly uniforms: Record<string, THREE.IUniform>
  constructor(horizon: THREE.Color, radius = 90) {
    this.uniforms = { horizon: { value: horizon.clone() }, zenith: { value: new THREE.Color(0x2b3140) }, cloud: { value: new THREE.Color(0x3c4250) }, time: { value: 0 }, density: { value: 0.5 } }
    const m = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), m)
    this.mesh.renderOrder = -10; this.mesh.frustumCulled = false; this.mesh.userData = { kind: 'sky' }
  }
  update(t: number): void { this.uniforms.time.value = t }
}
