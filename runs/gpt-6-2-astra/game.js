import { T, group, ring, oval, bake } from './forms.js';
import { routes, makeWorld } from './harbour.js';
import { makeCat } from './cat.js';
import { atmosphere, makeShadow } from './sea.js';
import * as radio from './radio.js';
const $ = (id) => document.getElementById(id),
  canvas = $('world');
const renderer = new T.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
const scene = new T.Scene(),
  cam = new T.PerspectiveCamera(39, 1, 0.06, 185),
  sky = atmosphere(scene);
let hemi = new T.HemisphereLight(0xffffe6, 0xe6b196, 1.73);
scene.add(hemi);
let sun = new T.DirectionalLight(0xffe5bd, 2.18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 0.1, far: 37 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.017;
scene.add(sun, sun.target);
const cat = makeCat(scene),
  shadow = makeShadow(scene);
cat.root.traverse((m) => {
  if (m.isMesh) m.castShadow = true;
});
const lifebelt = group(scene);
let beltRing = ring(lifebelt, '#bd4937', 0, 0, 0, 0.51, 0.11);
beltRing.rotation.x = Math.PI / 2;
for (let i = 0; i < 4; i++) {
  let a = (Math.PI / 2) * i;
  let band = oval(lifebelt, '#ffe2af', 0.51 * Math.sin(a), 0, 0.51 * Math.cos(a), 0.14, 0.113, 0.12);
  band.rotation.y = a;
}
bake(lifebelt);
lifebelt.visible = false;
const envelope = group(scene);
const letterCard = new T.Mesh(
  new T.BoxGeometry(0.49, 0.31, 0.021),
  new T.MeshStandardMaterial({ color: 0xffe7bd }),
);
envelope.add(letterCard);
const outline = new T.Line(
  new T.BufferGeometry().setFromPoints([
    new T.Vector3(-0.233, 0.14, 0.015),
    new T.Vector3(0, -0.035, 0.017),
    new T.Vector3(0.233, 0.14, 0.015),
  ]),
  new T.LineBasicMaterial({ color: 0x9a5c4b }),
);
envelope.add(outline);
envelope.visible = false;
let handoff = 0;
const puffGeometry = new T.SphereGeometry(1, 7, 5),
  motes = [];
for (let i = 0; i < 24; i++) {
  let mat = new T.MeshBasicMaterial({ color: 0xffdea0 });
  let m = new T.Mesh(puffGeometry, mat);
  m.visible = false;
  scene.add(m);
  motes.push({ m, life: 0 });
}
let mote = 0;
function burst(x, y, z, n, colour, power = 1) {
  for (let i = 0; i < n; i++) {
    let b = motes[mote++ % motes.length];
    b.m.visible = true;
    b.m.material.color.set(colour);
    b.m.position.set(x, y, z);
    let a = (i / n) * Math.PI * 2;
    b.vx = Math.cos(a) * (1 + Math.random()) * power;
    b.vz = Math.sin(a) * (1 + Math.random()) * power;
    b.vy = (1 + Math.random() * 2) * power;
    b.life = 0.48 + Math.random() * 0.22;
    b.m.scale.setScalar(0.045 + Math.random() * 0.031);
  }
}
let save = { stage: 0, records: [], muted: false };
const storeKey = 'harbour-post-mackerel-v1';
try {
  let r = JSON.parse(localStorage.getItem(storeKey));
  if (r && Array.isArray(r.records) && Number.isInteger(r.stage) && r.stage >= 0 && r.stage <= 3)
    Object.assign(save, r);
} catch {}
function saveNow() {
  try {
    localStorage.setItem(storeKey, JSON.stringify(save));
  } catch {}
}
let state = 'title',
  stage = 0,
  world,
  pl,
  home,
  x = 0,
  y = 0,
  z = 0,
  vx = 0,
  vz = 0,
  vy = 0,
  heading = 0.62,
  clock = 0,
  runTime = 0,
  falls = 0,
  stamps = 0,
  land = 0,
  buffer = 0,
  coyote = 0,
  meow = 0,
  stepClock = 0,
  notice = 0,
  airTime = 0,
  started = false,
  zoomQuality = Math.min(devicePixelRatio, 1.65),
  slow = 0,
  recover = 0;
let previousZ = 0,
  previousX = 0,
  lastGround = 0;
const keys = new Set(),
  touchMove = { x: 0, y: 0 },
  focus = new T.Vector3(),
  aim = new T.Vector3(),
  offset = new T.Vector3(),
  projected = new T.Vector3();
const debug = new URLSearchParams(location.search).has('manual');
let phone = () => innerWidth < 650,
  touch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
function resize() {
  renderer.setPixelRatio(zoomQuality);
  renderer.setSize(innerWidth, innerHeight, false);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  if (world) {
    camera(1, true);
    if (started) refresh();
    if (debug) renderer.render(scene, cam);
  }
}
function shadows() {
  world.surfaces.forEach((p) =>
    p.g.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    }),
  );
  world.resident.root.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
}
function setStage(i, title = false) {
  if (world) world.dispose();
  lifebelt.visible = envelope.visible = false;
  stage = i;
  world = makeWorld(scene, i);
  world.update(clock, 0);
  sky.set(routes[i]);
  sun.color.set(i === 2 ? 0xffbe8a : 0xffe5bd);
  hemi.color.set(i === 2 ? 0xe3e3ff : 0xffffe6);
  hemi.groundColor.set(i === 2 ? 0x8f849c : 0xe6b196);
  sun.intensity = i === 2 ? 1.82 : 2.18;
  shadows();
  cat.pins.forEach((p, j) => (p.visible = save.records[j]?.stamps === 3));
  pl = home = world.plats[0];
  x = pl.x + 0.68;
  y = pl.g.position.y;
  z = pl.z + 0.1;
  vx = vz = vy = 0;
  lastGround = 0;
  heading = title ? 0.6 : 1.13;
  runTime = falls = stamps = buffer = coyote = meow = land = airTime = recover = 0;
  previousX = pl.g.position.x;
  previousZ = pl.g.position.z;
  state = title ? 'title' : 'play';
  keys.clear();
  radio.music(i, !title);
  cat.root.position.set(x, y, z);
  cat.root.rotation.y = heading;
  for (let b of motes) {
    b.life = 0;
    b.m.visible = false;
  }
  refresh();
  camera(1, true);
  if (!title) toast(i === 0 ? 'First stop · Fig’s bait shop →' : routes[i].time + ' · Mail aboard!', 2.6);
}
function recordCount() {
  return save.records.reduce((sum, r) => sum + (r?.stamps || 0), 0);
}
function refresh() {
  const play = state === 'play',
    isTitle = state === 'title';
  $('title').hidden = !isTitle;
  $('hud').hidden = !play;
  $('brand').hidden = !isTitle;
  $('pause').hidden = !play;
  $('tools').hidden = !isTitle && !play;
  $('keybar').hidden = !play || touch();
  $('touch').hidden = !play || !touch();
  $('veil').hidden = !['pause', 'letter', 'end', 'restart'].includes(state);
  $('speech').hidden = true;
  $('maplabel').hidden = true;
  $('start').firstChild.textContent =
    save.stage > 0 && save.stage < 3
      ? 'Continue my round '
      : save.stage === 3
        ? 'Start a new round '
        : 'Start my round ';
  $('routeNo').textContent = 'ROUND ' + String(stage + 1).padStart(2, '0') + ' / 03';
  $('routeName').textContent = routes[stage].name;
  $('objective').textContent = 'Deliver to ' + routes[stage].to + ' →';
  $('count').textContent = stamps + ' / 3';
  $('audio').classList.toggle('muted', save.muted);
  $('audio').setAttribute('aria-pressed', String(!save.muted));
  if (!play) {
    $('toast').classList.remove('on');
    notice = 0;
  }
}
function toast(s, d = 1.8) {
  $('toast').textContent = s;
  $('toast').classList.add('on');
  notice = d;
}
function start() {
  if (state !== 'title') return;
  radio.wake();
  if (save.stage === 3) {
    save.stage = 0;
    save.records = [];
    saveNow();
  }
  started = true;
  setStage(save.stage);
}
function stopInput() {
  keys.clear();
  touchMove.x = touchMove.y = 0;
  $('stick').firstElementChild.style.transform = '';
  buffer = 0;
}
function modal(mode, label, title, body, buttons) {
  state = mode;
  stopInput();
  radio.music(stage, false);
  refresh();
  $('modalLabel').textContent = label;
  $('modalTitle').textContent = title;
  $('imprint').hidden = mode !== 'letter' && mode !== 'end';
  $('sealTown').textContent =
    mode === 'end' ? 'ROUND COMPLETE' : ['PILCHARD QUAY', 'COPPERPOT', 'LANTERN POINT'][stage];
  $('modalBody').replaceChildren();
  for (let [txt, cls] of body) {
    const p = document.createElement('p');
    p.textContent = txt;
    if (cls) p.className = cls;
    $('modalBody').append(p);
  }
  $('actions').replaceChildren();
  buttons.forEach(([txt, fn], i) => {
    let b = document.createElement('button');
    b.textContent = txt;
    b.classList.toggle('secondary', i > 0);
    b.onclick = (e) => {
      e.stopPropagation();
      fn();
    };
    $('actions').append(b);
  });
  $('actions').firstChild.focus({ preventScroll: true });
}
function resume() {
  state = 'play';
  refresh();
  radio.music(stage, true);
  $('pause').blur();
}
function pause() {
  if (state === 'play')
    modal(
      'pause',
      'HARBOUR POST  /  ON BREAK',
      'Catnap.',
      [
        [
          'WASD or arrow keys to move. Space to pounce. E to meow, ring the ferry bell or hand over a letter.',
        ],
        [
          'Collect all three fish stamps in a harbour to earn a brass pin for your postbag. Your round is saved after each delivery.',
          'receipt',
        ],
      ],
      [
        ['Back to work', resume],
        [
          'Restart round',
          () =>
            modal(
              'restart',
              'HARBOUR POST',
              'Start over?',
              [['This clears the current round and its three delivery receipts.']],
              [
                ['Keep playing', resume],
                [
                  'Start over',
                  () => {
                    save.stage = 0;
                    save.records = [];
                    saveNow();
                    setStage(0);
                  },
                ],
              ],
            ),
        ],
        [
          'Sound ' + (save.muted ? 'off' : 'on'),
          () => {
            sound();
            state = 'play';
            pause();
          },
        ],
      ],
    );
  else if (state === 'pause' || state === 'restart') resume();
}
function sound() {
  radio.wake();
  save.muted = !save.muted;
  radio.mute(save.muted);
  saveNow();
  $('audio').classList.toggle('muted', save.muted);
  $('audio').setAttribute('aria-pressed', String(!save.muted));
}
function clockText(t) {
  return Math.floor(t / 60) + ':' + String(Math.floor(t) % 60).padStart(2, '0');
}
function deliver() {
  const c = routes[stage];
  radio.fx('letter');
  save.records[stage] = { stamps, falls, time: runTime };
  save.stage = stage + 1;
  saveNow();
  modal(
    'letter',
    'SIGNED FOR   /   ' + c.name.toUpperCase(),
    'Dear Postcat,',
    [
      ['“' + c.quote + '”'],
      ['— ' + c.sign],
      ...(stamps === 3 ? [['Enclosed · One brass postbag pin.']] : []),
      [
        'POSTAGE  ' +
          stamps +
          '/3   ·   ' +
          (falls === 0 ? 'DRY PAWS' : falls + ' RESCUE' + (falls > 1 ? 'S' : '')) +
          '   ·   ' +
          clockText(runTime),
        'receipt',
      ],
    ],
    [
      [
        stage === 2 ? 'Finish my round' : 'Sail to next harbour',
        stage === 2 ? ending : () => setStage(stage + 1),
      ],
    ],
  );
}
function ending() {
  let n = recordCount(),
    dips = save.records.reduce((a, r) => a + r.falls, 0);
  modal(
    'end',
    'HARBOUR POST  /  END OF ROUND',
    'All mail ashore.',
    [
      [
        n === 9
          ? 'Nine fish stamps and three happy neighbours. The harbourmaster has promoted you to First Class Postcat.'
          : 'Three letters delivered. Fig, Miso and Pip have set a fourth place at supper. It has a saucer.',
      ],
      [
        n +
          ' / 9 FISH STAMPS   ·   ' +
          (dips === 0 ? 'DRY PAWS AWARD' : dips + ' WATER RESCUE' + (dips === 1 ? '' : 'S')),
        'receipt',
      ],
    ],
    [
      [
        'Return to harbour',
        () => {
          started = false;
          setStage(0, true);
        },
      ],
    ],
  );
}
function closeToRecipient() {
  let r = world.resident.root.position;
  return Math.hypot(x - r.x, z - r.z) < 2.05 && pl === world.plats.at(-1);
}
function call() {
  if (state !== 'play' || meow > 0.33 || recover) return;
  meow = 0.9;
  radio.fx('meow', stage);
  if (closeToRecipient()) {
    state = 'handoff';
    stopInput();
    handoff = 0;
    vx = vz = 0;
    envelope.visible = true;
    refresh();
    return;
  }
  if (pl?.type === 'ferry' && !pl.go) {
    pl.go = true;
    $('speech').textContent = 'Mrrring!';
    radio.fx('bell');
    toast('One meow fare. All aboard!', 2.2);
  } else {
    const replies = ['Mrrrp!', 'Miaow!', 'Prrrow?'];
    $('speech').textContent = replies[Math.floor(clock * 3) % 3];
  }
}
function pounce() {
  if (state === 'play' && !recover) buffer = 0.16;
}
function topAt(p, px, pz) {
  return (
    p.g.position.y +
    (px - p.g.position.x) * Math.tan(p.g.rotation.z) -
    (pz - p.g.position.z) * Math.tan(p.g.rotation.x)
  );
}
function contains(p, px, pz, slack = 0.08) {
  let ax = (px - p.g.position.x) / p.w,
    az = Math.abs((pz - p.g.position.z) / p.d);
  if (Math.abs(ax) > 0.5 + slack / p.w) return false;
  let rim = 0.5;
  if (['post', 'skiff', 'ferry'].includes(p.type)) {
    if (ax > 0.24) rim = Math.max(0.05, (0.5 * (0.53 - ax)) / 0.29);
    if (ax < -0.38) rim = 0.47 + (ax + 0.38) * 1.45;
  }
  return az < rim + slack / p.d;
}
function dry() {
  pl = home;
  x = pl.g.position.x + (pl.i === 0 ? 0.72 : 0);
  z = pl.g.position.z + 0.05;
  y = topAt(pl, x, z);
  vx = vz = vy = 0;
  airTime = 0;
  previousX = pl.g.position.x;
  previousZ = pl.g.position.z;
  land = 0.6;
  toast('Fished out. The letter is dry.', 1.8);
}
function simulate(dt) {
  clock += dt;
  world.update(clock, dt);
  if (state === 'play') {
    runTime += dt;
    notice = Math.max(0, notice - dt);
    if (!notice) $('toast').classList.remove('on');
    meow = Math.max(0, meow - dt);
    land = Math.max(0, land - dt * 4.5);
    if (recover) {
      recover = Math.max(0, recover - dt);
      if (!recover) {
        lifebelt.visible = false;
        dry();
      }
    } else {
      let dx =
          (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
          (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
          touchMove.x,
        dz =
          (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
          (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) +
          touchMove.y,
        len = Math.hypot(dx, dz);
      if (len > 1) {
        dx /= len;
        dz /= len;
      }
      let vmax = 5.45;
      const approach = (value, target, delta) =>
        value + Math.sign(target - value) * Math.min(Math.abs(value - target), delta);
      vx = approach(vx, dx * vmax, (pl ? 36 : 20) * dt);
      vz = approach(vz, dz * vmax, (pl ? 36 : 20) * dt);
      if (pl) {
        x += pl.g.position.x - previousX;
        z += pl.g.position.z - previousZ;
        coyote = 0.12;
      }
      if (buffer > 0 && (pl || coyote > 0)) {
        pl = null;
        coyote = 0;
        buffer = 0;
        vy = 7.15;
        radio.fx('jump');
        land = 0;
      }
      buffer = Math.max(0, buffer - dt);
      coyote = Math.max(0, coyote - dt);
      let oldY = y;
      x += vx * dt;
      z += vz * dt;
      // The pilothouse fills the aft end of the launch. Slide along its walls.
      let boat = world.plats[0];
      if (
        y > boat.g.position.y - 0.22 &&
        y < boat.g.position.y + 1.57 &&
        Math.abs(x - (boat.x - boat.w * 0.31)) < 0.81 &&
        Math.abs(z - (boat.z - 0.1)) < 0.93
      ) {
        let ox = x - (boat.x - boat.w * 0.31),
          oz = z - (boat.z - 0.1);
        if (0.81 - Math.abs(ox) < 0.93 - Math.abs(oz)) {
          x = boat.x - boat.w * 0.31 + Math.sign(ox || 1) * 0.812;
          vx = 0;
        } else {
          z = boat.z - 0.1 + Math.sign(oz || 1) * 0.932;
          vz = 0;
        }
      }
      if (pl === world.plats.at(-1)) {
        const r = world.resident.root.position,
          rx = x - r.x,
          rz = z - r.z,
          d = Math.hypot(rx, rz);
        if (d < 0.86) {
          x = r.x + (0.86 * rx) / (d || 1);
          z = r.z + (0.86 * rz) / (d || 1);
        }
      }
      if (pl && !contains(pl, x, z)) pl = null;
      if (pl) {
        y = topAt(pl, x, z);
        vy = 0;
        airTime = 0;
      } else {
        vy -= 18.6 * dt;
        y += vy * dt;
        airTime += dt;
        if (vy <= 0) {
          for (let p of world.surfaces) {
            let top = topAt(p, x, z);
            if (contains(p, x, z) && oldY >= top - 0.075 && y <= top + 0.032) {
              pl = home = p;
              lastGround = p.i === -1 ? p.parentIndex : p.i;
              y = top;
              land = Math.min(1, Math.abs(vy) / 7);
              radio.fx('land');
              if (land > 0.6) burst(x, y + 0.08, z, 5, 0xe6c897, 0.48);
              vy = 0;
              airTime = 0;
              if (p.type === 'ferry' && !p.go)
                toast(touch() ? 'Tap Meow to ring the ferry bell' : 'Press E to ring the ferry bell', 3);
              break;
            }
          }
        }
      }
      if (pl) {
        previousX = pl.g.position.x;
        previousZ = pl.g.position.z;
        if (Math.hypot(vx, vz) > 1.0) {
          stepClock += dt * Math.hypot(vx, vz);
          if (stepClock > 0.98) {
            stepClock = 0;
            radio.fx('step', pl.i);
          }
        }
      }
      if (y < -0.36) {
        recover = 0.83;
        falls++;
        y = -0.85;
        lifebelt.visible = true;
        heading = 0.1;
        radio.fx('splash');
        burst(x, 0.03, z, 18, 0xccebdd, 1.55);
        meow = 0;
        buffer = 0;
      }
      if (Math.hypot(vx, vz) > 0.18) {
        let angle = Math.atan2(vx, vz),
          d = Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading));
        heading += d * (1 - Math.exp(-dt * 15));
      }
      for (let token of world.tokens) {
        let v = token.g.position;
        if (!token.taken && Math.hypot(x - v.x, z - v.z) < 0.73 && Math.abs(y + 0.83 - v.y) < 1.55) {
          token.taken = true;
          token.g.visible = false;
          stamps++;
          $('count').textContent = stamps + ' / 3';
          radio.fx('stamp', stamps);
          burst(v.x, v.y, v.z, 11, 0xffda76);
          toast('Fish stamp · ' + stamps + ' of 3', 1.4);
        }
      }
    }
  }
  if (state === 'title') {
    pl = world.plats[0];
    y = topAt(pl, x, z);
    heading = -0.39 + Math.sin(clock * 0.48) * 0.085;
  }
  if (state === 'handoff') {
    handoff = Math.min(1, handoff + dt * 1.22);
    const r = world.resident.root.position;
    let u = handoff;
    envelope.position.set(
      x + (r.x - x) * u,
      y + 1 + (r.y - y) * u + Math.sin(u * Math.PI) * 0.87,
      z + (r.z - z) * u + 0.18,
    );
    envelope.rotation.set(-0.16, 0.25 + u * 0.6, Math.sin(u * Math.PI * 2) * 0.18);
    heading = Math.atan2(r.x - x, r.z - z);
    world.resident.root.rotation.y = Math.atan2(x - r.x, z - r.z);
    if (u >= 1) {
      envelope.visible = false;
      deliver();
    }
  }
  if (recover) {
    y = -0.75 + Math.min(1, (0.83 - recover) * 5) * 0.31;
    lifebelt.position.set(x, y + 0.69 + Math.sin(recover * 6) * 0.04, z);
    lifebelt.rotation.z = Math.sin(recover * 6) * 0.09;
  }
  cat.root.position.set(x, y, z);
  cat.root.visible = true;
  cat.root.rotation.y = heading;
  cat.animate(
    clock,
    dt,
    state === 'play' ? Math.hypot(vx, vz) : 0,
    pl ? 0 : Math.min(1, airTime * 6),
    land,
    Math.max(0, meow - 0.45) * 2,
  );
  let under = pl || world.surfaces.find((p) => contains(p, x, z, 0));
  shadow.visible = !recover;
  shadow.position.set(x, (under ? topAt(under, x, z) : -0.035) + 0.017, z);
  shadow.scale.setScalar(pl ? 1 : Math.max(0.54, 1 - (y - shadow.position.y) * 0.19));
  for (let b of motes)
    if (b.life > 0) {
      b.life -= dt;
      b.vy -= dt * 6;
      b.m.position.x += b.vx * dt;
      b.m.position.y += b.vy * dt;
      b.m.position.z += b.vz * dt;
      if (b.life <= 0) b.m.visible = false;
    }
}
function camera(dt, snap = false) {
  const title = state === 'title',
    narrow = phone();
  let fov;
  if (title) {
    let slide = narrow ? 0.02 : Math.min(1.62, cam.aspect * 0.86);
    aim.set(x - slide, narrow ? 1.02 : 1.77, z + 0.15 + slide * 0.28);
    offset.set(2.65, narrow ? 1.18 : 0.92, narrow ? 7.6 : 7.1);
    fov = narrow ? 44 : 34;
  } else {
    let small = cam.aspect < 1,
      look = small ? 1.57 : 1.47;
    aim.set(x + look, 1.32 + Math.max(0, y - 1) * 0.29, z * 0.73);
    offset.set(small ? 2.15 : 2.65, small ? 4.7 : 3.6, small ? 9.7 : 8.6);
    if (small) offset.multiplyScalar(Math.min(1.58, 0.86 / cam.aspect));
    fov = small ? 51 : 41;
  }
  if (!title && !narrow) {
    const arrival = T.MathUtils.smoothstep(x - world.plats.at(-1).x, -7, -1.2);
    offset.y += arrival * 0.5;
    offset.z += arrival * 1.5;
    aim.y += arrival * 1.0;
  }
  if (snap) focus.copy(aim);
  else focus.lerp(aim, 1 - Math.exp(-dt * 6));
  cam.position.copy(focus).add(offset);
  cam.lookAt(focus);
  cam.fov = fov;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  sun.target.position.set(x, 0, z);
  sun.position.set(x - 5.7, 11.4, z + 6.1);
  sky.update(clock, cam);
}
function screen(el, px, py, pz) {
  projected.set(px, py, pz).project(cam);
  if (Math.abs(projected.x) > 0.93 || Math.abs(projected.y) > 0.92) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.style.left = ((projected.x + 1) * innerWidth) / 2 + 'px';
  el.style.top = ((1 - projected.y) * innerHeight) / 2 + 'px';
}
function overlays() {
  if (state !== 'play') return;
  const l = $('maplabel');
  let next = world.plats[lastGround + 1];
  if (closeToRecipient()) {
    l.textContent = 'E · Deliver letter';
    let v = world.resident.root.position;
    screen(l, v.x, v.y + 2.1, v.z);
  } else if (pl?.type === 'ferry' && !pl.go) {
    l.textContent = 'E · Ring ferry bell';
    screen(l, x, y + 2.26, z);
  } else if (next && lastGround === 0 && stage === 0 && x < 3.7) {
    l.textContent = 'Space · Pounce';
    screen(l, next.g.position.x - 0.7, next.y + 0.55, next.z);
  } else if (world.spur && lastGround === world.spur.parentIndex && !world.tokens[1].taken) {
    let v = world.tokens[1].g.position;
    l.textContent = 'Fish stamp';
    screen(l, v.x, v.y + 0.51, v.z);
  } else if (world.plats.at(-1).x - x < 7) {
    let v = world.resident.root.position;
    l.textContent = routes[stage].to;
    screen(l, v.x, v.y + 2, v.z);
  } else l.hidden = true;
  if (touch() && !l.hidden)
    l.textContent = l.textContent.replace('Space · Pounce', 'Pounce').replace('E · ', 'Meow · ');
  if (meow > 0.14 && !recover) screen($('speech'), x + 0.16, y + 2.04, z);
  else $('speech').hidden = true;
}
function frame(dt) {
  if (state === 'play' || state === 'title' || state === 'handoff') {
    let n = Math.max(1, Math.ceil(dt / 0.0167));
    for (let j = 0; j < n; j++) simulate(dt / n);
  }
  camera(dt);
  overlays();
  renderer.render(scene, cam);
  radio.tick();
}
let prev = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.max(0, (now - prev) / 1000);
  prev = now;
  if (!debug) {
    if (dt > 0.053) slow += Math.min(0.11, dt);
    else slow = Math.max(0, slow - dt * 0.6);
    if (slow > 2 && zoomQuality > 0.8) {
      zoomQuality = Math.max(0.8, zoomQuality * 0.82);
      resize();
      slow = 0;
    }
    frame(Math.min(dt, 0.12));
  } else radio.tick();
}
window.addEventListener('keydown', (e) => {
  if (state === 'play' && ['Space', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.code))
    e.preventDefault();
  if (e.repeat && ['KeyE', 'KeyM', 'Escape', 'Enter', 'Space'].includes(e.code)) return;
  if (e.code === 'KeyM') {
    sound();
    if (state === 'pause') {
      state = 'play';
      pause();
    }
    return;
  }
  if (e.code === 'Escape') {
    pause();
    return;
  }
  if (
    state === 'title' &&
    document.activeElement !== $('audio') &&
    (e.code === 'Enter' || e.code === 'Space')
  ) {
    e.preventDefault();
    start();
    return;
  }
  if (state !== 'play') return;
  keys.add(e.code);
  if (e.code === 'Space') pounce();
  if (e.code === 'KeyE') call();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  stopInput();
  if (state === 'play') pause();
});
window.addEventListener('resize', resize);
$('start').onclick = start;
document.body.addEventListener('click', (e) => {
  if (state === 'title' && !e.target.closest('button,#veil')) start();
});
$('audio').onclick = (e) => {
  e.stopPropagation();
  sound();
};
$('pause').onclick = pause;
for (const [id, fn] of [
  ['call', call],
  ['leap', pounce],
])
  $(id).onpointerdown = (e) => {
    e.preventDefault();
    fn();
  };
let pointer = null;
const stick = $('stick');
function drag(e) {
  if (pointer !== e.pointerId) return;
  let r = stick.getBoundingClientRect(),
    a = e.clientX - r.x - r.width / 2,
    b = e.clientY - r.y - r.height / 2,
    m = Math.max(28, Math.hypot(a, b));
  touchMove.x = a / m;
  touchMove.y = b / m;
  stick.firstElementChild.style.transform = 'translate(' + (a / m) * 24 + 'px,' + (b / m) * 24 + 'px)';
}
stick.onpointerdown = (e) => {
  pointer = e.pointerId;
  stick.setPointerCapture(pointer);
  drag(e);
};
stick.onpointermove = drag;
stick.onlostpointercapture = () => {
  pointer = null;
  touchMove.x = touchMove.y = 0;
  stick.firstElementChild.style.transform = '';
};
radio.mute(save.muted);
resize();
setStage(0, true);
frame(0.01);
requestAnimationFrame(loop);
if (debug)
  window.postTest = {
    step(seconds, draw = true) {
      let n = Math.ceil(seconds * 60);
      for (let i = 0; i < n; i++) {
        if (state === 'play' || state === 'title' || state === 'handoff') simulate(seconds / n);
        camera(seconds / n);
      }
      overlays();
      if (draw) renderer.render(scene, cam);
      return this.read();
    },
    read() {
      return {
        state,
        stage,
        x,
        y,
        z,
        vx,
        vz,
        pl: pl?.i,
        home: lastGround,
        stamps,
        falls,
        ferry: world.plats.find((p) => p.dx)?.fraction,
        platforms: world.plats.map((p) => ({ x: p.g.position.x, z: p.g.position.z, w: p.w, d: p.d })),
        spur: world.spur ? { x: world.spur.x, z: world.spur.z, from: world.spur.parentIndex } : null,
        recipient: world.resident.root.position.toArray(),
        save,
      };
    },
  };
