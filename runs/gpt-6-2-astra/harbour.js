import { T, group, form, box, tube, oval, ring, rod, face, triangles, bake, label, rng } from './forms.js';
import { makeCat } from './cat.js';
const cream = '#fbe4b1',
  wood = '#ad7651',
  deep = '#23595e',
  rust = '#bd513d',
  gold = '#e5ae51';
export const routes = [
  {
    name: 'Pilchard Quay',
    to: 'Fig',
    shop: 'FIG’S • BAIT & TACKLE',
    time: 'Morning tide',
    quote: 'The tide table! I’ve been telling the time by how wet my ankles are.',
    sign: 'Fig, bait shop proprietor',
    sky: [0x88ccda, 0xffeacb],
    sea: [0x287f83, 0x9bd4bc],
    cat: ['#6e7781', '#414d58'],
    stops: [
      ['post', 0, 0, 5.9, 2.65, 0.9],
      ['pier', 6.35, -0.35, 4.7, 3.1, 1.04],
      ['skiff', 12, -1.45, 4, 2.45, 0.74],
      ['raft', 16.65, -0.45, 3, 2.65, 0.64],
      ['end', 22.35, 0.15, 5.5, 3.8, 1.04],
    ],
    stamps: [
      [1, 0.15, 0.57],
      [2, 0, -0.3],
      [3, -0.2, 0.4],
    ],
  },
  {
    name: 'Copperpot Reach',
    to: 'Miso',
    shop: 'COPPERPOT CANNERY',
    time: 'Afternoon tide',
    quote: 'A recipe from Gran. “Add one sardine for the soup, two for the cook.” Sensible woman.',
    sign: 'Miso, night cook',
    sky: [0x91c5cd, 0xffdfaa],
    sea: [0x36828a, 0xafd4ad],
    cat: ['#e7c8a3', '#af917d'],
    stops: [
      ['post', 0, 0, 5.9, 2.65, 0.9],
      ['raft', 5.6, 1.0, 2.8, 2.9, 0.62],
      ['pier', 10.2, 1.1, 4.2, 3.05, 1.05],
      ['ferry', 15.5, 0.35, 3.95, 2.75, 0.74, 5.5, -2.0],
      ['skiff', 26, -2.55, 4, 2.6, 0.83],
      ['end', 32, -1.4, 5.3, 4, 1.14],
    ],
    spur: [2, -0.58, -3.75],
    stamps: [
      [1, -0.17, 0.1],
      [-1, 0, 0],
      [4, -0.28, -0.1],
    ],
  },
  {
    name: 'Lantern Point',
    to: 'Captain Pip',
    shop: 'LANTERN STATION',
    time: 'Last light',
    quote:
      'An invitation to supper. All these years sending ships home, and tonight someone’s left a light on for me.',
    sign: 'Pip, keeper of the light',
    sky: [0x7685a8, 0xf8c4a2],
    sea: [0x375670, 0xd1b997],
    cat: ['#424b53', '#2e393e'],
    stops: [
      ['post', 0, 0, 5.9, 2.65, 0.9],
      ['skiff', 6.4, -0.7, 4.2, 2.2, 0.7],
      ['raft', 11, -2, 2.7, 2.5, 0.7],
      ['pier', 15.35, -2.5, 3.5, 3.1, 1.17],
      ['ferry', 20.25, -1.65, 4.15, 2.5, 0.68, 5.5, 2.4],
      ['raft', 30.35, 1.15, 3.1, 2.75, 0.78],
      ['skiff', 35.5, 0.4, 4.25, 2.45, 0.78],
      ['end', 41.7, -0.55, 5.8, 3.7, 1.12],
    ],
    spur: [3, 0.05, 3.9],
    stamps: [
      [2, -0.1, -0.22],
      [-1, 0, 0],
      [6, 0.0, -0.2],
    ],
  },
];
function crate(p, x, y, z, size = 1) {
  const g = group(p, x, y, z);
  box(g, '#976945', 0, size * 0.46, 0, size, size * 0.92, size * 0.82);
  for (let i of [-1, 1]) {
    box(g, '#c49464', size * 0.435 * i, size * 0.46, size * 0.422, size * 0.1, size * 0.92, 0.045);
    box(g, '#c49464', 0, size * (0.47 + i * 0.38), size * 0.422, size, 0.096, 0.04);
  }
  rod(
    g,
    '#bc8654',
    [-size * 0.39, size * 0.11, size * 0.44],
    [size * 0.39, size * 0.8, size * 0.44],
    size * 0.05,
  );
  box(g, '#e8d7a5', 0, size * 0.53, size * 0.455, size * 0.31, size * 0.24, 0.01);
  return g;
}
function life(p, x, y, z, s = 0.32) {
  ring(p, rust, x, y, z, s, s * 0.25);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4;
    let m = oval(p, cream, x + Math.cos(a) * s, y + Math.sin(a) * s, z, s * 0.27, s * 0.38, s * 0.265);
    m.rotation.z = a;
  }
}
function bollard(p, x, y, z) {
  tube(p, deep, x, y + 0.18, z, 0.105, 0.11, 0.36);
  tube(p, '#40545a', x, y + 0.35, z, 0.14, 0.13, 0.085);
  tube(p, '#d1aa7d', x, y + 0.15, z, 0.126, 0.126, 0.085);
}
const polygon = [
  [-0.5, -0.29],
  [-0.38, -0.47],
  [0.24, -0.5],
  [0.41, -0.35],
  [0.51, 0],
  [0.41, 0.35],
  [0.24, 0.5],
  [-0.38, 0.47],
  [-0.5, 0.29],
];
function hull(p, w, d, body) {
  let levels = [
    [0, 1, deep],
    [-0.1, 1, cream],
    [-0.23, 0.97, body],
    [-0.66, 0.84, body],
    [-0.97, 0.59, '#244c53'],
  ];
  for (let i = 0; i < polygon.length; i++) {
    let a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const pt = (u, h, k) => [u[0] * w * k, h, u[1] * d * k];
    triangles(p, '#bd9263', [0, 0, 0, ...pt(b, 0, 1), ...pt(a, 0, 1)]);
    for (let j = 1; j < levels.length; j++) {
      const [v, k, c] = levels[j],
        [t, l] = levels[j - 1];
      face(p, c, pt(a, t, l), pt(b, t, l), pt(b, v, k), pt(a, v, k));
    }
  }
  for (let i = -5; i <= 5; i++) {
    const x = (w * i) / 13;
    let breadth = (i > 3 ? 0.62 : i === -5 ? 0.76 : 0.91) * d;
    box(p, '#966e4e', x, 0.004, 0, 0.012, 0.008, breadth);
  }
  for (let i = 0; i < polygon.length; i++) {
    let a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    rod(p, cream, [a[0] * w, 0, a[1] * d], [b[0] * w, 0, b[1] * d], 0.043);
  }
}
function boat(p, type, w, d, idx) {
  hull(p, w, d, type === 'post' ? rust : type === 'ferry' ? '#e5ac4f' : idx % 2 ? '#488581' : '#728d9c');
  if (type === 'post') {
    const x = -w * 0.31;
    // A rope fender, cabin steps and the launch's little swallowtail flag.
    for (let j = 0; j < 4; j++) {
      let coil = ring(p, '#d6b47e', 1.18, 0.049 + j * 0.028, -0.66, 0.21 - j * 0.013, 0.023);
      coil.rotation.x = Math.PI / 2;
    }
    for (let j = 0; j < 3; j++) box(p, '#caad80', x + 0.69, 0.24 + j * 0.2, -0.39, 0.15, 0.055, 0.42);
    rod(p, wood, [x + 0.4, 1.56, -0.54], [x + 0.4, 2.75, -0.54], 0.034);
    flag(p, x + 0.4, 2.72, -0.54, rust, 0.63);
    box(p, deep, x, 0.58, -0.1, 1.23, 1.15, 1.55);
    box(p, cream, x, 1.16, -0.1, 1.25, 0.65, 1.54);
    for (let s of [-1, 1]) {
      box(p, '#416c74', x + s * 0.306, 1.17, 0.681, 0.46, 0.41, 0.023);
      box(p, '#71a4a2', x + s * 0.306, 1.24, 0.697, 0.38, 0.15, 0.01);
      box(p, '#365d63', x + 0.635, 1.15, s * 0.34 - 0.08, 0.022, 0.39, 0.54);
    }
    box(p, '#9e4b38', x, 1.52, -0.1, 1.51, 0.13, 1.78);
    box(p, cream, x, 1.6, -0.1, 1.41, 0.045, 1.71);
    tube(p, deep, x - 0.2, 1.91, -0.29, 0.11, 0.14, 0.6);
    tube(p, '#4e6060', x - 0.2, 2.2, -0.29, 0.148, 0.14, 0.07);
    life(p, x - 0.2, 0.54, 0.71, 0.23);
    box(p, '#d6ad66', x + 0.38, 0.55, 0.69, 0.37, 0.21, 0.028);
    for (let i = 0; i < 9; i++)
      oval(
        p,
        '#dfa777',
        -1.85 + i * 0.38,
        -0.31,
        d * (0.46 + 0.019 * Math.sin(i * 0.4)),
        0.024,
        0.024,
        0.014,
      );
    label(p, 'H.P. PILCHARD', -0.15, -0.39, d * 0.465, 1.75, 0.34, rust, '#ffecd3');
    crate(p, -0.69, 0.02, -0.73, 0.53);
    bollard(p, 1.95, 0.04, -0.61);
  } else if (type === 'skiff') {
    box(p, wood, -w * 0.27, 0.06, 0, 0.29, 0.12, d * 0.82);
    box(p, wood, w * 0.21, 0.05, 0, 0.24, 0.1, d * 0.78);
    let oar = rod(p, cream, [-w * 0.3, 0.18, -d * 0.37], [w * 0.35, 0.19, -d * 0.43], 0.047);
    oval(p, '#b67e50', w * 0.35, 0.19, -d * 0.43, 0.255, 0.052, 0.085);
    life(p, -0.55, -0.29, d * 0.49, 0.18);
  } else {
    let x = -w * 0.31,
      z = -d * 0.36;
    rod(p, deep, [x, 0, z], [x, 1.85, z], 0.063);
    flag(p, x, 1.82, z, gold, 0.65);
    life(p, -0.45, -0.28, d * 0.5, 0.196);
    bollard(p, w * 0.34, 0, -0.45);
  }
}
function pier(p, w, d, type) {
  let n = Math.ceil(w / 0.38);
  for (let i = 0; i < n; i++)
    box(
      p,
      ['#c39063', '#c7986b', '#d0a275', '#bf906a'][i % 4],
      ((i + 0.5) * w) / n - w / 2,
      -0.093,
      0,
      w / n - 0.018,
      0.186,
      d,
    );
  for (let s of [-1, 1]) {
    box(p, '#855e49', 0, -0.26, s * d * 0.39, w, 0.21, 0.16);
    for (let j of [-1, 1]) {
      let x = j * (w / 2 - 0.2),
        z = s * (d / 2 - 0.17);
      tube(p, '#865f49', x, -0.65, z, 0.135, 0.16, 1.92);
      tube(p, '#d6ae7d', x, 0.24, z, 0.147, 0.146, 0.13);
      tube(p, cream, x, 0.11, z, 0.146, 0.146, 0.1);
    }
  }
  if (type === 'end') {
    crate(p, w * 0.01, 0, -d * 0.39, 0.54);
    crate(p, -w * 0.11, 0, -d * 0.35, 0.42);
  } else bollard(p, -w * 0.26, 0, -d * 0.35);
}
function raft(p, w, d) {
  for (let i = 0; i < 6; i++)
    box(p, i % 2 ? '#b99467' : '#c69c6e', 0, -0.103, d * ((i + 0.5) / 6 - 0.5), w, 0.206, d / 6 - 0.017);
  for (let s of [-1, 1]) {
    let m = tube(p, '#4b7373', s * w * 0.28, -0.27, 0, 0.26, 0.26, d, 12);
    m.rotation.x = Math.PI / 2;
    box(p, cream, s * w * 0.285, 0.01, 0, 0.073, 0.02, d);
  }
}
function flag(p, x, y, z, c, size) {
  triangles(p, c, [
    x,
    y,
    z,
    x + size * 0.45,
    y - 0.045,
    z + 0.07,
    x,
    y - size * 0.46,
    z,
    x + size * 0.45,
    y - 0.045,
    z + 0.07,
    x + size,
    y - 0.14,
    z + 0.035,
    x,
    y - size * 0.46,
    z,
  ]);
}
function roof(p, x, y, z, w, d, h, c) {
  let A = [x - w / 2, y, z + d / 2],
    B = [x + w / 2, y, z + d / 2],
    C = [x, y + h, z + d / 2],
    F = [x - w / 2, y, z - d / 2],
    G = [x + w / 2, y, z - d / 2],
    H = [x, y + h, z - d / 2];
  face(p, c, A, C, H, F);
  face(p, c, C, B, G, H);
  triangles(p, c, [...A, ...B, ...C, ...F, ...G, ...H]);
}
function house(p, x, y, z, w, h, d, c, roofColor, rand, lit = false) {
  box(p, c, x, y + h / 2, z, w, h, d);
  let rh = w * (0.25 + rand() * 0.14);
  roof(p, x, y + h, z, w + 0.26, d + 0.32, rh, roofColor);
  for (let s of [-1, 1]) {
    rod(
      p,
      '#eed6b0',
      [x + s * (w / 2 + 0.11), y + h, z + d / 2 + 0.17],
      [x, y + h + rh, z + d / 2 + 0.17],
      0.055,
    );
    box(p, '#d0b193', x + s * w * 0.486, y + h * 0.5, z + d * 0.505, 0.1, h, 0.1);
    for (let l = 1; l < 4; l++) {
      let k = l * 0.245;
      rod(
        p,
        roofColor,
        [x + s * k * (w / 2 + 0.12), y + h + rh * (1 - k) + 0.039, z - d / 2 - 0.1],
        [x + s * k * (w / 2 + 0.12), y + h + rh * (1 - k) + 0.039, z + d / 2 + 0.1],
        0.043,
      );
    }
  }
  box(p, '#dcc199', x, y + 0.17, z, w + 0.04, 0.32, d + 0.055);
  let front = z + d / 2 + 0.019;
  for (let row = 0; row < (h > 3.2 ? 2 : 1); row++)
    for (let i = 0; i < 2; i++) {
      let wx = x + (i ? 1 : -1) * w * 0.242,
        wy = y + h * (row === 1 ? 0.38 : 0.77),
        ww = w * 0.21,
        hh = Math.min(0.89, h * 0.21);
      box(p, '#eee1b8', wx, wy, front, ww + 0.14, hh + 0.15, 0.08);
      box(p, lit ? '#f2b76d' : '#44676c', wx, wy, front + 0.054, ww, hh, 0.04);
      box(
        p,
        lit ? '#ffe1a0' : '#a8c3ae',
        wx - 0.05 * ww,
        wy + 0.19 * hh,
        front + 0.079,
        ww * 0.87,
        hh * 0.33,
        0.012,
      );
      box(p, '#e6d8b7', wx, wy, front + 0.09, 0.044, hh, 0.014);
      box(p, roofColor, wx, wy - hh / 2 - 0.085, front + 0.04, ww + 0.24, 0.12, 0.14);
    }
  box(p, '#486362', x, y + 0.61, front, 0.49, 1.22, 0.05);
  box(p, roofColor, x + w * 0.23, y + h + rh * 0.75, z - 0.25, 0.3, 0.83, 0.36);
  if (rand() > 0.3) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      let b = box(
        p,
        i % 2 ? cream : roofColor,
        x + w * ((i + 0.5) / n - 0.5),
        y + 1.33,
        front + 0.31,
        w / n,
        0.08,
        0.75,
      );
      b.rotation.x = 0.12;
      box(
        p,
        i % 2 ? cream : roofColor,
        x + w * ((i + 0.5) / n - 0.5),
        y + 1.23,
        front + 0.66,
        w / n,
        0.12,
        0.045,
      );
    }
  }
}
function tower(p, x, y, z, s) {
  const g = group(p, x, y, z);
  g.scale.setScalar(s);
  tube(g, '#d5c5a2', 0, 0.22, 0, 1.35, 1.6, 0.44, 12);
  for (let i = 0; i < 5; i++)
    tube(
      g,
      i % 2 ? rust : cream,
      0,
      0.45 + i * 1.17 + 0.585,
      0,
      1.02 - (i + 1) * 0.092,
      1.02 - i * 0.092,
      1.17,
      16,
    );
  tube(g, deep, 0, 6.38, 0, 0.88, 0.86, 0.2, 14);
  tube(g, '#fbd17b', 0, 6.91, 0, 0.54, 0.54, 0.96, 10);
  for (let i = 0; i < 8; i++) {
    let a = (i * Math.PI) / 4;
    rod(
      g,
      deep,
      [Math.sin(a) * 0.56, 6.42, Math.cos(a) * 0.56],
      [Math.sin(a) * 0.56, 7.38, Math.cos(a) * 0.56],
      0.039,
    );
  }
  tube(g, rust, 0, 7.62, 0, 0.06, 0.86, 0.57, 12);
  rod(g, deep, [0, 7.87, 0], [0, 8.2, 0], 0.04);
  box(g, deep, 0, 1.1, 0.95, 0.46, 1.07, 0.1);
  for (let i = 0; i < 8; i++) {
    let a = (i * Math.PI) / 4,
      b = ((i + 1) * Math.PI) / 4;
    rod(
      g,
      deep,
      [Math.sin(a) * 0.85, 6.43, Math.cos(a) * 0.85],
      [Math.sin(a) * 0.85, 6.81, Math.cos(a) * 0.85],
      0.025,
    );
    rod(
      g,
      deep,
      [Math.sin(a) * 0.85, 6.79, Math.cos(a) * 0.85],
      [Math.sin(b) * 0.85, 6.79, Math.cos(b) * 0.85],
      0.029,
    );
  }
}
function island(p, x, z, r, h, c, rand) {
  let g = new T.IcosahedronGeometry(1, 1);
  let v = g.attributes.position;
  for (let i = 0; i < v.count; i++) {
    let a = v.getX(i),
      b = v.getY(i),
      d = v.getZ(i);
    v.setXYZ(i, a * (1 + 0.09 * Math.sin(d * 8 + b * 4)), b * (1 + 0.15 * Math.cos(a * 5 + d * 6)), d);
  }
  g.computeVertexNormals();
  form(p, g, c, x, -0.6, z, r, h, r * 0.73);
}
function waterPrint(parent, w, d, seed) {
  let mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { phase: { value: seed } },
    vertexShader:
      'varying vec2 point;void main(){point=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
 varying vec2 point;uniform float phase;
 void main(){vec2 p=point;float a=atan(p.y,p.x);float r=length(p);float wav=.015*sin(a*12.+phase)+.009*sin(a*23.-phase*.4);
 float edge=r+wav;float shade=(1.-smoothstep(.51,.82,edge))*.30;
 float gleam=(1.-smoothstep(.009,.026,abs(edge-.77)))*smoothstep(-.45,.55,sin(3.*a-phase*.67)+.32*sin(8.*a));
 gleam+=.48*(1.-smoothstep(.006,.019,abs(edge-.89)))*smoothstep(.1,.75,cos(a*5.+phase*.29));
 gl_FragColor=vec4(mix(vec3(.10,.24,.22),vec3(.82,.88,.73),step(.04,gleam)),max(shade,gleam*.74));}`,
  });
  let m = new T.Mesh(new T.PlaneGeometry(w * 1.44, d * 1.68), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.032;
  m.renderOrder = 1;
  parent.add(m);
  return m;
}
function buoy(p, x, z, c) {
  const g = group(p, x, 0, z);
  tube(g, c, 0, 0.04, 0, 0.27, 0.42, 0.6);
  tube(g, cream, 0, 0.39, 0, 0.16, 0.27, 0.13);
  rod(g, deep, [0, 0.41, 0], [0, 1.38, 0], 0.046);
  tube(g, c, 0, 1.32, 0, 0.14, 0.14, 0.28);
  tube(g, cream, 0, 1.5, 0, 0, 0.19, 0.16);
  return g;
}
export function makeWorld(scene, stage) {
  let cfg = routes[stage],
    rand = rng(279 + stage * 13),
    all = group(scene),
    distant = group(all),
    near = group(all),
    plats = [],
    birds = [],
    waves = [],
    tokens = [],
    buoys = [];
  const finish = cfg.stops.at(-1)[1];
  for (let i = -4; i < 12; i++) {
    let x = i * 11 + rand() * 4;
    island(
      distant,
      x,
      -39 - rand() * 11,
      10 + rand() * 9,
      5 + rand() * 4,
      ['#8da99a', '#92ae9b', '#87a69a'][(i + 4) & 1],
      rand,
    );
  }
  for (let i = -3; i < 10; i++) {
    let x = i * 7.8 + rand() * 1.2,
      z = -19 - rand() * 4;
    island(distant, x, z, 5.8 + rand() * 1.4, 1.8, '#8b9c80', rand);
    box(distant, '#ada18a', x, 0.14, z + 1.9, 7.9, 1.65, 2.3);
    box(distant, '#dbbd9a', x, 1.0, z + 1.9, 7.95, 0.14, 2.35);
    for (let b = 0; b < 6; b++) {
      box(distant, '#938a79', x - 3.45 + b * 1.31, 0.6, z + 3.06, 0.74, 0.11, 0.06);
      tube(distant, '#7f7461', x - 2.9 + b * 1.28, 0.18, z + 3.24, 0.09, 0.115, 1.47, 8);
    }
    for (let b = 0; b < 3; b++) {
      let tx = x + rand() * 5 - 2.5,
        tz = z - 2.5 - rand() * 2.3,
        th = 1.5 + rand() * 1.4;
      rod(distant, '#81785e', [tx, 0.65, tz], [tx, th + 0.6, tz], 0.15);
      for (let m = 0; m < 2; m++)
        form(
          distant,
          new T.IcosahedronGeometry(1, 0),
          m ? '#779184' : '#789580',
          tx + m * 0.42,
          th + m * 0.45,
          tz,
          0.94 + m * 0.31,
          1.1 + m * 0.4,
          0.85,
        );
    }

    if (i === -1 && stage !== 2) {
      tower(distant, x, 0.95, z, 0.74);
      continue;
    }
    if (stage === 1 && i % 3 === 0) {
      box(distant, '#b48667', x, 2.3, z, 5.9, 2.55, 2.8);
      for (let j = 0; j < 3; j++) {
        roof(distant, x - 2 + j * 2, 3.58, z, 2.14, 3.03, 0.8, '#71817d');
        box(distant, '#718179', x - 2 + j * 2, 2.45, z + 1.43, 1.27, 0.82, 0.05);
      }
      tube(distant, '#af7f66', x - 1.85, 3.67, z - 0.6, 0.26, 0.42, 5.6, 10);
      tube(distant, '#816c60', x - 1.85, 6.44, z - 0.6, 0.33, 0.33, 0.22, 10);
      continue;
    }
    const colours = ['#efc48c', '#ead8b0', '#dda881', '#b5c5ae', '#e5bc93'];
    for (let j = 0; j < 2; j++) {
      let w = 2.1 + rand() * 1.0;
      house(
        distant,
        x + (j - 0.5) * 3.2,
        1.0,
        z + rand() * 1.4,
        w,
        2.6 + rand() * 2.2,
        2 + rand(),
        colours[Math.floor(rand() * 5)],
        ['#b86e54', '#9c6354', '#547877'][Math.floor(rand() * 3)],
        rand,
        stage === 2,
      );
    }
  }
  // Tall nearer working waterfront behind the destination.
  box(near, '#9d9682', finish + 0.1, 0.25, -7, 9.1, 1.48, 4.2);
  box(near, '#c8b394', finish + 0.1, 1.02, -7, 9.3, 0.22, 4.35);
  for (let i = 0; i < 11; i++) box(near, '#b7a38b', finish - 4 + i * 0.81, 0.67, -4.88, 0.7, 0.39, 0.08);
  if (stage === 2) tower(near, finish + 1, 1.13, -7.3, 1.03);
  else {
    house(
      near,
      finish + 0.2,
      1.13,
      -7.4,
      4.9,
      3.07,
      3.4,
      stage ? '#cf996d' : '#d3b487',
      stage ? '#537579' : '#a8664c',
      rand,
    );
    label(near, cfg.shop, finish + 0.2, 3.15, -5.62, 4.35, 0.55, deep, '#fff0c8');
  }
  for (let k = 0; k < 3; k++) {
    let f = group(near, finish - 3.7 + k * 1.63, 1.14, -5.0);
    if (k === 0 || k === 2) rod(f, wood, [0, 0, 0], [0, 1.58, 0], 0.053);
    for (let v = 0; v < 3; v++)
      rod(f, '#937e62', [0, 0.65 + v * 0.24, 0], [1.6, 0.55 + v * 0.24, 0], 0.014);
    for (let a = 0; a < 7; a++) rod(f, '#937e62', [a * 0.22, 0.65, 0], [(a + 1) * 0.22, 1.13, 0], 0.012);
  }
  for (let i = 0; i < 3; i++) crate(near, finish - 3.6 + i * 0.62, 1.14, -5.3, 0.58);
  // A sagging string of signal pennants over the harbour wall.
  for (let j = 0; j < 2; j++)
    rod(near, wood, [finish - 4.2 + j * 8, 1.08, -5.2], [finish - 4.2 + j * 8, 4.25, -5.2], 0.069);
  for (let i = 0; i < 13; i++) {
    const x = finish - 4.2 + (i * 8) / 13,
      a = 4.23 - 0.48 * Math.sin((i * Math.PI) / 13),
      b = 4.23 - 0.48 * Math.sin(((i + 1) * Math.PI) / 13);
    rod(near, '#675f51', [x, a, -5.2], [x + 8 / 13, b, -5.2], 0.015);
    triangles(near, [rust, gold, cream, deep][i % 4], [
      x + 0.05,
      a - 0.02,
      -5.2,
      x + 0.52,
      b - 0.02,
      -5.2,
      x + 0.32,
      a - 0.47,
      -5.17,
    ]);
  }
  for (let i = -1; i < Math.ceil(finish / 14) + 1; i++) {
    const x = i * 14 + 2,
      z = -10 - rand() * 2;
    let g = group(near, x, 0.46, z);
    g.rotation.y = (rand() - 0.5) * 0.45;
    hull(g, 3.6, 1.44, i % 2 ? deep : rust);
    rod(g, wood, [0, 0.03, 0], [0, 3.9, 0], 0.042);
    triangles(g, i % 2 ? '#f3d5a7' : '#cf8b69', [0.1, 3.7, 0, 0.1, 0.58, 0, 1.41, 0.58, 0.08]);
    triangles(g, '#eee3bf', [-0.1, 2.7, 0, -1.27, 0.55, 0.16, -0.1, 0.55, 0]);
    flag(g, 0, 3.88, 0, rust, 0.4);
  }
  for (let i = 0; i < 21; i++) {
    const x = -50 + i * 6.3 + rand() * 4,
      z = -48 - rand() * 10,
      y = 10 + rand() * 6;
    const g = group(distant, x, y, z);
    for (let j = 0; j < 4; j++)
      oval(g, '#fff2d9', j * 1.16, Math.sin(j) * 0.35, 0, 1.7 + rand(), 0.58 + rand() * 0.67, 1.05);
  }
  for (let i = 0; i < 9; i++) {
    let g = group(all);
    let wing = [];
    for (let s of [-1, 1]) {
      let w = group(g);
      triangles(w, '#fff1cc', [
        0,
        0,
        0.075,
        s * 0.28,
        0.085,
        0,
        s * 0.64,
        0.005,
        -0.055,
        0,
        0,
        0.075,
        s * 0.64,
        0.005,
        -0.055,
        s * 0.24,
        -0.01,
        -0.065,
      ]);
      bake(w);
      wing.push(w);
    }
    birds.push({ g, wing, x: i * 6.2 - 5, z: -6 - rand() * 12, y: 3.4 + rand() * 5 });
  }
  for (let i = 0; i < 6; i++) {
    let b = buoy(all, i * 8 - 3, i % 2 ? -4.65 : 3.8, i % 2 ? rust : gold);
    bake(b);
    buoys.push(b);
  }
  cfg.stops.forEach(([type, x, z, w, d, y, dx = 0, dz = 0], i) => {
    let g = group(all, x, y, z);
    if (['post', 'skiff', 'ferry'].includes(type)) boat(g, type, w, d, i);
    else if (type === 'raft') raft(g, w, d);
    else pier(g, w, d, type);
    if (type === 'pier') {
      const px = w * 0.37,
        pz = -d * 0.41;
      rod(g, wood, [px, 0, pz], [px, 1.57, pz], 0.055);
      box(g, deep, px, 1.28, pz, 0.72, 0.36, 0.08);
      label(g, '→', px, 1.28, pz + 0.055, 0.68, 0.32, deep, '#fff3cc');
    }
    bake(g);
    let ripple = waterPrint(all, w, d, i);
    waves.push(ripple);
    plats.push({ g, type, x, z, w, d, y, dx, dz, fraction: 0, outbound: false, i });
  });
  let spur = null;
  if (cfg.spur) {
    const [idx, ox, oz] = cfg.spur,
      base = plats[idx],
      w = 2.8,
      d = 2.05;
    const g = group(all, base.x + ox, 0.65, base.z + oz);
    boat(g, 'skiff', w, d, 2);
    bake(g);
    spur = { g, x: g.position.x, y: 0.65, z: g.position.z, w, d, i: -1, type: 'skiff', parentIndex: idx };
    waves.push(waterPrint(all, w, d, 11));
  }
  const surfaces = spur ? [...plats, spur] : plats;
  const end = plats.at(-1);
  const resident = makeCat(all, ...cfg.cat, false, stage);
  resident.root.scale.setScalar(0.9);
  resident.root.position.set(end.x + 1.29, end.y, end.z - 0.51);
  resident.root.rotation.y = -0.62;
  const mailbox = group(all, end.x + 1.74, end.y, end.z - 1.13);
  box(mailbox, wood, 0, 0.56, 0, 0.12, 1.12, 0.14);
  box(mailbox, rust, 0, 1.18, 0, 0.53, 0.58, 0.4);
  box(mailbox, cream, 0, 1.25, 0.211, 0.36, 0.079, 0.02);
  box(mailbox, deep, 0, 1.49, 0, 0.63, 0.07, 0.49);
  bake(mailbox);
  for (const [index, ox, oz] of cfg.stamps) {
    const pl = index === -1 ? spur : plats[index],
      g = group(all);
    let coin = group(g);
    let disk = tube(coin, '#e7ae47', 0, 0, 0, 0.235, 0.235, 0.074, 24);
    disk.rotation.x = Math.PI / 2;
    ring(coin, '#ffde87', 0, 0, 0.043, 0.2, 0.018);
    oval(coin, deep, 0.028, 0.011, 0.052, 0.112, 0.062, 0.016);
    triangles(coin, deep, [-0.052, 0.015, 0.06, -0.13, 0.075, 0.06, -0.13, -0.05, 0.06]);
    oval(coin, cream, 0.092, 0.02, 0.068, 0.012, 0.012, 0.006);
    bake(coin);
    tokens.push({ g, pl, ox, oz, taken: false });
  }
  bake(near);
  bake(distant);
  function update(t, dt) {
    for (const p of plats) {
      if (p.type === 'pier' || p.type === 'end') continue;
      if (p.type === 'ferry') {
        const direction = p.outbound ? 1 : -1;
        p.fraction = T.MathUtils.clamp(p.fraction + direction * dt * 0.29, 0, 1);
      }
      let k = p.fraction * p.fraction * (3 - 2 * p.fraction),
        s = t * 1.64 + p.i * 1.64;
      p.g.position.set(
        p.x + k * p.dx,
        p.y + 0.052 * Math.sin(s),
        p.z + k * p.dz + (p.type === 'skiff' ? 0.18 * Math.sin(t * 0.8 + p.i) : 0),
      );
      p.g.rotation.z = 0.011 * Math.sin(s * 0.82);
      p.g.rotation.x = 0.017 * Math.sin(s + 0.9);
    }
    if (stage === 2)
      for (const p of plats) {
        if (p.type === 'raft') {
          p.g.position.z += 0.63 * Math.sin(t * 1.12 + p.i);
          p.g.position.y += 0.14 * Math.sin(t * 1.28 + p.i);
        }
      }
    if (spur) {
      spur.g.position.y = 0.65 + 0.065 * Math.sin(t * 1.74);
      spur.g.rotation.z = 0.017 * Math.sin(t * 1.28);
    }
    for (let i = 0; i < waves.length; i++) {
      let m = waves[i],
        v = surfaces[i].g.position;
      m.position.x = v.x;
      m.position.z = v.z;
      m.material.uniforms.phase.value = t * 0.95 + i * 2.1;
    }
    for (let i = 0; i < birds.length; i++) {
      let b = birds[i],
        a = t * 0.26 + i * 1.61;
      b.g.position.set(b.x + Math.sin(a) * 3.7, b.y + Math.sin(a * 2) * 0.24, b.z + Math.cos(a) * 2);
      b.g.rotation.y = -a;
      b.wing.forEach((w, j) => (w.rotation.z = (j ? 1 : -1) * (0.12 + Math.sin(t * 4 + i) * 0.28)));
    }
    buoys.forEach((b, i) => {
      b.position.y = Math.sin(t * 1.75 + i) * 0.07;
      b.rotation.z = 0.075 * Math.sin(t * 1.5 + i);
    });
    tokens.forEach((s, i) => {
      if (s.taken) return;
      s.g.position.set(
        s.pl.g.position.x + s.ox,
        s.pl.g.position.y + 0.95 + 0.13 * Math.sin(t * 2.8 + i),
        s.pl.g.position.z + s.oz,
      );
      s.g.rotation.y = 0.4 + Math.sin(t * 1.9 + i) * 0.65;
      s.g.rotation.z = Math.sin(t * 2.4 + i) * 0.1;
    });
    resident.animate(t + 0.8, dt);
  }
  return {
    all,
    plats,
    surfaces,
    spur,
    tokens,
    resident,
    update,
    dispose() {
      all.removeFromParent();
      all.traverse((m) => {
        if (!m.isMesh) return;
        m.geometry.dispose();
        if (m.material.map) {
          m.material.map.dispose();
          m.material.dispose();
        } else if (m.material.isShaderMaterial) m.material.dispose();
      });
    },
  };
}
