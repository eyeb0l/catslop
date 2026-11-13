// The rules: catch, carry, deliver, get paid, spend, and eventually eat the tin.
import * as THREE from 'three';
import { GIFTS, GIFT_ORDER, SHOP, TIPS, FIRST_TIME_BONUS } from './data.js';
import { clamp, damp } from './util.js';
import { heightAt, waterDepthAt } from './terrain.js';

const SAVE_KEY = 'catslop:claude-fable-5-2:v1';
const fresh = () => ({
  v: 1, treats: 0, delivered: {}, owned: {}, wearing: [], coat: 'marmalade', tips: {},
  stats: { gifts: 0, pounces: 0, catches: 0, time: 0, soaked: 0, earned: 0 }, dotHits: 0, ended: false,
  settings: { volume: 0.8, sensitivity: 1, music: true, invertY: false, quality: 'auto' },
});

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    const base = fresh();
    return { ...base, ...s, stats: { ...base.stats, ...s.stats }, settings: { ...base.settings, ...s.settings } };
  } catch { return null; }
}

export class Game {
  constructor(deps) {
    Object.assign(this, deps); // player, wildlife, fx, sound, ui, props, env, cam, input, scene
    const saved = loadSave();
    this.hadSave = !!saved && (saved.stats.gifts > 0 || saved.stats.time > 30);
    this.state = saved || fresh();
    this.bag = [];
    this.hitStop = 0; this.deliverTimer = 0; this.saveTimer = 0; this.travelled = 0; this.tipTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.ending = null;
    this.purr = 0; this.happyTimer = 0; this.meowCool = 0; this.fullWarn = 0;

    // Bouncing markers: "bring it here" and "you can afford something".
    const cone = new THREE.ConeGeometry(0.16, 0.34, 4); cone.rotateX(Math.PI);
    this.matMarker = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: '#ffd23e', fog: false }));
    this.shopMarker = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: '#ff5d7e', fog: false }));
    this.matMarker.visible = this.shopMarker.visible = false;
    this.scene.add(this.matMarker, this.shopMarker);

    // The tin itself.
    const label = document.createElement('canvas'); label.width = 256; label.height = 96;
    const g = label.getContext('2d');
    g.fillStyle = '#d7263d'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#f6c544'; g.fillRect(0, 0, 256, 14); g.fillRect(0, 82, 256, 14);
    g.fillStyle = '#fff'; g.font = '900 42px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('CATSLOP', 64, 50); g.fillText('CATSLOP', 192, 50);
    const tex = new THREE.CanvasTexture(label); tex.colorSpace = THREE.SRGBColorSpace;
    const metal = new THREE.MeshStandardMaterial({ color: '#cfd3d6', metalness: 0.9, roughness: 0.3 });
    this.tin = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.16, 24), [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), metal, metal]);
    this.tin.castShadow = true; this.tin.visible = false;
    this.scene.add(this.tin);

    this.wildlife.emit = (ev, c) => this.onWildlife(ev, c);
    this.player.findTarget = (p, power) => this.wildlife.findTarget(p, power);
    const ev = this.player.events;
    ev.jump = (power) => { this.state.stats.pounces++; this.sound.whoosh(power); if (power > 0.2) this.state.tips.jump = true; };
    ev.land = (impact, p) => { this.sound.land(impact); if (impact > 0.3) this.fx.dust(p.pos, impact, waterDepthAt(p.pos.x, p.pos.z) > 0 ? [0.8, 0.9, 1] : undefined); if (impact > 0.75) this.cam.shake = 0.5; };
    ev.splash = (s, p) => { tmp.set(p.pos.x, p.pos.y + 0.36, p.pos.z); this.fx.splash(tmp, s); this.sound.splash(s); if (s > 0.6) { this.state.stats.soaked++; this.sound.meow('yelp'); } };
    ev.shake = (p) => { tmp.copy(p.pos); this.fx.spray(tmp); this.sound.shake(); };
    ev.step = (i, sp, p) => {
      const wood = p.pos.y - heightAt(p.pos.x, p.pos.z) > 0.12;
      const surface = p.wading > 0.15 ? 'water' : wood ? 'wood' : heightAt(p.pos.x, p.pos.z) < 0.9 ? 'sand' : 'grass';
      if (!p.sneaking) this.sound.step(sp, surface);
      if (p.wading > 0.3 && i < 2) { tmp.set(p.pos.x, p.pos.y + p.wading * 0.3, p.pos.z); this.fx.splash(tmp, 0.05); }
      if (this.state.wearing.includes('bell') && i === 0) this.sound.bell();
    };
    this.applyLoadout();
    if (this.state.ended) this.placeTin(1);
  }

  get capacity() { return this.state.owned.backpack ? 4 : 1; }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* storage unavailable: play on without saving */ }
  }
  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to erase */ }
    location.reload();
  }

  applyLoadout() {
    const s = this.state, up = this.player.upgrades, cat = this.player.cat;
    up.springy = !!s.owned.springy; up.softPaws = !!s.owned.softPaws; up.zoomies = !!s.owned.zoomies; up.wings = !!s.owned.wings;
    up.bell = s.wearing.includes('bell');
    this.wildlife.nightEyes = !!s.owned.nightEyes;
    cat.setCoat(s.coat);
    cat.setAccessory('backpack', !!s.owned.backpack);
    cat.setAccessory('wings', !!s.owned.wings);
    cat.setAccessory('bell', up.bell);
    for (const hat of ['party', 'wizard', 'crown']) cat.setAccessory(hat, s.wearing.includes(`hat:${hat}`));
    this.cam.sensitivity = s.settings.sensitivity; this.cam.invertY = s.settings.invertY;
    this.sound.setVolume(s.settings.volume); this.sound.setMusic(s.settings.music);
  }

  // ---- Shop ------------------------------------------------------------------------------
  shop(id) {
    const s = this.state, it = SHOP.find((x) => x.id === id);
    if (!it) return;
    if (!s.owned[id]) {
      if (it.price > 0 && s.treats < it.price) { this.sound.nope(); return; }
      s.treats -= it.price; s.owned[id] = true;
      this.sound.buy();
      if (it.kind === 'coat') s.coat = id.split(':')[1];
      if (it.kind === 'hat') s.wearing = s.wearing.filter((w) => !w.startsWith('hat:')).concat(id);
      if (id === 'bell') s.wearing.push('bell');
      if (it.kind === 'goal') { this.applyLoadout(); this.save(); this.ui.close(); this.startEnding(); return; }
    } else if (it.kind === 'coat') {
      const coat = id.split(':')[1];
      s.coat = s.coat === coat ? 'marmalade' : coat; this.sound.click();
    } else if (it.kind === 'hat') {
      const on = s.wearing.includes(id);
      s.wearing = s.wearing.filter((w) => !w.startsWith('hat:'));
      if (!on) s.wearing.push(id);
      this.sound.click();
    } else if (id === 'bell') {
      s.wearing = s.wearing.includes('bell') ? s.wearing.filter((w) => w !== 'bell') : s.wearing.concat('bell');
      this.sound.bell();
    }
    this.applyLoadout(); this.save();
    this.ui.setTreats(s.treats, true);
    this.ui.openShop(s);
  }

  // ---- Catching ----------------------------------------------------------------------------
  take(c) {
    if (this.bag.length >= this.capacity) {
      if (this.fullWarn <= 0) { this.ui.toast(this.capacity > 1 ? 'Backpack full. Take it home.' : 'Mouth full. Take it home.', 'plain'); this.sound.nope(); this.fullWarn = 2.5; }
      return false;
    }
    const first = !this.state.delivered[c.type];
    this.wildlife.carry(c, this.player.cat, true);
    for (const o of this.bag) o.mesh.visible = false;
    this.bag.push(c);
    this.state.stats.catches++; this.state.tips.catch = true;
    this.hitStop = 0.09;
    this.player.cat.headWorld && this.fx.sparkle(this.player.cat.headWorld, first ? [0.5, 1, 0.9] : [1, 0.85, 0.35], first ? 34 : 20);
    this.sound.catch(first);
    this.ui.caught(c.type, first);
    this.cam.shake = 0.35;
    return true;
  }

  onWildlife(ev, c) {
    const pp = this.player.pos;
    const v = c && c.pos ? clamp(1 - c.pos.distanceTo(pp) / 22) : 1;
    switch (ev) {
      case 'croak': if (v > 0.05) this.sound.croak(v); break;
      case 'squeak': this.sound.squeak(v); break;
      case 'plop': this.sound.plop(v); break;
      case 'leap': this.sound.plop(v * 0.8); break;
      case 'takeoff': this.sound.flap(); break;
      case 'alarm': if (c && c.type === 'sparrow') this.sound.chirp(1); break;
      case 'pinch': {
        const p = this.player;
        const dx = pp.x - c.pos.x, dz = pp.z - c.pos.z, d = Math.hypot(dx, dz) || 1;
        p.vel.set((dx / d) * 4.5, 5, (dz / d) * 4.5); p.grounded = false; p.stun = 0.5; p.pos.y += 0.05;
        this.sound.snip(1); this.sound.meow('yelp');
        this.ui.toast('Pinched!', 'plain'); this.cam.shake = 0.6;
        break;
      }
      case 'dot-on': this.ui.toast('Something red is in the yard.', 'plain'); break;
      case 'dot-hit': {
        this.state.dotHits++; this.sound.catch(false);
        if (c.hits >= 3) this.reward('reddot'); else this.ui.toast(`Got it! …It is not in your mouth. (${c.hits}/3)`, 'plain');
        break;
      }
      case 'dot-off': if (c.hits >= 3) this.sound.laugh(); break;
      default: break;
    }
  }

  /** Pay out for one gift and have the Tall One comment on it. */
  reward(type) {
    const s = this.state, g = GIFTS[type];
    const n = s.delivered[type] || 0, first = n === 0;
    const amount = g.value * (first ? FIRST_TIME_BONUS : 1);
    s.delivered[type] = n + 1; s.treats += amount; s.stats.gifts++; s.stats.earned += amount;
    const quote = first ? g.said[0] : g.said[1 + ((n - 1) % (g.said.length - 1))];
    this.ui.note({ title: type === 'reddot' ? `${g.name} caught` : `${g.name} delivered`, reward: first ? `+${amount} treats (first time ×${FIRST_TIME_BONUS})` : `+${amount} treats`, quote });
    this.ui.setTreats(s.treats, true);
    this.sound.coins(Math.ceil(amount / 3));
    const sp = this.project(this.props.spots.bowl);
    if (sp) this.ui.float(`+${amount}`, sp.x, sp.y - 30);
    this.happyTimer = 6;
    this.save();
    const found = GIFT_ORDER.filter((t) => s.delivered[t]).length;
    if (found === GIFT_ORDER.length && !s.allFound) { s.allFound = true; this.ui.toast('Every kind of gift delivered. The Tall One is speechless.', 'new'); this.sound.fanfare(); }
  }

  project(v) {
    tmp.copy(v).project(this.cam.camera);
    if (tmp.z > 1) return null;
    return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight };
  }

  // ---- Ending ----------------------------------------------------------------------------------
  placeTin(k) {
    const spots = this.props.spots;
    const from = spots.flap.position, to = tmp.set(spots.doormat.x + 0.95, spots.deckTop + 0.08, spots.doormat.z + 0.05);
    this.tin.visible = true;
    this.tin.position.set(from.x + (to.x - from.x) * k, to.y, from.z + 0.1 + (to.z - from.z - 0.1) * k);
    this.tin.rotation.y = k * 5;
  }
  startEnding() {
    const spots = this.props.spots, p = this.player;
    this.ending = { t: 0, stage: 0 };
    p.frozen = true;
    p.teleport(spots.doormat.x - 0.1, spots.doormat.z + 0.25, Math.PI * 0.75);
    this.cam.snap(p.pos, Math.PI * 0.35);
    this.cam.pitch = 0.22; this.cam.wantDist = 3.2;
    this.sound.flap();
    this.state.ended = true;
    this.save();
  }
  updateEnding(dt) {
    const e = this.ending, spots = this.props.spots;
    e.t += dt;
    spots.flap.rotation.x = e.t < 2.2 ? -Math.sin(Math.min(1, e.t / 0.5) * Math.PI * 0.5) * 1.1 * (e.t > 1.7 ? 1 - (e.t - 1.7) / 0.5 : 1) : Math.sin(e.t * 9) * 0.25 * Math.max(0, 1 - (e.t - 2.2));
    this.placeTin(clamp((e.t - 0.4) / 1.3));
    this.player.forceSit = e.t > 1.2;
    this.player.look = this.tin.position;
    if (e.stage === 0 && e.t > 1.8) { e.stage = 1; this.sound.canOpen(); this.sound.meow('demand'); }
    if (e.stage === 1 && e.t > 2.6) { e.stage = 2; this.sound.fanfare(); this.happyTimer = 30; }
    if (e.stage >= 2 && Math.random() < dt * 5) { tmp.copy(this.player.cat.headWorld); tmp.y += 0.25; this.fx.sprite('heart', tmp, { rise: 0.7 }); }
    if (e.stage === 2 && e.t > 5.2) {
      e.stage = 3;
      const s = this.state, mm = Math.floor(s.stats.time / 60), ss = Math.floor(s.stats.time % 60);
      this.ui.openEnd([
        ['Gifts delivered', s.stats.gifts], ['Kinds of gift', `${GIFT_ORDER.filter((t) => s.delivered[t]).length} of ${GIFT_ORDER.length}`],
        ['Treats earned', s.stats.earned], ['Pounces', s.stats.pounces], ['Unplanned swims', s.stats.soaked],
        ['Time as a cat', `${mm}:${String(ss).padStart(2, '0')}`],
      ]);
      this.input.releaseLock();
    }
  }
  endEnding() {
    if (!this.ending || this.ending.stage < 3) return;
    this.ending = null;
    this.player.frozen = false; this.player.forceSit = false; this.player.look = null;
    this.props.spots.flap.rotation.x = 0;
  }

  // ---- Per-frame ----------------------------------------------------------------------------------
  update(dt, rawDt) {
    const { player: p, state: s, ui, props, wildlife, fx } = this;
    const spots = props.spots;
    s.stats.time += dt;
    this.hitStop = Math.max(0, this.hitStop - rawDt);
    this.fullWarn = Math.max(0, this.fullWarn - dt);
    this.meowCool = Math.max(0, this.meowCool - dt);
    if (this.lastPos.lengthSq() > 0) this.travelled += this.lastPos.distanceTo(p.pos);
    this.lastPos.copy(p.pos);
    if (this.travelled > 5) s.tips.move = true;
    if (p.sneaking) s.tips.sneak = true;

    if (this.ending) this.updateEnding(dt);

    // Catch whatever the pounce reached.
    const hit = wildlife.tryCatch(p);
    if (hit) { if (!this.take(hit)) { hit.cool = 1; } }

    // Loose objects can simply be picked up.
    const loose = this.ending ? null : wildlife.pickupNear(p);
    const nearShop = !this.ending && Math.hypot(p.pos.x - spots.catalogue.x, p.pos.z - spots.catalogue.z) < 2.3 && Math.abs(p.pos.y - spots.deckTop) < 1.2;
    let prompt = '';
    if (loose) prompt = `<kbd>E</kbd> pick up the ${GIFTS[loose.type].name.toLowerCase()}`;
    else if (nearShop) prompt = '<kbd>E</kbd> read the Cat-alogue';
    if (this.input.pressed('interact') && !p.frozen) {
      if (loose) this.take(loose);
      else if (nearShop) { s.tips.shop = true; this.sound.paper(); this.input.releaseLock(); ui.openShop(s); }
    }
    if (this.input.pressed('meow') && this.meowCool <= 0 && !p.frozen) {
      this.meowCool = 0.5; this.sound.meow('meow');
      tmp.copy(p.cat.headWorld); tmp.y += 0.3; fx.sprite('note', tmp, { life: 0.9, scale: 0.28 });
    }

    // Doormat deliveries, one gift at a time.
    const onMat = Math.abs(p.pos.x - spots.doormat.x) < 0.95 && Math.abs(p.pos.z - spots.doormat.z) < 0.7 && Math.abs(p.pos.y - spots.deckTop) < 0.4 && p.grounded;
    this.deliverTimer -= dt;
    if (onMat && this.bag.length && this.deliverTimer <= 0) {
      const c = this.bag.pop();
      const k = s.stats.gifts % 5;
      tmp.set(spots.doormat.x - 0.45 + k * 0.22, spots.deckTop + 0.035, spots.doormat.z - 0.28 + (k % 2) * 0.1);
      wildlife.deliver(c, tmp);
      if (this.bag.length) this.bag[this.bag.length - 1].mesh.visible = true;
      this.sound.deliver();
      fx.sparkle(tmp, [1, 0.85, 0.4], 14);
      this.reward(c.type);
      this.deliverTimer = 0.5;
      p.sneaking = false;
    }

    // Mood: a cat that has just been paid purrs about it.
    this.happyTimer = Math.max(0, this.happyTimer - dt);
    const content = this.happyTimer > 0 && p.speed < 0.5;
    p.happy = this.happyTimer > 0 ? 1 : 0;
    this.purr = damp(this.purr, content || (p.sitting && onMat) ? 1 : 0, 3, dt);
    this.sound.setPurr(this.purr);
    if (content && Math.random() < dt * 1.6) { tmp.copy(p.cat.headWorld); tmp.y += 0.28; fx.sprite('heart', tmp, { rise: 0.55, scale: 0.26 }); }

    // The cat watches whatever is nearest.
    if (!this.ending) {
      const n = wildlife.nearest;
      p.look = n ? n.pos : null;
      p.alert = n && (p.sneaking || p.charging) ? 1 : 0;
    }

    // Markers.
    const t = this.env.elapsed;
    this.matMarker.visible = this.bag.length > 0 && !onMat;
    this.matMarker.position.set(spots.doormat.x, spots.deckTop + 1.15 + Math.sin(t * 4) * 0.12, spots.doormat.z);
    this.matMarker.rotation.y = t * 2;
    const cheapest = SHOP.some((it) => it.kind === 'gear' && it.price > 0 && !s.owned[it.id] && s.treats >= it.price);
    this.shopMarker.visible = cheapest && !s.tips.shop && !nearShop;
    this.shopMarker.position.set(spots.catalogue.x, spots.catalogue.y + 0.75 + Math.sin(t * 4 + 1) * 0.1, spots.catalogue.z);
    this.shopMarker.rotation.y = -t * 2;

    // HUD.
    ui.setPrompt(prompt);
    ui.setBag(this.bag.map((c) => c.type), this.capacity);
    ui.setClock(this.env.clock(), this.env.isDark);
    const found = GIFT_ORDER.filter((x) => s.delivered[x]).length;
    ui.setGoal(s.ended ? `Gifts <b>${found}/${GIFT_ORDER.length}</b> · fed, for now` : `Gifts <b>${found}/${GIFT_ORDER.length}</b> · CATSLOP™ <b>${Math.min(s.treats, 150)}/150</b>`);
    ui.setStealth(p.sneaking && !p.swimming ? (p.inTallGrass ? 'hidden' : 'sneak') : s.wearing.includes('bell') && p.speed > 1 ? 'loud' : null);
    ui.setTip(this.currentTip(dt));

    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.save(); }
  }

  currentTip(dt) {
    const s = this.state, tips = s.tips;
    if (this.ending || s.ended) return '';
    const text = (id) => TIPS.find((x) => x.id === id).text;
    if (!tips.move) return text('move');
    if (!tips.jump) return text('jump');
    if (this.bag.length && s.stats.gifts === 0) return text('carry');
    if (!tips.catch) return text('catch');
    if (!tips.shop && s.treats >= 25) return text('shop');
    if (!tips.sneak && s.stats.gifts >= 1) { this.tipTimer += dt; if (this.tipTimer > 25) tips.sneak = true; return text('sneak'); }
    if (!tips.journal && s.stats.gifts >= 2) { this.tipTimer += dt; if (this.tipTimer > 45) tips.journal = true; return text('journal'); }
    return '';
  }
}

const tmp = new THREE.Vector3();
