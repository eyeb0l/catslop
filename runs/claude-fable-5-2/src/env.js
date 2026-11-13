// Sky dome, sun and moon, and the day/night cycle that drives every light.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, TAU } from './util.js';

const DAY_FRACTION = 0.62; // share of the cycle the sun is up
export const CYCLE_SECONDS = 540;

// Everything is keyed on sun elevation e = sin(angle): -1 midnight, 0 horizon, 1 noon.
const STOPS = [
  { e: -1.0, zenith: '#060a1c', horizon: '#18244a', light: '#9db0ff', lightI: 1.05, sky: '#34478a', ground: '#1a2140', hemiI: 1.1, fog: '#141d3c' },
  { e: -0.14, zenith: '#0d1232', horizon: '#2c2f5e', light: '#9db0ff', lightI: 0.95, sky: '#3a4a88', ground: '#1c2240', hemiI: 1.05, fog: '#20264e' },
  { e: 0.0, zenith: '#2a3a7c', horizon: '#ff8a5c', light: '#ff9560', lightI: 1.0, sky: '#7c78b0', ground: '#4d3d48', hemiI: 0.85, fog: '#e79476' },
  { e: 0.16, zenith: '#3565c4', horizon: '#ffcc8e', light: '#ffc88c', lightI: 2.3, sky: '#a6bce8', ground: '#70693f', hemiI: 0.95, fog: '#f4d3a6' },
  { e: 0.5, zenith: '#1f6fd6', horizon: '#aad6f5', light: '#fff0d4', lightI: 2.9, sky: '#bcd9ff', ground: '#77824a', hemiI: 1.05, fog: '#bcdcf2' },
  { e: 1.0, zenith: '#1a66d2', horizon: '#a6d4f5', light: '#fff4e0', lightI: 3.0, sky: '#c2ddff', ground: '#77824a', hemiI: 1.1, fog: '#bcdcf2' },
].map((s) => ({
  ...s,
  zenith: new THREE.Color(s.zenith), horizon: new THREE.Color(s.horizon), light: new THREE.Color(s.light),
  sky: new THREE.Color(s.sky), ground: new THREE.Color(s.ground), fog: new THREE.Color(s.fog),
}));

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uSunDir, uMoonDir, uSunColor, uCloudLit, uCloudShade;
uniform float uNight, uTime, uSunUp;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += noise(p) * a; p = p * 2.03 + vec2(13.1, 7.7); a *= 0.5; }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = max(dir.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));
  // Haze band and the sea-level fade below the horizon.
  col = mix(col, uHorizon, smoothstep(0.0, -0.25, dir.y));

  // Sun: a soft disc and a wide warm glow that bleeds into the horizon.
  float sd = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 6.0) * 0.22 + pow(sd, 60.0) * 0.5) * uSunUp;
  col += uSunColor * smoothstep(0.9994, 0.9997, sd) * 6.0 * uSunUp;

  // Moon with a shadowed limb.
  float md = dot(dir, uMoonDir);
  float moon = smoothstep(0.9989, 0.9992, md);
  vec3 mside = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
  float limb = smoothstep(-0.02, 0.03, dot(dir - uMoonDir, mside) + 0.012);
  col += vec3(0.95, 0.96, 1.0) * moon * (0.25 + 0.75 * limb) * 2.2 * uNight;
  col += vec3(0.35, 0.45, 0.9) * pow(max(md, 0.0), 40.0) * 0.25 * uNight;

  // Stars.
  vec3 sp = dir * 190.0;
  vec3 cell = floor(sp);
  float star = hash3(cell);
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + star * 3.0) + star * 40.0);
  float sdist = length(fract(sp) - 0.5);
  col += vec3(0.9, 0.95, 1.0) * step(0.992, star) * smoothstep(0.32, 0.0, sdist) * tw * uNight * smoothstep(0.02, 0.2, dir.y) * 1.6;

  // Clouds: one layer of drifting fbm on a plane overhead.
  vec2 uv = dir.xz / (dir.y + 0.16) * 0.55 + uTime * vec2(0.008, 0.003);
  float c = fbm(uv * 1.5);
  float cov = smoothstep(0.46, 0.7, c) * smoothstep(0.01, 0.16, dir.y);
  float lit = smoothstep(0.45, 0.85, fbm(uv * 1.5 + uSunDir.xz * 0.15));
  vec3 cloud = mix(uCloudShade, uCloudLit, lit);
  cloud += uSunColor * pow(sd, 10.0) * 0.35 * uSunUp;
  col = mix(col, cloud, cov * 0.9);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.phase = 0.4; // 0 sunrise, DAY_FRACTION sunset
    this.elapsed = 0;
    this.paused = false;

    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.moonDir = new THREE.Vector3(0, -1, 0);
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.lightColor = new THREE.Color();
    this.horizon = new THREE.Color();
    this.zenith = new THREE.Color();
    this.elevation = 1;
    this.night = 0;

    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 140;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xffffff, 0.0046);

    this.skyUniforms = {
      uZenith: { value: this.zenith }, uHorizon: { value: this.horizon },
      uSunDir: { value: this.sunDir }, uMoonDir: { value: this.moonDir },
      uSunColor: { value: new THREE.Color() }, uCloudLit: { value: new THREE.Color() },
      uCloudShade: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 }, uSunUp: { value: 1 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 20),
      new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);
    this.update(0, new THREE.Vector3());
  }

  /** 'day' | 'dusk' | 'night' | 'dawn' for spawners and the HUD. */
  get period() {
    if (this.elevation > 0.2) return 'day';
    if (this.elevation < -0.1) return 'night';
    return this.phase > 0.3 && this.phase < 0.8 ? 'dusk' : 'dawn';
  }
  get isDark() { return this.elevation < 0.02; }

  setShadowQuality(size) {
    if (size <= 0) { this.sun.castShadow = false; return; }
    this.sun.castShadow = true;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }

  update(dt, focus) {
    if (!this.paused) this.phase = (this.phase + dt / CYCLE_SECONDS) % 1;
    this.elapsed += dt;
    // Map phase to a sun angle so that day lasts DAY_FRACTION of the cycle.
    const ang = this.phase < DAY_FRACTION
      ? (this.phase / DAY_FRACTION) * Math.PI
      : Math.PI + ((this.phase - DAY_FRACTION) / (1 - DAY_FRACTION)) * Math.PI;
    const e = Math.sin(ang);
    this.elevation = e;
    this.sunDir.set(Math.cos(ang) * 0.9, Math.sin(ang) * 0.82, 0.42).normalize();
    this.moonDir.set(-Math.cos(ang) * 0.75, Math.max(0.35, -Math.sin(ang) * 0.9), -0.4).normalize();

    let i = 0;
    while (i < STOPS.length - 2 && e > STOPS[i + 1].e) i++;
    const a = STOPS[i], b = STOPS[i + 1];
    const t = clamp((e - a.e) / (b.e - a.e));
    this.zenith.copy(a.zenith).lerp(b.zenith, t);
    this.horizon.copy(a.horizon).lerp(b.horizon, t);
    this.lightColor.copy(a.light).lerp(b.light, t);
    this.hemi.color.copy(a.sky).lerp(b.sky, t);
    this.hemi.groundColor.copy(a.ground).lerp(b.ground, t);
    this.hemi.intensity = lerp(a.hemiI, b.hemiI, t);
    this.scene.fog.color.copy(a.fog).lerp(b.fog, t);

    // Hand over from sun to moon while both are near zero.
    const sunUp = smoothstep(-0.09, 0.03, e);
    const moonUp = smoothstep(-0.07, -0.2, e);
    this.night = smoothstep(0.08, -0.16, e);
    const useSun = e > -0.08;
    this.lightDir.copy(useSun ? this.sunDir : this.moonDir);
    if (this.lightDir.y < 0.12) { this.lightDir.y = 0.12; this.lightDir.normalize(); }
    this.sun.color.copy(this.lightColor);
    this.sun.intensity = lerp(a.lightI, b.lightI, t) * (useSun ? sunUp : moonUp);
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 70);
    this.sun.target.position.copy(focus);

    const u = this.skyUniforms;
    u.uSunColor.value.copy(this.lightColor);
    u.uNight.value = this.night;
    u.uSunUp.value = sunUp;
    u.uTime.value = this.elapsed;
    const dayness = smoothstep(-0.1, 0.3, e);
    u.uCloudLit.value.set('#ffffff').lerp(this.lightColor, 0.45).multiplyScalar(lerp(0.16, 1.0, dayness));
    u.uCloudShade.value.copy(this.zenith).lerp(this.horizon, 0.6).multiplyScalar(lerp(0.55, 0.92, dayness));
    this.sky.position.copy(focus);
  }

  /** Clock-style label for the HUD. Sunrise is 06:00. */
  clock() {
    const ang = this.phase < DAY_FRACTION
      ? (this.phase / DAY_FRACTION) * 0.5
      : 0.5 + ((this.phase - DAY_FRACTION) / (1 - DAY_FRACTION)) * 0.5;
    const hours = (6 + ang * 24) % 24;
    const hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60 / 10) * 10;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}
export { TAU };
