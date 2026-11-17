import { T, group, oval, box, tube, rod, triangles, bake, ring, face } from './forms.js';
const cream = '#ffe5b5',
  dark = '#512f28',
  ink = '#272e2b',
  pink = '#d78072';
// Taper a painted stripe along the actual ellipsoid so it follows the fur.
function marking(parent, colour, centre, radii, angle, latitude, end, bend, width) {
  const point = (a, v) => [
    centre[0] + radii[0] * Math.cos(v) * Math.sin(a),
    centre[1] + radii[1] * Math.sin(v),
    centre[2] + radii[2] * Math.cos(v) * Math.cos(a),
  ];
  let last;
  for (let j = 0; j <= 12; j++) {
    let k = j / 12,
      v = latitude + (end - latitude) * k,
      a = angle + bend * Math.sin(k * 1.9),
      w = width * (0.035 + Math.pow(Math.sin(Math.PI * k), 0.7));
    let pair = [point(a - w, v), point(a + w, v)];
    if (last) face(parent, colour, last[0], last[1], pair[1], pair[0]);
    last = pair;
  }
}
export function makeCat(parent, coat = '#dc853f', stripe = '#a0522f', postie = true, job = -1) {
  const root = group(parent),
    body = group(root),
    haunch = group(body, 0, 0.68, -0.27),
    head = group(body, 0, 1.07, 0.43),
    legs = [],
    eyes = [],
    ears = [],
    tail = [];
  oval(haunch, coat, 0, 0.02, -0.1, 0.38, 0.45, 0.48);
  oval(body, coat, 0, 0.73, 0.05, 0.345, 0.39, 0.56);
  oval(body, cream, 0, 0.78, 0.35, 0.28, 0.36, 0.29);
  for (let s of [-1, 1])
    for (let i = 0; i < 3; i++)
      marking(
        haunch,
        stripe,
        [0, 0.02, -0.1],
        [0.384, 0.455, 0.484],
        s * (1.27 + i * 0.47),
        1.37 - i * 0.11,
        -0.22 + i * 0.1,
        s * 0.16,
        0.13,
      );
  oval(head, coat, 0, 0.1, 0.01, 0.465, 0.4, 0.375);
  for (let s of [-1, 1]) {
    let ear = group(head, s * 0.267, 0.36, -0.025);
    ears.push(ear);
    const L = [s * -0.16, -0.05, 0.14],
      R = [s * 0.17, -0.045, 0.1],
      tip = [s * 0.105, 0.365, -0.065],
      back = [0, -0.035, -0.16];
    triangles(ear, coat, [...L, ...R, ...tip, ...R, ...back, ...tip, ...back, ...L, ...tip]);
    triangles(ear, pink, [s * -0.085, 0.012, 0.122, s * 0.121, 0.002, 0.096, s * 0.089, 0.265, -0.015]);
    bake(ear);
    oval(head, cream, s * 0.237, 0.046, 0.23, 0.204, 0.18, 0.145);
    for (let i = 0; i < 2; i++) {
      let m = oval(
        head,
        stripe,
        s * (0.385 + i * 0.016),
        0.126 - i * 0.083,
        0.14 - i * 0.003,
        0.045,
        0.027,
        0.116,
      );
      m.rotation.x = -0.26;
    }
    let e = group(head, s * 0.192, 0.161, 0.308);
    e.rotation.y = s * 0.26;
    eyes.push(e);
    oval(e, ink, 0, 0, 0, 0.117, 0.112, 0.054);
    oval(e, '#b4c981', 0, -0.002, 0.026, 0.094, 0.089, 0.044);
    oval(e, ink, 0, 0.002, 0.054, 0.046, 0.084, 0.024);
    oval(e, '#fff4d4', -0.026, 0.035, 0.077, 0.02, 0.024, 0.012);
    bake(e);
    let brow = oval(head, stripe, s * 0.19, 0.297, 0.238, 0.068, 0.019, 0.038);
    brow.rotation.z = s * 0.15;
    oval(head, cream, s * 0.096, -0.015, 0.332, 0.131, 0.096, 0.101);
    for (let i = 0; i < 3; i++) {
      const x = s * (0.16 + 0.012 * i),
        y = -0.015 - i * 0.026;
      oval(head, dark, x, y, 0.405 - i * 0.008, 0.009, 0.009, 0.008);
      rod(
        head,
        '#e9d9b4',
        [x, y, 0.398 - i * 0.009],
        [s * (0.54 + i * 0.023), y + 0.047 - i * 0.036, 0.37 - i * 0.04],
        0.009,
        0.003,
      );
    }
  }
  oval(head, cream, 0, -0.086, 0.286, 0.142, 0.089, 0.119);
  for (const s of [-1, 1]) {
    rod(head, dark, [0, -0.01, 0.418], [s * 0.041, -0.047, 0.417], 0.008);
    rod(head, dark, [s * 0.041, -0.047, 0.417], [s * 0.075, -0.035, 0.412], 0.007);
  }
  triangles(head, '#864e47', [-0.067, 0.061, 0.423, 0.066, 0.061, 0.423, 0, -0.004, 0.454]);
  oval(head, pink, 0, 0.056, 0.423, 0.056, 0.013, 0.017);
  for (let i = -1; i <= 1; i++)
    marking(
      head,
      stripe,
      [0, 0.1, 0.01],
      [0.471, 0.407, 0.38],
      i * 0.34,
      1.42,
      0.43 + Math.abs(i) * 0.12,
      i * 0.09,
      0.085,
    );
  for (let s of [-1, 1])
    marking(head, stripe, [0, 0.1, 0.01], [0.47, 0.406, 0.38], s * 0.98, 1.22, 0.4, s * 0.25, 0.09);
  if (postie) {
    const hat = group(head, 0, 0.433, -0.01);
    hat.rotation.z = -0.13;
    hat.rotation.x = -0.09;
    oval(hat, '#18454d', 0, -0.003, 0.143, 0.29, 0.042, 0.218);
    tube(hat, '#273f48', 0, 0.04, 0, 0.235, 0.227, 0.09, 18);
    let cap = oval(hat, '#39716c', 0, 0.11, -0.023, 0.283, 0.11, 0.25);
    cap.rotation.x = -0.15;
    oval(hat, '#edb753', 0, 0.078, 0.224, 0.046, 0.046, 0.012);
    bake(hat);
    let scarf = tube(body, '#bc4d38', 0, 1.035, 0.37, 0.242, 0.27, 0.094, 18);
    scarf.rotation.x = -0.24;
    const strap = ring(body, '#754c38', 0, 0.78, 0.03, 0.377, 0.038);
    strap.rotation.set(0.29, 0.05, -0.24);
    strap.scale.y = 1.08;
    let bag = group(body, 0.355, 0.675, -0.017);
    bag.rotation.z = 0.11;
    box(bag, '#9c5431', 0, 0, 0, 0.128, 0.34, 0.47);
    box(bag, '#c98649', 0.066, 0.065, 0, 0.046, 0.23, 0.48);
    box(bag, '#ebbd70', 0.095, 0.018, 0, 0.016, 0.065, 0.077);
    for (let j = 0; j < 7; j++) box(bag, '#e9af6e', 0.094, 0.15, -0.195 + j * 0.063, 0.008, 0.011, 0.029);
    box(bag, '#fff0c8', 0.02, 0.17, -0.025, 0.072, 0.055, 0.35);
  }
  if (job === 0) {
    for (const side of [-1, 1]) {
      const specs = ring(head, '#735037', side * 0.19, 0.163, 0.367, 0.119, 0.012);
      specs.rotation.y = side * 0.25;
    }
    rod(head, '#735037', [-0.08, 0.17, 0.39], [0.08, 0.17, 0.39], 0.013);
    tube(body, '#76856a', 0, 1.02, 0.37, 0.251, 0.255, 0.095);
  }
  if (job === 1) {
    let apron = oval(body, '#eee5cc', 0, 0.79, 0.44, 0.245, 0.32, 0.2);
    apron.rotation.x = -0.17;
    box(body, '#b27355', 0, 0.72, 0.633, 0.21, 0.105, 0.025);
    tube(head, '#eae5d3', 0, 0.46, -0.036, 0.235, 0.205, 0.145, 18);
    for (let j = 0; j < 5; j++) {
      let a = (j * 2 * Math.PI) / 5;
      oval(head, '#fff3dc', Math.cos(a) * 0.124, 0.56, Math.sin(a) * 0.12 - 0.045, 0.16, 0.128, 0.15);
    }
  }
  if (job === 2) {
    let h = group(head, 0, 0.42, -0.04);
    h.rotation.x = -0.09;
    oval(h, '#c99a38', 0, -0.016, -0.034, 0.334, 0.056, 0.33);
    oval(h, '#edbd55', 0, 0.06, 0, 0.24, 0.13, 0.236);
    tube(h, '#997844', 0, 0.048, 0, 0.236, 0.246, 0.054, 18);
    tube(body, '#dca945', 0, 1.02, 0.37, 0.245, 0.262, 0.112);
  }
  bake(head);
  bake(haunch);
  for (let i = 0; i < 4; i++) {
    const s = i % 2 === 0 ? -1 : 1,
      back = i > 1;
    const leg = group(body, s * (back ? 0.22 : 0.208), back ? 0.62 : 0.66, back ? -0.365 : 0.375);
    legs.push(leg);
    oval(
      leg,
      coat,
      0,
      -0.15,
      back ? 0.03 : 0,
      back ? 0.148 : 0.104,
      back ? 0.25 : 0.23,
      back ? 0.206 : 0.128,
    );
    oval(leg, cream, 0, -0.425, back ? -0.032 : 0.023, 0.085, 0.181, 0.093);
    oval(leg, cream, 0, back ? -0.565 : -0.604, 0.065, 0.111, 0.077, 0.146);
    for (let j = 0; j < 2; j++)
      oval(leg, '#dcae83', (j - 0.5) * 0.054, back ? -0.57 : -0.613, 0.194, 0.004, 0.014, 0.008);
    bake(leg);
  }
  bake(body);
  const pins = [];
  if (postie) {
    for (let j = 0; j < 3; j++) {
      const pin = group(body, 0.455, 0.78, -0.145 + 0.1 * j);
      oval(pin, '#fff0ac', 0.0, 0, 0, 0.018, 0.037, 0.04);
      bake(pin);
      pins.push(pin);
      pin.visible = false;
    }
  }
  const tailBase = group(body, 0, 0.76, -0.65);
  let node = tailBase;
  for (let i = 0; i < 10; i++) {
    let joint = group(node, 0, i ? 0.141 : 0, 0),
      r = 0.1 - i * 0.005;
    const c = i === 9 ? cream : [1, 4, 7].includes(i) ? stripe : coat;
    tube(joint, c, 0, 0.069, 0, r - 0.003, r, 0.144, 10);
    oval(joint, c, 0, 0.14, 0, r - 0.004, r * 0.8, r - 0.004);
    bake(joint);
    tail.push(joint);
    node = joint;
  }
  let gait = 0;
  return {
    root,
    pins,
    animate(t, dt, speed = 0, air = 0, land = 0, call = 0) {
      gait += dt * (speed * 2.5);
      let run = Math.min(1, speed / 3.5),
        cycle = Math.sin(gait),
        idle = Math.sin(t * 2.4);
      body.position.y = 0.02 * idle * (1 - run) + Math.abs(cycle) * 0.075 * run - land * 0.105;
      body.scale.set(1 + land * 0.07, 1 - land * 0.09, 1 + air * 0.05);
      body.rotation.x = air * -0.12 + cycle * 0.035 * run;
      head.rotation.x = 0.03 * idle + 0.04 * cycle * run - call * 0.15;
      head.rotation.y = Math.sin(t * 0.84) * (0.19 - 0.13 * run);
      head.rotation.z = 0.04 * Math.sin(t * 0.9);
      head.position.y = 1.07 + call * 0.06;
      ears.forEach(
        (e, i) =>
          (e.rotation.z =
            (i ? 1 : -1) * (0.04 + 0.23 * Math.pow(Math.max(0, Math.cos(t * 2.1 + i * 0.28)), 24))),
      );
      let blink = Math.pow(Math.max(0, Math.cos(t * 1.54 + 0.9)), 120);
      eyes.forEach((e) => (e.scale.y = 1 - 0.95 * blink));
      legs.forEach((l, i) => {
        const wave = Math.sin(gait + (i === 0 || i === 3 ? 0 : Math.PI));
        l.rotation.x = wave * 0.8 * run + (i > 1 ? 0.82 : -0.62) * air;
        l.position.y = (i > 1 ? 0.62 : 0.66) + Math.max(0, -wave) * 0.08 * run;
      });
      tail.forEach((v, i) => {
        v.rotation.x = i === 0 ? -0.96 + 0.08 * idle : i < 4 ? 0.2 : 0.25 + 0.025 * idle;
        v.rotation.z = i === 0 ? 0.22 * Math.sin(t * 2) : 0.054 * Math.sin(t * 2 + i * 0.35);
      });
    },
  };
}
