// Gifts for the Tall One: bootstrap and main loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildTerrainMesh, buildHeightTexture, heightAt, POND, WORLD_SIZE } from './terrain.js';
import { Environment } from './env.js';
import { Water } from './water.js';
import { buildGrass, buildTrees, buildFlowers, buildRocks } from './flora.js';
import { buildProps } from './props.js';
import { addSolids, groundAt } from './physics.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { FX } from './fx.js';
import { Wildlife } from './wildlife.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { clamp } from './util.js';

const query = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ui = new UI();

// ---- Renderer ---------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const cam = new FollowCamera(innerWidth / innerHeight);
const camera = cam.camera;

let composer = null, bloom = null;
function buildComposer() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.6, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// ---- World ----------------------------------------------------------------------------
const env = new Environment(scene);
scene.add(buildTerrainMesh());
const water = new Water(scene, buildHeightTexture());
const grass = buildGrass(scene);
const trees = buildTrees(scene, grass.uniforms);
const flowers = buildFlowers(scene, grass.uniforms);
const rocks = buildRocks(scene);
const props = buildProps(scene);
addSolids([...trees.colliders, ...rocks.colliders, ...props.solids]);

const fx = new FX(scene);
const sound = new Sound();
const input = new Input(canvas);
if (query.has('nolock')) input.wantLock = false;
const player = new Player();
scene.add(player.cat.root);
// With real shadows switched off (low settings) the cat still needs something under it.
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.46, 20).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }),
);
blob.renderOrder = 1;
scene.add(blob);
const wildlife = new Wildlife(scene, { flowers, spots: props.spots, fx, trees: trees.trees });
const game = new Game({ player, wildlife, fx, sound, ui, props, env, cam, input, scene });
ui.icons = wildlife.renderIcons(renderer);

// ---- Quality ------------------------------------------------------------------------------
const QUALITY = {
  high: { ratio: 2, shadow: 2048, post: true, grass: 1 },
  medium: { ratio: 1.25, shadow: 1024, post: true, grass: 0.6 },
  low: { ratio: 0.85, shadow: 0, post: false, grass: 0.32 },
  minimum: { ratio: 0.6, shadow: 0, post: false, grass: 0.1 }, // software renderers; not offered in the menu
};
const LEVELS = ['high', 'medium', 'low', 'minimum'];
let quality = 'high', autoQuality = true, usePost = true;
const perf = { since: 0, frames: 0, hold: 0 };
function setQuality(level) {
  quality = level;
  const q = QUALITY[level];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.ratio));
  renderer.setSize(innerWidth, innerHeight, false);
  env.setShadowQuality(q.shadow);
  grass.setDensity(q.grass);
  usePost = q.post;
  if (usePost) {
    if (!composer) buildComposer();
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  }
}
/** A machine with no GPU should not be asked to try the pretty settings first. */
function looksLikeSoftware() {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch { return false; }
}
function chooseQuality(pref) {
  autoQuality = pref === 'auto';
  setQuality(autoQuality ? (looksLikeSoftware() ? 'low' : 'high') : pref);
  perf.since = performance.now(); perf.frames = 0; perf.hold = 2500;
}
/** Auto quality: if the frame rate will not hold, trade pixels, shadows and grass for it. */
function watchFrameRate(now) {
  if (!autoQuality || document.hidden) { perf.since = now; perf.frames = 0; return; }
  perf.frames++;
  const span = now - perf.since;
  // A long gap means the tab was in the background, not that the machine is slow.
  if (span > 6000) { perf.since = now; perf.frames = 0; return; }
  if (span < perf.hold) { if (perf.hold > 1500) { perf.frames = 0; if (span >= perf.hold - 1500) { perf.hold = 1500; perf.since = now; } } return; }
  const fps = (perf.frames * 1000) / span;
  const i = LEVELS.indexOf(quality);
  if (fps < 38 && i < LEVELS.length - 1) { setQuality(LEVELS[i + 1]); perf.hold = 2500; } else perf.hold = 1500;
  perf.since = now; perf.frames = 0;
}
const forced = query.get('quality');
chooseQuality(LEVELS.includes(forced) ? forced : game.state.settings.quality);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  setQuality(quality);
});

// ---- Start state -----------------------------------------------------------------------------
const mat = props.spots.doormat;
player.teleport(mat.x + 0.4, mat.z + 3.6, 0.25);
player.frozen = true; player.forceSit = true;
env.phase = query.has('time') ? Number(query.get('time')) : 0.4;
env.paused = true;
wildlife.populate(env.period, player.pos);
cam.snap(player.pos, player.yaw);

let mode = 'title';
let titleBlend = 1; // 1 = title camera, 0 = follow camera
let smokeTimer = 0, last = performance.now(), elapsedPlay = 0;
const titleCam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
const followPos = new THREE.Vector3(), followQuat = new THREE.Quaternion(), titleQuat = new THREE.Quaternion();

function start() {
  if (mode !== 'title') return;
  mode = 'play';
  sound.unlock();
  ui.hideTitle();
  player.frozen = false; player.forceSit = false;
  env.paused = false;
  input.requestLock();
  suppressPause = 0.5;
}
function openPause() {
  if (mode !== 'play' || ui.panel || game.ending) return;
  sound.click();
  ui.openPause(game.state.settings);
  input.releaseLock();
}
function openJournal() {
  if (mode !== 'play' || game.ending) return;
  if (ui.panel === 'journal') { closePanel(); return; }
  if (ui.panel) return;
  game.state.tips.journal = true;
  sound.paper();
  ui.openJournal(game.state);
  input.releaseLock();
}
let suppressPause = 0;
function closePanel() {
  if (!ui.panel) return;
  const was = ui.panel;
  ui.close();
  sound.click();
  if (was === 'end') game.endEnding();
  suppressPause = 0.4;
  input.requestLock();
}

ui.on.start = start;
ui.on.newGame = () => game.reset();
ui.on.journal = openJournal;
ui.on.pause = openPause;
ui.on.close = closePanel;
ui.on.reset = () => game.reset();
ui.on.shop = (id) => game.shop(id);
ui.on.touch = (act, on) => { sound.unlock(); input.setVirtual(act, on); };
ui.on.noteShown = () => sound.paper();
ui.on.setting = (key, value) => {
  const s = game.state.settings;
  s[key] = value;
  if (key === 'quality') chooseQuality(value);
  game.applyLoadout();
  game.save();
};
input.onAnyInput = () => { sound.unlock(); if (input.isTouch) ui.showTouch(); };
input.onLockChange = (locked, was) => {
  // Leaving pointer lock with Esc is how most people ask for the menu.
  if (!locked && was && mode === 'play' && !ui.panel && suppressPause <= 0) openPause();
};
addEventListener('blur', () => { if (mode === 'play' && !ui.panel && !game.ending) openPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
addEventListener('pagehide', () => game.save());

// ---- Loop ------------------------------------------------------------------------------------------
const focus = new THREE.Vector3();
const manual = query.has('debug') && query.has('manual');
function frame(now) {
  requestAnimationFrame(frame);
  if (manual) return;
  const rawDt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;
  tick(rawDt);
  render(rawDt);
  watchFrameRate(now);
}
function render(rawDt) {
  if (usePost) composer.render(rawDt); else renderer.render(scene, camera);
}
/** Advance the whole game by one frame of rawDt seconds (no drawing). */
function tick(rawDt) {
  suppressPause = Math.max(0, suppressPause - rawDt);
  input.pollGamepad(rawDt);

  if (mode === 'title') {
    if (input.pressed('confirm') || input.pressed('jump')) start();
  } else {
    if (input.pressed('pause')) { if (ui.panel) { if (ui.panel !== 'end') closePanel(); } else openPause(); }
    if (input.pressed('journal')) openJournal();
    if (ui.panel === 'shop' && input.pressed('interact')) { closePanel(); input.consume('interact'); }
    if (ui.panel === 'end' && input.pressed('confirm')) closePanel();
    if (ui.panel === 'pause' && input.pressed('confirm')) closePanel();
    // Keys that drove a menu must not also drive the cat this frame.
    if (ui.panel) { input.consume('jump'); input.consume('interact'); input.consume('meow'); input.consume('sneak'); }
  }

  const running = mode === 'title' || !ui.panel;
  const dt = running ? rawDt * (game.hitStop > 0 ? 0.06 : 1) : 0;

  if (running) {
    player.update(dt, input, cam, env);
    wildlife.update(dt, player, env);
    if (mode === 'play') { game.update(dt, rawDt); elapsedPlay += dt; }
    fx.update(dt);
    fx.showAim(player);
    if (player.speed > 8.4 && player.grounded) fx.speedLine(player.pos, player.vel);
    smokeTimer -= dt;
    if (smokeTimer <= 0) { smokeTimer = 0.4; fx.smoke(props.spots.chimney); }
  }

  // Camera: follow rig always runs; the title shot blends out of it.
  cam.update(running && mode === 'play' ? rawDt : 0, mode === 'play' && !ui.panel ? input : IDLE_INPUT, player, { distScale: game.ending ? 0.9 : 1 });
  if (titleBlend > 0) {
    if (mode === 'play') titleBlend = Math.max(0, titleBlend - rawDt / 1.4);
    const a = env.elapsed * 0.1 + 0.55;
    titleCam.pos.set(player.pos.x - 0.5 + Math.sin(a) * 0.9, player.pos.y + 0.5 + Math.sin(a * 0.7) * 0.08, player.pos.z + 2.9 + Math.cos(a) * 0.3);
    titleCam.look.set(player.pos.x - 1.25, player.pos.y + 0.78, player.pos.z);
    followPos.copy(camera.position); followQuat.copy(camera.quaternion);
    camera.position.copy(titleCam.pos); camera.lookAt(titleCam.look); titleQuat.copy(camera.quaternion);
    const k = titleBlend * titleBlend * (3 - 2 * titleBlend);
    camera.position.lerpVectors(followPos, titleCam.pos, k);
    camera.quaternion.slerpQuaternions(followQuat, titleQuat, k);
  }

  blob.visible = !env.sun.castShadow && !player.swimming;
  if (blob.visible) {
    const gy = groundAt(player.pos.x, player.pos.z, player.pos.y + 0.1);
    const lift = clamp(1 - (player.pos.y - gy) / 2.5, 0.25, 1);
    blob.position.set(player.pos.x, gy + 0.03, player.pos.z);
    blob.scale.setScalar(lift);
    blob.material.opacity = 0.26 * lift;
  }

  focus.copy(player.pos);
  env.update(running ? dt : 0, focus);
  grass.uniforms.uTime.value = env.elapsed;
  grass.uniforms.uCat.value.copy(player.pos);
  water.update(env, player.pos, player.swimming ? 1 : player.wading);
  props.update(env, env.elapsed);
  if (bloom) bloom.strength = 0.2 + env.night * 0.16;

  const coast = clamp(1 - Math.abs(heightAt(player.pos.x, player.pos.z) - 0.2) / 2.2);
  const pond = clamp(1 - Math.hypot(player.pos.x - POND.x, player.pos.z - POND.z) / 30);
  sound.update(rawDt, { night: env.night, coast, pond, speed: player.speed, happy: player.happy, paused: !running || mode === 'title' });

  input.endFrame();
}
const IDLE_INPUT = { lookX: 0, lookY: 0, zoom: 0, turn: () => 0, lastLookAt: -1e9 };

// Debug handle for automated play-testing: ?debug
if (query.has('debug')) {
  window.__game = {
    game, player, cam, env, wildlife, fx, sound, input, scene, renderer, props, WORLD_SIZE,
    start, setQuality, get mode() { return mode; }, get quality() { return quality; },
    give(n) { game.state.treats += n; ui.setTreats(game.state.treats); },
    /** Simulate `seconds` of play at 60 Hz, then draw once. With ?manual nothing else advances time. */
    step(seconds = 1 / 60) { const n = Math.max(1, Math.round(seconds * 60)); for (let i = 0; i < n; i++) tick(1 / 60); render(1 / 60); },
    /** The same without drawing anything: for long soak tests. */
    sim(seconds) { const n = Math.max(1, Math.round(seconds * 60)); for (let i = 0; i < n; i++) tick(1 / 60); },
    go(x, z, yaw = 0) { player.teleport(x, z, yaw); cam.snap(player.pos, yaw); },
  };
}

// Compile shaders before showing the button so the first frame is not a hitch.
renderer.compile(scene, camera);
ui.ready(game.hadSave);
requestAnimationFrame(frame);
