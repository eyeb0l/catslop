// Sea and pond: one shader, depth-aware via the terrain height texture.
import * as THREE from 'three';
import { POND, SEA_LEVEL, WORLD_SIZE } from './terrain.js';

const VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += (sin(wp.x * 0.35 + uTime * 0.9) + sin(wp.z * 0.28 - uTime * 0.7)) * 0.035;
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uHeight;
uniform float uTime, uLevel, uWorldSize, uFogDensity, uNight;
uniform vec3 uShallow, uDeep, uSky, uHorizon, uSunDir, uSunColor, uFogColor;
uniform vec3 uCat; // xyz = cat position, for the ripple ring
uniform float uCatWet;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float waves(vec2 p) {
  float t = uTime;
  float v = sin(p.x * 1.3 + t * 1.1) * 0.5 + sin(p.y * 1.7 - t * 0.9) * 0.5;
  v += noise(p * 2.1 + vec2(t * 0.35, -t * 0.22)) * 1.2;
  v += noise(p * 5.3 - vec2(t * 0.5, t * 0.3)) * 0.5;
  return v;
}

void main() {
  vec2 uv = vWorld.xz / uWorldSize + 0.5;
  float ground = texture2D(uHeight, uv).r * 12.0 - 6.0;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float depth = mix(6.0, uLevel - ground, inside);

  // Normal from the wave height field.
  vec2 p = vWorld.xz * 0.55;
  float e = 0.12;
  float h0 = waves(p), hx = waves(p + vec2(e, 0.0)), hz = waves(p + vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx - h0) * 0.22, 1.0, -(hz - h0) * 0.22));

  vec3 view = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);

  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 2.6, depth));
  vec3 refl = mix(uHorizon, uSky, clamp(reflect(-view, n).y * 1.6, 0.0, 1.0));
  vec3 col = mix(body, refl, 0.18 + fres * 0.62);

  // Sun or moon glitter.
  vec3 hlf = normalize(uSunDir + view);
  col += uSunColor * pow(max(dot(n, hlf), 0.0), 220.0) * 1.6;

  // Foam: a breathing line at the shore plus a couple of trailing bands.
  float wob = noise(vWorld.xz * 0.6 + uTime * 0.15) * 0.25;
  float surge = 0.5 + 0.5 * sin(uTime * 0.8 + vWorld.x * 0.05 + vWorld.z * 0.04);
  float foam = smoothstep(0.26 + wob + surge * 0.14, 0.02, depth);
  float band = smoothstep(0.75, 1.0, sin(depth * 9.0 - uTime * 1.6 + wob * 8.0)) * smoothstep(1.3, 0.25, depth) * 0.5;
  foam = max(foam, band * (0.5 + 0.5 * noise(vWorld.xz * 2.5)));

  // Ripples around a wading or swimming cat.
  float cd = distance(vWorld.xz, uCat.xz);
  float ring = smoothstep(0.75, 1.0, sin(cd * 7.0 - uTime * 6.0)) * smoothstep(2.6, 0.3, cd) * uCatWet;
  foam = max(foam, ring * 0.7);

  vec3 foamCol = mix(vec3(1.0), uHorizon, 0.25) * (1.0 - uNight * 0.55);
  col = mix(col, foamCol, clamp(foam, 0.0, 1.0) * 0.85);

  float alpha = smoothstep(0.0, 0.1, depth) * mix(0.72, 0.96, smoothstep(0.0, 1.8, depth));
  alpha = max(alpha, foam * smoothstep(-0.02, 0.05, depth));

  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dot(cameraPosition - vWorld, cameraPosition - vWorld));
  col = mix(col, uFogColor, fogF);

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Water {
  constructor(scene, heightTexture) {
    const base = {
      uHeight: { value: heightTexture }, uTime: { value: 0 }, uWorldSize: { value: WORLD_SIZE },
      uFogDensity: { value: 0.006 }, uNight: { value: 0 },
      uShallow: { value: new THREE.Color('#58c9c0') }, uDeep: { value: new THREE.Color('#1f6f9a') },
      uSky: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() },
      uFogColor: { value: new THREE.Color() }, uCat: { value: new THREE.Vector3() }, uCatWet: { value: 0 },
    };
    const make = (level) => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { ...base, uLevel: { value: level } },
    });
    this.base = base;
    this.shallowDay = new THREE.Color('#58c9c0');
    this.deepDay = new THREE.Color('#1f6f9a');
    this.shallowNight = new THREE.Color('#1d4a6a');
    this.deepNight = new THREE.Color('#0a1c3a');

    const seaGeo = new THREE.PlaneGeometry(1400, 1400, 96, 96);
    seaGeo.rotateX(-Math.PI / 2);
    this.sea = new THREE.Mesh(seaGeo, make(SEA_LEVEL));
    this.sea.position.y = SEA_LEVEL;
    this.sea.renderOrder = 2;

    const pondGeo = new THREE.CircleGeometry(POND.r + 1.4, 48);
    pondGeo.rotateX(-Math.PI / 2);
    this.pond = new THREE.Mesh(pondGeo, make(POND.level));
    this.pond.position.set(POND.x, POND.level, POND.z);
    this.pond.renderOrder = 2;
    scene.add(this.sea, this.pond);
  }

  update(env, catPos, catWet) {
    const u = this.base;
    u.uTime.value = env.elapsed;
    u.uNight.value = env.night;
    u.uSky.value.copy(env.zenith);
    u.uHorizon.value.copy(env.horizon);
    u.uSunDir.value.copy(env.lightDir);
    u.uSunColor.value.copy(env.lightColor).multiplyScalar(env.sun.intensity * 0.45);
    u.uFogColor.value.copy(env.scene.fog.color);
    u.uFogDensity.value = env.scene.fog.density;
    u.uShallow.value.copy(this.shallowDay).lerp(this.shallowNight, env.night);
    u.uDeep.value.copy(this.deepDay).lerp(this.deepNight, env.night);
    u.uCat.value.copy(catPos);
    u.uCatWet.value = catWet;
  }
}
