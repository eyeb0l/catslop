import * as THREE from 'three';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';

const canvas = document.getElementById('view');
const ui = {
  scrim: document.getElementById('scrim'),
  hud: document.getElementById('hud'),
  pause: document.getElementById('pause'),
  shop: document.getElementById('shop'),
  ending: document.getElementById('ending'),
  start: document.getElementById('start'),
  best: document.getElementById('best'),
  objective: document.getElementById('objective'),
  prompt: document.getElementById('prompt'),
  motes: document.getElementById('motes'),
  sunbar: document.getElementById('sunbar'),
  pips: document.getElementById('pips'),
  hint: document.getElementById('hint'),
  volume: document.getElementById('volume'),
  sens: document.getElementById('sens'),
  invert: document.getElementById('invert'),
  shadows: document.getElementById('shadows'),
  shadowNote: document.getElementById('shadow-note'),
  mute: document.getElementById('mute'),
  resume: document.getElementById('resume'),
  restart: document.getElementById('restart'),
  wares: document.getElementById('wares'),
  shopMotes: document.getElementById('shop-motes'),
  endTitle: document.getElementById('end-title'),
  endBody: document.getElementById('end-body'),
  endBest: document.getElementById('end-best'),
  stay: document.getElementById('stay'),
  again: document.getElementById('again'),
  debug: document.getElementById('debug'),
};

const NAMES = { tin: 'tin', mouse: 'mouse', mitten: 'mitten', bell: 'bell', stone: 'stone', ribbon: 'ribbon' };

function softwareRenderer() {
  try {
    const probe = document.createElement('canvas');
    probe.width = 16;
    probe.height = 16;
    const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i.test(name);
  } catch {
    return true;
  }
}

const params = new URLSearchParams(location.search);
const software = softwareRenderer();
const quality = software
  ? { shadows: false, shadowSize: 512, grass: 110, flowers: 36, software: true }
  : { shadows: true, shadowSize: 2048, grass: 380, flowers: 84, software: false };
if (params.has('hi')) {
  quality.shadows = true;
  quality.shadowSize = software ? 1024 : quality.shadowSize;
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !software,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setPixelRatio(software ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.08, 90);

function fit() {
  const w = Math.max(320, window.innerWidth || 1280);
  const h = Math.max(180, window.innerHeight || 720);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
fit();
window.addEventListener('resize', fit);

const audio = createAudio();
const input = createInput(canvas);
const game = createGame({ scene, camera, renderer, audio, quality });

const manual = params.has('manual');
if (params.has('debug')) ui.debug.hidden = false;

const bus = {
  start: false,
  restart: false,
  again: false,
  resume: false,
  mute: false,
  stay: false,
  buy: null,
  volume: undefined,
  sens: undefined,
  invert: null,
  shadows: null,
};

let settingsBound = false;
let shopKey = '';
let dropped = false;
let frames = 0;
let slow = 0;
let last = performance.now();

function blurFocus() {
  const el = document.activeElement;
  if (el && el !== document.body && typeof el.blur === 'function') el.blur();
}

function bindSettings(view) {
  if (settingsBound) return;
  settingsBound = true;
  ui.volume.value = String(view.volume);
  ui.sens.value = String(view.sens);
  ui.invert.checked = view.invert;
  ui.shadows.checked = view.shadows;
  ui.shadows.disabled = view.software;
  ui.shadowNote.hidden = !view.software;
}

function paint(view) {
  bindSettings(view);
  ui.scrim.hidden = view.mode !== 'title';
  ui.hud.hidden = view.mode === 'title';
  ui.pause.hidden = view.mode !== 'pause';
  ui.shop.hidden = view.mode !== 'shop';
  const showEnd = view.mode === 'ending' && view.ending && !view.ending.hide;
  ui.ending.hidden = !showEnd;

  if (view.best && view.best.time != null) {
    const mins = Math.floor(view.best.time / 60);
    const secs = Math.floor(view.best.time % 60);
    const clock = `${mins}:${String(secs).padStart(2, '0')}`;
    ui.best.hidden = false;
    ui.best.textContent = view.best.night ? `Best nap ${clock}, after the sun had gone.` : `Best nap ${clock}.`;
    ui.endBest.textContent = ui.best.textContent;
  }

  ui.objective.textContent = view.objective || '';
  ui.prompt.hidden = !view.prompt;
  ui.prompt.textContent = view.prompt || '';
  ui.motes.textContent = `${view.motes} shiny`;
  ui.sunbar.style.width = `${Math.max(4, Math.min(100, view.sun * 100))}%`;
  ui.hint.hidden = !(view.hint > 0.05);
  ui.hint.style.opacity = String(view.hint || 0);

  const order = ['tin', 'mouse', 'mitten', 'bell', 'stone', 'ribbon'];
  ui.pips.replaceChildren(...order.map((id) => {
    const mark = document.createElement('b');
    mark.className = view.have[id] ? 'on' : '';
    mark.title = NAMES[id];
    return mark;
  }));

  ui.shopMotes.textContent = `${view.motes} shiny things on the step.`;
  const nextShop = view.shop.map((item) => `${item.id}:${item.owned}:${item.note}`).join('|');
  if (nextShop !== shopKey) {
    shopKey = nextShop;
    ui.wares.replaceChildren(...view.shop.map((item, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ware${item.owned ? ' owned' : ''}`;
      button.dataset.buy = item.id;
      const name = document.createElement('strong');
      name.textContent = `${i + 1}  ${item.name}`;
      const cost = document.createElement('span');
      cost.textContent = item.owned ? (item.note || 'kept') : `${item.cost} shiny`;
      const line = document.createElement('small');
      line.textContent = item.text;
      button.append(name, cost, line);
      return button;
    }));
  }

  if (view.ending) {
    ui.endTitle.textContent = view.ending.title;
    ui.endBody.textContent = view.ending.body;
  }
  ui.mute.textContent = audio.muted ? 'Sound on' : 'Mute';

  if (!ui.debug.hidden) {
    const s = game.debug.state();
    ui.debug.textContent = `${s.mode}  ${s.x.toFixed(2)} ${s.y.toFixed(2)} ${s.z.toFixed(2)}  have ${s.have}  motes ${s.motes}`;
  }
}

function clearBus() {
  bus.start = false;
  bus.restart = false;
  bus.again = false;
  bus.resume = false;
  bus.mute = false;
  bus.stay = false;
  bus.buy = null;
  bus.volume = undefined;
  bus.sens = undefined;
  bus.invert = null;
  bus.shadows = null;
}

function tick(dt) {
  const snap = input.frame();
  const view = game.update(dt, snap, bus);
  clearBus();
  paint(view);
  renderer.render(scene, camera);
  return view;
}

ui.start.addEventListener('click', () => {
  bus.start = true;
  audio.resume();
  blurFocus();
});
canvas.addEventListener('click', () => {
  const mode = game.debug.state().mode;
  if (mode === 'title') {
    bus.start = true;
    audio.resume();
  }
});
ui.resume.addEventListener('click', () => { bus.resume = true; blurFocus(); });
ui.restart.addEventListener('click', () => { bus.restart = true; blurFocus(); });
ui.again.addEventListener('click', () => { bus.again = true; blurFocus(); });
ui.stay.addEventListener('click', () => { bus.stay = true; blurFocus(); });
ui.mute.addEventListener('click', () => { bus.mute = true; });
ui.volume.addEventListener('input', () => { bus.volume = Number(ui.volume.value); });
ui.sens.addEventListener('input', () => { bus.sens = Number(ui.sens.value); });
ui.invert.addEventListener('change', () => { bus.invert = ui.invert.checked; });
ui.shadows.addEventListener('change', () => { bus.shadows = ui.shadows.checked; });
ui.wares.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button && button.dataset.buy) bus.buy = button.dataset.buy;
});

const empty = () => ({
  down: new Set(),
  pressed: new Set(),
  dx: 0,
  dy: 0,
  leftEdge: false,
  right: false,
  lockFailed: true,
  locked: false,
});

window.__game = {
  step(seconds) {
    const dt = Math.max(0, Math.min(0.1, Number(seconds) || 0));
    return tick(dt);
  },
  sim(seconds) {
    let left = Math.max(0, Number(seconds) || 0);
    while (left > 0) {
      const dt = Math.min(0.05, left);
      tick(dt);
      left -= dt;
    }
    return game.debug.state();
  },
  press(code, seconds) {
    const dt = Math.max(0, Number(seconds) || 0);
    let left = dt;
    let first = true;
    while (left > 0) {
      const step = Math.min(0.05, left);
      const snap = empty();
      snap.down.add(code);
      snap.lockFailed = true;
      if (first) snap.pressed.add(code);
      first = false;
      game.update(step, snap, bus);
      clearBus();
      left -= step;
    }
    const view = game.view();
    paint(view);
    renderer.render(scene, camera);
    return game.debug.state();
  },
  state: () => game.debug.state(),
  tp: (x, z) => game.debug.tp(x, z),
  give: (id) => game.debug.give(id),
  motes: (n) => game.debug.motes(n),
  sun: (t) => game.debug.sun(t),
  finish: () => game.debug.finish(),
  hold: (on) => game.debug.hold(on),
};

tick(1 / 60);

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (!manual) tick(dt);
  else renderer.render(scene, camera);
  frames += 1;
  if (dt > 0.05) slow += 1;
  if (!dropped && !quality.software && frames > 40 && slow / frames > 0.55) {
    dropped = true;
    renderer.setPixelRatio(1);
    if (quality.shadows) {
      bus.shadows = false;
      ui.shadows.checked = false;
    }
  }
}
requestAnimationFrame(frame);
