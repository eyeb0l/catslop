import * as T from 'three';
import { sculptCat, torus, glow } from './sculpt.js';
import { BOUNDS, HOME, START, KITTENS, SOCKS, createLaundrette, softShadow, makeSock, makeVacuum } from './laundrette.js';
import { LaundretteAudio } from './sound.js';

const $ = (id) => document.getElementById(id);
const clamp = T.MathUtils.clamp;
const damp = T.MathUtils.damp;
const tau = Math.PI * 2;
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const portraitShape = 'M3 12 2 3q0-1 1-.6l6 5q3-.8 6 0l6-5q1-.4 1 .6l-1 9q2 3 .4 6-2 3-9.4 3t-9.4-3Q1 15 3 12Z';
const storageKey = 'lint-and-whiskers/v1';
const read = key => {
  try { return JSON.parse(localStorage.getItem(storageKey + key)); }
  catch { return null; }
};
const write = (key, value) => {
  try { localStorage.setItem(storageKey + key, JSON.stringify(value)); }
  catch { /* play still works with browser storage disabled */ }
};

const options = new URLSearchParams(location.search);
const debug = options.has('debug');
const manual = debug && options.has('manual');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
const canvas = renderer.domElement;
canvas.tabIndex = -1;
canvas.setAttribute('aria-label', '3D laundrette. Use WASD or arrow keys to move, Space to jump, Shift to prowl, and F to meow.');
$('view').append(canvas);
const scene = new T.Scene();
scene.background = new T.Color('#1a3240');
scene.add(new T.HemisphereLight('#fff1cf', '#8b989e', 1.8));
const day = new T.DirectionalLight('#ffe1af', 2.14);
day.position.set(-4, 11, 5);
day.target.position.set(0, 0, -1);
day.castShadow = true;
Object.assign(day.shadow.camera, { left: -12, right: 12, top: 11, bottom: -11, near: .3, far: 30 });
day.shadow.camera.updateProjectionMatrix();
day.shadow.mapSize.set(1024, 1024);
day.shadow.normalBias = .024;
day.shadow.bias = -.0002;
day.shadow.radius = 2.4;
scene.add(day, day.target);
const moon = new T.DirectionalLight('#a2c9e6', 1.22);
moon.position.set(5, 5, -8);
scene.add(moon);

const world = createLaundrette(scene);
const adult = sculptCat(scene, { coat: '#cd8050', shade: '#945347', bib: '#ffe7bd', ear: '#dc9b8c', iris: '#b9cc82' });
const player = { ...START, y: 0, vx: 0, vz: 0, vy: 0, onGround: true, coyote: 0, jumpBuffer: 0, stride: 0, squash: 0, talk: 0, crouch: 0, stunned: 0 };
const playerShadow = softShadow(scene, 1.24, 2.04);
const kittens = KITTENS.map((spec, i) => {
  const cat = sculptCat(scene, { ...spec, scale: spec.size });
  const icon = document.createElement('div');
  icon.className = 'portrait';
  icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${portraitShape}" fill="${spec.coat}" stroke="${spec.shade}" stroke-width="1.2"/><ellipse cx="12" cy="16.5" rx="5.6" ry="3.7" fill="${spec.bib}"/><path d="M7.8 13v1m8.4-1v1m-5.2 2 1 1 1-1" stroke="#344242" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${spec.name}</span>`;
  $('portraits').append(icon);
  return { ...spec, cat, i, icon, shadow: softShadow(scene, .65, .98), status: 'lost', response: 0, talk: 0, stride: 0, speed: 0, homeAge: 0 };
});
const socks = SOCKS.map(spec => ({ ...spec, ...makeSock(scene, spec), found: false }));
const vacuum = { ...makeVacuum(scene), x: 0, z: 0, face: 0, targetX: 0, targetZ: 0, state: 'patrolling', alert: 0, phase: 0, cooldown: 0 };
const pulse = torus(scene, glow('#fce5a8'), 0, .06, 0, 1, .016, 64);
pulse.material.transparent = true;
pulse.material.depthWrite = false;
pulse.rotation.x = -Math.PI / 2;
pulse.visible = false;
const motes = Array.from({ length: 24 }, () => {
  const m = torus(scene, glow('#ffdf98'), 0, 0, 0, .034, .009, 6);
  m.visible = false;
  return { m, life: 0 };
});
const camera = new T.OrthographicCamera(-10, 10, 6, -6, .1, 75);
const focal = new T.Vector3();
const aimedAt = new T.Vector3();
const eye = new T.Vector3(.46, .66, .888).normalize().multiplyScalar(30);
const horizontal = new T.Vector3(.888, 0, -.46);
const upfield = new T.Vector3(-.46, 0, -.888);
const v = new T.Vector3();
const sight = new T.Ray(new T.Vector3(), eye.clone().normalize());
const sightObstacles = world.solid.map(s => new T.Box3(
  new T.Vector3(s.x - s.w / 2, s.bottom, s.z - s.d / 2),
  new T.Vector3(s.x + s.w / 2, s.top, s.z + s.d / 2),
));
const marker = (text, kind = '') => {
  const e = document.createElement('div');
  e.className = `marker ${kind}`;
  e.innerHTML = '<span></span>';
  e.firstElementChild.textContent = text;
  e.hidden = true;
  $('markers').append(e);
  return e;
};
const tags = kittens.map(k => marker(k.name));
const homeTag = marker('Warm basket', 'home');
const vacuumTag = marker('!', 'vacuum');
const meowTag = marker('mrrrow!', 'speech');
const playerTag = marker('You', 'home');
let mode = 'title';
let elapsed = 0;
let finishedAt = 0;
let simTime = 0;
let artTime = 0;
let frameTime = 0;
let scale = 0;
let renderScale = 1;
let performanceFrames = 0;
let performanceSeconds = 0;
let height = 0;
let width = 0;
let titleAspect = 1;
let cooldown = 0;
let ringAge = 1;
let noticeUntil = 0;
let touchedVacuum = false;
let idle = 0;
let lastHint = '';
let endingWait = 0;
let touchX = 0, touchY = 0, touchProwl = false;
let trail = [];
let trailBudget = 0;
let remainder = 0;
const keys = new Set();
const audio = new LaundretteAudio(read('/muted') === true);
const STEP = 1 / 120;
const MAX_Y = 6;
const PLAYER_R = .27;
const R_BODY = .78;
const movement = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
const down = (...codes) => codes.some(c => keys.has(c));

function changeMode(next) {
  mode = next;
  document.body.dataset.mode = mode;
  $('pause-panel').hidden = mode !== 'paused';
  $('ending').hidden = mode !== 'ended';
  keys.clear();
  dropStick();
  if (mode === 'paused') $('resume').focus({ preventScroll: true });
  else if (mode === 'ended') $('continue').focus({ preventScroll: true });
  else if (mode === 'playing') canvas.focus({ preventScroll: true });
  if (manual && mode !== 'title') draw(0);
}
function save() {
  write('/rescue', {
    home: kittens.filter(k => k.status === 'home').map(k => k.name),
    socks: socks.map(s => s.found),
    elapsed,
    finishedAt,
  });
}
function refreshTicket() {
  $('kitten-count').textContent = `${kittens.filter(k => k.status === 'home').length} / 3`;
  $('sock-count').textContent = `${socks.filter(s => s.found).length} / 6`;
  for (const k of kittens) {
    k.icon.dataset.status = k.status;
    k.icon.title = `${k.name} ${k.status === 'home' ? 'is home' : k.status === 'following' ? 'is following' : 'is still out'}`;
  }
  if (socks.every(s => s.found)) adult.reward();
  else adult.removeReward();
}
function reset(progress = null) {
  Object.assign(player, START, { y: 0, vx: 0, vz: 0, vy: 0, stride: 0, talk: 0, squash: 0, stunned: 0, onGround: true, crouch: 0, coyote: 0, jumpBuffer: 0 });
  elapsed = Number.isFinite(progress?.elapsed) ? progress.elapsed : 0;
  finishedAt = Number.isFinite(progress?.finishedAt) ? progress.finishedAt : 0;
  for (const k of kittens) {
    Object.assign(k, KITTENS[k.i], { status: progress?.home?.includes(k.name) ? 'home' : 'lost', response: 0, talk: 0, stride: 0, speed: 0, homeAge: 2 });
    if (k.status === 'home') Object.assign(k, homeSpot(k.i));
  }
  socks.forEach((s, i) => { s.found = Boolean(progress?.socks?.[i]); s.g.visible = !s.found; });
  Object.assign(vacuum, { x: 4.67, z: .22, face: Math.PI / 2, alert: 0, state: 'patrolling', cooldown: 0, phase: -Math.PI / 2 });
  trail = [];
  trailBudget = 0;
  endingWait = 0;
  ringAge = 1;
  cooldown = 0;
  touchedVacuum = false;
  idle = 0;
  remainder = 0;
  noticeUntil = 0;
  lastHint = '';
  $('notice').textContent = '';
  touchProwl = false;
  $('sneak-touch').setAttribute('aria-pressed', 'false');
  for (const mote of motes) mote.life = 0;
  refreshTicket();
}

function updateMute() {
  $('mute').setAttribute('aria-pressed', audio.muted);
  $('mute').setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
}
function toggleMute() {
  audio.open();
  audio.setMuted(!audio.muted);
  updateMute();
  write('/muted', audio.muted);
}
function resume() {
  audio.open();
  changeMode('playing');
}
function start() {
  if (mode !== 'title') return;
  reset(read('/rescue'));
  resume();
  audio.cue('start');
}
function togglePause() {
  if (mode === 'paused') resume();
  else if (mode === 'playing') {
    save();
    changeMode('paused');
  }
}
function restart() {
  reset();
  save();
  resume();
  audio.cue('start');
}
function notify(text, time = 3.5) {
  $('notice').textContent = text;
  noticeUntil = simTime + time;
}
function celebration(x, y, z, n, color) {
  for (let i = 0; i < n; i++) {
    const p = motes.find(m => m.life <= 0);
    if (!p) return;
    const phase = i * 2.399 + simTime;
    p.life = .55 + (i % 4) * .12;
    p.m.position.set(x, y, z);
    p.m.material.color.set(color);
    p.dx = Math.cos(phase) * (.29 + .28 * (i % 3));
    p.dz = Math.sin(phase) * (.29 + .28 * (i % 3));
    p.dy = .81 + (i % 4) * .25;
  }
}

function canHear(k) {
  return distance(player, k) < 1.74 && Math.abs(player.y - k.y) < .59;
}
function isProwling() {
  return down('ShiftLeft', 'ShiftRight') || touchProwl;
}
function meow() {
  if (mode !== 'playing' || cooldown > 0) return;
  audio.open();
  cooldown = .76;
  ringAge = 0;
  pulse.position.set(player.x, player.y + .065, player.z);
  player.talk = .46;
  audio.meow();
  const lost = kittens.filter(k => k.status === 'lost');
  let joined = false;
  for (const k of lost) {
    if (!canHear(k)) continue;
    k.response = .22 + k.i * .09;
    if (k.i === 2 && !isProwling()) {
      notify('Moth is frightened. Prowl and meow softly.');
      continue;
    }
    k.status = 'following';
    k.joined = simTime;
    k.followDelay = .66 + kittens.filter(o => o.status === 'following').length * .25;
    joined = true;
    notify(`${k.name} is following. Lead them to the basket.`);
    celebration(k.x, k.y + .4, k.z, 10, '#fce0a6');
    audio.cue('follow');
  }
  if (joined) refreshTicket();
  if (!joined) {
    const near = lost.filter(k => distance(player, k) < 4.0 && Math.abs(player.y - k.y) < 2.3).sort((a, b) => distance(player, a) - distance(player, b))[0];
    if (near) near.response ||= .29;
  }
  if (!isProwling() && player.y < .4 && distance(vacuum, player) < 3.6 && vacuum.cooldown <= 0) {
    vacuum.state = 'curious';
    vacuum.alert = 1.62;
    vacuum.targetX = player.x;
    vacuum.targetZ = player.z;
  }
}
function jump() {
  if (mode === 'playing') player.jumpBuffer = .14;
}

const rectHits = (s, x, z, r) => {
  const dx = Math.max(Math.abs(x - s.x) - s.w * .5, 0);
  const dz = Math.max(Math.abs(z - s.z) - s.d * .5, 0);
  return dx * dx + dz * dz < r * r;
};
function blocked(x, y, z, r, tall) {
  return world.solid.some(s => y < s.top - .019 && y + tall > s.bottom + .015 && rectHits(s, x, z, r));
}
function floorAt(x, z, y, r = .14) {
  let best = 0;
  for (const s of world.solid) {
    if (s.top <= y + .046 && s.top > best && rectHits(s, x, z, r)) best = s.top;
  }
  return best;
}
function brushesKitten(x, y, z) {
  return kittens.some(k => k.status === 'lost' && Math.abs(k.y - y) < .45
    && Math.hypot(k.x - x, k.z - z) < Math.min(.49, distance(player, k)));
}
function moveCat(dt) {
  const sneaking = isProwling();
  const sx = clamp(+down('KeyD', 'ArrowRight') - +down('KeyA', 'ArrowLeft') + touchX, -1, 1);
  const sy = clamp(+down('KeyW', 'ArrowUp') - +down('KeyS', 'ArrowDown') - touchY, -1, 1);
  const norm = Math.max(1, Math.hypot(sx, sy));
  const speed = sneaking ? 1.77 : 4.40;
  const inputX = (sx * horizontal.x + sy * upfield.x) * speed / norm;
  const inputZ = (sx * horizontal.z + sy * upfield.z) * speed / norm;
  player.stunned = Math.max(0, player.stunned - dt);
  player.crouch = damp(player.crouch, sneaking ? 1 : 0, 16, dt);
  if (player.stunned === 0) {
    const traction = player.onGround ? (sx || sy ? 15 : 22) : 10;
    player.vx = damp(player.vx, inputX, traction, dt);
    player.vz = damp(player.vz, inputZ, traction, dt);
  } else {
    player.vx *= Math.exp(-4 * dt);
    player.vz *= Math.exp(-4 * dt);
  }
  if (Math.abs(inputX) + Math.abs(inputZ) > .1) {
    player.yaw += angleDelta(player.yaw, Math.atan2(inputX, inputZ)) * (1 - Math.exp(-16 * dt));
  }
  player.coyote = player.onGround ? .095 : Math.max(0, player.coyote - dt);
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = sneaking ? 5.50 : 6.45;
    player.coyote = 0;
    player.onGround = false;
    player.jumpBuffer = 0;
    audio.cue('jump');
  }
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  const newX = clamp(player.x + player.vx * dt, -BOUNDS.x, BOUNDS.x);
  const newZ = clamp(player.z + player.vz * dt, -BOUNDS.z, BOUNDS.z);
  const lastX = player.x, lastZ = player.z;
  const tall = R_BODY - player.crouch * .21;
  if (!blocked(newX, player.y, player.z, PLAYER_R, tall) && !brushesKitten(newX, player.y, player.z)) player.x = newX;
  else player.vx = 0;
  if (!blocked(player.x, player.y, newZ, PLAYER_R, tall) && !brushesKitten(player.x, player.y, newZ)) player.z = newZ;
  else player.vz = 0;

  const ground = floorAt(player.x, player.z, player.y);
  if (player.vy <= 0 && player.y <= ground + .002) {
    player.vy = 0;
    player.onGround = true;
    player.y = ground;
  } else {
    player.vy -= 15.8 * dt;
    let y = clamp(player.y + player.vy * dt, 0, MAX_Y);
    if (player.vy > 0) {
      for (const s of world.solid) {
        if (s.bottom > 0 && y + tall > s.bottom && player.y + tall <= s.bottom && rectHits(s, player.x, player.z, PLAYER_R)) {
          y = s.bottom - tall;
          player.vy = 0;
        }
      }
    }
    if (player.vy <= 0 && y <= ground) {
      if (player.vy < -2.4) {
        player.squash = Math.min(.92, -player.vy * .11);
        audio.cue('land');
      }
      y = ground;
      player.vy = 0;
      player.onGround = true;
    } else player.onGround = false;
    player.y = y;
  }
  const travel = Math.hypot(player.x - lastX, player.z - lastZ);
  player.speed = travel / dt;
  idle = player.speed < .12 && player.onGround && !player.talk ? idle + dt : 0;
  if (player.onGround && travel > .0003) {
    const foot = Math.floor(player.stride * 2);
    player.stride += travel / (sneaking ? .86 : 1.17);
    if (Math.floor(player.stride * 2) !== foot && !sneaking) audio.cue('paw');
  }
  player.squash = damp(player.squash, 0, 10, dt);
  player.talk = Math.max(0, player.talk - dt);
  trailBudget -= dt;
  if (trailBudget <= 0) {
    trailBudget += .034;
    trail.push({ x: player.x, y: player.y, z: player.z, yaw: player.yaw, at: simTime });
    if (trail.length > 110) trail.shift();
  }
}

function homeSpot(i) {
  return { x: HOME.x + [-.58, .08, .65][i], z: HOME.z + [-.17, .13, -.11][i], y: .55, yaw: [.68, 1.14, -.39][i] };
}
function kittenUpdate(dt) {
  for (const k of kittens) {
    k.talk = Math.max(0, k.talk - dt);
    if (k.response > 0) {
      k.response -= dt;
      if (k.response <= 0) {
        k.talk = .54;
        audio.meow(k.i);
      }
    }
    if (k.status === 'following') {
      const targetTime = Math.max(k.joined, simTime - k.followDelay);
      const target = trail.find(t => t.at >= targetTime) || player;
      const gap = distance(k, target);
      const distanceKept = targetTime === k.joined ? .26 : .66;
      let move = 0;
      if (gap > distanceKept) {
        move = Math.min(gap - distanceKept, dt * Math.min(5.45, 2.1 + gap * 2.6));
        k.x += (target.x - k.x) * move / gap;
        k.z += (target.z - k.z) * move / gap;
      }
      if (move > .001) {
        k.yaw += angleDelta(k.yaw, Math.atan2(target.x - k.x, target.z - k.z)) * (1 - Math.exp(-14 * dt));
      }
      k.y = damp(k.y, target.y, 12, dt);
      k.speed = damp(k.speed, move / dt, 15, dt);
      k.stride += move * 1.3;
      if (distance(k, HOME) < 2.4 && distance(player, HOME) < 1.87 && player.y < .85) {
        k.status = 'home';
        k.arrival = { x: k.x, y: k.y, z: k.z };
        k.homeAge = 0;
        k.talk = .45;
        audio.cue('home');
        notify(`${k.name} is tucked in.`);
        celebration(HOME.x, .75, HOME.z, 12, '#f8ce88');
        refreshTicket();
        if (kittens.every(m => m.status === 'home')) {
          finishedAt = elapsed;
          endingWait = 2.1;
        }
        save();
      }
    } else if (k.status === 'home') {
      k.homeAge += dt;
      const target = homeSpot(k.i);
      const progress = clamp(k.homeAge / .57, 0, 1);
      if (progress < 1 && k.arrival) {
        const t = progress * (2 - progress);
        k.x = T.MathUtils.lerp(k.arrival.x, target.x, t);
        k.z = T.MathUtils.lerp(k.arrival.z, target.z, t);
        k.y = T.MathUtils.lerp(k.arrival.y, target.y, t) + Math.sin(progress * Math.PI) * .66;
        k.yaw += angleDelta(k.yaw, target.yaw) * (1 - Math.exp(-8 * dt));
      } else Object.assign(k, target);
    } else if (distance(k, player) < 3.8 && Math.abs(k.y - player.y) < 1.8) {
      const angle = Math.atan2(player.x - k.x, player.z - k.z);
      k.yaw += angleDelta(k.yaw, angle) * (1 - Math.exp(-5 * dt));
    }
  }
  if (endingWait > 0) {
    endingWait -= dt;
    if (endingWait <= 0) {
      $('end-time').textContent = timeLabel(finishedAt);
      $('end-socks').textContent = `${socks.filter(s => s.found).length} / 6`;
      audio.cue('end');
      changeMode('ended');
    }
  }
}
function timeLabel(seconds) {
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function vacuumUpdate(dt) {
  const v = vacuum;
  v.cooldown = Math.max(0, v.cooldown - dt);
  const playerDistance = distance(v, player);
  const aim = Math.atan2(player.x - v.x, player.z - v.z);
  const vision = playerDistance < 2.47 && Math.abs(angleDelta(v.face, aim)) < .76 && !isProwling() && player.y < .42;
  if (vision && v.cooldown <= 0) {
    v.state = 'chasing';
    v.alert = 1.58;
    v.targetX = player.x;
    v.targetZ = player.z;
  } else {
    v.alert -= dt;
    if (v.alert <= 0) v.state = 'patrolling';
    if (v.state === 'chasing' && isProwling()) v.alert = Math.min(v.alert, .28);
  }
  const patrolX = 4.67 + Math.cos(v.phase) * 1.5;
  const patrolZ = 2.22 + Math.sin(v.phase) * 2;
  if (v.state === 'patrolling' && Math.hypot(v.x - patrolX, v.z - patrolZ) < .27) v.phase += dt * .73;
  const tx = v.state === 'patrolling' ? patrolX : clamp(v.targetX, 1.34, 6.26);
  const tz = v.state === 'patrolling' ? patrolZ : clamp(v.targetZ, -.38, 5.10);
  const targetGap = Math.hypot(tx - v.x, tz - v.z);
  if (targetGap > .03) {
    const desired = Math.atan2(tx - v.x, tz - v.z);
    v.face += angleDelta(v.face, desired) * (1 - Math.exp(-12 * dt));
    const step = Math.min(targetGap, dt * (v.state === 'chasing' ? 2.65 : v.state === 'curious' ? 1.8 : 1.61));
    const nx = v.x + (tx - v.x) / targetGap * step;
    const nz = v.z + (tz - v.z) / targetGap * step;
    if (!blocked(nx, .02, v.z, .425, .30)) v.x = nx;
    if (!blocked(v.x, .02, nz, .425, .30)) v.z = nz;
    // Near furniture, drop the pursuit and roll on to the next patrol point.
    if (v.state === 'patrolling' && blocked(nx, .02, nz, .425, .30)) v.phase += dt * 2.45;
  }
  if (playerDistance < .62 && player.y < .28 && v.cooldown === 0) {
    const nudge = Math.atan2(player.x - v.x, player.z - v.z);
    player.vx = Math.sin(nudge) * 4.42;
    player.vz = Math.cos(nudge) * 4.42;
    player.stunned = .35;
    player.vy = 2.45;
    player.onGround = false;
    player.coyote = 0;
    v.cooldown = 1.40;
    v.alert = 0;
    v.state = 'patrolling';
    audio.cue('bump');
    if (!touchedVacuum) {
      notify('Boop! Prowl to slip past the vacuum.');
      touchedVacuum = true;
    }
  }
}

function collectSocks() {
  for (const s of socks) {
    if (s.found || Math.abs(player.y - s.y) >= .52 || distance(player, s) >= .57) continue;
    s.found = true;
    s.g.visible = false;
    audio.cue('sock');
    celebration(s.x, s.y + .46, s.z, 7, '#ffe1a1');
    if (socks.every(o => o.found)) {
      audio.cue('reward');
      notify('All six socks! The laundrette’s golden bell is yours.', 5.2);
    } else notify('A lost sock!', 1.26);
    refreshTicket();
    save();
  }
}
function update(dt) {
  simTime += dt;
  if (finishedAt === 0) elapsed += dt;
  cooldown = Math.max(0, cooldown - dt);
  ringAge += dt;
  moveCat(dt);
  vacuumUpdate(dt);
  kittenUpdate(dt);
  collectSocks();
  if (noticeUntil > 0 && simTime >= noticeUntil) {
    noticeUntil = 0;
    $('notice').textContent = '';
  }
  for (const p of motes) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.m.position.x += p.dx * dt;
    p.m.position.y += p.dy * dt;
    p.m.position.z += p.dz * dt;
  }
}

function placeTag(element, x, y, z, visible) {
  if (!visible) { element.hidden = true; return; }
  v.set(x, y, z).project(camera);
  const off = Math.abs(v.x) > .94 || Math.abs(v.y) > .91;
  const sx = clamp((v.x * .5 + .5) * width, 29, width - 29);
  const sy = clamp((-.5 * v.y + .5) * height, 61, height - 64);
  element.style.left = `${sx}px`;
  element.style.top = `${sy}px`;
  element.style.opacity = off ? '.83' : '1';
  element.hidden = false;
}
function updateGuidance() {
  if (mode !== 'playing') return;
  const followers = kittens.filter(k => k.status === 'following');
  const lost = kittens.filter(k => k.status === 'lost');
  const next = lost[0];
  const near = lost.find(k => canHear(k));
  const touch = matchMedia('(pointer: coarse)').matches;
  const meowKey = touch ? 'Meow' : 'F';
  let hint = '';
  if (near) {
    hint = near.i === 2 && !isProwling()
      ? (touch ? 'Tap <strong>Prowl</strong>, then meow to Moth.' : 'Hold <strong>Shift</strong> and meow to Moth.')
      : `<strong>${meowKey}</strong> · Call ${near.name}`;
  } else if (followers.length) {
    hint = `Lead ${followers.length === 1 ? followers[0].name : 'the kittens'} to the <strong>warm basket</strong>.`;
  } else if (!next) {
    hint = socks.some(s => !s.found) ? 'Everyone’s home. Look for the remaining <strong>lost socks</strong>.' : 'Everyone’s home. That’s a wrap for tonight.';
  } else if (next.i === 0) {
    hint = 'Find <strong>Bobbin</strong> under the folding table. Get close and meow.';
  } else if (next.i === 1) {
    hint = `<strong>${touch ? 'Jump' : 'Space'}</strong> · Follow the little steps up to Pip.`;
  } else if (next.i === 2) {
    hint = `<strong>${touch ? 'Prowl' : 'Shift'}</strong> · Prowl past the vacuum to reach Moth.`;
  }
  if (hint !== lastHint) {
    $('hint').innerHTML = hint;
    lastHint = hint;
  }
  kittens.forEach((k, i) => {
    const talking = k.talk > .07 && k.status !== 'home';
    const label = talking ? k.line : k.name;
    if (tags[i].firstElementChild.textContent !== label) tags[i].firstElementChild.textContent = label;
    const focus = near || (followers.length ? null : next);
    const close = !near && !followers.length && distance(player, k) < 3.1;
    placeTag(tags[i], k.x, k.y + .99, k.z, talking || (k.status === 'lost' && (k === focus || close)));
  });
  placeTag(homeTag, HOME.x, 1.36, HOME.z, followers.length > 0);
  placeTag(vacuumTag, vacuum.x, .72, vacuum.z, vacuum.state !== 'patrolling');
  placeTag(meowTag, player.x, player.y + 1.52, player.z, player.talk > .15);
  sight.origin.set(player.x, player.y + .82 - player.crouch * .14, player.z);
  const obscured = sightObstacles.some(s => sight.intersectsBox(s));
  placeTag(playerTag, player.x, player.y + 1.45, player.z, obscured && player.talk <= .15);
}

function cameraUpdate(dt, titleShot) {
  const aspect = width / height;
  const portrait = aspect < 1;
  let targetScale;
  if (titleShot) {
    const slide = portrait ? .18 : clamp((aspect - 1) * 4.25, .65, 4.1);
    aimedAt.set(5.63 - horizontal.x * slide, portrait ? 2.76 : 2.37, -2.30 - horizontal.z * slide);
    targetScale = portrait ? 9.15 : 6.55;
  } else if (mode === 'ended') {
    const slide = portrait ? 0 : Math.min(3.6, aspect * 1.75);
    aimedAt.set(HOME.x - horizontal.x * slide, portrait ? 1.85 : .72, HOME.z - horizontal.z * slide);
    targetScale = portrait ? 7.1 : 5.9;
  } else {
    const follow = portrait ? .92 : .64;
    aimedAt.set(player.x * follow, 1.05 + player.y * .48, player.z * follow + (portrait ? .63 : 0));
    targetScale = portrait ? 9.95 : Math.max(9.9, 13.9 / aspect);
  }
  if (scale === 0 || dt === 0 || reduced) {
    scale = targetScale;
    focal.copy(aimedAt);
  } else {
    scale = damp(scale, targetScale, 4.9, dt);
    focal.lerp(aimedAt, 1 - Math.exp(-6.9 * dt));
  }
  camera.left = -scale * aspect / 2;
  camera.right = -camera.left;
  camera.top = scale / 2;
  camera.bottom = -camera.top;
  camera.updateProjectionMatrix();
  camera.position.copy(focal).add(eye);
  camera.lookAt(focal);
  camera.updateMatrixWorld();
}
function renderActors(isTitle) {
  const titleCat = { x: 5.61, y: 1.86, z: -2.21, yaw: .58 };
  const titleKittens = [
    { x: 4.95, y: 1.86, z: -2.06, yaw: .40 },
    { x: 6.23, y: 1.86, z: -2.18, yaw: .72 },
    { x: 3.82, y: 1.26, z: -1.98, yaw: .63 },
  ];
  const endCat = { x: HOME.x + .54, y: 0, z: HOME.z + 1.14, yaw: .74 };
  const resting = mode === 'ended';
  const p = isTitle ? titleCat : resting ? endCat : player;
  adult.root.position.set(p.x, p.y, p.z);
  adult.root.rotation.y = p.yaw;
  adult.root.scale.setScalar(isTitle ? 1.13 : 1);
  adult.pose({
    time: artTime, speed: isTitle ? 0 : player.speed, stride: player.stride,
    airborne: !isTitle && !resting && !player.onGround, vertical: player.vy, sneaking: isTitle || resting ? 0 : player.crouch,
    squash: player.squash, talk: player.talk > 0 ? Math.sin(player.talk / .46 * Math.PI) : 0,
    rest: resting ? .86 : !isTitle && distance(player, HOME) < 1.95 ? clamp((idle - 5.1) / .72, 0, .74) : 0,
  });
  actorShadow(playerShadow, p);
  for (const k of kittens) {
    const q = isTitle ? titleKittens[k.i] : k;
    k.cat.root.position.set(q.x, q.y, q.z);
    k.cat.root.rotation.y = q.yaw;
    k.cat.pose({
      time: artTime + k.i * .7, speed: k.status === 'following' ? k.speed : 0, stride: k.stride,
      airborne: k.status === 'following' && k.y - floorAt(k.x, k.z, k.y, .08) > .17,
      talk: k.talk > 0 ? Math.sin(Math.min(1, k.talk / .54) * Math.PI) : 0,
      rest: !isTitle && k.status === 'home' ? clamp((k.homeAge - .68) / .72, 0, 1) : 0,
    });
    actorShadow(k.shadow, q);
  }
  for (const [i, s] of socks.entries()) {
    s.g.visible = !isTitle && !s.found;
    if (!s.g.visible) continue;
    s.body.position.y = .066 * Math.sin(2.8 * artTime + i);
    s.body.rotation.y = artTime * .91 + i * 2.2;
    s.circle.material.opacity = .45 + .31 * Math.sin(artTime * 3 + i);
  }
  vacuum.g.visible = vacuum.shadow.visible = !isTitle;
  vacuum.g.position.set(vacuum.x, 0, vacuum.z);
  vacuum.g.rotation.y = vacuum.face;
  vacuum.shadow.position.set(vacuum.x, .025, vacuum.z);
  vacuum.brush.rotation.y = artTime * 8.2;
  vacuum.sensor.material.color.set(vacuum.state === 'patrolling' ? '#b6e9b4' : '#ffa466');
  vacuum.vision.material.opacity = vacuum.state === 'patrolling' ? .10 : .24;
  pulse.visible = ringAge < .58 && !isTitle;
  if (pulse.visible) {
    pulse.scale.setScalar(.26 + ringAge * 3.25);
    pulse.material.opacity = .72 * (1 - ringAge / .58);
  }
  world.homeRing.visible = !isTitle && kittens.some(k => k.status === 'following');
  world.homeRing.material.opacity = .53 + .22 * Math.sin(artTime * 4.6);
  for (const p of motes) {
    p.m.visible = p.life > 0;
    if (p.m.visible) {
      p.m.rotation.x = artTime * 6;
      p.m.rotation.y = artTime * 4;
      p.m.scale.setScalar(Math.min(1, p.life * 3));
    }
  }
}
function actorShadow(shadow, actor) {
  const floor = floorAt(actor.x, actor.z, actor.y, .08);
  const y = actor.status === 'home' && actor.homeAge > .90 ? actor.y : floor;
  shadow.position.set(actor.x, y + .017, actor.z);
  shadow.rotation.z = -actor.yaw;
  const gap = Math.max(0, actor.y - y);
  shadow.material.opacity = .9 / (1 + gap * 1.8);
  shadow.scale.setScalar(1 + gap * .26);
}

function draw(dt) {
  const titleShot = mode === 'title';
  if (mode !== 'paused') artTime += dt;
  world.animate(mode !== 'paused' ? dt : 0);
  cameraUpdate(dt, titleShot);
  renderActors(titleShot);
  updateGuidance();
  renderer.render(scene, camera);
  const purr = mode === 'ended' ? .85 : mode === 'playing' && kittens.some(k => k.status === 'home') ? Math.max(0, 1 - distance(player, HOME) / 2.55) : 0;
  audio.tick(mode === 'playing', vacuum.state === 'chasing' ? .66 : 0, Math.max(0, 1 - distance(player, vacuum) / 6), finishedAt > 0, purr);
}
function resize() {
  width = Math.max(1, innerWidth);
  height = Math.max(1, innerHeight);
  const aspect = width / height;
  if (Math.abs(aspect - titleAspect) > .3) scale = 0;
  titleAspect = aspect;
  const pixelBudget = Math.min(1.65, devicePixelRatio || 1, Math.sqrt(2350000 / (width * height)));
  renderer.setPixelRatio(pixelBudget * renderScale);
  renderer.setSize(width, height, false);
  if (manual) draw(0);
}
function advance(dt) {
  if (mode !== 'playing') return;
  remainder += dt;
  while (remainder >= STEP && mode === 'playing') {
    update(STEP);
    remainder -= STEP;
  }
}
function loop(ms) {
  requestAnimationFrame(loop);
  const real = frameTime ? (ms - frameTime) / 1000 : 0;
  frameTime = ms;
  const dt = Math.min(.15, real);
  advance(dt);
  draw(dt);
  if (document.hidden || real > 1 || real <= 0) return;
  performanceFrames++;
  performanceSeconds += real;
  if (performanceSeconds >= 2.5) {
    const fps = performanceFrames / performanceSeconds;
    if (fps < 37 && renderScale > .66) {
      renderScale = Math.max(.66, renderScale - .12);
      resize();
    }
    performanceFrames = 0;
    performanceSeconds = 0;
  }
}

const setStick = (e) => {
  const r = $('stick').getBoundingClientRect();
  const x = e.clientX - r.left - r.width / 2;
  const y = e.clientY - r.top - r.height / 2;
  const max = r.width * .32;
  const mag = Math.max(max, Math.hypot(x, y));
  touchX = x / mag;
  touchY = y / mag;
  $('knob').style.transform = `translate(${touchX * max}px, ${touchY * max}px)`;
};
let stickId = null;
function dropStick() {
  const pointer = stickId;
  stickId = null;
  if (pointer !== null && $('stick').hasPointerCapture(pointer)) $('stick').releasePointerCapture(pointer);
  touchX = touchY = 0;
  $('knob').style.transform = '';
}
$('stick').addEventListener('pointerdown', e => {
  if (stickId !== null) return;
  stickId = e.pointerId;
  $('stick').setPointerCapture(stickId);
  setStick(e);
});
$('stick').addEventListener('pointermove', e => { if (stickId === e.pointerId) setStick(e); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  $('stick').addEventListener(event, e => { if (stickId === e.pointerId) dropStick(); });
}
$('sneak-touch').addEventListener('click', () => {
  touchProwl = !touchProwl;
  $('sneak-touch').setAttribute('aria-pressed', touchProwl);
});
$('jump-touch').addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
$('meow-touch').addEventListener('pointerdown', e => { e.preventDefault(); meow(); });
$('jump-touch').addEventListener('click', e => { if (e.detail === 0) jump(); });
$('meow-touch').addEventListener('click', e => { if (e.detail === 0) meow(); });
$('splash').addEventListener('click', start);
canvas.addEventListener('pointerdown', e => { if (e.button === 0) meow(); });
$('mute').addEventListener('click', e => {
  toggleMute();
  if (mode === 'playing' && e.detail > 0) canvas.focus({ preventScroll: true });
});
$('pause').addEventListener('click', togglePause);
$('resume').addEventListener('click', resume);
$('restart').addEventListener('click', restart);
$('continue').addEventListener('click', resume);
$('replay').addEventListener('click', restart);
window.addEventListener('keydown', e => {
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (movement.includes(e.code)) {
    if (mode === 'playing') {
      e.preventDefault();
      keys.add(e.code);
    }
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape') {
    e.preventDefault();
    if (mode === 'ended') resume();
    else togglePause();
  }
  if (e.code === 'Enter' && mode === 'title' && document.activeElement !== $('mute')) {
    e.preventDefault();
    start();
  }
  if (mode === 'playing' && e.code === 'KeyF') meow();
  if (mode === 'playing' && e.code === 'Space' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    jump();
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); dropStick(); });
window.addEventListener('pagehide', () => { if (mode !== 'title') save(); });
window.addEventListener('resize', resize);

updateMute();
reset(read('/rescue'));
if (kittens.every(k => k.status === 'home')) $('start').firstChild.textContent = 'Back to the laundrette ';
resize();
if (debug) {
  window.__laundrette = {
    state: () => ({
      mode, elapsed, finishedAt, player: { ...player }, kittens: kittens.map(({ name, status, x, y, z }) => ({ name, status, x, y, z })),
      socks: socks.map(({ x, y, z, found }) => ({ x, y, z, found })),
      vacuum: { x: vacuum.x, z: vacuum.z, state: vacuum.state },
      muted: audio.muted, audio: audio.context?.state, calls: renderer.info.render.calls,
    }),
    step: manual ? (seconds, render = true) => {
      advance(clamp(seconds, 0, 6));
      if (render) draw(seconds > 0 ? Math.min(seconds, .15) : 0);
      else audio.tick(mode === 'playing', 0, 0, false);
    } : undefined,
  };
}
if (!manual) requestAnimationFrame(loop);
