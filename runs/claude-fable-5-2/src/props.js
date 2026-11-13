// Everything the Tall One built: cottage, porch, garden, clothesline, dock,
// boat, lighthouse. Also returns the solids the cat can bump into or stand on.
import * as THREE from 'three';
import { COTTAGE, DOCK, POND, heightAt } from './terrain.js';
import { mulberry32, lerp, TAU } from './util.js';

const G = COTTAGE.ground;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roofTexture() {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#a8482f'; g.fillRect(0, 0, w, h);
    const rows = 8, cols = 8, rh = h / rows, cw = w / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * cw + (r % 2 ? cw / 2 : 0), y = r * rh;
        const v = 0.85 + Math.sin(r * 12.9 + c * 78.2) * 0.12;
        g.fillStyle = `rgb(${190 * v | 0},${86 * v | 0},${58 * v | 0})`;
        g.beginPath(); g.roundRect(x + 1.5, y + 1, cw - 3, rh + 6, [0, 0, 9, 9]); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 1.5, y + rh - 1, cw - 3, 3);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 2.5);
  return t;
}

export function buildProps(scene) {
  const solids = [];
  const group = new THREE.Group();
  scene.add(group);
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const M = {
    wall: std('#f4e8d2'), stone: std('#9a968d', { flatShading: true }), timber: std('#6a4630'), wood: std('#b98b56'),
    woodDark: std('#8a623c'), door: std('#2f6f9f'), trim: std('#fbf6ea'), shutter: std('#2f8f83'),
    roof: std('#ffffff', { map: roofTexture(), roughness: 0.8 }), soil: std('#5b4332'), metal: std('#4a4f57', { metalness: 0.6, roughness: 0.5 }),
    rope: std('#d9cfb8'), red: std('#c8402f'), white: std('#f6f3ec'),
    window: new THREE.MeshStandardMaterial({ color: '#31425f', emissive: '#ffc873', emissiveIntensity: 0, roughness: 0.25 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: '#ffcf7a', emissiveIntensity: 0.2 }),
  };
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const solidBox = (x, z, hw, hd, top, bottom = -5) => solids.push({ kind: 'box', x, z, hw, hd, top, bottom });
  const solidCircle = (x, z, r, top, bottom = -5) => solids.push({ kind: 'circle', x, z, r, top, bottom });

  // ---- Cottage -----------------------------------------------------------------
  const cx = COTTAGE.x, cz = COTTAGE.z, HW = 4.5, HD = 3.25, WH = 3.1;
  const front = cz + HD;
  box(HW * 2, WH, HD * 2, M.wall, cx, G + WH / 2, cz);
  box(HW * 2 + 0.24, 0.55, HD * 2 + 0.24, M.stone, cx, G + 0.2, cz);
  solidBox(cx, cz, HW + 0.12, HD + 0.12, G + 9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.26, WH, 0.26, M.timber, cx + sx * HW, G + WH / 2, cz + sz * HD);
  box(HW * 2 + 0.1, 0.2, 0.2, M.timber, cx, G + WH - 0.1, front + 0.02);
  box(HW * 2 + 0.1, 0.2, 0.2, M.timber, cx, G + WH - 0.1, cz - HD - 0.02);

  // Roof: two tiled slabs and two gable ends.
  const over = 0.6, run = HD + over, rise = 2.5, slope = Math.hypot(run, rise), ang = Math.atan2(rise, run);
  const ridgeY = G + WH + (HD / run) * rise;
  for (const s of [-1, 1]) {
    const slab = box(HW * 2 + 1.0, 0.16, slope, M.roof, cx, ridgeY - rise / 2 + 0.05, cz + s * (run / 2));
    slab.rotation.x = s * ang;
  }
  box(HW * 2 + 1.1, 0.18, 0.3, M.timber, cx, ridgeY + 0.1, cz);
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -HD, 0, 0, HD, 0, (HD / run) * rise, 0], 3));
  gable.computeVertexNormals();
  for (const s of [-1, 1]) {
    const m = add(gable, new THREE.MeshStandardMaterial({ color: '#f4e8d2', roughness: 0.9, side: THREE.DoubleSide }), cx + s * HW, G + WH, cz);
    m.castShadow = false;
    box(0.12, 1.5, 0.18, M.timber, cx + s * (HW + 0.03), G + WH + 0.75, cz);
  }
  box(0.85, 1.9, 0.85, M.stone, cx + 2.6, ridgeY - 0.2, cz - 1.2);
  box(1.0, 0.16, 1.0, M.timber, cx + 2.6, ridgeY + 0.8, cz - 1.2);
  const chimney = new THREE.Vector3(cx + 2.6, ridgeY + 1.0, cz - 1.2);

  // Door with a cat flap.
  box(1.36, 2.3, 0.14, M.trim, cx, G + 1.15, front + 0.03);
  box(1.1, 2.1, 0.12, M.door, cx, G + 1.07, front + 0.08);
  box(0.42, 0.42, 0.06, std('#1d4666'), cx, G + 0.36, front + 0.13);
  const flap = box(0.34, 0.34, 0.03, std('#3d86b8'), 0, -0.17, 0, new THREE.Group());
  flap.parent.position.set(cx, G + 0.53, front + 0.16);
  group.add(flap.parent);
  add(new THREE.SphereGeometry(0.06, 10, 8), std('#e8c15a', { metalness: 0.7, roughness: 0.3 }), cx + 0.38, G + 1.1, front + 0.17);

  // Windows.
  const windowAt = (x, y, z, alongX) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (!alongX) g.rotation.y = Math.PI / 2;
    group.add(g);
    box(1.3, 1.3, 0.1, M.trim, 0, 0, 0, g);
    box(1.08, 1.08, 0.12, M.window, 0, 0, 0.01, g).castShadow = false;
    box(0.06, 1.08, 0.14, M.trim, 0, 0, 0.02, g);
    box(1.08, 0.06, 0.14, M.trim, 0, 0, 0.02, g);
    for (const s of [-1, 1]) box(0.34, 1.3, 0.06, M.shutter, s * 0.84, 0, 0.02, g);
    box(1.4, 0.2, 0.28, M.woodDark, 0, -0.78, 0.14, g);
    const cols = ['#ff7aa8', '#ffd23e', '#ff5a5f', '#ffffff'];
    for (let i = 0; i < 6; i++) add(new THREE.IcosahedronGeometry(0.11, 0), std(cols[i % 4], { flatShading: true }), -0.55 + i * 0.22, -0.62 + (i % 2) * 0.04, 0.16, g);
    for (let i = 0; i < 5; i++) add(new THREE.IcosahedronGeometry(0.12, 0), std('#4f8a35', { flatShading: true }), -0.45 + i * 0.22, -0.68, 0.22, g);
  };
  windowAt(cx - 2.6, G + 1.7, front + 0.05, true);
  windowAt(cx + 2.6, G + 1.7, front + 0.05, true);
  windowAt(cx + HW + 0.05, G + 1.7, cz, false);
  const backWin = new THREE.Group(); group.add(backWin);

  // Porch deck, steps, doormat, bowl.
  const deckTop = G + 0.34;
  box(5.8, 0.14, 2.5, M.wood, cx, deckTop - 0.07, front + 1.25);
  for (let i = 0; i < 9; i++) box(0.03, 0.15, 2.5, M.woodDark, cx - 2.6 + i * 0.65, deckTop - 0.068, front + 1.25).castShadow = false;
  box(5.7, 0.3, 2.4, M.stone, cx, G + 0.1, front + 1.25);
  solidBox(cx, front + 1.25, 2.9, 1.25, deckTop);
  box(2.4, 0.17, 0.5, M.wood, cx, G + 0.085, front + 2.75);
  solidBox(cx, front + 2.75, 1.2, 0.25, G + 0.17);
  for (const sx of [-1, 1]) {
    box(0.16, 2.3, 0.16, M.timber, cx + sx * 2.75, deckTop + 1.15, front + 2.35);
    solidCircle(cx + sx * 2.75, front + 2.35, 0.12, G + 9);
  }
  // A little porch roof over the door.
  const awning = box(5.9, 0.12, 2.7, M.roof, cx, deckTop + 2.42, front + 1.25);
  awning.rotation.x = 0.16;

  const matTex = canvasTexture(256, 160, (g, w, h) => {
    g.fillStyle = '#9c6b3f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${60 + Math.random() * 60 | 0},${40 + Math.random() * 30 | 0},20,0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 1); }
    g.strokeStyle = '#3c2716'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#2e1d10'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 40px Georgia, serif'; g.fillText('NO MICE', w / 2, h / 2 - 22);
    g.font = '900 34px Georgia, serif'; g.fillText('PLEASE', w / 2, h / 2 + 26);
  });
  const doormat = new THREE.Vector3(cx, deckTop, front + 0.75);
  const matMesh = add(new THREE.BoxGeometry(1.5, 0.03, 0.95), std('#ffffff', { map: matTex }), doormat.x, deckTop + 0.016, doormat.z);
  matMesh.castShadow = false;

  const bowl = new THREE.Vector3(cx + 1.75, deckTop, front + 0.45);
  add(new THREE.CylinderGeometry(0.2, 0.15, 0.1, 16), std('#e86a5c', { roughness: 0.4 }), bowl.x, deckTop + 0.05, bowl.z);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), std('#7a4a2a'), bowl.x, deckTop + 0.095, bowl.z).castShadow = false;

  // The bench with the Cat-alogue on it.
  const bx = cx - 1.95, bz = front + 0.42, seat = deckTop + 0.42;
  box(1.3, 0.07, 0.45, M.woodDark, bx, seat - 0.035, bz);
  box(1.3, 0.5, 0.06, M.woodDark, bx, seat + 0.27, bz - 0.22);
  for (const s of [-1, 1]) box(0.07, 0.42, 0.4, M.woodDark, bx + s * 0.58, deckTop + 0.2, bz);
  solidBox(bx, bz, 0.65, 0.24, seat);
  const coverTex = canvasTexture(256, 320, (g, w, h) => {
    g.fillStyle = '#f6c544'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d7263d'; g.fillRect(0, 0, w, 86);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 44px Georgia, serif'; g.fillText('THE CAT-', w / 2, 44); g.fillText('ALOGUE', w / 2, 80);
    // A cat face.
    g.fillStyle = '#2b2b33';
    g.beginPath(); g.moveTo(70, 250); g.lineTo(62, 150); g.lineTo(104, 186); g.lineTo(152, 186); g.lineTo(194, 150); g.lineTo(186, 250); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(128, 236, 66, 54, 0, 0, TAU); g.fill();
    g.fillStyle = '#f6c544'; g.beginPath(); g.ellipse(104, 228, 11, 14, 0, 0, TAU); g.ellipse(152, 228, 11, 14, 0, 0, TAU); g.fill();
    g.fillStyle = '#2b2b33'; g.font = '700 20px Georgia, serif'; g.fillText('everything a cat needs', w / 2, 308);
  });
  const catalogue = new THREE.Group();
  catalogue.position.set(bx + 0.1, seat + 0.02, bz + 0.02);
  catalogue.rotation.y = 0.35;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.43), [M.trim, M.trim, std('#ffffff', { map: coverTex, roughness: 0.5 }), M.trim, M.trim, M.trim]);
  mag.castShadow = true;
  catalogue.add(mag);
  group.add(catalogue);

  // Wall lantern by the door.
  const porchLamp = new THREE.Vector3(cx + 1.05, G + 2.25, front + 0.32);
  box(0.06, 0.06, 0.3, M.metal, porchLamp.x, porchLamp.y + 0.22, front + 0.17);
  add(new THREE.CylinderGeometry(0.1, 0.13, 0.26, 6), M.lamp, porchLamp.x, porchLamp.y, porchLamp.z).castShadow = false;
  add(new THREE.ConeGeometry(0.17, 0.12, 6), M.metal, porchLamp.x, porchLamp.y + 0.18, porchLamp.z);
  const porchLight = new THREE.PointLight('#ffc070', 0, 14, 1.5);
  // Hung a little below and in front of the lantern so it lights the porch, not the awning above it.
  porchLight.position.set(porchLamp.x, porchLamp.y - 0.7, porchLamp.z + 0.7);
  group.add(porchLight);

  // Crates and a barrel to climb.
  const cr = box(0.85, 0.85, 0.85, M.wood, cx - HW - 0.75, G + 0.425, front - 0.9);
  cr.rotation.y = 0.2;
  solidBox(cx - HW - 0.75, front - 0.9, 0.44, 0.44, G + 0.85);
  box(0.6, 0.6, 0.6, M.woodDark, cx - HW - 0.7, G + 0.3, front + 0.1).rotation.y = -0.3;
  solidBox(cx - HW - 0.7, front + 0.1, 0.32, 0.32, G + 0.6);
  add(new THREE.CylinderGeometry(0.42, 0.38, 1.0, 12), M.woodDark, cx + HW + 0.7, G + 0.5, front - 0.6);
  for (const y of [0.25, 0.75]) add(new THREE.TorusGeometry(0.42, 0.025, 5, 16).rotateX(Math.PI / 2), M.metal, cx + HW + 0.7, G + y, front - 0.6);
  solidCircle(cx + HW + 0.7, front - 0.6, 0.42, G + 1.0);

  // ---- Garden --------------------------------------------------------------------
  const gx0 = 11, gx1 = 21, gz0 = -12.5, gz1 = -2.6, gateX = 15.8, gateHalf = 1.0;
  const fenceTop = G + 0.86;
  const pickets = [];
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, alongX = Math.abs(x1 - x0) > 0.01;
    for (const y of [0.3, 0.62]) box(alongX ? len : 0.05, 0.07, alongX ? 0.05 : len, M.white, mx, heightAt(mx, mz) + y, mz);
    for (let d = 0.1; d < len; d += 0.24) pickets.push([lerp(x0, x1, d / len), lerp(z0, z1, d / len)]);
    solids.push({ kind: 'box', x: mx, z: mz, hw: alongX ? len / 2 : 0.07, hd: alongX ? 0.07 : len / 2, top: fenceTop, bottom: -5 });
  };
  rail(gx0, gz0, gx1, gz0); rail(gx0, gz0, gx0, gz1); rail(gx1, gz0, gx1, gz1);
  rail(gx0, gz1, gateX - gateHalf, gz1); rail(gateX + gateHalf, gz1, gx1, gz1);
  const picketGeo = new THREE.BoxGeometry(0.1, 0.84, 0.035);
  const pk = new THREE.InstancedMesh(picketGeo, M.white, pickets.length);
  const mtx = new THREE.Matrix4();
  pickets.forEach(([x, z], i) => { mtx.makeTranslation(x, heightAt(x, z) + 0.42, z); pk.setMatrixAt(i, mtx); });
  pk.castShadow = true;
  group.add(pk);
  for (const s of [-1, 1]) box(0.14, 1.1, 0.14, M.white, gateX + s * gateHalf, G + 0.55, gz1);

  const rng = mulberry32(31);
  const cabbage = new THREE.IcosahedronGeometry(0.24, 1); cabbage.scale(1, 0.75, 1);
  for (let row = 0; row < 3; row++) {
    const rz = gz0 + 2 + row * 2.6;
    box(7.6, 0.14, 1.3, M.soil, 16, G + 0.04, rz).castShadow = false;
    for (let i = 0; i < 9; i++) {
      const x = 12.7 + i * 0.82 + (rng() - 0.5) * 0.1;
      if (row === 0) add(cabbage, std('#7fbf5a', { flatShading: true }), x, G + 0.24, rz).rotation.y = rng() * 6;
      else if (row === 1) { const m = add(new THREE.ConeGeometry(0.12, 0.38, 5), std('#3f9a46', { flatShading: true }), x, G + 0.28, rz); m.rotation.z = (rng() - 0.5) * 0.4; }
      else if (i % 3 === 1) { const m = add(new THREE.SphereGeometry(0.32, 10, 7), std('#f08a2c', { flatShading: true }), x, G + 0.3, rz); m.scale.y = 0.72; add(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 5), M.timber, x, G + 0.56, rz); }
    }
  }
  const glove = new THREE.Vector3(18.6, G + 0.05, -4.2);

  // ---- Clothesline ---------------------------------------------------------------
  const lineX = cx - 9.5, lz0 = cz - 4.5, lz1 = cz + 3.5, lineY = heightAt(lineX, cz) + 1.75;
  for (const z of [lz0, lz1]) {
    add(new THREE.CylinderGeometry(0.06, 0.07, 2.0, 6), M.woodDark, lineX, lineY - 0.87, z);
    box(0.9, 0.07, 0.07, M.woodDark, lineX, lineY + 0.08, z);
    solidCircle(lineX, z, 0.08, lineY + 0.2);
  }
  const rope = add(new THREE.CylinderGeometry(0.012, 0.012, lz1 - lz0, 4).rotateX(Math.PI / 2), M.rope, lineX, lineY + 0.06, (lz0 + lz1) / 2);
  rope.castShadow = false;
  const laundry = [];
  const hang = (z, w, h, color) => {
    const g = new THREE.Group();
    g.position.set(lineX, lineY + 0.05, z);
    const geo = new THREE.PlaneGeometry(w, h, 1, 4); geo.translate(0, -h / 2, 0); geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }));
    m.castShadow = true;
    g.add(m); group.add(g); laundry.push(g);
    return g;
  };
  hang(lz0 + 1.3, 0.95, 0.75, '#f3f0e8'); hang(lz0 + 2.9, 0.6, 0.7, '#7fb7e6'); hang(lz1 - 1.2, 0.5, 0.4, '#f29fb4');
  const sock = new THREE.Vector3(lineX, lineY - 0.5, lz0 + 4.6);
  const sockLine = new THREE.Vector3(lineX, lineY + 0.05, lz0 + 4.6);

  // ---- Dock, lamp and boat ----------------------------------------------------------
  const dz = (DOCK.z0 + DOCK.z1) / 2, dlen = DOCK.z1 - DOCK.z0;
  box(DOCK.halfW * 2, 0.12, dlen, M.wood, DOCK.x, DOCK.top - 0.06, dz);
  for (let z = DOCK.z0 + 0.4; z < DOCK.z1; z += 0.5) box(DOCK.halfW * 2, 0.125, 0.03, M.woodDark, DOCK.x, DOCK.top - 0.058, z).castShadow = false;
  solidBox(DOCK.x, dz, DOCK.halfW, dlen / 2, DOCK.top, DOCK.top - 0.3);
  for (let z = DOCK.z0 + 1; z <= DOCK.z1; z += 4.5) {
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.12, 0.12, 4.6, 7), M.woodDark, DOCK.x + s * (DOCK.halfW - 0.02), -0.9, z);
  }
  const dockLamp = new THREE.Vector3(DOCK.x - DOCK.halfW + 0.12, DOCK.top + 2.5, DOCK.z1 - 0.5);
  add(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6), M.metal, dockLamp.x, DOCK.top + 1.3, dockLamp.z);
  add(new THREE.CylinderGeometry(0.12, 0.15, 0.3, 6), M.lamp, dockLamp.x, dockLamp.y, dockLamp.z).castShadow = false;
  add(new THREE.ConeGeometry(0.2, 0.14, 6), M.metal, dockLamp.x, dockLamp.y + 0.22, dockLamp.z);
  const dockLight = new THREE.PointLight('#ffc070', 0, 16, 1.6);
  dockLight.position.copy(dockLamp);
  group.add(dockLight);

  const boat = new THREE.Group();
  const hullGeo = new THREE.SphereGeometry(1, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2);
  hullGeo.scale(0.78, 0.55, 2.0);
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ color: '#c8402f', roughness: 0.7, side: THREE.DoubleSide }));
  hull.castShadow = true;
  boat.add(hull);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 5, 28).rotateX(Math.PI / 2), M.white);
  rim.scale.set(0.78, 1, 2.0);
  boat.add(rim);
  box(1.35, 0.05, 0.3, M.wood, 0, -0.14, 0.2, boat);
  box(1.1, 0.05, 0.3, M.wood, 0, -0.14, -1.0, boat);
  boat.position.set(DOCK.x + 2.6, 0.2, DOCK.z1 - 5);
  boat.rotation.y = 0.12;
  group.add(boat);

  // ---- Lighthouse on the eastern point ---------------------------------------------------
  let lx = 70, lz = -26;
  for (let r = 100; r > 40; r -= 0.5) {
    const x = Math.cos(-0.36) * r, z = Math.sin(-0.36) * r;
    if (heightAt(x, z) > 0.9) { lx = x; lz = z; break; }
  }
  const ly = heightAt(lx, lz);
  const tower = new THREE.Group();
  tower.position.set(lx, ly, lz);
  group.add(tower);
  add(new THREE.CylinderGeometry(3.2, 3.8, 1.2, 9), M.stone, 0, 0.2, 0, tower);
  for (let i = 0; i < 4; i++) {
    const r0 = 2.3 - i * 0.22, r1 = 2.3 - (i + 1) * 0.22;
    add(new THREE.CylinderGeometry(r1, r0, 2.6, 16), i % 2 ? M.red : M.white, 0, 0.8 + 1.3 + i * 2.6, 0, tower);
  }
  add(new THREE.CylinderGeometry(1.9, 1.9, 0.2, 16), M.metal, 0, 11.3, 0, tower);
  add(new THREE.CylinderGeometry(1.0, 1.0, 1.5, 10), M.lamp, 0, 12.15, 0, tower).castShadow = false;
  add(new THREE.ConeGeometry(1.35, 1.1, 10), M.red, 0, 13.45, 0, tower);
  box(0.9, 1.7, 0.12, M.door, 0, 1.6, 2.26, tower);
  solidCircle(lx, lz, 3.7, ly + 0.8);
  solidCircle(lx, lz, 2.35, ly + 30);
  const beam = new THREE.Group();
  beam.position.set(lx, ly + 12.15, lz);
  const beamGeo = new THREE.CylinderGeometry(0.4, 3.2, 44, 14, 1, true);
  beamGeo.translate(0, -22, 0); beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff0b8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (const r of [0, Math.PI]) { const b = new THREE.Mesh(beamGeo, beamMat); b.rotation.y = r; beam.add(b); }
  beam.rotation.x = 0.04;
  group.add(beam);

  // ---- Pond dressing --------------------------------------------------------------------
  const padGeo = new THREE.CircleGeometry(0.5, 12, 0.35, TAU - 0.7); padGeo.rotateX(-Math.PI / 2);
  const pads = new THREE.InstancedMesh(padGeo, std('#3f8f4a', { roughness: 0.6, side: THREE.DoubleSide }), 16);
  const q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0);
  const padSpots = [];
  for (let i = 0; i < 16; i++) {
    const a = rng() * TAU, r = lerp(2, POND.r - 2.4, Math.sqrt(rng()));
    pv.set(POND.x + Math.cos(a) * r, POND.level + 0.012, POND.z + Math.sin(a) * r);
    padSpots.push(pv.clone());
    mtx.compose(pv, q.setFromAxisAngle(upv, rng() * TAU), sv.setScalar(lerp(0.6, 1.25, rng())));
    pads.setMatrixAt(i, mtx);
    if (i % 4 === 0) {
      const f = add(new THREE.ConeGeometry(0.17, 0.2, 7), std('#ffb3cf', { flatShading: true }), pv.x, POND.level + 0.1, pv.z);
      f.rotation.x = Math.PI; f.castShadow = false;
      add(new THREE.SphereGeometry(0.06, 6, 5), std('#ffd23e'), pv.x, POND.level + 0.13, pv.z).castShadow = false;
    }
  }
  pads.receiveShadow = true;
  group.add(pads);

  // A signpost where the paths split.
  const signTex = (text, flip) => canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#b98b56'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3c2716'; g.font = '700 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(flip ? `← ${text}` : `${text} →`, w / 2, h / 2 + 2);
  });
  const sx = 6.6, sz = 14.6, sy = heightAt(sx, sz);
  add(new THREE.CylinderGeometry(0.06, 0.07, 1.9, 6), M.woodDark, sx, sy + 0.95, sz);
  solidCircle(sx, sz, 0.1, sy + 2);
  const plank = (text, y, rot, flip) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 0.04), [M.woodDark, M.woodDark, M.woodDark, M.woodDark, std('#ffffff', { map: signTex(text, flip) }), std('#ffffff', { map: signTex(text, !flip) })]);
    m.position.set(sx, sy + y, sz); m.rotation.y = rot; m.castShadow = true;
    group.add(m);
  };
  plank('POND', 1.72, 0.25, true); plank('SEA', 1.4, -1.35, false); plank('HOME', 1.08, 1.75, false);

  return {
    solids,
    spots: { doormat, bowl, catalogue: catalogue.position.clone(), porchLamp, dockLamp, chimney, sock, sockLine, glove, deckTop, lighthouse: new THREE.Vector3(lx, ly, lz), flap: flap.parent, padSpots },
    catalogue,
    update(env, time) {
      const n = env.night;
      M.window.emissiveIntensity = n * 1.1;
      M.lamp.emissiveIntensity = 0.15 + n * 1.1;
      porchLight.intensity = n * 5;
      dockLight.intensity = n * 12;
      beamMat.opacity = n * 0.05;
      beam.rotation.y = time * 0.45;
      boat.position.y = 0.2 + Math.sin(time * 0.9) * 0.035;
      boat.rotation.z = Math.sin(time * 0.7) * 0.03;
      boat.rotation.x = Math.sin(time * 0.9 + 1) * 0.015;
      laundry.forEach((g, i) => { g.rotation.z = Math.sin(time * 1.4 + i * 1.3) * 0.16 + 0.05; });
      catalogue.position.y = seat + 0.02 + Math.abs(Math.sin(time * 2.2)) * 0.012;
    },
  };
}
