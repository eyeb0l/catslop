// The cat. Nothing here is a baked animation: the body is rebuilt every frame
// from a small skeleton (hips, chest, head, four IK legs, a verlet tail) that is
// driven by what the cat is doing. Gait, spine flex, tail and ears all fall out
// of the same few numbers, so every state blends into every other state.
import * as THREE from 'three';
import { Tube, catmull, catmull1 } from './tube.js';
import { COATS, paintBody, paintLeg, paintTail, paintHead, pawColor, earColor } from './coats.js';
import { clamp, lerp, damp, smoothstep, TAU, rand } from './util.js';

export const CAT_SCALE = 1.3;
const S = CAT_SCALE;
const V3 = THREE.Vector3;
const PAW_R = 0.027;
const HEAD_R = 0.104;
const TAIL_N = 11;
const TAIL_SEG = 0.047;

const LEGS = [
  { front: true, side: 1, rest: new V3(0.05, 0, 0.165) },
  { front: true, side: -1, rest: new V3(-0.05, 0, 0.165) },
  { front: false, side: 1, rest: new V3(0.06, 0, -0.18) },
  { front: false, side: -1, rest: new V3(-0.06, 0, -0.18) },
];
const SIT_FEET = [new V3(0.045, 0, 0.125), new V3(-0.045, 0, 0.125), new V3(0.092, 0, -0.03), new V3(-0.092, 0, -0.03)];
const BODY_S = [0, 0.18, 0.45, 0.75, 1, 1.33, 1.66, 2, 2.33, 2.66, 3, 3.3, 3.6, 4, 4.5, 5];
const BODY_RX = [0.032, 0.092, 0.104, 0.094, 0.066, 0.052];
const BODY_RY = [0.032, 0.097, 0.108, 0.102, 0.07, 0.052];
const FRONT_R = [0.041, 0.031, 0.0245];
const HIND_R = [0.06, 0.04, 0.026, 0.0245];

function furMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  m.userData.rim = { value: new THREE.Color(0.25, 0.22, 0.2) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = m.userData.rim;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <opaque_fragment>', `
        float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.4);
        outgoingLight += rimF * uRim * (diffuseColor.rgb * 0.75 + 0.25);
        #include <opaque_fragment>`);
  };
  return m;
}

/** A sphere pushed into a cat's head: cheeks, muzzle, chin. Returns nose position too. */
function buildHeadGeometry() {
  const geo = new THREE.SphereGeometry(1, 30, 22);
  const pos = geo.attributes.position;
  const raw = new Float32Array(pos.count * 3);
  let noseZ = 0;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    raw[i * 3] = x; raw[i * 3 + 1] = y; raw[i * 3 + 2] = z;
    const cheek = smoothstep(0.3, -0.25, y) * smoothstep(-0.75, -0.2, y) * smoothstep(-0.6, 0.3, z);
    x *= 1.08 + 0.14 * cheek;
    y *= 0.86;
    z *= 0.9;
    const m = Math.exp(-((x * x) / 0.11 + ((y + 0.24) * (y + 0.24)) / 0.05)) * smoothstep(0.0, 0.7, z);
    z += 0.15 * m;
    if (y < -0.3) { const k = -(y + 0.3); x *= 1 - k * 0.5; z *= 1 - k * 0.22; } // jaw tapers to a small chin
    y += smoothstep(0.5, 1.0, y) * -0.06; // flatter crown between the ears
    pos.setXYZ(i, x * HEAD_R, y * HEAD_R, z * HEAD_R);
    if (Math.abs(x) < 0.08 && y < -0.08 && y > -0.3) noseZ = Math.max(noseZ, z * HEAD_R);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  geo.computeVertexNormals();
  geo.userData.raw = raw;
  return { geo, noseZ };
}

function buildEar() {
  const h = 0.088;
  const outer = new THREE.ConeGeometry(0.052, h, 4, 1);
  outer.rotateY(Math.PI / 4);
  outer.scale(1, 1, 0.5);
  outer.translate(0, h / 2, 0);
  const inner = new THREE.BufferGeometry();
  inner.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.025, 0.006, 0.015, 0.025, 0.006, 0.015, 0, h * 0.74, 0.005]), 3));
  inner.computeVertexNormals();
  return { outer, inner };
}

export class Cat {
  constructor() {
    this.root = new THREE.Group();
    this.root.scale.setScalar(S);
    this.fur = furMaterial();
    this.coatId = 'marmalade';

    this.body = new Tube(BODY_S.length, 14, this.fur);
    this.tail = new Tube(TAIL_N + 1, 8, this.fur);
    this.legs = LEGS.map((l) => new Tube(l.front ? 8 : 9, 10, this.fur));
    this.root.add(this.body.mesh, this.tail.mesh, ...this.legs.map((l) => l.mesh));

    this.pawMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    const pawGeo = new THREE.SphereGeometry(PAW_R, 12, 8);
    pawGeo.scale(1.22, 0.85, 1.55);
    this.paws = LEGS.map(() => {
      const m = new THREE.Mesh(pawGeo, this.pawMat);
      m.castShadow = true;
      this.root.add(m);
      return m;
    });

    // Head and everything attached to it.
    this.head = new THREE.Group();
    this.root.add(this.head);
    const { geo, noseZ } = buildHeadGeometry();
    this.headGeo = geo;
    this.headMesh = new THREE.Mesh(geo, this.fur);
    this.headMesh.castShadow = true;
    this.head.add(this.headMesh);

    const ear = buildEar();
    this.earMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    this.earInnerMat = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
    this.ears = [1, -1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.058, 0.064, -0.012);
      const o = new THREE.Mesh(ear.outer, this.earMat);
      o.castShadow = true;
      g.add(o, new THREE.Mesh(ear.inner, this.earInnerMat));
      g.userData = { side, twitch: 0 };
      this.head.add(g);
      return g;
    });

    this.eyeMat = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.0 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeGeo = new THREE.SphereGeometry(0.029, 16, 12);
    eyeGeo.scale(1, 1, 0.55);
    const pupilGeo = new THREE.SphereGeometry(0.017, 12, 10);
    pupilGeo.scale(1, 1, 0.3);
    const glintGeo = new THREE.SphereGeometry(0.0048, 6, 5);
    this.eyes = [1, -1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.041, 0.012, 0.074);
      g.rotation.y = side * 0.16;
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.z = 0.0125;
      const glint = new THREE.Mesh(glintGeo, glintMat);
      glint.position.set(0.008, 0.01, 0.017);
      g.add(new THREE.Mesh(eyeGeo, this.eyeMat), pupil, glint);
      g.userData.pupil = pupil;
      this.head.add(g);
      return g;
    });

    this.noseMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
    const noseGeo = new THREE.SphereGeometry(0.011, 8, 6);
    noseGeo.scale(1.25, 0.8, 0.8);
    this.nose = new THREE.Mesh(noseGeo, this.noseMat);
    this.nose.position.set(0, -0.019, noseZ - 0.002);
    this.head.add(this.nose);

    const wp = [];
    for (const side of [1, -1]) {
      for (let k = -1; k <= 1; k++) {
        wp.push(side * 0.026, -0.03 + k * 0.004, noseZ - 0.018, side * 0.125, -0.028 + k * 0.022, noseZ - 0.05 - Math.abs(k) * 0.01);
      }
      wp.push(side * 0.03, 0.045, 0.07, side * 0.062, 0.09, 0.06);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wp), 3));
    this.whiskers = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
    this.head.add(this.whiskers);

    this.mouth = new THREE.Object3D();
    this.mouth.position.set(0, -0.052, noseZ - 0.012);
    this.head.add(this.mouth);
    this.hatAnchor = new THREE.Object3D();
    this.hatAnchor.position.set(0, HEAD_R * 0.8, -0.008);
    this.head.add(this.hatAnchor);
    this.backAnchor = new THREE.Object3D();
    this.neckAnchor = new THREE.Object3D();
    this.root.add(this.backAnchor, this.neckAnchor);
    this.accessories = {};

    // Pose state.
    this.phase = 0;
    this.crouch = 0; this.sitAmt = 0; this.air = 0; this.swim = 0; this.bend = 0; this.charge = 0;
    this.hipGround = 0; this.chestGround = 0; this.airPitch = 0;
    this.headYaw = 0; this.headPitch = 0; this.headTilt = 0;
    this.blinkT = rand(1, 4); this.blink = 0; this.pupil = 0.42; this.happy = 0;
    this.earTimer = rand(1, 4); this.shake = 0; this.squash = 0; this.time = 0;
    this.lastPos = new V3(1e9, 0, 0);
    this.prevStance = [true, true, true, true];
    this.onStep = null;

    this.P = Array.from({ length: 6 }, () => new V3());
    this.bodyC = BODY_S.map(() => new V3());
    this.bodyRx = new Array(BODY_S.length); this.bodyRy = new Array(BODY_S.length);
    this.feet = LEGS.map((l) => l.rest.clone());
    this.legPts = LEGS.map((l) => Array.from({ length: l.front ? 3 : 4 }, () => new V3()));
    this.legC = LEGS.map((l) => Array.from({ length: l.front ? 8 : 9 }, () => new V3()));
    this.legR = LEGS.map((l) => new Array(l.front ? 8 : 9));
    this.legRx = LEGS.map((l) => new Array(l.front ? 8 : 9));
    this.tailNodes = Array.from({ length: TAIL_N }, () => new V3());
    this.tailPrev = Array.from({ length: TAIL_N }, () => new V3());
    this.tailTarget = Array.from({ length: TAIL_N }, () => new V3());
    this.tailC = Array.from({ length: TAIL_N + 1 }, () => new V3());
    this.tailR = new Array(TAIL_N + 1);
    this.tailInit = false;
    this.headWorld = new V3();
    this.pawWorld = new V3();

    this.setCoat(this.coatId);
  }

  setCoat(id) {
    const coat = COATS[id] || COATS.marmalade;
    this.coatId = id;
    this.body.paint((u, th, c) => paintBody(coat, u, th, c));
    this.tail.paint((u, th, c) => paintTail(coat, u, th, c));
    this.legs.forEach((leg, i) => leg.paint((u, th, c) => paintLeg(coat, u, th, i, c)));
    pawColor(coat, this.pawMat.color);
    const raw = this.headGeo.userData.raw, colors = this.headGeo.attributes.color;
    const c = new THREE.Color();
    for (let i = 0; i < colors.count; i++) {
      paintHead(coat, raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2], c);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;
    earColor(coat, 1, this.earMat.color);
    this.earInnerMat.color.copy(coat.ear);
    this.eyeMat.color.copy(coat.eye);
    this.eyeMat.emissive.copy(coat.eye);
    this.noseMat.color.copy(coat.nose);
    this.whiskers.material.color.set(coat.pattern === 'solid' ? 0x9a9aa8 : 0xffffff);
  }

  /** Show or hide a wearable. Built on first use. */
  setAccessory(name, on) {
    if (!this.accessories[name] && on) this.accessories[name] = this.buildAccessory(name);
    if (this.accessories[name]) this.accessories[name].visible = on;
  }

  buildAccessory(name) {
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
    const g = new THREE.Group();
    const add = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    if (name === 'party') {
      add(new THREE.ConeGeometry(0.036, 0.1, 12), std('#ff5d8f'), 0, 0.05, 0);
      add(new THREE.TorusGeometry(0.027, 0.006, 6, 14).rotateX(Math.PI / 2), std('#ffe066'), 0, 0.022, 0);
      add(new THREE.SphereGeometry(0.014, 8, 6), std('#ffe066'), 0, 0.104, 0);
      g.rotation.set(-0.12, 0, 0.16);
      this.hatAnchor.add(g);
    } else if (name === 'wizard') {
      add(new THREE.CylinderGeometry(0.085, 0.085, 0.006, 20), std('#4b3aa8'), 0, 0.006, 0);
      const cone = add(new THREE.ConeGeometry(0.052, 0.17, 14, 4), std('#5a45c9'), 0, 0.09, 0);
      const p = cone.geometry.attributes.position; // a tired, bent tip
      for (let i = 0; i < p.count; i++) { const k = Math.max(0, p.getY(i)); p.setZ(i, p.getZ(i) - k * k * 5); }
      cone.geometry.computeVertexNormals();
      add(new THREE.TorusGeometry(0.05, 0.007, 6, 18).rotateX(Math.PI / 2), std('#ffd23e', { metalness: 0.5, roughness: 0.35 }), 0, 0.016, 0);
      g.rotation.set(-0.1, 0, 0.06);
      this.hatAnchor.add(g);
    } else if (name === 'crown') {
      const gold = std('#ffcc33', { metalness: 0.85, roughness: 0.25, emissive: '#553300' });
      add(new THREE.CylinderGeometry(0.043, 0.039, 0.03, 16, 1, true), gold, 0, 0.018, 0).material.side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        add(new THREE.ConeGeometry(0.011, 0.03, 4), gold, Math.cos(a) * 0.041, 0.047, Math.sin(a) * 0.041);
      }
      add(new THREE.SphereGeometry(0.008, 8, 6), std('#e0245e', { roughness: 0.2 }), 0, 0.02, 0.043);
      g.rotation.set(-0.08, 0, -0.1);
      this.hatAnchor.add(g);
    } else if (name === 'bell') {
      add(new THREE.TorusGeometry(0.057, 0.0085, 8, 22), std('#d7263d'));
      add(new THREE.SphereGeometry(0.017, 10, 8), std('#ffd23e', { metalness: 0.8, roughness: 0.25 }), 0, -0.064, 0.01);
      this.neckAnchor.add(g);
    } else if (name === 'backpack') {
      const teal = std('#2fa39a'), dark = std('#1c6f69');
      add(new THREE.BoxGeometry(0.115, 0.075, 0.13), teal, 0, 0.03, 0).geometry.translate(0, 0, 0);
      add(new THREE.BoxGeometry(0.12, 0.022, 0.07), dark, 0, 0.065, 0.028);
      add(new THREE.BoxGeometry(0.03, 0.02, 0.012), std('#ffd23e', { metalness: 0.6 }), 0, 0.045, 0.068);
      for (const sx of [1, -1]) add(new THREE.TorusGeometry(0.098, 0.008, 6, 18, Math.PI * 1.15).rotateY(Math.PI / 2).rotateX(-0.2), dark, sx * 0.045, -0.062, 0.01);
      this.backAnchor.add(g);
    } else if (name === 'wings') {
      const mat = std('#ff8c1a', { roughness: 0.35 });
      this.wingMeshes = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.021, 8, 16), mat);
        m.castShadow = true;
        g.add(m);
        return m;
      });
      this.root.add(g);
    }
    return g;
  }

  /**
   * s: { pos, yaw, speed, yawRate, vy, grounded, swim, crouch, charge, sit, look,
   *      alert, night, happy, groundAt(x,z) }
   */
  update(dt, s) {
    this.time += dt;
    const time = this.time;
    const sp = s.speed / S;
    this.root.position.copy(s.pos);
    this.root.rotation.y = s.yaw;
    this.root.updateMatrixWorld(true);

    const grounded = s.grounded && !s.swim;
    this.crouch = damp(this.crouch, s.crouch, 12, dt);
    this.charge = damp(this.charge, s.charge, 16, dt);
    this.sitAmt = damp(this.sitAmt, s.sit ? 1 : 0, s.sit ? 5 : 12, dt);
    this.air = damp(this.air, !s.grounded && !s.swim ? 1 : 0, 16, dt);
    this.swim = damp(this.swim, s.swim ? 1 : 0, 8, dt);
    this.bend = damp(this.bend, clamp(s.yawRate * 0.085, -1, 1), 9, dt);
    this.happy = damp(this.happy, s.happy || 0, 3, dt);
    this.squash = damp(this.squash, 0, 9, dt);
    this.shake = Math.max(0, this.shake - dt);
    const sit = this.sitAmt, crouch = Math.max(this.crouch, this.charge * 0.9), air = this.air, swim = this.swim;

    // ---- Gait -------------------------------------------------------------------
    const w1 = smoothstep(0.9, 1.5, sp), w2 = smoothstep(1.8, 2.9, sp);
    const duty = lerp(lerp(0.64, 0.5, w1), lerp(0.4, 0.28, smoothstep(3.4, 6.5, sp)), w2);
    const L = clamp(0.2 + 0.05 * sp, 0.2, 0.36);
    const moving = smoothstep(0.03, 0.45, sp);
    const shuffle = clamp(Math.abs(s.yawRate) * 0.1, 0, 0.35) * (1 - moving) * (1 - sit);
    let rate = (duty * sp) / L + shuffle * 6;
    if (s.swim) rate = 2.4;
    this.phase = (this.phase + rate * dt) % 1;
    const off = [lerp(0.25, 0.5, w1), lerp(lerp(0.75, 1, w1), 0.62, w2), 0, lerp(0.5, 0.12, w2)];
    const amp = Math.max(moving, shuffle);
    const liftH = lerp(0.032, lerp(0.05, 0.1, w2), moving) * (1 - crouch * 0.4);
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw);

    let gFront = 0, gHind = 0;
    for (let i = 0; i < 4; i++) {
      const leg = LEGS[i], f = this.feet[i];
      const p = (this.phase + off[i]) % 1;
      let fz, lift;
      const stance = p < duty;
      if (stance) { fz = L * (0.5 - p / duty); lift = 0; } else {
        const q = (p - duty) / (1 - duty);
        fz = L * (-0.5 + q * q * (3 - 2 * q));
        lift = Math.sin(Math.PI * q);
      }
      if (grounded && stance && !this.prevStance[i] && moving > 0.5 && this.onStep) this.onStep(i, sp);
      this.prevStance[i] = stance;

      let x = leg.rest.x * (1 - w2 * 0.2) + (leg.front ? 0 : crouch * leg.side * 0.012);
      let z = leg.rest.z + fz * amp * (shuffle > moving ? 0.25 : 1);
      // Ground under this paw.
      const wx = s.pos.x + S * (x * cy + z * sy), wz = s.pos.z + S * (-x * sy + z * cy);
      const gy = clamp((s.groundAt(wx, wz) - s.pos.y) / S, -0.16, 0.16);
      if (leg.front) gFront += gy * 0.5; else gHind += gy * 0.5;
      let y = gy + PAW_R + lift * liftH * amp;

      if (sit > 0.001) { const t = SIT_FEET[i]; x = lerp(x, t.x, sit); z = lerp(z, t.z, sit); y = lerp(y, gy + PAW_R, sit); }
      if (air > 0.001) {
        const up = clamp(s.vy / 6, -1, 1) * 0.5 + 0.5; // 1 rising, 0 falling
        const ax = leg.rest.x * 0.8;
        const az = leg.front ? leg.rest.z + lerp(0.1, 0.17, up) : leg.rest.z + lerp(0.13, -0.2, up);
        const ay = leg.front ? lerp(0.05, 0.2, up) : lerp(0.15, 0.1, up);
        x = lerp(x, ax, air); z = lerp(z, az, air); y = lerp(y, ay, air);
      }
      if (swim > 0.001) {
        const a = (this.phase + (i === 0 || i === 3 ? 0 : 0.5)) * TAU;
        const sz = leg.rest.z + Math.cos(a) * 0.07, sy2 = 0.08 + Math.sin(a) * 0.035;
        x = lerp(x, leg.rest.x, swim); z = lerp(z, sz, swim); y = lerp(y, sy2, swim);
      }
      f.set(x, y, z);
    }
    const gk = grounded ? 1 : 0;
    this.hipGround = damp(this.hipGround, gHind * gk, 14, dt);
    this.chestGround = damp(this.chestGround, gFront * gk, 14, dt);

    // ---- Spine --------------------------------------------------------------------
    const ph = this.phase * TAU;
    const gallop = w2 * moving * (1 - air);
    let hipY = 0.31, chestY = 0.31, hipZ = -0.165, chestZ = 0.155;
    hipY = lerp(hipY, 0.215, crouch) + this.charge * 0.03;
    chestY = lerp(chestY, 0.19, crouch) - this.charge * 0.012;
    hipY = lerp(hipY, 0.135, sit); chestY = lerp(chestY, 0.3, sit);
    hipZ = lerp(hipZ, -0.095, sit); chestZ = lerp(chestZ, 0.1, sit);
    hipY = lerp(hipY, 0.25, swim); chestY = lerp(chestY, 0.29, swim);
    // Bob, gallop rocking, breathing, landing squash.
    const bob = Math.sin(ph * 2) * 0.006 * moving * (1 - w2);
    const rock = Math.sin(ph + 0.5) * 0.034 * gallop;
    const breathe = Math.sin(time * 2.2) * 0.003 * (1 - moving);
    hipY += bob - rock + this.hipGround - this.squash * 0.07;
    chestY += bob + rock + this.chestGround + breathe - this.squash * 0.085;
    // In the air the body follows its velocity.
    const targetPitch = grounded || s.swim ? 0 : clamp(Math.atan2(s.vy, Math.max(s.speed, 2.5)) * 0.75, -0.7, 0.8);
    this.airPitch = damp(this.airPitch, targetPitch, 12, dt);
    hipY -= Math.sin(this.airPitch) * 0.17; chestY += Math.sin(this.airPitch) * 0.17;

    const wiggle = Math.sin(time * 30) * 0.013 * this.charge;
    const shakeX = this.shake > 0 ? Math.sin(time * 46) * 0.016 * Math.min(1, this.shake * 3) : 0;
    const hipSway = Math.sin(ph) * 0.01 * moving * (1 - w2);
    const beta = this.bend * 0.32;
    const [P0, P1, P2, P3, P4, P5] = this.P;
    P1.set(wiggle + hipSway - shakeX, hipY, hipZ);
    const len = chestZ - hipZ;
    P3.set(P1.x * 0.2 + Math.sin(beta) * len + shakeX, chestY, hipZ + Math.cos(beta) * len);
    const fx = Math.sin(beta * 1.3), fz = Math.cos(beta * 1.3); // forward of the front half
    const lx = fz, lz = -fx; // its left
    const arch = Math.sin(ph + 0.5 + Math.PI / 2) * 0.03 * gallop + sit * 0.025 + this.charge * 0.012;
    P2.set((P1.x + P3.x) / 2 - Math.sin(beta) * 0.03 - shakeX * 1.5, (hipY + chestY) / 2 + arch - 0.004, (P1.z + P3.z) / 2);
    P0.set(P1.x * 1.2, hipY - 0.022 - sit * 0.02, P1.z - 0.085);

    // ---- Head -------------------------------------------------------------------------
    let wantYaw = 0, wantPitch = 0;
    if (s.look) {
      const l = this.root.worldToLocal(tmpA.copy(s.look));
      const dy = l.y - (chestY + 0.1), dh = Math.hypot(l.x, l.z);
      wantYaw = clamp(Math.atan2(l.x, l.z), -1.25, 1.25);
      wantPitch = clamp(Math.atan2(dy, dh), -0.55, 0.7);
      if (dh < 0.25) { wantYaw = 0; wantPitch = 0; }
    } else {
      wantYaw = Math.sin(time * 0.37) * 0.35 * (1 - moving) + Math.sin(time * 0.9) * 0.08;
      wantPitch = Math.sin(time * 0.23) * 0.08 * (1 - moving);
    }
    this.headYaw = damp(this.headYaw, wantYaw, 7, dt);
    this.headPitch = damp(this.headPitch, wantPitch + this.airPitch * 0.5, 7, dt);
    this.headTilt = damp(this.headTilt, s.look && !moving && sit < 0.5 ? Math.sin(time * 0.6) * 0.16 : 0, 4, dt);
    const hy = beta * 1.4 + this.headYaw;
    const neckUp = 0.06 - crouch * 0.04 + sit * 0.005 + swim * 0.02;
    P4.set(P3.x + fx * 0.072, chestY + neckUp, P3.z + fz * 0.072);
    const hdx = Math.sin(beta * 1.3 + this.headYaw * 0.55), hdz = Math.cos(beta * 1.3 + this.headYaw * 0.55);
    const headUp = 0.058 - crouch * 0.06 + sit * 0.01 + swim * 0.03 + Math.sin(this.headPitch) * 0.03;
    const headFwd = 0.07 + crouch * 0.035 - sit * 0.025;
    const bobHead = Math.sin(ph * 2 + 0.6) * 0.004 * moving;
    this.head.position.set(P4.x + hdx * headFwd, P4.y + headUp - bobHead, P4.z + hdz * headFwd);
    this.head.rotation.set(0.14 - this.headPitch + crouch * 0.05 + rock * 1.2 + sit * 0.05, hy, this.headTilt + shakeX * 9, 'YXZ');
    P5.copy(this.head.position); P5.y -= 0.012;

    // ---- Body tube ----------------------------------------------------------------------
    const puff = 1 + Math.sin(time * 2.2) * 0.012 * (1 - moving);
    for (let i = 0; i < BODY_S.length; i++) {
      catmull(this.P, BODY_S[i], this.bodyC[i]);
      const k = BODY_S[i] > 0.6 && BODY_S[i] < 3.4 ? puff + this.squash * 0.12 : 1;
      this.bodyRx[i] = Math.max(0.02, catmull1(BODY_RX, BODY_S[i])) * k * (1 + sit * 0.06);
      this.bodyRy[i] = Math.max(0.02, catmull1(BODY_RY, BODY_S[i])) * k;
    }
    this.body.update(this.bodyC, this.bodyRx, this.bodyRy);

    // ---- Legs -------------------------------------------------------------------------------
    for (let i = 0; i < 4; i++) {
      const leg = LEGS[i], foot = this.feet[i], pts = this.legPts[i];
      const J = pts[0];
      if (leg.front) {
        const glide = (foot.z - leg.rest.z) * 0.28 * w2;
        J.set(P3.x + lx * leg.side * 0.046 + fx * glide, P3.y - 0.025, P3.z + lz * leg.side * 0.046 + fz * glide);
        tmpB.set(leg.side * 0.25, -0.1, -1); // elbows point back
        solveIK(J, foot, 0.14, 0.137, tmpB, pts[1], pts[2]);
        foot.copy(pts[2]);
        for (let k = 0; k < 8; k++) { catmull(pts, (k / 7) * 2, this.legC[i][k]); this.legR[i][k] = catmull1(FRONT_R, (k / 7) * 2) * (k === 0 ? 0.45 : 1); this.legRx[i][k] = this.legR[i][k] * 0.88; }
      } else {
        const glide = (foot.z - leg.rest.z) * 0.22 * w2;
        J.set(P1.x + leg.side * 0.05, P1.y - 0.02, P1.z - 0.012 + glide);
        const hockBack = lerp(0.036, 0.075, sit), hockUp = lerp(0.07, 0.03, sit);
        tmpA.set(foot.x, foot.y + hockUp, foot.z - hockBack);
        tmpB.set(leg.side * lerp(0.2, 1.1, sit), 0.1, 1); // knees point forward (and out when sitting)
        solveIK(J, tmpA, 0.137, 0.132, tmpB, pts[1], pts[2]);
        pts[3].set(pts[2].x, pts[2].y - hockUp, pts[2].z + hockBack);
        foot.copy(pts[3]);
        for (let k = 0; k < 9; k++) { catmull(pts, (k / 8) * 3, this.legC[i][k]); this.legR[i][k] = catmull1(HIND_R, (k / 8) * 3) * (k < 3 ? 1 + sit * 0.25 : 1) * (k === 0 ? 0.45 : 1); this.legRx[i][k] = this.legR[i][k] * (k < 4 ? 0.8 : 0.92); }
      }
      this.legs[i].update(this.legC[i], this.legRx[i], this.legR[i], LEG_UP, 0.9);
      this.paws[i].position.set(foot.x, foot.y - 0.004, foot.z + 0.013);
    }
    if (this.wingMeshes && this.accessories.wings.visible) {
      for (let i = 0; i < 2; i++) {
        const pts = this.legPts[i], m = this.wingMeshes[i];
        m.position.lerpVectors(pts[0], pts[1], 0.72);
        tmpA.subVectors(pts[1], pts[0]).normalize();
        m.quaternion.setFromUnitVectors(Z_AXIS, tmpA);
      }
    }

    // ---- Tail ----------------------------------------------------------------------------------
    this.updateTail(dt, s, moving, w2, crouch, sit, air, swim);

    // ---- Face -------------------------------------------------------------------------------------
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blinkT = rand(1.8, 5.5); this.blink = 1; }
    this.blink = Math.max(0, this.blink - dt * 7);
    const sleepy = this.happy * 0.55 * (1 - moving);
    const lid = Math.max(Math.sin(Math.min(1, this.blink) * Math.PI), sleepy, swim * 0.3);
    const dilate = Math.max(s.night || 0, s.alert || 0, this.charge);
    this.pupil = damp(this.pupil, lerp(0.42, 1.02, dilate), 6, dt);
    for (const e of this.eyes) {
      e.scale.y = Math.max(0.07, 1 - lid * 0.93);
      e.userData.pupil.scale.x = this.pupil;
    }
    this.eyeMat.emissiveIntensity = 0.08 + (s.night || 0) * 0.85;

    this.earTimer -= dt;
    if (this.earTimer < 0) { this.earTimer = rand(1.5, 6); this.ears[Math.random() < 0.5 ? 0 : 1].userData.twitch = 1; }
    const flat = Math.max(swim * 0.9, air * 0.45, this.shake > 0 ? 0.6 : 0, clamp(sp / 7, 0, 0.45));
    const perk = Math.max(s.alert || 0, this.charge) * (1 - flat);
    for (const e of this.ears) {
      const d = e.userData;
      d.twitch = Math.max(0, d.twitch - dt * 6);
      const tw = Math.sin(d.twitch * Math.PI) * 0.5;
      e.rotation.set(-0.08 + perk * 0.2 - flat * 0.75, d.side * (0.25 + tw * 0.5 - perk * 0.2), -d.side * (0.3 + flat * 0.7 + tw * 0.35 - perk * 0.12), 'YXZ');
    }

    // ---- Attachment points ---------------------------------------------------------------------------
    this.backAnchor.position.set(P2.x, P2.y + 0.092, P2.z + 0.03);
    this.backAnchor.rotation.set(-Math.atan2(P3.y - P1.y, len), beta, 0, 'YXZ');
    this.neckAnchor.position.lerpVectors(P4, P5, 0.22);
    tmpA.subVectors(P5, P4).normalize();
    this.neckAnchor.quaternion.setFromUnitVectors(Z_AXIS, tmpA);

    this.head.getWorldPosition(this.headWorld);
    this.pawWorld.copy(this.feet[0]).add(this.feet[1]).multiplyScalar(0.5);
    this.root.localToWorld(this.pawWorld);
    this.fur.userData.rim.value.copy(s.rim || DEFAULT_RIM);
  }

  updateTail(dt, s, moving, w2, crouch, sit, air, swim) {
    const time = this.time;
    const happy = this.happy * (1 - crouch) * (1 - w2);
    // Blend a few characteristic shapes: elevation at base and tip, sideways curl, sway.
    let th0 = lerp(0.2, 0.15, moving), th1 = lerp(1.05, 0.7, moving), curl = 0, sway = 0.22, freq = 1.3;
    th0 = lerp(th0, 1.25, happy); th1 = lerp(th1, 2.2, happy);
    th0 = lerp(th0, 0.22, w2); th1 = lerp(th1, 0.4, w2); sway = lerp(sway, 0.06, w2);
    th0 = lerp(th0, -0.05, crouch); th1 = lerp(th1, 0.12, crouch); sway = lerp(sway, 0.03, crouch);
    th0 = lerp(th0, 0.55, air); th1 = lerp(th1, 0.95, air);
    th0 = lerp(th0, -0.2, sit); th1 = lerp(th1, -0.05, sit); curl = lerp(curl, 0.36, sit); sway = lerp(sway, 0.05, sit);
    th0 = lerp(th0, 0.25, swim); th1 = lerp(th1, 0.5, swim);
    const twitch = Math.max(crouch, sit * 0.6) * Math.max(0, Math.sin(time * 1.7)) * Math.sin(time * 12) * 0.55 + this.charge * Math.sin(time * 15) * 0.5;
    const gaitWave = Math.sin(this.phase * TAU) * 0.12 * w2 * moving;

    const base = tmpA.copy(this.P[0]); base.y += 0.028; base.z += 0.012;
    let px = base.x, py = base.y, pz = base.z;
    for (let k = 0; k < TAIL_N; k++) {
      const u = k / (TAIL_N - 1);
      const th = lerp(th0, th1, Math.pow(u, 1.3)) + gaitWave * u;
      const yawOff = Math.sin(time * freq - u * 2.6) * sway * u * 1.6 + curl * k + twitch * smoothstep(0.55, 1, u) - this.bend * 0.5 * u;
      const ch = Math.cos(th);
      if (k > 0) {
        px += -Math.sin(yawOff) * ch * TAIL_SEG * -1; // back is -Z; positive yawOff swings to +X
        py += Math.sin(th) * TAIL_SEG;
        pz += -Math.cos(yawOff) * ch * TAIL_SEG;
      }
      this.tailTarget[k].set(px, Math.max(py, 0.022), pz);
      this.root.localToWorld(this.tailTarget[k]);
    }
    const jumped = this.lastPos.distanceToSquared(s.pos) > 9 || !this.tailInit;
    this.lastPos.copy(s.pos);
    this.tailInit = true;
    const segW = TAIL_SEG * S;
    for (let k = 0; k < TAIL_N; k++) {
      const p = this.tailNodes[k], prev = this.tailPrev[k], tg = this.tailTarget[k];
      if (k === 0 || jumped) { p.copy(tg); prev.copy(tg); continue; }
      const u = k / (TAIL_N - 1);
      const vx = (p.x - prev.x) * 0.86, vy = (p.y - prev.y) * 0.86, vz = (p.z - prev.z) * 0.86;
      prev.copy(p);
      p.x += vx; p.y += vy; p.z += vz;
      p.lerp(tg, 1 - Math.exp(-lerp(34, 11, u) * dt));
      const q = this.tailNodes[k - 1];
      tmpB.subVectors(p, q);
      const d = tmpB.length() || 1;
      p.copy(q).addScaledVector(tmpB, segW / d);
      const floor = s.groundAt(p.x, p.z) + 0.03;
      if (p.y < floor && !s.swim) p.y = floor;
    }
    const thick = 1 + (this.shake > 0 ? 0.5 : 0);
    for (let k = 0; k < TAIL_N; k++) {
      this.root.worldToLocal(this.tailC[k].copy(this.tailNodes[k]));
      this.tailR[k] = lerp(0.031, 0.021, k / (TAIL_N - 1)) * thick;
    }
    // One extra shrinking ring so the tip is rounded.
    const a = this.tailC[TAIL_N - 2], b = this.tailC[TAIL_N - 1];
    this.tailC[TAIL_N].copy(b).addScaledVector(tmpB.subVectors(b, a).normalize(), 0.018);
    this.tailR[TAIL_N] = 0.011;
    this.tail.update(this.tailC, this.tailR, this.tailR, TAIL_UP, 0.5);
  }

  /** Call when landing from a jump. */
  land(strength) { this.squash = clamp(strength, 0, 1); }
  startShake() { this.shake = 0.9; }
}

const tmpA = new V3(), tmpB = new V3(), tmpC = new V3(), tmpD = new V3();
const Z_AXIS = new V3(0, 0, 1);
const LEG_UP = new V3(0, 0, 1);
const TAIL_UP = new V3(0.05, 1, 0.3).normalize();
const DEFAULT_RIM = new THREE.Color(0.25, 0.22, 0.2);

/** Two-bone IK. Writes the middle joint and the (possibly clamped) end position. */
function solveIK(root, target, l1, l2, pole, outMid, outEnd) {
  tmpC.subVectors(target, root);
  let d = tmpC.length();
  const maxD = (l1 + l2) * 0.995, minD = Math.abs(l1 - l2) + 0.02;
  if (d < 1e-5) { tmpC.set(0, -1, 0); d = 1e-5; }
  tmpC.multiplyScalar(1 / d);
  const dc = clamp(d, minD, maxD);
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  tmpD.copy(pole).addScaledVector(tmpC, -pole.dot(tmpC));
  if (tmpD.lengthSq() < 1e-8) tmpD.set(0, 0, 1);
  tmpD.normalize();
  outMid.copy(root).addScaledVector(tmpC, a).addScaledVector(tmpD, h);
  outEnd.copy(root).addScaledVector(tmpC, dc);
}
