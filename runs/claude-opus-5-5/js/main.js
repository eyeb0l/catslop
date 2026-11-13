// Knock Theory: game state, camera, input, objectives, HUD and menus.
import * as THREE from 'three';
import { World } from './world.js';
import { Items } from './items.js';
import { CatModel, COATS, HATS } from './cat.js';
import { Player } from './player.js';
import { Robot, Bird } from './critters.js';
import { Sound } from './audio.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const MANUAL = params.has('manual');
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

// ---------------------------------------------------------------- save

const SAVE_KEY = 'knock-theory-save-v1';
const DEFAULT_SAVE = {
  treats: 0, best: 0, day: 1, coat: 'marmalade', hat: 'none',
  coats: ['marmalade'], hats: ['none'], tutorial: false, everDone: [],
  settings: { master: 80, music: 55, sfx: 85, sens: 100, invert: false, day: 360, quality: 'auto', hints: true },
};
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const s = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_SAVE), ...s, settings: { ...DEFAULT_SAVE.settings, ...(s.settings || {}) } };
  } catch { return structuredClone(DEFAULT_SAVE); }
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode: progress lives for this session only */ } }

// ---------------------------------------------------------------- three

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a2026');
const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 200);

const world = new World(scene);
const items = new Items(scene, world);
const cat = new CatModel(scene);
const player = new Player(world, items);
const robot = new Robot(scene, world, items);
const bird = new Bird(scene);
const sound = new Sound();
cat.setCoat(save.coat);
cat.setHat(save.hat);

// pounce preview: dotted arc + landing ring
const arcGeo = new THREE.BufferGeometry();
arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
const arc = new THREE.Points(arcGeo, new THREE.PointsMaterial({ color: '#fff7ea', size: 0.03, transparent: true, opacity: 0.85, depthWrite: false }));
arc.frustumCulled = false;
arc.visible = false;
scene.add(arc);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff7ea', transparent: true, opacity: 0.8, depthWrite: false }));
ring.visible = false;
scene.add(ring);

// ---------------------------------------------------------------- quality

let pixelRatio = 1;
let maxPR = 1;
function applyQuality() {
  const q = save.settings.quality;
  maxPR = q === 'low' ? 0.75 : q === 'high' ? Math.min(2, devicePixelRatio) : Math.min(1.5, devicePixelRatio);
  pixelRatio = q === 'auto' ? Math.min(maxPR, pixelRatio || maxPR) : maxPR;
  if (q !== 'auto') pixelRatio = maxPR;
  const size = q === 'low' ? 1024 : 2048;
  if (world.sun.shadow.mapSize.x !== size) {
    world.sun.shadow.mapSize.set(size, size);
    if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; }
  }
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
const perf = { acc: 0, n: 0, slow: 0, fast: 0 };
function adaptQuality(frameMs) {
  if (save.settings.quality !== 'auto') return;
  perf.acc += frameMs; perf.n++;
  if (perf.acc < 1500) return;
  const avg = perf.acc / perf.n;
  perf.acc = 0; perf.n = 0;
  if (avg > 24 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio - 0.15); resize(); }
  else if (avg < 13 && pixelRatio < maxPR) { pixelRatio = Math.min(maxPR, pixelRatio + 0.1); resize(); }
}

// ---------------------------------------------------------------- input

const keys = new Set();
const pressed = new Set();
let mouseSwat = false;
let pointerLocked = false;
let lockFailed = false;
let dragging = false;
let dragMoved = 0;
const look = { dx: 0, dy: 0, wheel: 0 };

addEventListener('keydown', (e) => {
  if (e.repeat) { if (state === 'play' && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
  sound.init();
  keys.add(e.code);
  pressed.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && state === 'play') e.preventDefault();
  onKey(e);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); });

canvas.addEventListener('mousedown', (e) => {
  sound.init();
  if (state !== 'play') return;
  dragging = true;
  dragMoved = 0;
  if (!pointerLocked) requestLock();
  if (pointerLocked && e.button === 0) mouseSwat = true;
});
addEventListener('mouseup', (e) => {
  if (state === 'play' && dragging && !pointerLocked && e.button === 0 && dragMoved < 6) mouseSwat = true;
  dragging = false;
});
addEventListener('mousemove', (e) => {
  if (state !== 'play') return;
  if (pointerLocked) { look.dx += e.movementX; look.dy += e.movementY; }
  else if (dragging) { look.dx += e.movementX; look.dy += e.movementY; dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY); }
});
addEventListener('wheel', (e) => { if (state === 'play') look.wheel += Math.sign(e.deltaY); }, { passive: true });
addEventListener('contextmenu', (e) => { if (state === 'play') e.preventDefault(); });

function requestLock() {
  try {
    const p = canvas.requestPointerLock?.();
    if (p && typeof p.catch === 'function') p.catch(() => { lockFailed = true; if (state === 'play' && game.hint === 0) setHint(0); });
  } catch { lockFailed = true; }
}
document.addEventListener('pointerlockchange', () => {
  const was = pointerLocked;
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) lockFailed = false;
  if (was && !pointerLocked && state === 'play') pause();
});
document.addEventListener('pointerlockerror', () => { lockFailed = true; if (state === 'play' && game.hint === 0) setHint(0); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function readInput() {
  const k = (c) => keys.has(c);
  const x = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
  const z = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  const p = (c) => pressed.has(c);
  const inp = {
    x, z,
    run: k('ShiftLeft') || k('ShiftRight'),
    sneak: k('KeyC'),
    jumpDown: p('Space'),
    jumpHeld: k('Space'),
    swat: p('KeyF') || p('KeyE') || mouseSwat,
    meow: p('KeyQ'),
  };
  inp.any = !!(x || z || inp.jumpDown || inp.swat || inp.meow);
  pressed.clear();
  mouseSwat = false;
  return inp;
}

// ---------------------------------------------------------------- camera

const cam = { yaw: Math.PI, pitch: 0.32, dist: 1.7, distNow: 1.7, target: new THREE.Vector3(), shake: 0, fov: 60, idleOrbit: 0 };
const _v = new THREE.Vector3(), _d = new THREE.Vector3();

function updateCamera(dt, follow = true) {
  const sens = save.settings.sens / 100;
  cam.yaw -= look.dx * 0.0026 * sens;
  cam.pitch += look.dy * 0.0026 * sens * (save.settings.invert ? -1 : 1);
  look.dx = 0; look.dy = 0;
  if (keys.has('ArrowLeft')) cam.yaw += 2.2 * dt;
  if (keys.has('ArrowRight')) cam.yaw -= 2.2 * dt;
  if (keys.has('ArrowUp')) cam.pitch += 1.4 * dt;
  if (keys.has('ArrowDown')) cam.pitch -= 1.4 * dt;
  cam.dist = clamp(cam.dist + look.wheel * 0.18, 0.9, 3.6);
  look.wheel = 0;
  cam.pitch = clamp(cam.pitch, -0.35, 1.3);
  // without mouse look, drift gently behind the cat while it runs
  if (!pointerLocked && !dragging && follow && player.speed > 1 && player.grounded) {
    const behind = player.yaw;
    let d = behind - cam.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    cam.yaw += d * (1 - Math.exp(-0.9 * dt));
  }
  const tx = player.pos.x, tz = player.pos.z, ty = player.pos.y + 0.3;
  cam.target.x = damp(cam.target.x, tx, 14, dt);
  cam.target.z = damp(cam.target.z, tz, 14, dt);
  cam.target.y = damp(cam.target.y, ty, player.grounded ? 9 : 5, dt);
  placeCamera(dt);
  const wantFov = 60 + (player.speed > 3 ? 7 : 0);
  cam.fov = damp(cam.fov, wantFov, 4, dt);
  if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

function placeCamera(dt) {
  const t = cam.target;
  _d.set(-Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let dist = cam.dist;
  const hit = world.raycast(t, _d, dist + 0.15);
  if (hit < dist + 0.15) dist = Math.max(0.35, hit - 0.15);
  cam.distNow = dist < cam.distNow ? dist : damp(cam.distNow, dist, 3, dt);
  _v.copy(t).addScaledVector(_d, cam.distNow);
  // stay inside the flat
  _v.x = clamp(_v.x, -6.85, 6.85);
  _v.z = clamp(_v.z, -4.85, 4.85);
  _v.y = clamp(_v.y, 0.08, 2.68);
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 2.5);
    const s = cam.shake * cam.shake * 0.04;
    _v.x += rnd(-s, s); _v.y += rnd(-s, s); _v.z += rnd(-s, s);
  }
  camera.position.copy(_v);
  camera.lookAt(t);
}

// ---------------------------------------------------------------- hypotheses

const HYPOTHESES = [
  { id: 'mug', text: 'Do mugs obey gravity? Knock one off something.' },
  { id: 'box', text: 'If it fits, I sits. Sit in the cardboard box.' },
  { id: 'sun', text: 'Find a sunbeam. Fall asleep in it.' },
  { id: 'glass', text: 'Glass makes a better sound. Break some.' },
  { id: 'laptop', text: 'Walk across the laptop. Send an email.' },
  { id: 'combo', text: 'Peer review: three experiments in four seconds.', prog: () => `best ${game.bestCombo}` },
  { id: 'ride', text: 'Ride Bumble the robot vacuum for 5 seconds.', needs: () => robot.active, prog: () => `${Math.min(5, game.rideT).toFixed(1)}s` },
  { id: 'fridge', text: 'Claim the top of the fridge.' },
  { id: 'fish', text: "Tonight's dinner looks unstable. Test it." },
  { id: 'scratch', text: 'Sharpen your claws on the sofa (never the post).', prog: () => `${game.scratches}/3` },
  { id: 'bird', text: 'There is a bird at the window. Tell it off.', needs: () => bird.state !== 'away' || game.dayT > 0.15 },
  { id: 'summit', text: 'The Grand Experiment: the Fancy Vase, from the very top.' },
];

const CAPTIONS = {
  any: ['Gravity: confirmed', 'Results replicated', 'Data point acquired', 'Hypothesis supported', 'For science', 'Peer reviewed', 'Still works', 'Noted'],
  broke: ['Gravity: VERY confirmed', 'Irreversible results', 'Oops (not sorry)', 'Significant findings', 'Smash!'],
};
const QUIPS = {
  fish: 'Dinner is served (floor)', figurine: 'Traitor dealt with', fancyvase: 'THE GRAND EXPERIMENT', frame: 'Nothing personal',
  phone: 'Screen time reduced', remote: 'Channel changed', trophy: 'Still 2nd place', treatjar: 'Jackpot', teapot: 'Sorry, Grandma',
  snowglobe: 'Weather event', egg: 'Breakfast cancelled', speaker: '"Sorry, I didn\'t catch that"', kettle: 'Kettle: confirmed', book: 'Light reading',
  plant: 'Repotted', cactus: 'Ouch (worth it)', apple: 'Newton was right', bread: 'Loaf, meet floor', cereal: 'Part of a balanced floor',
};
const EMAILS = ['jjjjjjjjjjjjjjjjjjj;;;;;', 'hhhhhhhhh000000000000000', 'mmmmmmmmmmmmmmmmmmmm', 'ffffffffff,,,,,,,,,,,,,,,,,,,,,,,,,,,]]]', ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;'];
const RECIPIENTS = ["the Tall One's boss", 'the whole office', 'Mum', 'a recruiter', 'the landlord'];

// ---------------------------------------------------------------- game state

let state = 'boot';
let screen = null;
let screenStack = [];
const game = {};

function newDay() {
  Object.assign(game, {
    time: 0, dayT: 0, score: 0, combo: 0, comboT: 0, bestCombo: 0, experiments: 0, breaks: 0,
    done: new Set(), order: [], rideT: 0, napT: 0, boxT: 0, scratches: 0, fired: new Set(), treatBonus: 0,
    maxDrop: 0, emails: 0, onLaptop: false, laptopCd: 0, sunny: false, sunCheck: 0, chatterCd: 0, endT: 0,
    hint: 0, hintT: 0, moved: 0, sprinted: 0, jumped: false, swatted: false, lookTarget: null, lastPopZ: 0,
  });
  items.reset();
  robot.reset();
  bird.reset();
  player.reset(-1.0, 3.6, Math.PI);
  cam.yaw = Math.PI; cam.pitch = 0.3; cam.dist = 1.7; cam.distNow = 1.7;
  cam.target.set(player.pos.x, 0.3, player.pos.z);
  world.setTime(0);
  world.door.rotation.y = 0;
  world.laptopScreen.material.color.set('#9fc4d8');
  $('hypList').innerHTML = '';
  for (const h of HYPOTHESES) h._doneAt = undefined;
  renderHyp(true);
  updateScore(true);
  if (!save.tutorial || save.settings.hints) game.hint = save.tutorial ? 99 : 0;
}

function startDay() {
  sound.init();
  closeAllScreens();
  newDay();
  state = 'play';
  $('hud').classList.remove('hidden');
  fadeIn();
  toast(`9:00 AM. The Tall One has left for work.`, 'big', 'Day ' + save.day + '. Gravity will not test itself.');
  requestLock();
  setHint(0);
}

function pause() {
  if (state !== 'play') return;
  state = 'paused';
  openScreen('pause');
  sound.purr(false);
  sound.hum(0);
}

function resume() {
  closeAllScreens();
  state = 'play';
  requestLock();
}

function toTitle() {
  closeAllScreens();
  state = 'title';
  $('hud').classList.add('hidden');
  $('endcard').classList.add('hidden');
  sound.purr(false);
  sound.hum(0);
  sound.ticking = false;
  sound.intensity = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  setupTitleScene();
  openScreen('title');
}

function setupTitleScene() {
  items.reset();
  robot.reset();
  bird.reset();
  world.door.rotation.y = 0;
  world.setTime(0.22);
  player.reset(0.75, -3.75, 0.4);
  player.mode = 'sit';
  cam.target.set(0.75, 0.3, -3.75);
}

// ---------------------------------------------------------------- scoring

function addScore(n) {
  game.score += Math.round(n);
  updateScore();
}

function onItemLand(it, impact, drop, broke) {
  if (state !== 'play') return;
  const def = it.def;
  if (def.toy) return;
  if (drop > 0) {
    game.experiments++;
    game.maxDrop = Math.max(game.maxDrop, drop);
    game.combo = game.comboT > 0 ? game.combo + 1 : 1;
    game.comboT = 4;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    const mult = Math.min(4, 1 + (game.combo - 1) * 0.5);
    const pts = def.value * (1 + drop * 0.45) * (broke ? 1.5 : 1) * mult;
    addScore(pts);
    if (broke) game.breaks++;
    const caption = QUIPS[it.type] && Math.random() < 0.85 ? QUIPS[it.type] : broke ? pick(CAPTIONS.broke) : pick(CAPTIONS.any);
    pop(it.pos, `+${Math.round(pts)}`, `${caption}${game.combo > 1 ? ` · x${mult.toFixed(1)}` : ''}`);
    sound.ding(Math.min(9, game.combo - 1));
    cam.shake = Math.max(cam.shake, broke ? 0.8 : 0.35);
    if (it.type === 'mug') complete('mug');
    if (it.type === 'fish') complete('fish');
    if (it.type === 'fancyvase') complete('summit');
    if (broke && def.mat === 'glass') complete('glass');
    if (game.combo >= 3) complete('combo');
    if (it.type === 'treatjar') {
      game.treatBonus += 5;
      setTimeout(() => pop(it.pos, '+5 treats', 'the jar was not sealed', 'treat'), 350);
    }
  } else if (broke) {
    game.breaks++;
    addScore(def.value * 0.5);
    pop(it.pos, `+${Math.round(def.value * 0.5)}`, 'Smash!');
    if (def.mat === 'glass') complete('glass');
    cam.shake = Math.max(cam.shake, 0.6);
  }
}

items.onLand = onItemLand;
items.onSound = (mat, speed, pos, shatter) => {
  if (state === 'title' || state === 'boot') return;
  sound.impact(mat, speed, panOf(pos), shatter);
};

function panOf(p) {
  _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
  return clamp(_v.x / Math.max(1, -_v.z), -1, 1) * 0.8;
}

function complete(id) {
  if (game.done.has(id) || state !== 'play') return;
  const h = HYPOTHESES.find((x) => x.id === id);
  if (!h) return;
  game.done.add(id);
  game.order.push(id);
  addScore(500);
  sound.fanfare();
  toast('Hypothesis confirmed!  +500', 'big', h.text);
  if (!save.everDone.includes(id)) { save.everDone.push(id); persist(); }
  renderHyp();
}

// ---------------------------------------------------------------- per-frame game logic

function stepPlay(dt) {
  game.time += dt;
  const daySeconds = save.settings.day;
  game.dayT = Math.min(1, game.dayT + dt / daySeconds);
  world.setTime(game.dayT);
  const input = readInput();
  if (game.hint < 5) trackTutorial(input, dt);
  player.update(dt, input, cam.yaw, robot);
  player.sunny = game.sunny;
  handlePlayerEvents();
  robot.update(dt, player, game.time);
  bird.update(dt, game.time, sound, camera.position);
  items.update(dt, game.time);
  updateObjectives(dt);
  timeline();
  // combo decay
  if (game.comboT > 0) { game.comboT -= dt; if (game.comboT <= 0) { game.combo = 0; } }
  sound.intensity = clamp((game.combo > 1 ? 0.25 + game.combo * 0.1 : 0) + (game.dayT > 0.88 ? 0.45 : 0), 0, 1);
  // robot hum
  if (robot.active) {
    const d = robot.pos.distanceTo(camera.position);
    sound.hum(clamp(1.4 / (d + 0.3), 0, 1), panOf(robot.pos));
  }
  animateCat(dt, input);
  updateCamera(dt);
  updateArc();
  if (game.dayT >= 1 && state === 'play') beginEnding();
}

function trackTutorial(input, dt) {
  if (!save.settings.hints) { setHint(99); return; }
  game.hintT += dt;
  if (game.hint === 0) { game.moved += player.speed * dt; if (game.moved > 2) setHint(1); }
  else if (game.hint === 1) { if (player.sprintTime > 0.6 || game.hintT > 12) setHint(2); }
  else if (game.hint === 2) { if (game.jumped || game.hintT > 14) setHint(3); }
  else if (game.hint === 3) { if (game.swatted || game.hintT > 14) setHint(4); }
  else if (game.hint === 4) { if (game.hintT > 9) setHint(5); }
}

function setHint(n) {
  game.hint = n;
  game.hintT = 0;
  const el = $('hint');
  const lockNote = lockFailed ? 'drag the mouse (or use the arrow keys) to look' : 'move the mouse to look';
  const texts = [
    `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk · ${lockNote}`,
    `Hold <kbd>Shift</kbd> for zoomies`,
    `<kbd>Space</kbd> to jump · hold it while standing still to pounce further`,
    `Click or <kbd>F</kbd> to swat things off the edge · <kbd>Q</kbd> to meow`,
    `Every thing that hits the floor is science. Hypotheses are top left.`,
  ];
  if (n < texts.length && save.settings.hints) {
    el.innerHTML = texts[n];
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
    if (n >= 5 && !save.tutorial) { save.tutorial = true; persist(); }
  }
}

function handlePlayerEvents() {
  for (const e of player.events) {
    switch (e.type) {
      case 'jump': sound.jump(e.power); game.jumped = true; break;
      case 'charge': break;
      case 'land':
        sound.land(e.impact);
        if (e.fall > 1.2) cam.shake = Math.max(cam.shake, 0.35);
        break;
      case 'mantle': sound.step(2); setTimeout(() => sound.step(2), 70); break;
      case 'bonk': sound.impact('wood', 2, 0); break;
      case 'swat': sound.swat(); break;
      case 'swatHit': game.swatted = true; break;
      case 'swatRobot': sound.impact('plastic', 3, panOf(robot.pos)); pop(robot.pos, 'bonk', ''); break;
      case 'meow': {
        const c = COATS[save.coat];
        sound.meow({ pitch: c.pattern === 5 ? 1.2 : c.pattern === 1 ? 0.92 : 1, kind: Math.random() < 0.25 ? 'mrrp' : 'meow' });
        if (bird.present && player.pos.distanceTo(bird.mesh.position) < 3.2) {
          if (bird.scare()) { complete('bird'); sound.chatter(); pop(bird.mesh.position, 'Told it off', 'the bird has left'); }
        }
        break;
      }
      case 'startle':
        sound.hiss();
        pop(player.pos.clone().setY(player.pos.y + 0.5), '!!', 'Bumble!');
        break;
      case 'scratch':
        sound.scratch();
        items.debris.burst(new THREE.Vector3(e.x, e.y, e.z), e.tag === 'post' ? '#d9b98a' : e.tag === 'sofa' ? '#e7a28c' : '#f2d27e', 6, 0.6, 0.05, 0.6);
        if (e.tag === 'sofa' || e.tag === 'armchair') {
          game.scratches++;
          if (game.scratches >= 3) complete('scratch');
          else pop(new THREE.Vector3(e.x, e.y + 0.2, e.z), `${game.scratches}/3`, 'shred');
          renderHyp();
        } else pop(new THREE.Vector3(e.x, e.y + 0.2, e.z), 'Too easy', 'that is what it is for');
        break;
      case 'nap': sound.purr(true); break;
      case 'wake': sound.purr(false); break;
    }
  }
  player.events.length = 0;
}

function updateObjectives(dt) {
  // sunbeam check, a few times a second
  game.sunCheck -= dt;
  if (game.sunCheck <= 0) {
    game.sunCheck = 0.2;
    game.sunny = world.sunlit(player.pos.x, player.pos.y + 0.18, player.pos.z, true);
  }
  // nap in the sun
  if (player.mode === 'nap') {
    game.napT += dt;
    if (game.napT > 2.5) complete('sun');
    if (Math.floor(game.napT * 0.8) !== Math.floor((game.napT - dt) * 0.8)) pop(player.pos.clone().setY(player.pos.y + 0.45), 'z', '', 'z');
  } else game.napT = 0;
  // box
  if (player.inBox() && player.grounded) { game.boxT += dt; if (game.boxT > 1.4) complete('box'); } else game.boxT = 0;
  // fridge
  if (player.grounded && player.groundTag === 'fridge') complete('fridge');
  // laptop
  game.laptopCd -= dt;
  const onLaptop = player.grounded && player.groundTag === 'laptop';
  if (onLaptop && !game.onLaptop && game.laptopCd <= 0) {
    game.laptopCd = 2.5;
    game.emails++;
    sound.typing();
    world.laptopScreen.material.color.set(pick(['#f2c14e', '#e8546b', '#9fd0a0', '#ffffff']));
    toast(`Email sent to ${pick(RECIPIENTS)}: “${pick(EMAILS)}”`);
    addScore(80);
    complete('laptop');
  }
  game.onLaptop = onLaptop;
  // robot ride
  if (player.onRobot) {
    game.rideT += dt;
    if (game.rideT >= 5) complete('ride');
    if (Math.floor(game.rideT) !== Math.floor(game.rideT - dt) && game.rideT < 5.5) renderHyp();
  }
  // chatter at the bird
  game.chatterCd -= dt;
  if (bird.present && game.chatterCd <= 0 && player.pos.distanceTo(bird.mesh.position) < 2.2) {
    game.chatterCd = rnd(3, 6);
    sound.chatter(panOf(bird.mesh.position));
  }
  // status line: what the cat is feeling right now
  const st = $('status');
  let html = '';
  if (player.charging) html = `Pounce <span class="meter"><i style="width:${Math.round(player.charge * 100)}%"></i></span>`;
  else if (player.mode === 'nap') html = 'Napping in the sun. Purr.';
  else if (game.sunny && player.speed < 0.1 && player.grounded) html = `Warm. Stay still… <span class="meter"><i style="width:${Math.round(clamp(player.idle / 6, 0, 1) * 100)}%"></i></span>`;
  else if (player.onRobot) html = `Riding Bumble · ${game.rideT.toFixed(1)}s`;
  else if (player.inBox()) html = 'If it fits, I sits.';
  if (html !== game.statusHtml) {
    game.statusHtml = html;
    st.innerHTML = html;
    st.classList.toggle('hidden', !html);
  }
}

function timeline() {
  const hours = 9 + game.dayT * 8.5;
  const once = (id, at, fn) => { if (hours >= at && !game.fired.has(id)) { game.fired.add(id); fn(); } };
  once('phone1', 9.25, () => phone('be good today!! ♥ there is fish for dinner, do NOT touch it'));
  once('robot', 11, () => { robot.activate(); toast('11:00. Bumble the robot vacuum has woken up.', '', 'It is a moving platform. Probably.'); renderHyp(); });
  once('phone2', 13, () => phone('quick check: did you knock anything over'));
  once('phone3', 15.2, () => phone('the treat jar is on the fridge so you can’t reach it :)'));
  once('leaving', 16.75, () => { phone('leaving work now! home by 5:30'); toast('The Tall One is on the way home.', '', 'Finish your experiments.'); });
  once('tick', 17.1, () => { sound.ticking = true; $('clock').classList.add('late'); });
}

function phone(msg) {
  sound.phone();
  const old = $('phone');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'phone';
  el.innerHTML = `<div class="who">The Tall One</div><div class="msg"></div>`;
  el.querySelector('.msg').textContent = msg;
  $('hud').appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 7000);
}

// ---------------------------------------------------------------- the cat's attention

function animateCat(dt, input) {
  // what is the cat looking at?
  let look = null;
  const f = player.forward;
  if (bird.present && player.pos.distanceTo(bird.mesh.position) < 4) look = bird.mesh.position;
  else if (robot.active && player.pos.distanceTo(robot.pos) < 1.4 && !player.onRobot) look = robot.mesh.position;
  else if (player.mode === 'sit' && player.idle > 3.5 && Math.sin(game.time * 0.4) > 0.2) look = camera.position;
  else {
    let best = 1.0, bestIt = null;
    for (const it of items.list) {
      if (it.broken || it.pos.y < player.pos.y + 0.05) continue;
      const dx = it.pos.x - player.pos.x, dz = it.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < best && (dx * f.x + dz * f.z) > -0.1 * d) { best = d; bestIt = it; }
    }
    if (bestIt) look = bestIt.pos;
  }
  const footfalls = cat.update(dt, {
    pos: player.pos, yaw: player.yaw, speed: player.speed, vy: player.vel.y, grounded: player.grounded,
    turn: player.turn, mode: player.mode, charge: player.charge, sneak: input ? input.sneak : false,
    swatT: player.swatT, meowT: player.meowT, landImpact: player.landImpact, lookAt: look,
    sunny: game.sunny, groundY: player.groundY, teleport: player.teleport,
  });
  player.teleport = false;
  if (footfalls && state === 'play') sound.step(player.speed > 3 ? 1.4 : player.speed > 1 ? 0.8 : 0.4);
}

function updateArc() {
  const show = player.charging && player.charge > 0.08;
  arc.visible = show;
  ring.visible = false;
  if (!show) return;
  const pts = [];
  const land = player.predictArc(pts);
  const attr = arcGeo.attributes.position;
  const n = Math.min(64, pts.length / 3);
  for (let i = 0; i < n; i++) attr.setXYZ(i, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
  attr.needsUpdate = true;
  arcGeo.setDrawRange(0, n);
  if (land) { ring.visible = true; ring.position.set(land.x, land.y + 0.01, land.z); ring.scale.setScalar(1 + Math.sin(game.time * 10) * 0.1); }
}

// ---------------------------------------------------------------- ending

function beginEnding() {
  state = 'ending';
  game.endT = 0;
  sound.ticking = false;
  sound.purr(false);
  sound.hum(0);
  sound.door();
  $('clock').classList.remove('late');
  $('hint').classList.add('hidden');
  $('status').classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  const card = $('endcard');
  const messy = game.experiments >= 5;
  card.innerHTML = `17:30. The Tall One is home.<small>${messy ? '“…what happened in here?”' : '“Aww. Were you good all day?”'}</small>`;
  card.classList.remove('hidden');
}

function stepEnding(dt) {
  game.endT += dt;
  world.door.rotation.y = -Math.min(1.3, game.endT * 1.2);
  items.update(dt, game.time);
  robot.update(dt, player, game.time);
  // the cat sits and looks innocent
  player.mode = game.endT > 0.6 ? 'sit' : player.mode;
  player.vel.set(0, player.grounded ? 0 : player.vel.y, 0);
  player.speed = 0;
  if (!player.grounded) player.update(dt, { x: 0, z: 0 }, cam.yaw, robot);
  player.mode = 'sit';
  cat.update(dt, {
    pos: player.pos, yaw: player.yaw, speed: 0, vy: 0, grounded: true, turn: 0, mode: 'sit', charge: 0, sneak: false,
    swatT: -1, meowT: game.endT > 1.5 && game.endT < 2.2 ? game.endT - 1.5 : -1, landImpact: 0, lookAt: world.door.position.clone().setY(1.2), sunny: false, groundY: player.groundY,
  });
  if (game.endT > 1.5 && !game.endMeow) { game.endMeow = true; sound.meow({ kind: 'mrrp', pitch: 1.1 }); }
  // slow pull-back
  cam.yaw += dt * 0.25;
  cam.pitch = damp(cam.pitch, 0.55, 1.5, dt);
  cam.dist = damp(cam.dist, 3.2, 1, dt);
  cam.target.lerp(_v.set(player.pos.x, player.pos.y + 0.25, player.pos.z), 1 - Math.exp(-4 * dt));
  placeCamera(dt);
  if (game.endT > 4.2) showReport();
}

const RANKS = [
  [0, 'Suspiciously Good Kitty', 'The Tall One is delighted. You are disappointed in yourself.'],
  [1200, 'Lab Assistant', 'Promising work. Some things are still on surfaces.'],
  [3000, 'Junior Researcher', 'A solid day of data collection.'],
  [6000, 'Professor of Falling', 'Your results have been widely replicated, mostly on the floor.'],
  [10000, 'Chaos Laureate', 'Gravity has never been so thoroughly confirmed.'],
  [15000, 'Nobel Prize in Gravity', 'Newton is shaking. The flat is in pieces.'],
];

function showReport() {
  state = 'report';
  $('endcard').classList.add('hidden');
  $('hud').classList.add('hidden');
  const r = [...RANKS].reverse().find(([min]) => game.score >= min);
  const earned = Math.floor(game.score / 150) + game.done.size * 2 + game.treatBonus;
  const isBest = game.score > save.best;
  save.treats += earned;
  save.best = Math.max(save.best, game.score);
  $('rDay').textContent = `Day ${save.day} · Research report`;
  save.day++;
  persist();
  $('rScore').textContent = game.score.toLocaleString();
  $('rRank').textContent = r[1];
  $('rQuote').textContent = r[2];
  const rows = [
    ['Experiments (things on the floor)', game.experiments],
    ['Breakages', game.breaks],
    ['Highest drop', `${game.maxDrop.toFixed(2)} m`],
    ['Best combo', `x${game.bestCombo}`],
    ['Hypotheses confirmed', `${game.done.size} / ${HYPOTHESES.length}`],
    ['Emails sent', game.emails],
    ['Shards Bumble ate', robot.sucked],
    ['Treats earned', `<span class="new">+${earned}</span>`],
    ['Treats in the jar', save.treats],
  ];
  if (isBest) rows.unshift(['New personal best!', '<span class="new">★</span>']);
  $('rTable').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  openScreen('report');
}

// ---------------------------------------------------------------- HUD

function renderHyp(fresh = false) {
  const list = $('hypList');
  const active = [];
  for (const h of HYPOTHESES) {
    if (game.done.has(h.id)) continue;
    if (h.needs && !h.needs()) continue;
    active.push(h);
    if (active.length >= 3) break;
  }
  // keep the most recent completion visible for a moment
  const recent = game.order.slice(-1).map((id) => HYPOTHESES.find((h) => h.id === id)).filter((h) => game.time - (h._doneAt ?? (h._doneAt = game.time)) < 2.5);
  const show = [...recent, ...active];
  const sig = show.map((h) => h.id + (game.done.has(h.id) ? '1' : '0') + (h.prog ? h.prog() : '')).join('|');
  if (sig === list.dataset.sig && !fresh) return;
  const before = new Set((list.dataset.ids || '').split(','));
  list.dataset.sig = sig;
  list.dataset.ids = show.map((h) => h.id).join(',');
  list.innerHTML = show.map((h) => {
    const done = game.done.has(h.id);
    const prog = h.prog && !done ? `<span class="prog">(${h.prog()})</span>` : '';
    return `<li class="${done ? 'done' : ''} ${before.has(h.id) || fresh ? '' : 'enter'}"><div class="box"></div><span>${h.text}${prog}</span></li>`;
  }).join('') || '<li><span>Every hypothesis confirmed. Keep knocking.</span></li>';
  $('hypCount').textContent = `${game.done.size}/${HYPOTHESES.length}`;
}
for (const h of HYPOTHESES) h._doneAt = undefined;

let shownScore = 0;
function updateScore(reset = false) {
  if (reset) shownScore = 0;
  const el = $('scoreVal');
  el.classList.remove('bump');
  void el.offsetWidth;
  if (!reset) el.classList.add('bump');
}

function hudFrame(dt) {
  // rolling score
  shownScore = shownScore < game.score ? Math.min(game.score, shownScore + Math.max(5, (game.score - shownScore) * 8 * dt)) : game.score;
  $('scoreVal').textContent = Math.round(shownScore).toLocaleString();
  const comboEl = $('combo');
  if (game.combo > 1 && game.comboT > 0) {
    comboEl.innerHTML = `Combo x${Math.min(4, 1 + (game.combo - 1) * 0.5).toFixed(1)}<div class="meter"><i style="width:${(game.comboT / 4) * 100}%"></i></div>`;
    comboEl.style.opacity = 1;
  } else comboEl.style.opacity = 0;
  // clock
  const hours = 9 + game.dayT * 8.5;
  const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
  const label = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  if ($('time').textContent !== label) {
    $('time').textContent = label;
    const ha = ((hours % 12) / 12) * Math.PI * 2, ma = ((hours % 1)) * Math.PI * 2;
    $('hHand').setAttribute('x2', 12 + Math.sin(ha) * 5); $('hHand').setAttribute('y2', 12 - Math.cos(ha) * 5);
    $('mHand').setAttribute('x2', 12 + Math.sin(ma) * 7.5); $('mHand').setAttribute('y2', 12 - Math.cos(ma) * 7.5);
    $('dayBar').style.width = `${game.dayT * 100}%`;
  }
  renderHyp();
  updatePops(dt);
}

// floating labels in the world
const pops = [];
function pop(pos, big, small, cls = '') {
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.innerHTML = cls === 'z' ? 'z' : `<b></b><small></small>`;
  if (cls !== 'z') { el.querySelector('b').textContent = big; el.querySelector('small').textContent = small; }
  $('pops').appendChild(el);
  pops.push({ el, pos: pos.clone(), t: 0, life: cls === 'z' ? 2.2 : 1.6, drift: cls === 'z' ? rnd(-0.1, 0.1) : 0 });
}
function updatePops(dt) {
  const w = innerWidth, h = innerHeight;
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t += dt;
    if (p.t > p.life) { p.el.remove(); pops.splice(i, 1); continue; }
    _v.copy(p.pos);
    _v.y += 0.25 + p.t * 0.35;
    _v.x += p.drift * p.t;
    _v.project(camera);
    if (_v.z > 1) { p.el.style.opacity = 0; continue; }
    const k = p.t / p.life;
    const s = p.t < 0.15 ? 0.6 + (p.t / 0.15) * 0.5 : 1.1 - Math.min(0.1, (p.t - 0.15));
    p.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    p.el.style.transform = `translate(-50%,-50%) translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) scale(${s})`;
    p.el.style.left = '0'; p.el.style.top = '0';
  }
}

function toast(text, cls = '', sub = '') {
  const el = document.createElement('div');
  el.className = 'toast chip ' + cls;
  el.textContent = text;
  if (sub) { const s = document.createElement('small'); s.textContent = sub; el.appendChild(s); }
  const box = $('toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, cls === 'big' ? 3200 : 4200);
  if (cls !== 'big') sound.pop();
}

function fadeIn() {
  const f = $('fade');
  f.style.opacity = 1;
  requestAnimationFrame(() => { f.style.opacity = 0; });
}

// ---------------------------------------------------------------- menus

const SCREENS = ['title', 'wardrobe', 'help', 'settings', 'pause', 'report'];
function openScreen(id, push = false) {
  if (push && screen) screenStack.push(screen);
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  screen = id;
  if (id === 'wardrobe') renderWardrobe();
  if (id === 'settings') syncSettings();
  if (id === 'title') renderTitleStats();
  const first = $(id).querySelector('.btn.primary, .item, .btn, input, select');
  if (first) first.focus({ preventScroll: true });
}
function closeAllScreens() {
  for (const s of SCREENS) $(s).classList.add('hidden');
  screen = null;
  screenStack = [];
  canvas.focus({ preventScroll: true });
}
function back() {
  sound.ui('back');
  const prev = screenStack.pop();
  if (prev) openScreen(prev);
  else if (state === 'paused') resume();
}

function renderTitleStats() {
  const parts = [`Day ${save.day}`];
  if (save.best) parts.push(`best ${save.best.toLocaleString()} science`);
  parts.push(`${save.treats} treats`);
  $('titleStats').textContent = parts.join(' · ');
}

function onKey(e) {
  if (state === 'title' && screen === 'title') {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      const a = document.activeElement;
      if (!a || a === document.body || a === canvas || a.id === 'bStart') { e.preventDefault(); sound.ui(); startDay(); }
      return;
    }
  }
  if (state === 'report' && screen === 'report' && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
    const a = document.activeElement;
    if (!a || a === document.body || a.id === 'bAgain') { e.preventDefault(); startDay(); }
    return;
  }
  if (e.code === 'Escape' || (e.code === 'KeyP' && state === 'play')) {
    if (state === 'play') {
      // Escape releases pointer lock itself and pointerlockchange pauses; P has to do both
      if (!pointerLocked) pause();
      else if (e.code === 'KeyP') { pause(); document.exitPointerLock(); }
      return;
    }
    if (screen && screen !== 'title' && screen !== 'report') { if (screen === 'pause') resume(); else back(); return; }
  }
  // arrow keys move focus between menu buttons
  if (screen && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    const els = [...$(screen).querySelectorAll('button, input, select')].filter((x) => x.offsetParent !== null);
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' && a.type === 'range' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) return;
    if (a && a.tagName === 'SELECT') return;
    const i = els.indexOf(a);
    const dir = e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : -1;
    const next = els[(i + dir + els.length) % els.length] || els[0];
    if (next) { next.focus(); sound.ui('hover'); e.preventDefault(); }
  }
}

const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); sound.init(); sound.ui(); fn(e); });
on('bStart', startDay);
on('bWardrobe', () => openScreen('wardrobe', true));
on('bHelp', () => openScreen('help', true));
on('bSettings', () => openScreen('settings', true));
on('bWardrobeBack', back);
on('bHelpBack', back);
on('bSettingsBack', back);
on('bResume', resume);
on('bPHelp', () => openScreen('help', true));
on('bPSettings', () => openScreen('settings', true));
on('bRestart', startDay);
on('bQuit', toTitle);
on('bAgain', startDay);
on('bRWardrobe', () => { state = 'title'; setupTitleScene(); screenStack = ['title']; openScreen('wardrobe'); });
on('bRTitle', toTitle);
on('bResetSave', () => {
  if (!confirm('Erase all treats, unlocks and records?')) return;
  const settings = save.settings;
  Object.assign(save, structuredClone(DEFAULT_SAVE), { settings });
  persist();
  cat.setCoat(save.coat); cat.setHat(save.hat);
  toast('Progress erased.');
});
$('title').addEventListener('click', (e) => {
  if (e.target.closest('.btn')) return;
  sound.init();
  sound.ui();
  startDay();
});
for (const el of document.querySelectorAll('.btn')) el.addEventListener('mouseenter', () => sound.ui('hover'));

function renderWardrobe() {
  $('wTreats').textContent = save.treats;
  const mk = (gridId, table, owned, current, kind) => {
    const grid = $(gridId);
    grid.innerHTML = '';
    for (const [id, d] of Object.entries(table)) {
      const b = document.createElement('button');
      const has = owned.includes(id);
      b.className = `item ${current === id ? 'on' : ''} ${has ? '' : 'locked'}`;
      const sw = kind === 'coat'
        ? `background: radial-gradient(circle at 35% 35%, ${d.light} 0 22%, ${d.base} 23% 60%, ${d.dark} 61%)`
        : `background: ${['#efe1c6', '#e8546b', '#f4d35e', '#b7283b', '#3f8ad8', '#e8c58a', '#e3b23c', '#4b3b8f'][Object.keys(HATS).indexOf(id)]}`;
      b.innerHTML = `<span class="sw" style="${sw}"></span><span>${d.name}</span><span class="price">${current === id ? 'wearing' : has ? '' : d.price + ' treats'}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!has) {
          if (save.treats < d.price) { sound.ui('deny'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
          save.treats -= d.price;
          owned.push(id);
          sound.ui('buy');
        } else sound.ui();
        if (kind === 'coat') { save.coat = id; cat.setCoat(id); } else { save.hat = id; cat.setHat(id); }
        persist();
        renderWardrobe();
        const again = $(gridId).children[Object.keys(table).indexOf(id)];
        if (again) again.focus({ preventScroll: true });
        sound.meow({ kind: 'mrrp', vol: 0.6 });
      });
      b.addEventListener('mouseenter', () => sound.ui('hover'));
      grid.appendChild(b);
    }
  };
  mk('coatGrid', COATS, save.coats, save.coat, 'coat');
  mk('hatGrid', HATS, save.hats, save.hat, 'hat');
}

function syncSettings() {
  const s = save.settings;
  const bind = (id, out, key, fmt = (v) => v) => {
    const el = $(id);
    el.value = s[key];
    if (out) $(out).textContent = fmt(s[key]);
    el.oninput = () => { s[key] = Number(el.value); if (out) $(out).textContent = fmt(s[key]); applySettings(); };
  };
  bind('sMaster', 'oMaster', 'master');
  bind('sMusic', 'oMusic', 'music');
  bind('sSfx', 'oSfx', 'sfx');
  bind('sSens', 'oSens', 'sens', (v) => (v / 100).toFixed(1) + 'x');
  $('sInvert').checked = s.invert;
  $('sInvert').onchange = () => { s.invert = $('sInvert').checked; applySettings(); };
  $('sHints').checked = s.hints;
  $('sHints').onchange = () => { s.hints = $('sHints').checked; applySettings(); };
  $('sDay').value = String(s.day);
  $('sDay').onchange = () => { s.day = Number($('sDay').value); applySettings(); };
  $('sQuality').value = s.quality;
  $('sQuality').onchange = () => { s.quality = $('sQuality').value; applySettings(); applyQuality(); };
}
function applySettings() {
  const s = save.settings;
  sound.vol.master = s.master / 100;
  sound.vol.music = s.music / 100;
  sound.vol.sfx = s.sfx / 100;
  sound.applyVolumes();
  persist();
}

// ---------------------------------------------------------------- title scene animation

function stepTitle(dt) {
  game.time = (game.time || 0) + dt;
  const t = game.time;
  const inWardrobe = screen === 'wardrobe';
  player.mode = inWardrobe ? 'sit' : (Math.sin(t * 0.13) > 0.6 ? 'loaf' : 'sit');
  cat.update(dt, {
    pos: player.pos, yaw: player.yaw, speed: 0, vy: 0, grounded: true, turn: 0, mode: player.mode, charge: 0, sneak: false,
    swatT: -1, meowT: -1, landImpact: 0, lookAt: inWardrobe || Math.sin(t * 0.31) > 0.3 ? camera.position : bird.present ? bird.mesh.position : null,
    sunny: true, groundY: 0, teleport: player.teleport,
  });
  player.teleport = false;
  bird.update(dt, t, sound, camera.position);
  // camera: slow orbit, closer in the wardrobe
  const yaw = inWardrobe ? player.yaw + Math.PI + 0.55 + Math.sin(t * 0.3) * 0.25 : player.yaw + Math.PI - 0.7 + Math.sin(t * 0.07) * 0.5;
  cam.yaw = damp(cam.yaw, yaw, 2, dt);
  cam.pitch = damp(cam.pitch, inWardrobe ? 0.12 : 0.2, 2, dt);
  cam.dist = damp(cam.dist, inWardrobe ? 0.85 : 1.45, 2, dt);
  cam.target.lerp(_v.set(player.pos.x + (inWardrobe ? -0.15 : -0.35), player.pos.y + (inWardrobe ? 0.27 : 0.33), player.pos.z), 1 - Math.exp(-3 * dt));
  placeCamera(dt);
}

// ---------------------------------------------------------------- loop

let last = performance.now();
let simTime = 0;
function step(dt) {
  simTime += dt;
  if (state === 'play') stepPlay(dt);
  else if (state === 'ending') stepEnding(dt);
  else if (state === 'title' || state === 'report') stepTitle(dt);
  else if (state === 'paused') { readInput(); }
  world.updateDust(dt, simTime);
  if (state === 'play' || state === 'ending') hudFrame(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  const raw = now - last;
  last = now;
  adaptQuality(raw);
  if (!MANUAL) {
    let dt = Math.min(0.05, raw / 1000);
    // small fixed substeps keep collisions honest when frames are slow
    const n = Math.ceil(dt / (1 / 60));
    for (let i = 0; i < n; i++) step(dt / n);
  }
  renderer.render(scene, camera);
}

function boot() {
  applyQuality();
  applySettings();
  setupTitleScene();
  stepTitle(0.016);
  state = 'title';
  openScreen('title');
  $('loading').remove();
  fadeIn();
  requestAnimationFrame(frame);
}

if (DEBUG) {
  window.__game = {
    THREE, world, items, cat, player, robot, bird, sound, game, cam, camera, renderer, save, scene, placeCamera,
    render() { renderer.render(scene, camera); },
    get state() { return state; },
    start: startDay,
    step(sec = 1 / 60) { step(sec); renderer.render(scene, camera); },
    sim(seconds, dt = 1 / 30, input = null) {
      const n = Math.round(seconds / dt);
      for (let i = 0; i < n; i++) {
        if (input) { for (const k of input.hold || []) keys.add(k); if (i === 0) for (const k of input.press || []) pressed.add(k); }
        step(dt);
      }
      if (input) for (const k of input.hold || []) keys.delete(k);
      renderer.render(scene, camera);
    },
    keys, pressed, setDayT(t) { game.dayT = t; world.setTime(t); }, complete, onItemLand,
  };
}

boot();
