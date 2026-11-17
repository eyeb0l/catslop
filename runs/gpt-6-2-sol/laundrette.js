import * as T from 'three';
import { group, mesh, box, ball, drum, torus, disk, panel, line, paint, glow, texture, standard, colouredTexture, rng, batch } from './sculpt.js';

export const BOUNDS = { x: 7.78, z: 5.79 };
export const HOME = { x: -5.38, z: 3.94 };
export const START = { x: -3.75, z: 3.15, yaw: Math.PI };
export const KITTENS = [
  { name: 'Bobbin', x: -3.8, y: 0, z: -.54, coat: '#657b80', shade: '#46585f', bib: '#fbecdb', iris: '#b5c584', size: .58, yaw: .48, line: 'A lost sock has become my pillow.' },
  { name: 'Pip', x: 5.51, y: 1.85, z: -2.14, coat: '#e8c49e', shade: '#b27f61', bib: '#fff0d5', iris: '#78b9ad', size: .56, yaw: .69, line: 'I went up. I forgot about down.' },
  { name: 'Moth', x: 5.58, y: 0, z: 3.94, coat: '#927b9a', shade: '#684f76', bib: '#f0dded', iris: '#f9c471', size: .55, yaw: .37, line: 'Is the floor monster gone?' },
];
export const SOCKS = [
  { x: -6.87, y: 0, z: 1.30, color: '#cf845b' },
  { x: -.85, y: 0, z: -3.70, color: '#e9b655' },
  { x: 2.32, y: .65, z: -1.66, color: '#83b49b' },
  { x: 6.57, y: 1.85, z: -1.98, color: '#d394a3' },
  { x: 6.53, y: 0, z: .59, color: '#e9b655' },
  { x: .19, y: 0, z: 5.01, color: '#d394a3' },
];

const teal = '#35645e';
const petrol = '#264448';
const maple = '#ae7961';
const bone = '#ecdfbb';
const brass = '#d9a251';
const rust = '#a65148';

function floorMap() {
  return texture(2048, 1536, (ctx, w, h) => {
    const random = rng(145);
    const t = 128;
    ctx.fillStyle = '#585d55';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 16; col++) {
        const x = col * t, y = row * t;
        const odd = (col + row) % 2;
        const offset = Math.floor(random() * 9);
        ctx.fillStyle = odd ? `rgb(${117 + offset} ${140 + offset} ${126 + offset})` : `rgb(${204 + offset} ${186 + offset} ${152 + offset})`;
        ctx.fillRect(x + 1.5, y + 1.5, t - 3, t - 3);
        ctx.strokeStyle = odd ? '#a0aa8c61' : '#f9e4b371';
        ctx.strokeRect(x + 5.5, y + 5.5, t - 11, t - 11);
        for (let i = 0; i < 90; i++) {
          ctx.fillStyle = random() < .5 ? '#524a4031' : '#fcedb641';
          ctx.fillRect(x + 7 + random() * 114, y + 7 + random() * 114, 1 + random() * 3, 1 + random() * 3);
        }
      }
    }
    for (let y = 128; y < h; y += t) for (let x = 128; x < w; x += t) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#645c52';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#ba9c70';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    const edge = ctx.createRadialGradient(w * .53, h * .52, h * .24, w * .53, h * .5, w * .61);
    edge.addColorStop(0, '#2b333100');
    edge.addColorStop(1, '#343b4060');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
  });
}

function plaster() {
  return texture(512, 256, (ctx, w, h) => {
    const random = rng(681);
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, '#c2a585');
    wash.addColorStop(.48, '#e9cf9d');
    wash.addColorStop(1, '#d3b386');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 11500; i++) {
      ctx.fillStyle = random() > .45 ? '#fff0cc19' : '#69553c13';
      ctx.fillRect(random() * w, random() * h, 1 + random() * 4, 1 + random() * 2);
    }
  });
}

function makeSign(parent, x, y, z, w, h, text, sub, theme = 'night') {
  const dark = theme === 'night';
  box(parent, dark ? petrol : maple, x, y, z - .012, w + .08, h + .08, .09, .035);
  const tex = texture(768, 256, (ctx, width, height) => {
    ctx.fillStyle = dark ? '#2d4c4a' : '#edd4a5';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = dark ? '#c2ad79' : '#9f7054';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, width - 24, height - 24);
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.textAlign = 'center';
    ctx.fillStyle = dark ? '#ffdf9f' : '#523a37';
    ctx.font = 'bold 81px Georgia';
    ctx.fillText(text, width / 2, sub ? 131 : 160, width - 64);
    if (sub) {
      ctx.fillStyle = dark ? '#e6c592' : '#765349';
      ctx.font = '600 23px sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText(sub, width / 2, 187, width - 55);
    }
  });
  panel(parent, colouredTexture(tex), x, y, z + .038, w, h);
}

function nightImage() {
  return texture(1024, 512, (ctx, w, h) => {
    const random = rng(34);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#172647');
    sky.addColorStop(.54, '#314d71');
    sky.addColorStop(1, '#64628a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const light = ctx.createRadialGradient(813, 114, 3, 813, 114, 120);
    light.addColorStop(0, '#e2d0a5b0');
    light.addColorStop(.34, '#acabc050');
    light.addColorStop(1, '#aabbdd00');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f1dfb6';
    ctx.beginPath();
    ctx.arc(813, 114, 29, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 110; i++) {
      ctx.fillStyle = '#ecdfc4' + (random() > .75 ? 'a0' : '45');
      ctx.fillRect(random() * w, random() * 275, random() * 2 + 1, random() * 2 + 1);
    }
    for (let layer = 0; layer < 3; layer++) {
      let x = -30;
      while (x < w) {
        const width = 48 + random() * 88;
        const y = Math.floor(241 + layer * 38 + random() * 97);
        ctx.fillStyle = ['#293755', '#25354f', '#233345'][layer];
        ctx.fillRect(x, y, width, h - y);
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + width * .5, y - random() * 33);
        ctx.lineTo(x + width + 4, y);
        ctx.fill();
        ctx.fillRect(x + width * .73, y - 27, 9, 32);
        for (let wx = x + 13; wx < x + width - 8; wx += 20) for (let wy = y + 14; wy < h; wy += 28) {
          if (random() < .72) {
            ctx.fillStyle = random() > .65 ? '#dea56a' : '#7b8794';
            ctx.fillRect(wx, wy, 7 + Math.floor(random() * 3), 13);
          }
        }
        x += width + (layer === 2 ? 11 : 6);
      }
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 235; i++) {
      const x = random() * w, y = random() * h, l = 5 + random() ** 2 * 72;
      ctx.strokeStyle = random() > .79 ? '#b6dad855' : '#81b9c82a';
      ctx.lineWidth = 1 + random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - l * .24, y + l);
      ctx.stroke();
    }
  });
}

function windowToStreet(staticWorld, dynamics) {
  const x = 3.76, y = 3.24, z = -5.8;
  box(staticWorld, '#986e59', x, y, z, 6.2, 2.72, .30, .065);
  box(staticWorld, petrol, x, y, z + .18, 5.96, 2.47, .09);
  panel(staticWorld, colouredTexture(nightImage()), x, y, z + .233, 5.83, 2.32);
  const rainMat = new T.MeshBasicMaterial({ color: '#bddbdc', transparent: true, opacity: .26, depthWrite: false });
  const geo = new T.BufferGeometry();
  const drops = Array.from({ length: 49 }, (_, i) => {
    const random = rng(113 + i * 97);
    random();
    return { x: (random() - .5) * 5.65, y: random() * 2.26, speed: .23 + random() * 1.09, length: .055 + random() * .11 };
  });
  const vectors = new Float32Array(drops.length * 6);
  geo.setAttribute('position', new T.BufferAttribute(vectors, 3));
  const lines = new T.LineSegments(geo, rainMat);
  lines.frustumCulled = false;
  lines.position.set(x, y, z + .239);
  dynamics.add(lines);
  for (const dx of [-2.95, -.97, .98, 2.95]) box(staticWorld, '#476865', x + dx, y, z + .27, .103, 2.43, .12, .026);
  for (const dy of [-1.195, .37, 1.195]) box(staticWorld, '#4c6c66', x, y + dy, z + .285, 5.99, .106, .13, .027);
  box(staticWorld, bone, x, y - 1.32, z + .35, 6.42, .14, .54);
  return (dt) => {
    drops.forEach((d, i) => {
      d.y = (d.y - d.speed * dt + 2.26) % 2.26;
      const py = d.y - 1.13;
      vectors.set([d.x, py, 0, d.x - .018, Math.max(-1.13, py - d.length), 0], i * 6);
    });
    geo.attributes.position.needsUpdate = true;
  };
}

function laundry(stack, x, y, z, w, d, colours) {
  colours.forEach((c, i) => {
    const cloth = group(stack, x + Math.sin(i * 4) * .055, y + i * .111, z);
    cloth.rotation.y = Math.sin(i * 7) * .072;
    box(cloth, c, 0, .058, 0, w - i * .036, .121, d - i * .017, .052);
    box(cloth, c, .014, .084, d * .43, w - .13, .045, .064, .018);
    box(cloth, '#fbe7b9', -w * .29, .063, d * .49, .081, .048, .019, .005);
  });
}

function washer(staticWorld, dynamics, x, z, color, number) {
  const g = group(staticWorld, x, 0, z);
  box(g, '#444d4a', 0, .1, 0, 1.94, .17, 1.59, .035);
  box(g, color, 0, 1.07, 0, 2, 1.99, 1.57, .14);
  box(g, bone, 0, 1.779, .797, 1.81, .369, .073, .04);
  box(g, '#4a605c', -.49, 1.789, .84, .61, .17, .039, .022);
  const display = texture(192, 54, (ctx, w, h) => {
    ctx.fillStyle = '#324e44'; ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 26px monospace'; ctx.fillStyle = '#bee4ac';
    ctx.fillText(number === 2 ? '03:19' : '— — —', 15, 36);
  });
  panel(g, colouredTexture(display), -.49, 1.789, .863, .52, .136);
  drum(g, '#70574b', .493, 1.782, .848, .118, .04).rotation.x = Math.PI / 2;
  drum(g, '#d9c5a2', .493, 1.782, .877, .098, .045).rotation.x = Math.PI / 2;
  box(g, petrol, .498, 1.846, .906, .029, .049, .006, .004);
  ball(g, glow(number === 2 ? '#bce696' : '#dda375'), .716, 1.784, .856, .035, .035, .022);
  const ring = paint('#a8b0a5', .43, .35);
  const doorY = .892;
  disk(g, petrol, 0, doorY, .813, .677);
  torus(g, '#5c6d64', 0, doorY, .812, .671, .059);
  torus(g, ring, 0, doorY, .896, .61, .075);
  torus(g, '#66736e', 0, doorY, .946, .525, .023);
  disk(g, '#233c47', 0, doorY, .838, .562);
  box(g, ring, .65, doorY, .955, .105, .24, .12, .034);
  box(g, '#546163', -.652, doorY, .86, .094, .263, .10, .019);
  const turn = group(dynamics, x, doorY, z + .863);
  if (number === 2) {
    ball(turn, '#889d94', -.03, -.15, .008, .39, .155, .022).rotation.z = -.32;
    ball(turn, '#db847a', .092, -.23, .026, .275, .138, .024).rotation.z = .3;
    ball(turn, '#d5b078', .11, -.082, .041, .195, .128, .022).rotation.z = -.51;
    ball(turn, '#e5cfa7', -.24, -.07, .033, .135, .108, .019).rotation.z = 1.1;
  }
  disk(dynamics, new T.MeshBasicMaterial({ color: '#5cafa5', transparent: true, opacity: .15, depthWrite: false }), x, doorY, z + .95, .526);
  line(g, paint('#88a9a8'), [[-.41, 1.00, .953], [-.37, 1.18, .955], [-.23, 1.30, .955], [-.066, 1.344, .953]], .015);
  line(g, paint('#a8c9c3'), [[-.329, 1.03, .958], [-.294, 1.159, .959], [-.212, 1.207, .955]], .010);
  return turn;
}

function plant(parent, x, y, z, scale, seed) {
  const p = group(parent, x, y, z);
  p.scale.setScalar(scale);
  const random = rng(seed);
  const pot = new T.CylinderGeometry(.30, .21, .37, 16);
  mesh(p, pot, '#b57d5e', 0, .185, 0);
  drum(p, '#cc9a70', 0, .343, 0, .324, .086);
  drum(p, '#554c40', 0, .391, 0, .265, .025);
  for (let i = 0; i < 9; i++) {
    const turn = i * 2.398;
    const r = .29 + random() * .25;
    const h = .60 + random() * .65;
    const sx = Math.sin(turn), sz = Math.cos(turn);
    const leaf = group(p, .03 * sx, .39, .03 * sz);
    leaf.rotation.y = turn;
    line(leaf, '#647751', [[0, 0, 0], [0, h * .45, r * .24], [0, h * .78, r * .67]], .012, 7);
    const shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(.26, .19, .024, .52);
    shape.quadraticCurveTo(-.205, .34, 0, 0);
    const geom = new T.ShapeGeometry(shape, 12);
    const a = geom.attributes.position;
    for (let j = 0; j < a.count; j++) a.setZ(j, .051 - Math.abs(a.getX(j)) * .5 - .20 * a.getY(j) ** 2);
    geom.computeVertexNormals();
    const m = mesh(leaf, geom, leafMats[i % leafMats.length], 0, h * .63, r * .52);
    m.rotation.x = .64 + random() * .75;
    m.rotation.y = Math.PI * (i % 2);
    m.scale.setScalar(.65 + random() * .8);
  }
}
const leafMats = ['#64865a', '#829957', '#46725e', '#557c69'].map(color => new T.MeshStandardMaterial({ color, roughness: .89, side: T.DoubleSide }));

function basket(parent, x, z) {
  const g = group(parent, x, 0, z);
  const outer = new T.LatheGeometry([
    new T.Vector2(0, .057), new T.Vector2(.56, .064), new T.Vector2(.77, .16),
    new T.Vector2(.88, .42), new T.Vector2(.90, .51), new T.Vector2(.856, .52),
    new T.Vector2(.81, .30), new T.Vector2(.67, .10), new T.Vector2(0, .083),
  ], 64);
  mesh(g, outer, paint('#9a6d4f', .99), 0, 0, 0).scale.x = 1.37;
  const random = rng(244);
  for (let row = 0; row < 8; row++) {
    const ry = .11 + row * .052;
    const r = .65 + .235 * Math.pow(row / 7, .7);
    const path = [];
    for (let j = 0; j <= 88; j++) {
      const phi = j / 88 * Math.PI * 2;
      const wave = .018 * Math.sin(phi * 44 + row * Math.PI);
      path.push([(r + wave) * 1.37 * Math.cos(phi), ry, (r + wave) * Math.sin(phi)]);
    }
    line(g, row % 2 ? '#cf9f67' : '#bd8c5b', path, .024, 176);
  }
  for (let j = 0; j < 44; j++) {
    const a = j / 44 * Math.PI * 2;
    line(g, random() < .4 ? '#ba8e63' : '#dbb17a', [[.87 * Math.cos(a), .104, .64 * Math.sin(a)], [1.09 * Math.cos(a), .29, .80 * Math.sin(a)], [1.204 * Math.cos(a), .48, .887 * Math.sin(a)]], .024, 8);
  }
  const lip = torus(g, '#e3b680', 0, .52, 0, .888, .057, 64);
  lip.rotation.x = -Math.PI / 2;
  lip.scale.x = 1.37;
  ball(g, '#b98279', -.05, .337, 0, 1.06, .176, .73);
  ball(g, '#dd9b8e', .05, .43, -.13, .89, .147, .57).rotation.y = -.2;
  line(g, '#edba9b', [[-.6, .49, .34], [-.1, .527, .367], [.38, .49, .26], [.88, .473, .09]], .019);
  for (const s of [-1, 1]) line(g, '#dcaf77', [[s * 1.03, .45, -.32], [s * 1.24, .75, -.25], [s * 1.25, .76, .23], [s * 1.04, .47, .34]], .06);
  return g;
}

function matTexture() {
  return texture(768, 512, (ctx, w, h) => {
    const random = rng(483);
    ctx.fillStyle = '#ad694e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9100; i++) {
      ctx.fillStyle = random() > .5 ? '#f5bd8155' : '#6c483638';
      ctx.fillRect(random() * w, random() * h, 2 + random() * 8, 2 + random() * 4);
    }
    ctx.strokeStyle = '#e8b87b'; ctx.lineWidth = 6;
    ctx.strokeRect(26, 23, w - 52, h - 46);
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 36, w - 80, h - 72);
    for (let x = 79; x < w - 35; x += 42) for (const y of [72, h - 72]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-8, -8, 16, 16); ctx.restore();
    }
    ctx.font = 'bold 61px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#f5cc92';
    ctx.fillText('HOME', w / 2, h - 106);
  });
}

export function createLaundrette(scene) {
  const features = group(scene);
  const staticWorld = new T.Group();
  const solid = [];
  const obstacle = (x, z, w, d, top, bottom = 0) => {
    solid.push({ x, z, w, d, top, bottom });
  };
  const outside = box(features, '#182d39', 0, -.48, 0, 400, .06, 400, 0);
  outside.receiveShadow = true;
  box(staticWorld, '#385a54', 0, -.258, 0, 16.42, .42, 12.39, .10);
  box(staticWorld, '#759181', 0, -.118, 0, 16.32, .13, 12.28, .046);
  const floor = panel(features, standard(floorMap()), 0, 0, 0, 16, 12);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  box(staticWorld, '#405957', 0, -.052, 6.08, 16.2, .15, .14, .026);
  box(staticWorld, '#405957', 8.08, -.052, 0, .14, .15, 12.11, .026);

  const wallPaint = standard(plaster());
  box(staticWorld, wallPaint, 0, 2.55, -6.095, 16.33, 5.15, .24, .078);
  box(staticWorld, wallPaint, -8.09, 2.30, -2.12, .23, 4.64, 7.95, .073);
  box(staticWorld, '#bea07e', 0, 5.122, -6.03, 16.48, .14, .39, .04);
  box(staticWorld, '#bea07e', -8.10, 4.627, -2.10, .36, .14, 8.03, .04);
  const wallTile = texture(1280, 160, (ctx, w, h) => {
    const random = rng(20);
    ctx.fillStyle = '#587a6b'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) for (let y = 0; y < h; y += 40) {
      const k = Math.round(random() * 10);
      ctx.fillStyle = `rgb(${101 + k} ${144 + k} ${124 + k})`;
      ctx.fillRect(x + 1, y + 1, 62, 38);
      ctx.fillStyle = '#aad0ad55'; ctx.fillRect(x + 2, y + 2, 60, 2);
    }
  });
  const tilePaint = standard(wallTile);
  box(staticWorld, tilePaint, 0, .693, -5.923, 16.065, 1.37, .136, .025);
  box(staticWorld, tilePaint, -7.947, .693, -2.06, .127, 1.37, 7.76, .027);
  box(staticWorld, '#3e645c', 0, 1.41, -5.82, 16.15, .106, .17, .027);
  box(staticWorld, '#3e645c', -7.83, 1.41, -2.05, .17, .106, 7.72, .027);
  box(staticWorld, '#466158', 0, .116, -5.825, 16.15, .20, .16, .023);
  box(staticWorld, '#466158', -7.84, .116, -2.07, .16, .20, 7.72, .023);

  const rain = windowToStreet(staticWorld, features);
  makeSign(staticWorld, -4.18, 3.65, -5.78, 5.6, 1.27, 'BLUE HOUR', 'S E L F - S E R V I C E   L A U N D R E T T E');
  const leftSign = group(staticWorld, -7.92, 2.87, -.54);
  leftSign.rotation.y = Math.PI / 2;
  makeSign(leftSign, 0, 0, .06, 1.85, .76, 'Lost socks', 'PLEASE ASK INSIDE', 'day');
  const note = group(staticWorld, -7.87, 2.58, -3.1);
  note.rotation.y = Math.PI / 2;
  makeSign(note, 0, 0, .025, 1.35, .52, 'Quiet, please', 'CATS SLEEP HERE', 'day');
  // Brass sconces with warm frosted tubes.
  for (const x of [-6.84, -.99, 7.09]) {
    box(staticWorld, brass, x, 4.62, -5.814, .74, .115, .23, .03);
    box(staticWorld, glow('#ffdd9b'), x, 4.563, -5.68, .61, .064, .094, .028);
    const light = new T.PointLight('#ffc17b', 7.5, 5.4, 2);
    light.position.set(x, 4.43, -5.40);
    scene.add(light);
  }
  const turns = [-5.78, -3.60, -1.42].map((x, i) => {
    obstacle(x, -4.94, 2, 1.60, 2.065);
    return washer(staticWorld, features, x, -4.94, ['#e0caa5', '#8fb7a5', '#e5cfaf'][i], i + 1);
  });
  box(staticWorld, maple, -3.58, 2.094, -4.96, 6.42, .118, 1.67, .047);
  laundry(staticWorld, -5.36, 2.165, -4.89, .92, .65, ['#b27a72', '#ebd1a5', '#97aa81']);
  laundry(staticWorld, -2.21, 2.165, -5.01, 1.02, .67, ['#c39b77', '#e3c293']);
  plant(staticWorld, -6.54, 2.155, -4.95, .86, 105);
  for (const [i, x] of [-4.21, -3.79, -.78].entries()) {
    box(staticWorld, ['#d0a36e', '#92a998', '#cb8b76'][i], x, 2.40, -5.17, .30, .49, .22, .028);
    box(staticWorld, bone, x, 2.45, -5.046, .23, .115, .032, .012);
  }

  // Bobbin can be approached from any side of the folding table.
  const tableX = -4.08, tableZ = -1.25;
  box(staticWorld, teal, tableX, .994, tableZ, 2.68, .18, 1.51, .06);
  box(staticWorld, maple, tableX, 1.116, tableZ, 2.81, .11, 1.60, .055);
  obstacle(tableX, tableZ, 2.81, 1.6, 1.17, .90);
  for (const x of [-5.24, -2.92]) for (const z of [-1.85, -.67]) {
    box(staticWorld, teal, x, .49, z, .15, .95, .15, .026);
    obstacle(x, z, .15, .15, 1);
  }
  laundry(staticWorld, -4.84, 1.18, -1.48, .81, .68, ['#a6ae87', '#e6cba0', '#d1a383']);
  laundry(staticWorld, -3.64, 1.18, -1.39, .79, .60, ['#93b0a0', '#b7958b']);
  box(staticWorld, '#c2a070', -2.99, 1.23, -1.46, .36, .15, .43, .052);
  for (let i = 0; i < 7; i++) box(staticWorld, '#937154', -3.154 + i * .054, 1.247, -1.23, .018, .094, .024, .005);

  // Painted steps rise to the sorting counter below the window.
  box(staticWorld, '#ad7762', 2.32, .54, -1.66, 1.35, .22, 1.17, .056);
  box(staticWorld, '#cd9b73', 2.32, .613, -1.66, 1.43, .073, 1.23, .035);
  for (const dx of [-.52, .52]) for (const dz of [-.42, .42]) box(staticWorld, '#975f54', 2.32 + dx, .27, -1.66 + dz, .15, .54, .15, .027);
  obstacle(2.32, -1.66, 1.43, 1.23, .65);
  box(staticWorld, '#6a8d7d', 3.82, .594, -2.18, 1.64, 1.18, 1.41, .055);
  for (const y of [.231, .499, .782]) box(staticWorld, '#83a796', 3.82, y, -1.455, 1.59, .189, .077, .027);
  box(staticWorld, '#c4ab82', 3.82, 1.175, -2.18, 1.75, .15, 1.5, .041);
  obstacle(3.82, -2.18, 1.75, 1.5, 1.25);
  const benchX = 5.82, benchZ = -2.53;
  box(staticWorld, teal, benchX, .857, benchZ, 2.42, 1.67, 1.78, .076);
  box(staticWorld, maple, benchX, 1.758, benchZ, 2.54, .18, 1.88, .063);
  obstacle(benchX, benchZ, 2.54, 1.88, 1.85);
  for (const x of [5.24, 6.39]) {
    box(staticWorld, '#537a70', x, .82, -1.621, 1.075, 1.49, .075, .05);
    box(staticWorld, '#afd0b0', x, 1.366, -1.56, .40, .07, .10, .028);
  }
  laundry(staticWorld, 5.45, 1.852, -3.07, 1.0, .46, ['#dbbaa4', '#dec694']);
  laundry(staticWorld, 6.07, 1.852, -3.14, .72, .43, ['#bc8e84', '#f0d3a0', '#a4b59a']);
  plant(staticWorld, 6.72, 1.855, -2.94, .68, 132);
  obstacle(6.72, -2.94, .37, .40, 2.19, 1.85);
  const routeMark = texture(128, 64, (ctx) => {
    ctx.fillStyle = '#ffe8b8';
    ctx.beginPath();
    ctx.moveTo(24, 39); ctx.lineTo(64, 12); ctx.lineTo(104, 39); ctx.lineTo(94, 51);
    ctx.lineTo(64, 32); ctx.lineTo(34, 51); ctx.fill();
  });
  const routeMat = colouredTexture(routeMark, { transparent: true, depthWrite: false });
  panel(features, routeMat, 2.32, .426, -1.041, .40, .20);
  panel(features, routeMat, 3.82, .925, -1.41, .43, .23);
  panel(features, routeMat, 5.82, 1.707, -1.582, .46, .20);

  // Window details and a green corner behind the vacuum route.
  box(staticWorld, '#74847d', 4.3, .59, -5.54, 3.18, .84, .44, .06);
  for (let i = 0; i < 15; i++) box(staticWorld, '#a6a89b', 2.92 + i * .198, .59, -5.28, .125, .74, .13, .043);
  line(staticWorld, '#64746d', [[2.79, .34, -5.47], [2.45, .34, -5.46], [2.38, .30, -5.43], [2.38, .115, -5.43]], .052);
  obstacle(4.30, -5.54, 3.2, .62, 1.0);
  plant(staticWorld, 1.20, 1.847, -5.42, .64, 144);
  plant(staticWorld, 6.39, 1.847, -5.41, .70, 332);
  plant(staticWorld, 7.35, 0, 4.67, 1.07, 333);
  obstacle(7.35, 4.67, .65, .65, .41);
  plant(staticWorld, -7.17, 0, 4.44, 1.23, 876);
  obstacle(-7.17, 4.44, .7, .7, .46);

  // Wheeled canvas hamper beside Moth's corner.
  const hamper = group(staticWorld, 6.73, 0, 2.75);
  for (const x of [-.51, .51]) for (const z of [-.34, .34]) {
    drum(hamper, petrol, x, .13, z, .106, .076).rotation.z = Math.PI / 2;
    line(hamper, '#777f73', [[x, .17, z], [x * 1.10, .75, z * 1.12], [x * 1.12, 1.27, z * 1.15]], .036, 5);
  }
  box(hamper, '#b78f7d', 0, .76, 0, 1.15, .94, .80, .10);
  box(hamper, '#d3b391', 0, 1.203, 0, 1.23, .135, .88, .055);
  laundry(hamper, -.12, 1.28, .02, .74, .49, ['#9d9a87', '#cba085']);
  obstacle(6.73, 2.75, 1.25, .90, 1.65);

  const rug = panel(features, colouredTexture(matTexture()), HOME.x, .019, HOME.z + .2, 3.02, 2.26);
  rug.rotation.x = -Math.PI / 2;
  basket(staticWorld, HOME.x, HOME.z);
  obstacle(HOME.x, HOME.z, 2.17, 1.58, .55);
  const homeRing = torus(features, new T.MeshBasicMaterial({ color: '#f6d18b', transparent: true, opacity: .72, depthWrite: false }), HOME.x, .036, HOME.z, 1.54, .025, 64);
  homeRing.rotation.x = -Math.PI / 2;
  homeRing.visible = false;

  batch(staticWorld, features);
  return { solid, homeRing, animate(dt) { rain(dt); turns[1].rotation.z -= dt * 1.10; } };
}

const shadowMap = texture(128, 128, (ctx, w, h) => {
  const radial = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  radial.addColorStop(0, '#222934a9');
  radial.addColorStop(.39, '#252b348c');
  radial.addColorStop(.72, '#2a2b3230');
  radial.addColorStop(1, '#292a3000');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);
});
export function softShadow(scene, width, length) {
  const m = panel(scene, colouredTexture(shadowMap, { transparent: true, depthWrite: false }), 0, .022, 0, width, length);
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function makeSock(scene, spec) {
  const g = group(scene, spec.x, spec.y + .16, spec.z);
  const body = group(g);
  body.rotation.z = -.47;
  box(body, spec.color, 0, .145, 0, .21, .36, .091, .037);
  box(body, spec.color, .091, -.008, .004, .36, .18, .103, .070);
  box(body, bone, 0, .303, .002, .214, .081, .106, .027);
  box(body, bone, 0, .216, .049, .205, .028, .016, .006);
  ball(body, '#f1d6ab', .224, -.018, .008, .105, .082, .060);
  const circle = torus(g, glow('#ffdfa1'), 0, .079, .02, .307, .013, 22);
  circle.rotation.x = -Math.PI / 2;
  circle.material.transparent = true;
  circle.material.depthWrite = false;
  return { g, body, circle };
}

export function makeVacuum(scene) {
  const g = group(scene);
  const body = group(g);
  drum(body, '#3d555b', 0, .125, 0, .45, .15);
  drum(body, '#527377', 0, .216, 0, .449, .10);
  drum(body, '#9bb1a5', 0, .272, 0, .403, .034);
  drum(body, '#35545b', 0, .30, -.062, .12, .064);
  const sensor = disk(body, glow('#b6e9b4'), 0, .175, .449, .068, .035);
  drum(body, '#abc5ac', .145, .296, .171, .047, .016);
  const brush = group(g, .30, .068, .31);
  for (let i = 0; i < 3; i++) {
    const arm = group(brush);
    arm.rotation.y = i * 2.094;
    line(arm, '#9b7e68', [[0, 0, 0], [0, 0, .105], [.044, -.009, .172]], .018, 5);
  }
  const shadow = softShadow(scene, 1.17, 1.17);
  const positions = new Float32Array(14 * 3 * 3);
  const coneGeo = new T.BufferGeometry();
  coneGeo.setAttribute('position', new T.BufferAttribute(positions, 3));
  const vision = mesh(g, coneGeo, new T.MeshBasicMaterial({ color: '#ffbb79', opacity: .14, transparent: true, side: T.DoubleSide, depthWrite: false }), 0, .04, 0);
  vision.frustumCulled = false;
  let idx = 0;
  for (let i = 0; i < 14; i++) {
    const a = -.7 + i / 14 * 1.4, b = a + 1.4 / 14;
    positions.set([0, 0, .2, Math.sin(a) * 2.3, 0, Math.cos(a) * 2.3, Math.sin(b) * 2.3, 0, Math.cos(b) * 2.3], idx);
    idx += 9;
  }
  return { g, body, sensor, brush, shadow, vision };
}
