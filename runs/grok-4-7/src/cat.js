import * as THREE from 'three';
import { clamp, damp, paintUnitSphere, solveTwoBone } from './util.js';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _foot = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _home = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _q2 = new THREE.Quaternion();
const _end = new THREE.Vector3();

const LOCO = new Set(['stand', 'sneak', 'air', 'pounce']);

export function createCat(hooks) {
  const root = new THREE.Group();
  root.name = 'miso';
  const anim = new THREE.Group();
  root.add(anim);

  const catMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
    vertexColors: true,
  });
  const gingerMat = new THREE.MeshStandardMaterial({ color: 0xd98438, roughness: 0.92, metalness: 0 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xf3e2c8, roughness: 0.94, metalness: 0 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xeeaea4, roughness: 0.7, metalness: 0 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xc46a64, roughness: 0.45, metalness: 0.02 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.35, metalness: 0 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0xe39a28, roughness: 0.28, metalness: 0 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x140e0a, roughness: 0.4, metalness: 0 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xfffaf2 });
  const collarMat = new THREE.MeshStandardMaterial({ color: 0x8d3030, roughness: 0.55, metalness: 0.05 });
  const bellMat = new THREE.MeshStandardMaterial({ color: 0xe2b84a, roughness: 0.35, metalness: 0.6 });

  const bodyGeo = paintUnitSphere(new THREE.SphereGeometry(1, 18, 14), 'body');
  const bellyGeo = paintUnitSphere(new THREE.SphereGeometry(1, 16, 12), 'belly');
  const tailGeo = paintUnitSphere(new THREE.SphereGeometry(1, 12, 10), 'tail');

  const hips = new THREE.Group();
  hips.position.set(0, 0.3, 0.08);
  anim.add(hips);
  const hipMesh = new THREE.Mesh(bodyGeo, catMat);
  hipMesh.scale.set(0.112, 0.098, 0.128);
  hips.add(hipMesh);

  const spine = new THREE.Group();
  spine.position.set(0, 0.012, -0.1);
  hips.add(spine);
  const belly = new THREE.Mesh(bellyGeo, catMat);
  belly.scale.set(0.132, 0.118, 0.14);
  belly.position.set(0, -0.01, 0.01);
  spine.add(belly);

  const chest = new THREE.Group();
  chest.position.set(0, 0.018, -0.13);
  spine.add(chest);
  const chestMesh = new THREE.Mesh(bodyGeo, catMat);
  chestMesh.scale.set(0.118, 0.104, 0.15);
  chest.add(chestMesh);
  const bib = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), creamMat);
  bib.scale.set(0.072, 0.055, 0.07);
  bib.position.set(0, -0.045, -0.08);
  chest.add(bib);

  const neck = new THREE.Group();
  neck.position.set(0, 0.05, -0.11);
  chest.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.055, -0.055);
  neck.add(head);
  const skull = new THREE.Mesh(bodyGeo, catMat);
  skull.scale.set(0.1, 0.092, 0.096);
  head.add(skull);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), creamMat);
  muzzle.scale.set(0.046, 0.034, 0.048);
  muzzle.position.set(0, -0.028, -0.078);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), noseMat);
  nose.scale.set(1.15, 0.72, 0.85);
  nose.position.set(0, 0.012, -0.042);
  muzzle.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.004), pupilMat);
  mouth.position.set(0, -0.008, -0.04);
  muzzle.add(mouth);

  const whiskers = [];
  const whiskerGeo = new THREE.CylinderGeometry(0.0016, 0.0008, 0.15, 4);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(whiskerGeo, whiteMat);
      w.rotation.z = side * Math.PI / 2;
      w.rotation.y = (i - 1) * 0.22;
      w.position.set(side * 0.09, -0.004 + (i - 1) * 0.012, -0.01);
      muzzle.add(w);
      whiskers.push(w);
    }
  }

  function makeEar(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.042, 0.062, -0.012);
    g.rotation.z = side * -0.42;
    g.rotation.x = -0.18;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.095, 8), gingerMat);
    outer.position.y = 0.04;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.062, 6), pinkMat);
    inner.position.set(0, 0.032, -0.01);
    g.add(outer, inner);
    return g;
  }
  const earL = makeEar(-1);
  const earR = makeEar(1);
  head.add(earL, earR);

  function makeEye(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.04, 0.012, -0.078);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.023, 12, 10), whiteMat);
    white.scale.set(1.05, 1.12, 0.62);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), irisMat);
    iris.position.z = -0.012;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), pupilMat);
    pupil.scale.set(0.5, 1.55, 0.45);
    pupil.position.z = -0.02;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 6, 5), shineMat);
    shine.position.set(-side * 0.005, 0.008, -0.024);
    g.add(white, iris, pupil, shine);
    return { g, pupil };
  }
  const eyeL = makeEye(-1);
  const eyeR = makeEye(1);
  head.add(eyeL.g, eyeR.g);

  const collar = new THREE.Group();
  collar.position.set(0, 0.01, -0.02);
  collar.visible = false;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 14), collarMat);
  band.rotation.x = Math.PI / 2;
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), bellMat);
  bell.position.set(0, -0.045, -0.02);
  bell.scale.y = 1.2;
  collar.add(band, bell);
  neck.add(collar);

  function makeLeg(parent, x, y, z, L1, L2, hind, side, home) {
    const anchor = new THREE.Group();
    anchor.position.set(x, y, z);
    parent.add(anchor);
    const upper = new THREE.Group();
    anchor.add(upper);
    const uMesh = new THREE.Mesh(new THREE.CylinderGeometry(hind ? 0.034 : 0.03, 0.026, L1 * 0.92, 8), gingerMat);
    uMesh.position.y = L1 * 0.46;
    upper.add(uMesh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), gingerMat);
    knee.position.y = L1;
    upper.add(knee);
    const lower = new THREE.Group();
    lower.position.y = L1;
    upper.add(lower);
    const lMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, L2 * 0.9, 8), gingerMat);
    lMesh.position.y = L2 * 0.42;
    lower.add(lMesh);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), creamMat);
    paw.scale.set(0.038, 0.02, 0.046);
    root.add(paw);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), pinkMat);
    pad.scale.set(0.012, 0.006, 0.014);
    pad.position.set(0, -0.006, -0.02);
    paw.add(pad);
    return {
      anchor, upper, lower, paw, L1, L2, hind, side, home,
      phase: Math.random(),
      foot: new THREE.Vector3(),
      swingFrom: new THREE.Vector3(),
      swingTo: new THREE.Vector3(),
      wasSwing: false,
      ready: false,
    };
  }

  const legs = {
    FL: makeLeg(chest, -0.055, -0.06, -0.03, 0.125, 0.125, false, -1, new THREE.Vector3(-0.075, 0, -0.2)),
    FR: makeLeg(chest, 0.055, -0.06, -0.03, 0.125, 0.125, false, 1, new THREE.Vector3(0.075, 0, -0.2)),
    BL: makeLeg(hips, -0.05, -0.04, 0.02, 0.135, 0.13, true, -1, new THREE.Vector3(-0.08, 0, 0.16)),
    BR: makeLeg(hips, 0.05, -0.04, 0.02, 0.135, 0.13, true, 1, new THREE.Vector3(0.08, 0, 0.16)),
  };
  const legList = [legs.FL, legs.FR, legs.BL, legs.BR];

  const tail = [];
  let tailParent = hips;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group();
    const radius = 0.036 * (1 - i / 9);
    const mesh = new THREE.Mesh(tailGeo, catMat);
    mesh.scale.set(radius, radius * 0.8, radius);
    seg.add(mesh);
    seg.position.set(0, 0.01, i === 0 ? 0.11 : 0.05);
    tailParent.add(seg);
    tail.push(seg);
    tailParent = seg;
  }

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 16),
    new THREE.MeshBasicMaterial({ color: 0x2a1c14, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.visible = false;
  root.add(blob);

  root.traverse((obj) => {
    if (obj.isMesh && obj !== blob) {
      obj.castShadow = true;
      obj.receiveShadow = false;
    }
  });

  let blink = 0;
  let blinkIn = 2.2;
  let twitch = 0;
  let twitchIn = 1.4;
  let time = 0;
  let gait = 0;
  let collarOn = false;

  function homeWorld(leg, out) {
    out.copy(leg.home);
    out.applyMatrix4(root.matrixWorld);
    out.y = root.position.y;
    return out;
  }

  function placePaw(leg, world, lift) {
    root.updateWorldMatrix(true, false);
    _end.copy(world);
    root.worldToLocal(_end);
    leg.paw.position.copy(_end);
    leg.paw.position.y = Math.max(leg.paw.position.y, 0.012);
    leg.paw.rotation.set(lift * 0.9, 0, 0);
  }

  function poseLeg(leg, ux, uz, lx, dt) {
    _e.set(ux, 0, uz);
    _q.setFromEuler(_e);
    const k = 1 - Math.exp(-12 * dt);
    leg.upper.quaternion.slerp(_q, k);
    _e.set(lx, 0, 0);
    _q2.setFromEuler(_e);
    leg.lower.quaternion.slerp(_q2, k);
  }

  function ikLeg(leg, foot, poleBias) {
    _pole.copy(leg.anchor.position);
    leg.anchor.parent.localToWorld(_pole);
    _pole.addScaledVector(_fwd, poleBias);
    _pole.addScaledVector(_right, leg.side * 0.18);
    _pole.y += 0.12;
    solveTwoBone(leg.upper, leg.lower, foot, _pole, leg.L1, leg.L2);
  }

  function update(dt, rig) {
    time += dt;
    root.updateWorldMatrix(true, true);
    _fwd.set(0, 0, -1).applyQuaternion(root.quaternion);
    _right.set(1, 0, 0).applyQuaternion(root.quaternion);

    const mode = rig.mode;
    const loco = LOCO.has(mode) && rig.grounded !== false && mode !== 'air' && mode !== 'pounce';
    const airborne = mode === 'air' || mode === 'pounce';
    const speed = rig.speed || 0;

    blinkIn -= dt;
    if (blinkIn < 0) {
      blink = mode === 'loaf' || mode === 'endloaf' ? 0.28 : 0.14;
      blinkIn = mode === 'loaf' || mode === 'endloaf' ? 1.6 + Math.random() : 2.4 + Math.random() * 3.5;
    }
    if (blink > 0) blink -= dt;
    if (twitchIn < 0) {
      twitch = 1;
      twitchIn = 2 + Math.random() * 4;
    } else twitchIn -= dt;
    if (twitch > 0) twitch = Math.max(0, twitch - dt * 6);

    const loafish = mode === 'loaf' || mode === 'endloaf';
    const seated = mode === 'sit' || mode === 'groom' || mode === 'fish';
    const targetY = mode === 'sneak' ? -0.06 : loafish ? -0.26 : seated ? -0.18 : mode === 'swim' ? -0.17 : 0;
    anim.position.y = damp(anim.position.y, targetY + Math.sin(time * 2.3) * 0.004 + (loco ? Math.abs(Math.sin(gait * Math.PI * 2)) * 0.012 * clamp(speed, 0, 1) : 0), 8, dt);

    const pitchTarget = mode === 'sneak' ? 0.28 : mode === 'pounce' ? -0.45 : mode === 'air' ? clamp(-rig.vy * 0.04, -0.4, 0.35) : mode === 'climb' ? 1.15 : mode === 'swim' ? 0.4 : loafish ? 0.06 : seated ? 0.28 : 0;
    anim.rotation.x = damp(anim.rotation.x, pitchTarget, 7, dt);
    const rollTarget = mode === 'shake' ? Math.sin(time * 46) * 0.18 * (rig.extra || 1) : clamp(-rig.turn * 0.08, -0.18, 0.18);
    anim.rotation.z = damp(anim.rotation.z, rollTarget, mode === 'shake' ? 18 : 6, dt);

    const breathe = 1 + Math.sin(time * 2.15) * (loafish ? 0.035 : 0.018);
    const wide = loafish ? 1.24 : seated ? 1.38 : 1;
    const flat = loafish ? 0.7 : seated ? 0.74 : 1;
    hipMesh.scale.set(0.112 * wide, 0.098 * flat * breathe, 0.128 * (loafish ? 1.08 : 1));
    belly.scale.set(0.132 * wide, 0.118 * flat, 0.14 * (loafish ? 1.1 : 1));
    chestMesh.scale.set(0.118, 0.104 * breathe * (loafish ? 0.9 : 1), 0.15);

    const spineAmp = loco ? clamp(speed / 1.6, 0, 1) : 0;
    spine.rotation.y = damp(spine.rotation.y, Math.sin(gait * Math.PI * 2) * 0.08 * spineAmp + clamp(rig.turn, -1, 1) * 0.12, 8, dt);
    const sitChest = seated ? 0.4 : 0;
    spine.rotation.x = damp(spine.rotation.x, Math.sin(gait * Math.PI * 4) * 0.03 * spineAmp + sitChest, 8, dt);
    chest.rotation.y = damp(chest.rotation.y, Math.sin(gait * Math.PI * 2 + 0.6) * 0.05 * spineAmp, 8, dt);

    if (speed > 0.05 && (loco || airborne)) gait = (gait + dt * speed / 0.32) % 1;

    const stride = 0.15 + 0.05 * clamp(speed / 1.8, 0, 1);
    const duty = 0.64 - 0.12 * clamp(speed / 1.8, 0, 1);
    const trot = clamp((speed - 0.4) / 1.2, 0, 1);
    const offsets = {
      FL: 0,
      BR: 0.25 * (1 - trot),
      FR: 0.5,
      BL: 0.75 - 0.25 * trot,
    };

    for (const leg of legList) {
      if (!leg.ready) {
        homeWorld(leg, leg.foot);
        leg.swingFrom.copy(leg.foot);
        leg.swingTo.copy(leg.foot);
        leg.ready = true;
      }
      const u = ((gait + offsets[leg === legs.FL ? 'FL' : leg === legs.FR ? 'FR' : leg === legs.BL ? 'BL' : 'BR']) % 1 + 1) % 1;
      const swinging = u >= duty;
      if (loco && speed > 0.12) {
        if (swinging && !leg.wasSwing) {
          leg.swingFrom.copy(leg.foot);
          leg.anchor.getWorldPosition(leg.swingTo);
          leg.swingTo.addScaledVector(_fwd, stride);
          leg.swingTo.addScaledVector(_right, leg.side * 0.015);
          leg.swingTo.y = root.position.y;
          leg.wasSwing = true;
          if (hooks.onStep) hooks.onStep();
        }
        if (!swinging) leg.wasSwing = false;
        if (swinging) {
          const t = (u - duty) / (1 - duty);
          leg.foot.lerpVectors(leg.swingFrom, leg.swingTo, t);
          leg.foot.y = root.position.y + Math.sin(Math.PI * t) * (0.03 + speed * 0.008);
        } else {
          leg.foot.y += (root.position.y - leg.foot.y) * 0.5;
        }
        leg.anchor.getWorldPosition(_home);
        const fdx = leg.foot.x - _home.x;
        const fdz = leg.foot.z - _home.z;
        const far = Math.hypot(fdx, fdz);
        const limit = 0.13 + 0.04 * clamp(speed / 1.6, 0, 1);
        if (far > limit) {
          leg.foot.x = _home.x + (fdx / far) * limit;
          leg.foot.z = _home.z + (fdz / far) * limit;
        }
        ikLeg(leg, leg.foot, leg.hind ? 0.25 : -0.22);
        placePaw(leg, leg.foot, swinging ? 0.4 : 0);
      } else if (airborne) {
        leg.anchor.getWorldPosition(_foot);
        _foot.addScaledVector(_fwd, mode === 'pounce' ? 0.16 : 0.05);
        _foot.y = root.position.y + (mode === 'pounce' ? 0.22 : 0.16) + leg.home.z * -0.05;
        ikLeg(leg, _foot, leg.hind ? 0.2 : -0.15);
        placePaw(leg, _foot, 0.8);
        leg.wasSwing = false;
      } else {
        leg.wasSwing = false;
        const side = leg.side;
        // Rest pose points +Y. π hangs the leg straight down; negative X reaches toward the face (−Z).
        if (loafish) {
          if (leg.hind) poseLeg(leg, 1.35, side * 0.55, 1.9, dt);
          else poseLeg(leg, -0.85, side * 0.16, 1.7, dt);
        } else if (mode === 'sit' || mode === 'fish') {
          if (leg.hind) poseLeg(leg, 2.05, side * 0.95, 2.2, dt);
          else if (mode === 'fish' && leg === legs.FR) poseLeg(leg, -0.7, -0.2, 0.9, dt);
          else poseLeg(leg, 2.75, side * 0.08, 0.7, dt);
        } else if (mode === 'groom') {
          if (leg.hind) poseLeg(leg, 2.05, side * 0.95, 2.2, dt);
          else if (leg === legs.FR) poseLeg(leg, -0.35, -0.35, 1.2, dt);
          else poseLeg(leg, 2.75, 0.08, 0.7, dt);
        } else if (mode === 'swim') {
          const paddle = Math.sin(time * 7 + side + (leg.hind ? 1 : 0));
          poseLeg(leg, Math.PI * 0.55 + paddle * 0.28, side * 0.85, 0.25, dt);
        } else if (mode === 'climb') {
          const phase = (leg === legs.FL || leg === legs.BR) ? 0 : Math.PI;
          const reach = Math.sin(time * 3.4 + phase);
          const grip = _foot;
          grip.copy(root.position);
          grip.addScaledVector(_fwd, leg.hind ? 0.2 : 0.26);
          grip.addScaledVector(_right, leg.side * (0.045 + reach * 0.01));
          grip.y = root.position.y + (leg.hind ? 0.08 : 0.2) + reach * 0.07;
          _pole.copy(root.position).addScaledVector(_right, leg.side * 0.28);
          _pole.y += leg.hind ? 0.02 : 0.12;
          solveTwoBone(leg.upper, leg.lower, grip, _pole, leg.L1, leg.L2);
        } else if (mode === 'shake') {
          poseLeg(leg, Math.PI, side * 0.35, 0.35, dt);
        } else {
          homeWorld(leg, _foot);
          leg.foot.lerp(_foot, 1 - Math.exp(-10 * dt));
          ikLeg(leg, leg.foot, leg.hind ? 0.25 : -0.22);
          placePaw(leg, leg.foot, 0);
        }
        if (!loco && !airborne && mode !== 'stand' && mode !== 'sneak') {
          leg.lower.updateWorldMatrix(true, false);
          _end.set(0, leg.L2, 0).applyMatrix4(leg.lower.matrixWorld);
          placePaw(leg, _end, mode === 'swim' ? 0.3 : 0);
        }
      }
    }

    const curl = loafish ? 0.45 : seated ? 0.95 : mode === 'sneak' ? 0.05 : mode === 'pounce' ? -0.15 : 0.12;
    const lift = loafish ? 0.5 : seated ? 0.15 : mode === 'pounce' ? 0.55 : mode === 'air' ? -0.35 : mode === 'sneak' ? 0.25 : mode === 'climb' ? -0.15 : -0.35;
    for (let i = 0; i < tail.length; i++) {
      const tip = i / tail.length;
      const wag = Math.sin(time * (loafish ? 1.2 : 2.4) - i * 0.55) * (loafish ? 0.05 : 0.1 + spineAmp * 0.08);
      const wrap = seated ? 0.7 * tip : 0;
      tail[i].rotation.y = damp(tail[i].rotation.y, wag + curl * tip * 1.4 + wrap - rig.turn * 0.15 * (1 - tip), 8, dt);
      tail[i].rotation.x = damp(tail[i].rotation.x, lift * (0.25 + tip) + Math.sin(time * 1.6 - i) * 0.04, 8, dt);
    }

    const lookY = (rig.lookYaw || 0) + (rig.innocent || 0) * 0.85;
    const lookX = (rig.lookPitch || 0) + (mode === 'groom' ? 0.45 : 0) + (loafish ? 0.15 : 0);
    head.rotation.y = damp(head.rotation.y, clamp(lookY, -1.1, 1.1), 8, dt);
    head.rotation.x = damp(head.rotation.x, clamp(lookX, -0.6, 0.7), 8, dt);
    head.rotation.z = damp(head.rotation.z, mode === 'groom' ? -0.35 : (rig.innocent || 0) * 0.2, 8, dt);

    const earBase = loafish ? 0.25 : mode === 'pounce' ? -0.15 : 0;
    earL.rotation.z = damp(earL.rotation.z, -0.42 - earBase - twitch * 0.35, 10, dt);
    earR.rotation.z = damp(earR.rotation.z, 0.42 + earBase + (twitch > 0.4 ? twitch * 0.2 : 0), 10, dt);

    const shut = blink > 0 ? 0.08 : loafish ? 0.32 : rig.squint > 0.4 ? 0.46 : 1;
    const eyeY = damp(eyeL.g.scale.y || 1, shut, 18, dt);
    eyeL.g.scale.y = eyeY;
    eyeR.g.scale.y = eyeY;
    const dilate = rig.squint > 0.4 ? 0.65 : mode === 'pounce' ? 1.25 : 1;
    eyeL.pupil.scale.y = damp(eyeL.pupil.scale.y, 1.55 * dilate, 8, dt);
    eyeR.pupil.scale.y = eyeL.pupil.scale.y;
    const px = clamp((rig.lookYaw || 0) * 0.01, -0.006, 0.006);
    eyeL.pupil.position.x = px;
    eyeR.pupil.position.x = px;

    for (let i = 0; i < whiskers.length; i++) {
      const w = whiskers[i];
      const droop = Math.sin(time * 1.4 + i) * 0.08;
      w.rotation.x = droop;
    }

    if (collarOn) {
      bell.rotation.z = Math.sin(time * (speed > 0.2 ? 16 : 3)) * (speed > 0.2 ? 0.4 : 0.08);
      collar.visible = true;
    } else {
      collar.visible = false;
    }

    blob.position.y = -root.position.y + 0.025;
    const liftH = clamp(root.position.y, 0, 2);
    blob.scale.setScalar(1 - liftH * 0.25);
    blob.material.opacity = 0.28 * (1 - liftH * 0.35);
  }

  return {
    root,
    blob,
    update,
    setCollar(on) { collarOn = on; },
    reset() {
      gait = 0;
      blink = 0;
      for (const leg of legList) leg.ready = false;
    },
  };
}
