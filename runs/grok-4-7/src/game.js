import * as THREE from 'three';
import { LEVEL } from './level.js';
import { createWorld } from './world.js';
import { createCat } from './cat.js';
import { createActors } from './actors.js';
import { angDiff, clamp, damp, dampAngle, formatTime, smoothstep } from './util.js';

const SAVE_KEY = 'sunloaf-grok-4-7';
const SHOP = [
  { id: 'cream', name: 'Cream', cost: 3, text: 'A lick of speed, kept.' },
  { id: 'catnip', name: 'Catnip', cost: 5, text: 'Questionable judgement. Excellent altitude.' },
  { id: 'collar', name: 'Bell collar', cost: 4, text: 'Everyone will hear you coming. You do not mind.' },
  { id: 'daylight', name: 'Borrowed daylight', cost: 6, text: 'The sun agrees to wait. Twice, at most.' },
];

const _look = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _fwd = new THREE.Vector3();

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* storage may be blocked; the game still plays */
  }
}

export function createGame({ scene, camera, renderer, audio, quality }) {
  const world = createWorld(scene, renderer, quality);
  const actors = createActors(scene, quality);
  let stepQueued = false;
  const cat = createCat({
    onStep() { stepQueued = true; },
  });
  scene.add(cat.root);

  const save = loadSave();
  const settings = {
    volume: typeof save.volume === 'number' ? save.volume : 0.85,
    sens: typeof save.sens === 'number' ? save.sens : 0.0022,
    invert: Boolean(save.invert),
    shadows: save.shadows === undefined ? quality.shadows : Boolean(save.shadows),
    best: save.best || null,
  };
  if (!quality.software && settings.shadows !== quality.shadows) world.setShadows(settings.shadows);
  audio.setVolume(settings.volume);
  cat.blob.visible = !quality.shadows;

  const player = {
    x: LEVEL.start.x,
    y: 0,
    z: LEVEL.start.z,
    yaw: LEVEL.start.yaw,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 0.22,
  };

  let mode = 'title';
  let motes = 0;
  let spent = 0;
  let knocks = 0;
  const upgrades = { cream: false, catnip: false, collar: false, daylight: 0 };
  let sunT = 0.08;
  let elapsed = 0;
  let time = 0;
  let idle = 20;
  let groomLeft = 0;
  let groomPaid = false;
  let sunBank = 0;
  let innocent = 0;
  let shake = 0;
  let pounce = 0;
  let wasSwimming = false;
  let message = '';
  let messageT = 0;
  let lookIdle = 0;
  let cameraYaw = player.yaw + Math.PI - 0.42;
  let cameraPitch = 0.36;
  let camReady = false;
  let armClick = 0;
  let endingCard = false;
  let cardHide = false;
  let freeLook = false;
  let cameraHold = false;
  let surface = 'grass';
  let grounded = true;
  let prevY = 0;
  let coyote = 0;
  let jumpBuffer = 0;
  let climbing = false;
  let swimming = false;
  let sneaked = false;
  let nightEnding = false;
  const dyn = [];

  function persist() {
    writeSave({ ...settings, shadows: quality.shadows });
  }

  function say(text, sec = 3) {
    message = text;
    messageT = sec;
  }

  function nightAmount() {
    return smoothstep((sunT - 0.8) / 0.38);
  }

  function speedMax() {
    let s = sneaked ? 0.64 : 1.72;
    if (upgrades.cream) s *= 1.2;
    if (swimming) s *= 0.45;
    if (shake > 0) s *= 0.35;
    return s;
  }

  function jumpV() {
    return 4.85 * (upgrades.catnip ? 1.26 : 1);
  }

  function resetRun() {
    player.x = LEVEL.start.x;
    player.y = 0;
    player.z = LEVEL.start.z;
    player.yaw = LEVEL.start.yaw;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    mode = 'title';
    motes = 0;
    spent = 0;
    knocks = 0;
    upgrades.cream = false;
    upgrades.catnip = false;
    upgrades.collar = false;
    upgrades.daylight = 0;
    cat.setCollar(false);
    sunT = 0.08;
    elapsed = 0;
    idle = 20;
    groomLeft = 0;
    groomPaid = false;
    sunBank = 0;
    innocent = 0;
    shake = 0;
    pounce = 0;
    wasSwimming = false;
    message = '';
    messageT = 0;
    climbing = false;
    swimming = false;
    grounded = true;
    endingCard = false;
    cardHide = false;
    freeLook = false;
    armClick = 0;
    actors.reset();
    cat.reset();
    cameraYaw = player.yaw + Math.PI - 0.42;
    cameraPitch = 0.36;
  }

  function insideSolid(x, y, z) {
    if (y < 0.12) return true;
    for (const b of world.blocks) {
      if (y < b.minY || y > b.maxY) continue;
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  }

  function collide(x, z, y, height) {
    const circles = world.circles.concat(dyn);
    for (let n = 0; n < 3; n++) {
      for (const b of world.blocks) {
        if (y >= b.maxY - 0.06) continue;
        if (y + height <= b.minY + 0.02) continue;
        const minX = b.minX - player.radius;
        const maxX = b.maxX + player.radius;
        const minZ = b.minZ - player.radius;
        const maxZ = b.maxZ + player.radius;
        if (x > minX && x < maxX && z > minZ && z < maxZ) {
          const dl = x - minX;
          const dr = maxX - x;
          const df = z - minZ;
          const db = maxZ - z;
          const m = Math.min(dl, dr, df, db);
          if (m === dl) x = minX;
          else if (m === dr) x = maxX;
          else if (m === df) z = minZ;
          else z = maxZ;
        }
      }
      for (const c of circles) {
        if (y >= c.maxY - 0.04) continue;
        if (y + height <= c.minY) continue;
        const dx = x - c.x;
        const dz = z - c.z;
        const minD = player.radius + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < minD * minD) {
          const d = Math.sqrt(d2) || 0.0001;
          x = c.x + (dx / d) * minD;
          z = c.z + (dz / d) * minD;
        }
      }
    }
    return { x, z };
  }

  function bodyCollide(b) {
    for (const block of world.blocks) {
      if (block.minY > 0.4) continue;
      const minX = block.minX - b.r;
      const maxX = block.maxX + b.r;
      const minZ = block.minZ - b.r;
      const maxZ = block.maxZ + b.r;
      if (b.x > minX && b.x < maxX && b.z > minZ && b.z < maxZ) {
        const dl = b.x - minX;
        const dr = maxX - b.x;
        const df = b.z - minZ;
        const db = maxZ - b.z;
        const m = Math.min(dl, dr, df, db);
        if (m === dl) b.x = minX;
        else if (m === dr) b.x = maxX;
        else if (m === df) b.z = minZ;
        else b.z = maxZ;
        b.vx *= 0.4;
        b.vz *= 0.4;
      }
    }
    b.x = clamp(b.x, -11.7, 11.7);
    b.z = clamp(b.z, -4.7, 13.5);
  }

  function support(x, z, y, vy) {
    const platforms = world.platforms.slice();
    for (const b of actors.bodies) {
      if (b.kind !== 'crate') continue;
      platforms.push({
        minX: b.x - b.s / 2, maxX: b.x + b.s / 2,
        minZ: b.z - b.s / 2, maxZ: b.z + b.s / 2,
        y: b.s, surface: 'wood',
      });
    }
    let floor = 0;
    let surf = world.surfaceAt(x, z);
    for (const p of platforms) {
      if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) continue;
      if (p.y > y + 0.12) continue;
      if (prevY < p.y - 0.08 && y < p.y) continue;
      if (p.y >= floor) {
        floor = p.y;
        surf = p.surface || surf;
      }
    }
    return { floor, surf };
  }

  function animMode() {
    if (mode === 'title') return idle > 14 ? 'loaf' : 'groom';
    if (mode === 'ending') return 'endloaf';
    if (shake > 0) return 'shake';
    if (actors.fishing) return 'fish';
    if (climbing) return 'climb';
    if (swimming) return 'swim';
    if (!grounded && pounce > 0) return 'pounce';
    if (!grounded) return 'air';
    if (groomLeft > 0) return 'groom';
    if (idle > 11) return 'loaf';
    if (idle > 3.1) return 'sit';
    if (sneaked) return 'sneak';
    return 'stand';
  }

  function inIvy(x, z) {
    return Math.hypot(x - LEVEL.ivy.x, z - LEVEL.ivy.z) < LEVEL.ivy.r + 0.28;
  }

  function buy(id) {
    const spec = SHOP.find((s) => s.id === id);
    if (!spec) return;
    if (id === 'daylight') {
      if (upgrades.daylight >= 2) { say('The sun has already stayed twice.'); return; }
    } else if (upgrades[id]) {
      say('Already yours.');
      return;
    }
    if (motes < spec.cost) { say('Not enough shiny things.'); audio.blip(false); return; }
    motes -= spec.cost;
    spent += spec.cost;
    if (id === 'daylight') {
      upgrades.daylight += 1;
      sunT = Math.max(0, sunT - 0.17);
      say('The light climbs back a little.');
    } else {
      upgrades[id] = true;
      if (id === 'collar') cat.setCollar(true);
      say(spec.text);
    }
    audio.blip(true);
  }

  function finish() {
    if (mode === 'ending') return;
    nightEnding = sunT >= 1;
    mode = 'ending';
    climbing = false;
    swimming = false;
    player.vx = 0;
    player.vz = 0;
    player.vy = 0;
    const sill = LEVEL.sill;
    player.x = sill.x;
    player.y = sill.y + 0.05;
    player.z = sill.z + 0.05;
    player.yaw = Math.PI;
    actors.arrange(player.x, player.y, player.z + 0.05);
    endingCard = false;
    cardHide = false;
    audio.endingChord(nightEnding);
    const record = { time: elapsed, night: nightEnding, knocks };
    if (!settings.best || record.time < settings.best.time) settings.best = record;
    persist();
  }

  function update(dt, input, bus) {
    dt = Math.min(dt, 0.1);
    if (dt < 0) dt = 0;
    time += dt;
    if (armClick > 0) armClick -= dt;
    if (messageT > 0) {
      messageT -= dt;
      if (messageT <= 0) message = '';
    }
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (pounce > 0) pounce = Math.max(0, pounce - dt);
    if (innocent > 0) innocent = Math.max(0, innocent - dt);
    if (groomLeft > 0) {
      groomLeft -= dt;
      if (groomLeft <= 0 && !groomPaid) {
        groomPaid = true;
        motes += 1;
        actors.burst(player.x, player.y + 0.4, player.z, 0xffd27a);
      }
    }

    const key = (c) => input.down.has(c);
    const edge = (c) => input.pressed.has(c);
    const playing = mode === 'play';

    if ((mode === 'title' && (edge('Enter') || edge('Space') || edge('NumpadEnter') || bus.start)) || bus.start && mode === 'title') {
      mode = 'play';
      idle = 0;
      armClick = 0.35;
      audio.resume();
      say('Six comforts are out of place.', 3.2);
    }
    if (bus.restart || ((mode === 'pause' || mode === 'ending') && edge('KeyR'))) resetRun();
    if (bus.again || (mode === 'ending' && edge('KeyN'))) resetRun();

    if (mode === 'play' && (edge('Escape'))) {
      mode = 'pause';
      audio.blip(false);
    } else if (mode === 'pause' && (edge('Escape') || edge('Enter') || bus.resume)) {
      mode = 'play';
      armClick = 0.2;
    }
    if (mode === 'shop' && (edge('Escape') || edge('KeyE') || bus.resume)) mode = 'play';
    if (mode === 'ending' && edge('Escape')) cardHide = !cardHide;
    if (mode === 'ending' && (edge('Enter') || bus.stay)) cardHide = true;

    if (edge('KeyM') || bus.mute) {
      audio.setMuted(!audio.muted);
      say(audio.muted ? 'The garden goes quiet.' : 'Sound returns.', 1.4);
    }
    if (typeof bus.volume === 'number') {
      settings.volume = bus.volume;
      audio.setVolume(bus.volume);
      persist();
    }
    if (typeof bus.sens === 'number') {
      settings.sens = bus.sens;
      persist();
    }
    if (bus.invert != null) {
      settings.invert = bus.invert;
      persist();
    }
    if (bus.shadows != null && !quality.software) {
      settings.shadows = bus.shadows;
      quality.shadows = bus.shadows;
      world.setShadows(bus.shadows);
      cat.blob.visible = !bus.shadows;
      persist();
    }
    if (bus.buy && mode === 'shop') buy(bus.buy);
    if (mode === 'shop') {
      const digits = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
      digits.forEach((code, i) => { if (edge(code)) buy(SHOP[i].id); });
    }

    sneaked = playing && (key('ShiftLeft') || key('ShiftRight'));
    const height = sneaked ? 0.2 : 0.4;

    if (playing) elapsed += dt;

    // Look
    const canLook = mode === 'play' || (mode === 'ending' && cardHide);
    if (canLook) {
      const pointerLook = input.locked || input.right || input.lockFailed;
      if (pointerLook && (input.dx || input.dy)) {
        cameraYaw -= input.dx * settings.sens;
        const dir = settings.invert ? -1 : 1;
        cameraPitch += input.dy * settings.sens * dir;
        lookIdle = 0;
      }
      if (key('ArrowLeft')) { cameraYaw += dt * 1.4; lookIdle = 0; }
      if (key('ArrowRight')) { cameraYaw -= dt * 1.4; lookIdle = 0; }
      if (key('ArrowUp')) { cameraPitch -= dt * 0.8; lookIdle = 0; }
      if (key('ArrowDown')) { cameraPitch += dt * 0.8; lookIdle = 0; }
      lookIdle += dt;
    }
    cameraPitch = clamp(cameraPitch, 0.16, 1.15);

    if (playing && input.leftEdge && armClick <= 0 && !actors.fishing) {
      audio.resume();
      try { input.tryLock?.(); } catch { /* pointer lock is optional */ }
      if (grounded && !climbing && !swimming) {
        pounce = 0.42;
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        player.vx += fx * 3.3;
        player.vz += fz * 3.3;
        player.vy = Math.max(player.vy, 3.15);
        grounded = false;
        audio.jump();
        actors.pounceAt({ ...player, pouncing: true, sneaking: sneaked });
      } else {
        actors.pounceAt({ ...player, pouncing: true, sneaking: sneaked });
      }
    }

    if (playing && edge('KeyE')) {
      const hit = actors.use(player, motes);
      if (hit && hit.id === 'shop') mode = 'shop';
      else if (hit && hit.id === 'loaf' && actors.haveCount() >= 6) finish();
      else if (hit && hit.id === 'poor') say(hit.prompt, 2.6);
      else if (hit && hit.id === 'traded') {
        motes -= 8;
        spent += 8;
        say(hit.prompt, 2.6);
        audio.caw();
      } else if (hit && hit.prompt && hit.block) say(hit.prompt, 1.8);
    }

    let climbedThisPress = false;
    if (playing && edge('Space') && inIvy(player.x, player.z) && !climbing && player.y < LEVEL.ivy.top) {
      climbing = true;
      climbedThisPress = true;
      swimming = false;
      player.vy = 0;
    } else if (playing && edge('Space')) {
      jumpBuffer = 0.14;
    }
    if (playing && climbing && edge('Space') && !climbedThisPress) {
      climbing = false;
      player.vy = 1.4;
      const ox = player.x - LEVEL.ivy.x;
      const oz = player.z - LEVEL.ivy.z;
      const od = Math.hypot(ox, oz) || 1;
      player.vx += (ox / od) * 1.5;
      player.vz += (oz / od) * 1.5;
    }

    // Sun
    const patchX = 0.6 + Math.sin(time * 0.045) * 2.3;
    const patchZ = 2.15 + (Math.cos(time * 0.03) * 0.5 + 0.5) * 2.2;
    world.patch.position.set(patchX, 0.035, patchZ);
    const inSun = Math.hypot(player.x - patchX, player.z - patchZ) < 1.45;
    const basking = inSun && idle > 0.6 && grounded && !climbing && !swimming && (mode === 'play' || mode === 'title');
    sunT += dt / LEVEL.dayLength * (basking ? 0.35 : 1);
    if (basking && (animMode() === 'sit' || animMode() === 'loaf' || animMode() === 'groom' || mode === 'title')) {
      sunBank += dt;
      if (sunBank > 6) {
        sunBank = 0;
        motes += 1;
        actors.burst(player.x, player.y + 0.35, player.z, 0xffe08a);
      }
    }

    if (playing && climbing) {
      const ivy = LEVEL.ivy;
      if (key('KeyW')) player.y += dt * 1.25;
      if (key('KeyS')) player.y -= dt * 1.25;
      const ang = Math.atan2(player.z - ivy.z, player.x - ivy.x);
      let nang = ang;
      if (key('KeyA')) nang -= dt * 1.1;
      if (key('KeyD')) nang += dt * 1.1;
      const stick = 0.22;
      player.x = ivy.x + Math.cos(nang) * stick;
      player.z = ivy.z + Math.sin(nang) * stick;
      player.y = clamp(player.y, 0, ivy.top);
      player.yaw = dampAngle(player.yaw, nang + Math.PI, 8, dt);
      player.vy = 0;
      player.vx = 0;
      player.vz = 0;
      if (player.y <= 0.02 && key('KeyS')) climbing = false;
      const sill = LEVEL.sill;
      if (player.y > sill.y - 0.25 && Math.hypot(player.x - sill.x, player.z - sill.z) < 1.7) {
        climbing = false;
        player.x = sill.x - 0.15;
        player.z = sill.z + 0.02;
        player.y = sill.y + 0.05;
        player.vy = 0;
        grounded = true;
      }
    } else if (mode === 'play' || mode === 'shop' || mode === 'pause') {
      if (mode !== 'play') {
        player.vx = damp(player.vx, 0, 10, dt);
        player.vz = damp(player.vz, 0, 10, dt);
      } else if (!actors.fishing) {
        const lookX = -Math.sin(cameraYaw);
        const lookZ = -Math.cos(cameraYaw);
        const rightX = Math.cos(cameraYaw);
        const rightZ = -Math.sin(cameraYaw);
        let wx = 0;
        let wz = 0;
        if (key('KeyW')) { wx += lookX; wz += lookZ; }
        if (key('KeyS')) { wx -= lookX; wz -= lookZ; }
        if (key('KeyD')) { wx += rightX; wz += rightZ; }
        if (key('KeyA')) { wx -= rightX; wz -= rightZ; }
        const wl = Math.hypot(wx, wz);
        if (wl > 0) { wx /= wl; wz /= wl; }
        const max = speedMax();
        player.vx = damp(player.vx, wx * max, grounded ? 9 : 2.4, dt);
        player.vz = damp(player.vz, wz * max, grounded ? 9 : 2.4, dt);
        if (wl > 0.1) {
          const face = Math.atan2(-wx, -wz);
          player.yaw = dampAngle(player.yaw, face, swimming ? 4 : 8, dt);
          idle = 0;
          groomPaid = false;
        }
      } else {
        player.vx = damp(player.vx, 0, 8, dt);
        player.vz = damp(player.vz, 0, 8, dt);
      }

      if (mode === 'play' && jumpBuffer > 0 && !swimming) jumpBuffer -= dt;
      if (grounded) coyote = 0.12;
      else coyote = Math.max(0, coyote - dt);
      if (mode === 'play' && jumpBuffer > 0 && coyote > 0 && !swimming && shake <= 0) {
        player.vy = jumpV();
        grounded = false;
        coyote = 0;
        jumpBuffer = 0;
        audio.jump();
      }

      const grav = swimming ? 0 : 16.5;
      if (!swimming) player.vy -= grav * dt;
      prevY = player.y;
      if (!swimming) player.y += player.vy * dt;

      // Pushables
      dyn.length = 0;
      for (const b of actors.bodies) {
        const dx = b.x - player.x;
        const dz = b.z - player.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const min = player.radius + b.r;
        const onTop = player.y > b.h * 0.72;
        if (!onTop && d < min && player.y < b.h) {
          const nx = dx / d;
          const nz = dz / d;
          const toward = player.vx * nx + player.vz * nz;
          if (b.push && mode === 'play') {
            const impulse = Math.max(0, toward) * 1.15 + (pounce > 0 ? 2.4 : 0);
            b.vx += nx * Math.max(impulse, d < min * 0.7 ? 0.6 : 0);
            b.vz += nz * Math.max(impulse, d < min * 0.7 ? 0.6 : 0);
            if ((b.kind === 'pot' || b.kind === 'metal') && (pounce > 0 || toward > 1.15)) b.tipping = true;
          }
          const pen = min - d;
          player.x -= nx * pen;
          player.z -= nz * pen;
        }
        b.vx *= Math.exp(-2.6 * dt);
        b.vz *= Math.exp(-2.6 * dt);
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        bodyCollide(b);
        dyn.push({ x: b.x, z: b.z, r: b.r, minY: 0, maxY: b.h });
      }

      if (mode === 'play' || mode === 'shop' || mode === 'pause') {
        player.x += player.vx * dt;
        player.z += player.vz * dt;
      }
      const hit = collide(player.x, player.z, player.y, height);
      player.x = hit.x;
      player.z = hit.z;

      const pond = world.pondFactor(player.x, player.z);
      const sup = support(player.x, player.z, player.y, player.vy);
      if (pond < 0.58 && sup.floor <= 0.02 && player.y < 0.45) {
        if (!swimming && !wasSwimming) audio.splash();
        swimming = true;
        player.y = 0.03;
        player.vy = 0;
        grounded = true;
        if (edge('Space')) {
          audio.splash();
          actors.burst(player.x, 0.2, player.z, 0x9fe7e2);
        }
      } else {
        if (swimming) {
          swimming = false;
          wasSwimming = true;
          shake = 0.7;
          audio.splash();
        }
        if (player.y <= sup.floor) {
          const fall = -player.vy;
          if (!grounded && fall > 1.2) audio.land(fall > 4);
          player.y = sup.floor;
          player.vy = 0;
          grounded = true;
          surface = sup.floor > 0.04 ? (sup.surf || 'wood') : sup.surf;
        } else {
          grounded = false;
          surface = 'grass';
        }
      }
    }

    if (mode === 'title' || mode === 'ending') {
      if (mode === 'title') {
        player.x = LEVEL.start.x;
        player.y = 0;
        player.z = LEVEL.start.z;
        player.yaw = LEVEL.start.yaw;
        grounded = true;
      }
    }

    const speed = Math.hypot(player.vx, player.vz);
    if (speed < 0.08 && grounded && !climbing && mode !== 'ending') idle += dt;
    else if (speed >= 0.08) idle = 0;
    if (idle > 7.4 && idle < 7.55 && groomLeft <= 0 && mode === 'play') groomLeft = 2.5;

    if (stepQueued && speed > 0.15 && grounded && mode === 'play') {
      audio.footstep(surface);
      if (upgrades.collar) audio.collar();
    }
    stepQueued = false;

    const aMode = animMode();
    let lookYaw = 0;
    let lookPitch = 0;
    if (innocent > 0.2) lookYaw = 0.75;
    else if ((aMode === 'sit' || aMode === 'loaf' || aMode === 'groom' || aMode === 'endloaf' || mode === 'title') && lookIdle > 0.2) {
      const dx = camera.position.x - player.x;
      const dz = camera.position.z - player.z;
      const face = Math.atan2(-dx, -dz);
      lookYaw = clamp(angDiff(player.yaw, face), -1.1, 1.1);
      lookPitch = 0.05;
    }
    cat.root.userData.prevYaw = cat.root.userData.prevYaw ?? player.yaw;
    const turn = angDiff(cat.root.userData.prevYaw, player.yaw) / Math.max(dt, 0.001);
    cat.root.userData.prevYaw = player.yaw;
    cat.root.position.set(player.x, player.y, player.z);
    cat.root.rotation.y = player.yaw;
    cat.update(dt, {
      speed,
      turn,
      grounded,
      vy: player.vy,
      mode: aMode,
      lookYaw,
      lookPitch,
      innocent,
      squint: inSun && grounded ? 1 : 0,
      extra: shake,
    });

    actors.update(dt, time, { ...player, sneaking: sneaked, climbing });
    const events = actors.pullEvents();
    for (const ev of events) {
      if (ev.type === 'collect') {
        audio.collect();
        const names = { tin: 'sardine tin', mouse: 'toy mouse', mitten: 'mitten', bell: 'brass bell', stone: 'warm stone', ribbon: 'ribbon' };
        say(`The ${names[ev.id] || 'comfort'}, retrieved.`, 2.2);
        if (Math.random() < 0.7) audio.meow(ev.id === 'mouse' ? 'tiny' : 'down');
        if (actors.haveCount() === 6) say('All six. The windowsill is ready.', 3.2);
      } else if (ev.type === 'knock') {
        knocks += 1;
        motes += 1;
        innocent = 1.3;
        audio.knock(ev.kind);
        if (knocks === 1) say('Miso looks elsewhere. The pot does not.', 2.4);
      } else if (ev.type === 'mote') {
        motes += ev.n;
        audio.collect();
      } else if (ev.type === 'yarnpond') {
        motes += 4;
        audio.splash();
        say('The yarn has taken up swimming.', 2.4);
      } else if (ev.type === 'fish') {
        audio.splash();
      } else if (ev.type === 'trade') {
        /* mote spend already applied */
      }
    }
    // cameraYaw is the only orbit angle. 0 sits the camera on +Z looking toward −Z.
    // Placement and camera-relative WASD both read it; do not rebuild a second basis.
    const behind = speed > 0.28 && lookIdle > 0.35 && mode === 'play' && !climbing;
    const showingOff = (aMode === 'sit' || aMode === 'loaf' || aMode === 'groom' || mode === 'title' || mode === 'ending') && lookIdle > 0.5 && speed < 0.12;
    if (!cameraHold) {
      if (mode === 'title') {
        cameraYaw = player.yaw + Math.PI - 0.58 + Math.sin(time * 0.16) * 0.05;
        cameraPitch = 0.2 + Math.sin(time * 0.11) * 0.012;
      } else if (mode === 'ending') {
        cameraYaw = dampAngle(cameraYaw, player.yaw + Math.PI - 0.35 + Math.sin(time * 0.12) * 0.18, cardHide ? 0.4 : 1.4, dt);
        cameraPitch = damp(cameraPitch, 0.32, 1.4, dt);
      } else if (showingOff && lookIdle > 0.9) {
        cameraYaw = dampAngle(cameraYaw, player.yaw + Math.PI - 0.48, 1.1, dt);
        cameraPitch = damp(cameraPitch, 0.36, 1.1, dt);
      } else if (behind) {
        cameraYaw = dampAngle(cameraYaw, player.yaw, 3.1, dt);
      }
    }

    _fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const dist = mode === 'title' ? 1.78 : (showingOff || mode === 'ending') ? 2.7 : climbing ? 3.8 : 3.35;
    const horiz = dist * Math.cos(cameraPitch);
    const lookLift = mode === 'title' ? 0.22 : 0.38;
    _look.set(player.x + _fwd.x * 0.12, player.y + lookLift + Math.sin(time * 2) * 0.008 * clamp(speed, 0, 1), player.z + _fwd.z * 0.12);
    _desired.set(
      _look.x + Math.sin(cameraYaw) * horiz,
      _look.y + Math.sin(cameraPitch) * dist * 0.92,
      _look.z + Math.cos(cameraYaw) * horiz,
    );
    const dx = _desired.x - _look.x;
    const dy = _desired.y - _look.y;
    const dz = _desired.z - _look.z;
    let best = 1;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      if (insideSolid(_look.x + dx * t, _look.y + dy * t, _look.z + dz * t)) {
        best = Math.max(0.18, (i - 1) / 8);
        break;
      }
    }
    _cam.set(_look.x + dx * best, Math.max(0.25, _look.y + dy * best), _look.z + dz * best);
    if (!camReady) {
      camera.position.copy(_cam);
      camReady = true;
    } else {
      const k = mode === 'title' ? 1 : 1 - Math.exp(-6 * dt);
      camera.position.lerp(_cam, k);
    }
    camera.lookAt(_look);

    if (mode === 'ending' && !endingCard && time > 0) {
      /* card appears shortly after the loaf settles */
    }
    if (mode === 'ending') {
      endingCard = true;
    }

    world.update(dt, { sunT, night: nightAmount(), time });

    const purr = (aMode === 'loaf' || aMode === 'endloaf' || aMode === 'sit' || mode === 'title')
      ? (aMode === 'endloaf' || aMode === 'loaf' ? 0.16 : 0.07)
      : 0;
    audio.update({
      night: nightAmount(),
      comforts: actors.haveCount(),
      paused: mode === 'pause' || mode === 'shop',
      ending: mode === 'ending',
      purr,
    });

    if (mode === 'play' && Math.random() < dt * (0.15 + nightAmount())) {
      audio.chirp((Math.random() * 2 - 1) * 0.8);
    }

    return view();
  }

  function view() {
    const near = mode === 'play' || mode === 'shop' ? actors.nearest({ ...player, sneaking: sneaked, climbing }) : null;
    const night = sunT >= 1;
    let ending = null;
    if (mode === 'ending') {
      const clock = formatTime(elapsed);
      ending = {
        title: night || nightEnding ? 'The sun left first.' : 'The nap held.',
        body: night || nightEnding
          ? `Miso finished anyway, in ${clock}, under a cooler sky. ${motes + spent} shiny things found, ${spent} of them spent, ${knocks} knocked-over opinions.`
          : `Miso put the afternoon back together in ${clock}. ${motes + spent} shiny things found, ${spent} spent, ${knocks} opinions knocked over. The sill was warm. That was the point.`,
        hide: cardHide,
      };
    }
    return {
      mode,
      objective: actors.objective(),
      prompt: message || (near && near.prompt) || '',
      motes,
      sun: clamp(sunT, 0, 1.15),
      night: nightAmount(),
      have: Object.fromEntries(actors.ORDER.map((id) => [id, actors.items[id].have])),
      hint: mode === 'play' ? clamp(1 - (elapsed - 14) / 8, 0, 1) : 0,
      ending,
      best: settings.best,
      volume: settings.volume,
      sens: settings.sens,
      invert: settings.invert,
      shadows: quality.shadows && !quality.software,
      software: quality.software,
      shop: SHOP.map((s) => ({
        ...s,
        owned: s.id === 'daylight' ? upgrades.daylight >= 2 : Boolean(upgrades[s.id]),
        note: s.id === 'daylight' && upgrades.daylight > 0 ? `${upgrades.daylight}/2` : '',
      })),
      count: actors.haveCount(),
    };
  }

  // Prime one visual frame so the title is already a garden.
  cat.root.position.set(player.x, player.y, player.z);
  cat.root.rotation.y = player.yaw;
  cat.update(1 / 60, { speed: 0, turn: 0, grounded: true, vy: 0, mode: 'loaf', lookYaw: 0.2, lookPitch: 0.05, innocent: 0, squint: 1, extra: 0 });

  return {
    update,
    view,
    reset: resetRun,
    audioResume: () => audio.resume(),
    debug: {
      tp(x, z) { player.x = x; player.z = z; player.y = 0; player.vx = 0; player.vz = 0; mode = 'play'; },
      give(id) { actors.collect(id); },
      motes(n) { motes += n; },
      sun(t) { sunT = t; },
      finish() {
        for (const id of actors.ORDER) actors.collect(id);
        finish();
      },
      hold(on) { cameraHold = on !== false; },
      state: () => ({ x: player.x, y: player.y, z: player.z, yaw: player.yaw, mode, motes, sunT, have: actors.haveCount(), climbing, swimming }),
    },
  };
}
