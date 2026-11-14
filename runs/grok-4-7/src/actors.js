import * as THREE from 'three';
import { LEVEL, HINTS } from './level.js';
import { clamp, damp, mulberry32 } from './util.js';

const ORDER = ['tin', 'mouse', 'mitten', 'bell', 'stone', 'ribbon'];

function std(color, rough = 0.8, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
}

export function createActors(scene, quality) {
  const rand = mulberry32(0xc475);
  const bodies = [];
  const items = {};
  const events = [];
  let ribbonLoose = false;
  let fishT = 0;
  let beetleAlive = true;
  let beetleWait = 0;
  let butterAlive = true;
  let butterWait = 0;
  let yarnSplashed = false;
  let magpieGone = false;

  const tinMat = std(0xe07a32, 0.45, { metalness: 0.55 });
  const mouseMat = std(0xb9b1a6, 0.8);
  const pinkMat = std(0xeea8a0, 0.6);
  const woolMat = std(0xf4efe6, 0.95);
  const bellMat = std(0xe2b84a, 0.35, { metalness: 0.65 });
  const stoneMat = std(0x8e8578, 0.7);
  const ribbonMat = std(0xc4474a, 0.55);
  const woodMat = std(0x8d5a34, 0.86);
  const terraMat = std(0xc4623c, 0.78);
  const leafMat = std(0x3e7a42, 0.9);
  const yarnMat = std(0xf2d2c4, 0.85);
  const beetleMat = new THREE.MeshStandardMaterial({ color: 0x1c2420, roughness: 0.4, metalness: 0.2, emissive: 0x1f8a4c, emissiveIntensity: 0.6 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xf7f1e4, roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide });

  function bobber(mesh, baseY) {
    mesh.userData.baseY = baseY;
    return mesh;
  }

  function addItem(id, mesh, x, y, z) {
    mesh.position.set(x, y, z);
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = quality.shadows; } });
    scene.add(mesh);
    items[id] = { id, mesh, x, y, z, baseY: y, have: false, loose: id !== 'ribbon' };
    if (id === 'ribbon') mesh.visible = false;
    return items[id];
  }

  const tin = new THREE.Group();
  const tinBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), tinMat);
  tin.add(tinBody);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), std(0xf2e2c8, 0.6));
  fin.position.set(0, 0.05, 0);
  tin.add(fin);
  addItem('tin', tin, LEVEL.tin.x, LEVEL.tin.y, LEVEL.tin.z);

  const mouse = new THREE.Group();
  const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mouseMat);
  mouseBody.scale.set(0.07, 0.05, 0.1);
  mouse.add(mouseBody);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), pinkMat);
    ear.position.set(s * 0.03, 0.04, -0.03);
    mouse.add(ear);
  }
  const mouseTail = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.12, 4), mouseMat);
  mouseTail.rotation.x = 1.2;
  mouseTail.position.set(0, 0.02, 0.08);
  mouse.add(mouseTail);
  addItem('mouse', mouse, LEVEL.mouse.x, LEVEL.mouse.y, LEVEL.mouse.z);

  const mitten = new THREE.Group();
  const mitt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), woolMat);
  mitten.add(mitt);
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), woolMat);
  thumb.position.set(0.09, 0.02, 0);
  mitten.add(thumb);
  addItem('mitten', mitten, LEVEL.mitten.x, LEVEL.mitten.y, LEVEL.mitten.z);

  const bell = new THREE.Group();
  const bellBody = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), bellMat);
  bellBody.scale.y = 0.9;
  bell.add(bellBody);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), std(0x888888, 0.4, { metalness: 0.6 }));
  clapper.position.y = -0.05;
  bell.add(clapper);
  addItem('bell', bell, LEVEL.bell.x, LEVEL.bell.y, LEVEL.bell.z);

  const stone = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), stoneMat);
  stone.scale.set(1.1, 0.7, 0.9);
  addItem('stone', stone, LEVEL.stone.x, LEVEL.stone.y, LEVEL.stone.z);

  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 12), ribbonMat);
  ribbon.rotation.x = Math.PI / 2;
  addItem('ribbon', ribbon, LEVEL.ribbon.x, LEVEL.ribbon.y, LEVEL.ribbon.z);

  function makePot(x, z) {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.1, 0),
      new THREE.Vector2(0.14, 0.06),
      new THREE.Vector2(0.16, 0.2),
      new THREE.Vector2(0.2, 0.26),
      new THREE.Vector2(0.12, 0.28),
    ], 10), terraMat);
    g.add(pot);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), std(0x6a432c, 1));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.27;
    g.add(soil);
    const plant = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 5), leafMat);
    plant.position.y = 0.4;
    g.add(plant);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), std([0xd85048, 0xf0c14d, 0xf7f1e4][bodies.length % 3], 0.6));
    bloom.position.y = 0.56;
    g.add(bloom);
    g.position.set(x, 0, z);
    g.traverse((o) => { if (o.isMesh) o.castShadow = quality.shadows; });
    scene.add(g);
    const body = { id: 'pot' + bodies.length, kind: 'pot', x, z, r: 0.22, y: 0, h: 0.4, push: true, vx: 0, vz: 0, mesh: g, tip: 0, tipped: false, homeX: x, homeZ: z };
    bodies.push(body);
    return body;
  }
  for (const p of LEVEL.pots) makePot(p.x, p.z);

  const can = new THREE.Group();
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.22, 8), std(0xb7c0b8, 0.4, { metalness: 0.6 }));
  canBody.position.y = 0.12;
  can.add(canBody);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.16, 5), std(0xb7c0b8, 0.4, { metalness: 0.6 }));
  spout.rotation.z = -0.8;
  spout.position.set(0.12, 0.2, 0);
  can.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 4, 8, Math.PI), std(0x8d9490, 0.4, { metalness: 0.5 }));
  handle.position.set(-0.02, 0.22, 0);
  handle.rotation.z = Math.PI / 2;
  can.add(handle);
  can.position.set(LEVEL.can.x, 0, LEVEL.can.z);
  can.traverse((o) => { if (o.isMesh) o.castShadow = quality.shadows; });
  scene.add(can);
  bodies.push({ id: 'can', kind: 'metal', x: LEVEL.can.x, z: LEVEL.can.z, r: 0.16, y: 0, h: 0.3, push: true, vx: 0, vz: 0, mesh: can, tip: 0, tipped: false, homeX: LEVEL.can.x, homeZ: LEVEL.can.z });

  const crates = [];
  for (const spec of LEVEL.crates) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(spec.s, spec.s, spec.s), woodMat);
    box.position.y = spec.s / 2;
    g.add(box);
    for (const z of [-1, 1]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(spec.s * 1.02, spec.s * 0.08, spec.s * 0.08), std(0x6b4128, 0.9));
      slat.position.set(0, spec.s * 0.7, z * spec.s * 0.2);
      g.add(slat);
    }
    g.position.set(spec.x, 0, spec.z);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = quality.shadows; o.receiveShadow = true; } });
    scene.add(g);
    const body = { id: 'crate' + crates.length, kind: 'crate', x: spec.x, z: spec.z, r: spec.s * 0.48, y: 0, h: spec.s, s: spec.s, push: true, vx: 0, vz: 0, mesh: g, tip: 0, homeX: spec.x, homeZ: spec.z };
    bodies.push(body);
    crates.push(body);
  }

  const yarn = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), yarnMat);
  yarn.add(ball);
  for (let i = 0; i < 3; i++) {
    const strand = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 10), std(0xe7b8a8, 0.8));
    strand.rotation.x = i * 0.7;
    strand.rotation.y = i * 0.5;
    yarn.add(strand);
  }
  yarn.position.set(LEVEL.yarn.x, 0.13, LEVEL.yarn.z);
  yarn.traverse((o) => { if (o.isMesh) o.castShadow = quality.shadows; });
  scene.add(yarn);
  const yarnBody = { id: 'yarn', kind: 'yarn', x: LEVEL.yarn.x, z: LEVEL.yarn.z, r: 0.14, y: 0, h: 0.26, push: true, vx: 0, vz: 0, mesh: yarn, tip: 0, homeX: LEVEL.yarn.x, homeZ: LEVEL.yarn.z, spin: 0 };
  bodies.push(yarnBody);

  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.05, 12), std(0xf7f3ea, 0.4));
  dish.position.set(LEVEL.shop.x, 0.03, LEVEL.shop.z);
  dish.receiveShadow = true;
  scene.add(dish);
  const dishShine = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), bellMat);
  dishShine.position.set(LEVEL.shop.x + 0.06, 0.07, LEVEL.shop.z);
  scene.add(dishShine);

  // Creatures
  function makeBird(x, z, color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(color, 0.7));
    body.scale.set(1, 0.8, 1.3);
    g.add(body);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 4), std(0xe2a23a, 0.5));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0, -0.08);
    g.add(beak);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.01, 5, 4), std(0x140e0a, 0.4));
    eye.position.set(0.03, 0.02, -0.05);
    g.add(eye);
    g.position.set(x, 0.08, z);
    scene.add(g);
    return { mesh: g, x, z, homeX: x, homeZ: z, y: 0.08, state: 'peck', t: rand() * 3, perchX: x, perchZ: z };
  }
  const birds = [
    makeBird(-2.2, 2.4, 0x8d5a3a),
    makeBird(1.4, 5.2, 0x6e5144),
    makeBird(3.2, 1.6, 0xa97848),
  ];

  const beetle = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), beetleMat);
  shell.scale.set(1, 0.6, 1.3);
  beetle.add(shell);
  beetle.position.set(0.2, 0.04, 1.8);
  scene.add(beetle);
  const beetleState = { x: 0.2, z: 1.8, tx: 1, tz: 2.4 };

  const butterfly = new THREE.Group();
  const bBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.06, 2, 4), std(0x2a241c, 0.6));
  bBody.rotation.x = Math.PI / 2;
  butterfly.add(bBody);
  const wingL = new THREE.Mesh(new THREE.CircleGeometry(0.07, 6), wingMat);
  wingL.position.set(-0.06, 0, 0);
  const wingR = wingL.clone();
  wingR.position.x = 0.06;
  butterfly.add(wingL, wingR);
  butterfly.position.set(-1.5, 1.05, 4.2);
  scene.add(butterfly);

  const magpie = new THREE.Group();
  const mpBody = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), std(0x1a1c1e, 0.6));
  mpBody.scale.set(0.9, 0.75, 1.3);
  magpie.add(mpBody);
  const mpBelly = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), std(0xf4f0ea, 0.7));
  mpBelly.position.set(0, -0.03, -0.04);
  magpie.add(mpBelly);
  const mpTail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.28), std(0x1a1c1e, 0.5));
  mpTail.position.set(0, 0.02, 0.2);
  magpie.add(mpTail);
  const mpBeak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 4), std(0xe2a23a, 0.5));
  mpBeak.rotation.x = Math.PI / 2;
  mpBeak.position.set(0, 0, -0.12);
  magpie.add(mpBeak);
  magpie.position.set(LEVEL.magpie.x, LEVEL.magpie.y, LEVEL.magpie.z);
  magpie.rotation.y = Math.PI / 2;
  scene.add(magpie);

  const fish = new THREE.Group();
  const fishBody = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(0xd8a15a, 0.45, { metalness: 0.1 }));
  fishBody.scale.set(0.5, 0.7, 1.4);
  fish.add(fishBody);
  const fishTail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), std(0xd8a15a, 0.45));
  fishTail.rotation.x = Math.PI / 2;
  fishTail.position.z = 0.1;
  fish.add(fishTail);
  scene.add(fish);
  const fishState = { a: 0 };

  const sparkGeo = new THREE.PlaneGeometry(0.08, 0.08);
  const sparks = [];
  for (let i = 0; i < 18; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(sparkGeo, mat);
    m.visible = false;
    m.userData.life = 0;
    scene.add(m);
    sparks.push(m);
  }

  function burst(x, y, z, color) {
    let n = 0;
    for (const s of sparks) {
      if (s.userData.life > 0 || n >= 6) continue;
      s.visible = true;
      s.position.set(x, y, z);
      s.material.color.setHex(color);
      s.material.opacity = 1;
      s.userData.life = 0.5 + rand() * 0.3;
      s.userData.vx = (rand() - 0.5) * 0.8;
      s.userData.vy = 0.6 + rand() * 0.8;
      s.userData.vz = (rand() - 0.5) * 0.8;
      n += 1;
    }
  }

  function dist2(x, z, px, pz) {
    return Math.hypot(x - px, z - pz);
  }

  function nearest(player) {
    if (!items.tin.have && dist2(player.x, player.z, items.tin.x, items.tin.z) < 1.15) return { id: 'tin', prompt: 'E — take the sardine tin' };
    if (!items.mouse.have && dist2(player.x, player.z, items.mouse.x, items.mouse.z) < 0.85) {
      return player.sneaking
        ? { id: 'mouse', prompt: 'E — take the toy mouse' }
        : { id: 'mouse', prompt: 'Too tall for the bench. Hold Shift.', block: true };
    }
    if (!items.mitten.have && Math.hypot(player.x - items.mitten.x, player.y + 0.3 - items.mitten.y, player.z - items.mitten.z) < 1.05) {
      return { id: 'mitten', prompt: 'E or pounce — bat the mitten down' };
    }
    if (!items.bell.have && Math.hypot(player.x - items.bell.x, player.y + 0.35 - items.bell.y, player.z - items.bell.z) < 1.05) {
      return { id: 'bell', prompt: 'E or pounce — take the bell' };
    }
    if (!items.stone.have && dist2(player.x, player.z, LEVEL.stone.x, LEVEL.stone.z) < 1.15 && player.y < 0.4) {
      return { id: 'stone', prompt: 'E — fish out the warm stone' };
    }
    if (!items.ribbon.have && !ribbonLoose && dist2(player.x, player.z, LEVEL.magpie.x, LEVEL.magpie.z) < 1.9) {
      return { id: 'magpie', prompt: 'E — bargain with the magpie' };
    }
    if (!items.ribbon.have && ribbonLoose && dist2(player.x, player.z, items.ribbon.x, items.ribbon.z) < 1.1) {
      return { id: 'ribbon', prompt: 'E — take the ribbon' };
    }
    if (dist2(player.x, player.z, LEVEL.shop.x, LEVEL.shop.z) < 1.15 && player.y < 0.5) {
      return { id: 'shop', prompt: 'E — the saucer' };
    }
    const ivy = LEVEL.ivy;
    if (dist2(player.x, player.z, ivy.x, ivy.z) < ivy.r + 0.45 && player.y < ivy.top) {
      return { id: 'ivy', prompt: player.climbing ? 'W up, S down, Space lets go' : 'Space — climb the ivy' };
    }
    const sill = LEVEL.sill;
    if (player.y > 1.8 && dist2(player.x, player.z, sill.x, sill.z) < 1.2) {
      const n = ORDER.filter((id) => items[id].have).length;
      if (n >= 6) return { id: 'loaf', prompt: 'E — loaf in the sun' };
      return { id: 'sill', prompt: `The sill is patient. ${n} of 6 comforts.` };
    }
    return null;
  }

  function collect(id) {
    const item = items[id];
    if (!item || item.have) return false;
    item.have = true;
    item.mesh.visible = id === 'ribbon' ? true : true;
    events.push({ type: 'collect', id });
    burst(item.mesh.position.x, item.mesh.position.y + 0.1, item.mesh.position.z, 0xffd27a);
    return true;
  }

  function use(player, motes) {
    const hit = nearest(player);
    if (!hit || hit.block) return hit;
    if (hit.id === 'shop' || hit.id === 'ivy' || hit.id === 'sill') return hit;
    if (hit.id === 'magpie') {
      if (motes >= 8) {
        ribbonLoose = true;
        items.ribbon.loose = true;
        items.ribbon.mesh.visible = true;
        items.ribbon.y = LEVEL.magpie.y;
        items.ribbon.mesh.position.y = LEVEL.magpie.y;
        magpieGone = true;
        events.push({ type: 'trade' });
        return { id: 'traded', prompt: 'The magpie takes the lot, and the ribbon.' };
      }
      return { id: 'poor', prompt: `The magpie would like 8 shiny things. You have ${motes}.` };
    }
    if (hit.id === 'stone') {
      fishT = 0.7;
      events.push({ type: 'fish' });
      return { id: 'fishing', prompt: 'A careful paw.' };
    }
    if (hit.id === 'loaf') return hit;
    collect(hit.id);
    return { id: hit.id, prompt: '' };
  }

  function pounceAt(player) {
    const reach = player.pouncing ? 1.15 : 0.7;
    for (const id of ORDER) {
      const item = items[id];
      if (!item.have && item.loose && item.mesh.visible) {
        const d = Math.hypot(player.x - item.x, player.y + 0.3 - item.y, player.z - item.z);
        if (d < reach && id !== 'stone' && !(id === 'mouse' && !player.sneaking)) collect(id);
      }
    }
    if (beetleAlive && dist2(player.x, player.z, beetleState.x, beetleState.z) < 0.55 && Math.abs(player.y) < 0.8) {
      beetleAlive = false;
      beetleWait = 7;
      beetle.visible = false;
      events.push({ type: 'mote', n: 2, x: beetleState.x, z: beetleState.z });
      burst(beetleState.x, 0.2, beetleState.z, 0x7dffb2);
    }
    if (butterAlive) {
      const d = Math.hypot(player.x - butterfly.position.x, player.y + 0.4 - butterfly.position.y, player.z - butterfly.position.z);
      if (d < 0.7) {
        butterAlive = false;
        butterWait = 9;
        butterfly.visible = false;
        events.push({ type: 'mote', n: 3, x: butterfly.position.x, z: butterfly.position.z });
        burst(butterfly.position.x, butterfly.position.y, butterfly.position.z, 0xfff1c2);
      }
    }
    for (const b of bodies) {
      if (!b.push) continue;
      const d = dist2(player.x, player.z, b.x, b.z);
      if (d < player.radius + b.r + 0.35) {
        const nx = (b.x - player.x) / (d || 1);
        const nz = (b.z - player.z) / (d || 1);
        b.vx += nx * 3.4;
        b.vz += nz * 3.4;
        if (b.kind === 'pot' || b.kind === 'metal') b.tipping = true;
      }
    }
  }

  function pullEvents() {
    const out = events.slice();
    events.length = 0;
    return out;
  }

  function update(dt, time, player) {
    for (const item of Object.values(items)) {
      if (item.have && !item.presenting) {
        item.mesh.visible = false;
      } else if (item.loose && item.mesh.visible) {
        const bob = Math.sin(time * 2 + item.x) * 0.03;
        item.mesh.position.set(item.x, item.y + bob, item.z);
        item.mesh.rotation.y += dt * 0.4;
      }
    }
    if (fishT > 0) {
      fishT -= dt;
      if (fishT <= 0) collect('stone');
    }
    if (!ribbonLoose && !items.ribbon.have) items.ribbon.mesh.visible = false;
    if (ribbonLoose && !items.ribbon.have) {
      items.ribbon.y = damp(items.ribbon.y, LEVEL.ribbon.y, 4, dt);
      items.ribbon.mesh.position.y = items.ribbon.y;
      items.ribbon.x = LEVEL.ribbon.x;
      items.ribbon.z = LEVEL.ribbon.z;
    }

    for (const b of bodies) {
      b.mesh.position.set(b.x, 0, b.z);
      if (b.kind === 'pot' || b.kind === 'metal') {
        const target = b.tipping ? 1.15 : 0;
        b.tip = damp(b.tip, target, b.tipping ? 6 : 3, dt);
        b.mesh.rotation.z = b.tip;
        if (b.tip > 0.8 && !b.tipped) {
          b.tipped = true;
          events.push({ type: 'knock', kind: b.kind === 'metal' ? 'metal' : 'pot', x: b.x, z: b.z });
          burst(b.x, 0.3, b.z, 0xffb088);
        }
        if (!b.tipping && b.tip < 0.05) b.tipped = false;
      }
      if (b.kind === 'yarn') {
        b.spin += Math.hypot(b.vx, b.vz) * dt * 6;
        b.mesh.rotation.x = b.spin;
        b.mesh.position.y = 0.13;
        const pf = ((b.x - LEVEL.pond.x) / LEVEL.pond.rx) ** 2 + ((b.z - LEVEL.pond.z) / LEVEL.pond.rz) ** 2;
        if (pf < 0.85 && !yarnSplashed) {
          yarnSplashed = true;
          events.push({ type: 'yarnpond', x: b.x, z: b.z });
          b.mesh.position.y = 0.08;
        }
      }
    }

    for (const bird of birds) {
      const d = dist2(player.x, player.z, bird.x, bird.z);
      if (bird.state === 'peck' && d < 2.3) {
        bird.state = 'fly';
        bird.t = 0;
        bird.perchX = bird.homeX + (rand() - 0.5) * 2;
        bird.perchZ = Math.min(13, bird.homeZ + 3 + rand() * 2);
      }
      if (bird.state === 'fly') {
        bird.t += dt;
        const k = clamp(bird.t / 1.1, 0, 1);
        bird.x = bird.homeX + (bird.perchX - bird.homeX) * k;
        bird.z = bird.homeZ + (bird.perchZ - bird.homeZ) * k;
        bird.y = 0.08 + Math.sin(k * Math.PI) * 1.6;
        if (k >= 1) { bird.state = 'wait'; bird.t = 0; bird.homeX = bird.x; bird.homeZ = bird.z; }
      } else if (bird.state === 'wait') {
        bird.t += dt;
        bird.y = 0.08 + Math.sin(time * 2 + bird.x) * 0.01;
        if (bird.t > 5) bird.state = 'peck';
      } else {
        bird.y = 0.08 + Math.abs(Math.sin(time * 6 + bird.x)) * -0.01;
        bird.mesh.rotation.x = Math.sin(time * 5 + bird.z) * 0.15;
      }
      bird.mesh.position.set(bird.x, bird.y, bird.z);
      if (bird.state === 'fly') bird.mesh.rotation.x = -0.4;
    }

    if (!beetleAlive) {
      beetleWait -= dt;
      if (beetleWait <= 0) {
        beetleAlive = true;
        beetle.visible = true;
        beetleState.x = -2 + rand() * 4;
        beetleState.z = 1 + rand() * 3;
      }
    } else {
      const dx = beetleState.tx - beetleState.x;
      const dz = beetleState.tz - beetleState.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) {
        beetleState.tx = -3 + rand() * 6;
        beetleState.tz = 0.5 + rand() * 5;
      } else {
        beetleState.x += (dx / d) * dt * 0.35;
        beetleState.z += (dz / d) * dt * 0.35;
        beetle.rotation.y = Math.atan2(dx, dz);
      }
      beetle.position.set(beetleState.x, 0.04, beetleState.z);
    }

    if (!butterAlive) {
      butterWait -= dt;
      if (butterWait <= 0) {
        butterAlive = true;
        butterfly.visible = true;
      }
    } else {
      butterfly.position.set(
        -1.2 + Math.sin(time * 0.7) * 2.2,
        0.8 + Math.sin(time * 1.4) * 0.35,
        3.4 + Math.cos(time * 0.55) * 1.6,
      );
      wingL.rotation.y = Math.sin(time * 14) * 0.8;
      wingR.rotation.y = -Math.sin(time * 14) * 0.8;
    }

    if (magpieGone) {
      magpie.position.y = damp(magpie.position.y, 6.5, 2, dt);
      magpie.position.x += dt * 1.5;
    } else {
      magpie.position.y = LEVEL.magpie.y + Math.abs(Math.sin(time * 3)) * 0.03;
      magpie.rotation.y = Math.sin(time * 0.6) * 0.4 + 0.4;
    }

    fishState.a += dt * 0.6;
    const flee = dist2(player.x, player.z, LEVEL.pond.x, LEVEL.pond.z) < 2 ? 0.4 : 1;
    fish.position.set(
      LEVEL.pond.x + Math.cos(fishState.a) * LEVEL.pond.rx * 0.45 * flee,
      -0.02,
      LEVEL.pond.z + Math.sin(fishState.a) * LEVEL.pond.rz * 0.45,
    );
    fish.rotation.y = -fishState.a;
    fishTail.rotation.z = Math.sin(time * 8) * 0.4;

    for (const s of sparks) {
      if (s.userData.life <= 0) continue;
      s.userData.life -= dt;
      s.position.x += s.userData.vx * dt;
      s.position.y += s.userData.vy * dt;
      s.userData.vy -= dt * 1.2;
      s.position.z += s.userData.vz * dt;
      s.material.opacity = Math.max(0, s.userData.life * 2);
      s.lookAt(player.x, player.y + 0.4, player.z);
      if (s.userData.life <= 0) s.visible = false;
    }

    dishShine.position.y = 0.07 + Math.sin(time * 3) * 0.02;
  }

  function objective() {
    for (const id of ORDER) if (!items[id].have) return HINTS[id];
    return HINTS.sill;
  }

  function haveCount() {
    return ORDER.filter((id) => items[id].have).length;
  }

  function arrange(catX, catY, catZ) {
    let i = 0;
    for (const id of ORDER) {
      const item = items[id];
      item.have = true;
      item.presenting = true;
      item.mesh.visible = true;
      const a = (i / ORDER.length) * Math.PI * 1.4 - 0.4;
      item.x = catX + Math.sin(a) * 0.38;
      item.y = catY + 0.08;
      item.z = catZ + Math.cos(a) * 0.28;
      item.mesh.position.set(item.x, item.y, item.z);
      item.mesh.scale.setScalar(0.85);
      i += 1;
    }
  }

  function reset() {
    for (const item of Object.values(items)) {
      item.have = false;
      item.presenting = false;
      item.mesh.scale.setScalar(1);
      item.mesh.visible = item.id !== 'ribbon';
      if (item.id === 'tin') { item.x = LEVEL.tin.x; item.y = LEVEL.tin.y; item.z = LEVEL.tin.z; }
      if (item.id === 'mouse') { item.x = LEVEL.mouse.x; item.y = LEVEL.mouse.y; item.z = LEVEL.mouse.z; }
      if (item.id === 'mitten') { item.x = LEVEL.mitten.x; item.y = LEVEL.mitten.y; item.z = LEVEL.mitten.z; }
      if (item.id === 'bell') { item.x = LEVEL.bell.x; item.y = LEVEL.bell.y; item.z = LEVEL.bell.z; }
      if (item.id === 'stone') { item.x = LEVEL.stone.x; item.y = LEVEL.stone.y; item.z = LEVEL.stone.z; }
      if (item.id === 'ribbon') { item.x = LEVEL.ribbon.x; item.y = LEVEL.ribbon.y; item.z = LEVEL.ribbon.z; item.mesh.visible = false; }
    }
    for (const b of bodies) {
      b.x = b.homeX;
      b.z = b.homeZ;
      b.vx = 0;
      b.vz = 0;
      b.tip = 0;
      b.tipping = false;
      b.tipped = false;
      b.mesh.rotation.z = 0;
      b.mesh.position.set(b.x, b.kind === 'yarn' ? 0.13 : 0, b.z);
    }
    ribbonLoose = false;
    fishT = 0;
    yarnSplashed = false;
    magpieGone = false;
    magpie.position.set(LEVEL.magpie.x, LEVEL.magpie.y, LEVEL.magpie.z);
    beetleAlive = true;
    beetle.visible = true;
    butterAlive = true;
    butterfly.visible = true;
  }

  return {
    bodies,
    items,
    ORDER,
    update,
    pullEvents,
    nearest,
    use,
    pounceAt,
    collect,
    objective,
    haveCount,
    arrange,
    reset,
    burst,
    get fishing() { return fishT > 0; },
  };
}
