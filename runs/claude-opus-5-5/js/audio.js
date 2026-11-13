// Every sound in the game is synthesised here with the Web Audio API.
// No samples: meows are a sawtooth through moving formant filters, the music
// is an FM electric piano, a walking bass and brushes, scheduled ahead of time.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);
// The reverb sends were tuned at these settings; wet gains are scaled relative to them.
const DEFAULT_VOL = { music: 0.55, sfx: 0.85 };

export class Sound {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, ...DEFAULT_VOL };
    this.intensity = 0; // 0..1, pushed by the game (combo, last hour)
    this.ticking = false;
    this.musicOn = true;
    this._purr = null;
    this._hum = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);
    this.musicBus = c.createGain();
    this.sfxBus = c.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);

    // a small, warm room
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulse(1.6, 2.8);
    const revGain = c.createGain();
    revGain.gain.value = 0.32;
    this.reverb.connect(revGain).connect(this.master);
    this.revSend = c.createGain();
    this.revSend.gain.value = 1;
    this.revSend.connect(this.reverb);
    // each category's wet signal passes its own volume control on the way to the reverb
    this.musicWet = c.createGain();
    this.sfxWet = c.createGain();
    this.musicWet.connect(this.revSend);
    this.sfxWet.connect(this.revSend);

    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.applyVolumes();
    this._startMusic();
  }

  _impulse(seconds, decay) {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? this.vol.music * 0.5 : 0, t, 0.3);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.musicWet.gain.setTargetAtTime(this.musicOn ? this.vol.music / DEFAULT_VOL.music : 0, t, 0.3);
    this.sfxWet.gain.setTargetAtTime(this.vol.sfx / DEFAULT_VOL.sfx, t, 0.05);
  }

  setMusic(on) {
    this.musicOn = on;
    this.applyVolumes();
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---------- building blocks ----------

  _out(gain = 1, pan = 0, wet = 0.25, bus = null) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain;
    let node = g;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      node = p;
    }
    node.connect(bus || this.sfxBus);
    if (wet > 0) {
      const s = c.createGain();
      s.gain.value = wet;
      node.connect(s).connect(bus === this.musicBus ? this.musicWet : this.sfxWet);
    }
    return g;
  }

  _env(param, t, peak, attack, decay, sustain = 0, release = 0.05, hold = 0) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + attack);
    if (sustain > 0) {
      param.setTargetAtTime(peak * sustain, t + attack, decay / 3);
      param.setTargetAtTime(0.0001, t + attack + hold, release / 3);
    } else {
      param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
  }

  _osc(type, freq, t, dur, dest, gain = 0.3, attack = 0.005, freqEnd = null) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    this._env(g.gain, t, gain, attack, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  _noise(t, dur, dest, { gain = 0.3, type = 'bandpass', freq = 1000, freqEnd = null, Q = 1, attack = 0.003 } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = rand(0.9, 1.1);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = Q;
    const g = c.createGain();
    this._env(g.gain, t, gain, attack, dur);
    s.connect(f).connect(g).connect(dest);
    const off = Math.random() * 1.5;
    s.start(t, off);
    s.stop(t + attack + dur + 0.05);
  }

  _partials(t, base, ratios, decay, dest, gain = 0.15) {
    ratios.forEach((r, i) => {
      this._osc('sine', base * r * rand(0.99, 1.01), t, decay / (1 + i * 0.6), dest, gain / (1 + i * 0.7), 0.001);
    });
  }

  // ---------- the cat ----------

  meow({ pitch = 1, length = 1, pan = 0, vol = 1, kind = 'meow' } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const dur = (kind === 'mrrp' ? 0.22 : kind === 'yowl' ? 0.75 : 0.5) * length * rand(0.85, 1.15);
    const f0 = (kind === 'yowl' ? 560 : kind === 'mrrp' ? 380 : 600) * pitch * rand(0.92, 1.08);
    const out = this._out(0.0001, pan, 0.3);
    const src = c.createOscillator();
    src.type = 'sawtooth';
    if (kind === 'mrrp') {
      src.frequency.setValueAtTime(f0 * 0.8, t);
      src.frequency.linearRampToValueAtTime(f0 * 1.3, t + dur);
    } else {
      src.frequency.setValueAtTime(f0 * 0.82, t);
      src.frequency.linearRampToValueAtTime(f0 * 1.28, t + dur * 0.33);
      src.frequency.linearRampToValueAtTime(f0 * (kind === 'yowl' ? 0.6 : 0.78), t + dur);
    }
    const lfo = c.createOscillator();
    lfo.frequency.value = kind === 'mrrp' ? 28 : 6.5;
    const lfoG = c.createGain();
    lfoG.gain.value = f0 * (kind === 'mrrp' ? 0.08 : 0.025);
    lfo.connect(lfoG).connect(src.frequency);

    // formant path m-i-a-o-w
    const F = [
      [[350, 0], [420, 0.15], [950, 0.45], [650, 0.85], [420, 1]],
      [[1200, 0], [2100, 0.15], [1600, 0.45], [1000, 0.85], [800, 1]],
      [[2600, 0], [2900, 0.15], [2700, 0.5], [2500, 1]],
    ];
    const sum = c.createGain();
    sum.gain.value = 1;
    F.forEach((path, i) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = [6, 9, 10][i];
      path.forEach(([f, at], k) => {
        if (k === 0) bp.frequency.setValueAtTime(f * pitch, t);
        else bp.frequency.linearRampToValueAtTime(f * pitch, t + dur * at);
      });
      const g = c.createGain();
      g.gain.value = [1.0, 0.7, 0.35][i];
      src.connect(bp).connect(g).connect(sum);
    });
    sum.connect(out);
    const peak = 0.55 * vol;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(peak * 0.4, t + 0.04);
    out.gain.linearRampToValueAtTime(peak, t + dur * 0.3);
    out.gain.linearRampToValueAtTime(peak * 0.7, t + dur * 0.8);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    src.start(t); lfo.start(t);
    src.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    // breath
    this._noise(t, dur * 0.8, out, { gain: 0.04 * vol, freq: 3000, Q: 0.7 });
  }

  chatter(pan = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.01;
    const out = this._out(1.4, pan, 0.2);
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.075;
      this._osc('square', rand(820, 980), t, 0.035, out, 0.08, 0.002, 600);
      this._noise(t, 0.03, out, { gain: 0.08, freq: 2500, Q: 3 });
    }
  }

  hiss(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this._out(0.6, pan, 0.2);
    this._noise(t, 0.7, out, { gain: 0.5, type: 'highpass', freq: 2500, attack: 0.03 });
    this.meow({ kind: 'yowl', pitch: 1.25, vol: 0.8, pan });
  }

  purr(on, strength = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this._purr) {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const am = c.createGain();
      am.gain.value = 0;
      const lfo = c.createOscillator();
      lfo.type = 'sawtooth';
      lfo.frequency.value = 26;
      const lfoG = c.createGain();
      lfoG.gain.value = 0.5;
      lfo.connect(lfoG).connect(am.gain);
      const breath = c.createOscillator();
      breath.frequency.value = 0.45;
      const bG = c.createGain();
      bG.gain.value = 0.25;
      breath.connect(bG).connect(am.gain);
      const out = this._out(0.0001, 0, 0.1);
      s.connect(lp).connect(am).connect(out);
      s.start(); lfo.start(); breath.start();
      out.gain.setTargetAtTime(0.9 * strength, c.currentTime, 0.6);
      this._purr = { s, lfo, breath, out };
    } else if (!on && this._purr) {
      const p = this._purr;
      this._purr = null;
      p.out.gain.setTargetAtTime(0.0001, c.currentTime, 0.25);
      const end = c.currentTime + 1.2;
      p.s.stop(end); p.lfo.stop(end); p.breath.stop(end);
    }
  }

  step(vol = 1, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.04, this._out(1, pan, 0.05), { gain: 0.2 * vol, freq: rand(500, 900), Q: 1.5 });
  }

  jump(power = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.18 + power * 0.1, this._out(1, 0, 0.1), { gain: 0.25 + power * 0.2, freq: 600, freqEnd: 1800, Q: 1.2, attack: 0.02 });
  }

  land(speed = 3, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, speed / 8);
    const out = this._out(1, pan, 0.15);
    this._noise(t, 0.09 + k * 0.08, out, { gain: 0.1 + k * 0.3, type: 'lowpass', freq: 500 + k * 400, Q: 0.8 });
    this._osc('sine', 110, t, 0.08, out, 0.1 + k * 0.25, 0.002, 55);
  }

  swat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.14, this._out(1, 0, 0.1), { gain: 0.6, freq: 1200, freqEnd: 3500, Q: 2, attack: 0.01 });
  }

  scratch() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const out = this._out(1, 0, 0.15);
    for (let i = 0; i < 4; i++) this._noise(t0 + i * 0.07, 0.06, out, { gain: 0.25, freq: rand(2500, 4000), Q: 4 });
  }

  // ---------- objects ----------

  impact(material, speed, pan = 0, shatter = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const k = Math.max(0.15, Math.min(1, speed / 6));
    const out = this._out(1, pan, 0.3);
    switch (material) {
      case 'ceramic':
        this._partials(t, rand(1500, 2300), [1, 2.76, 5.4], 0.35, out, 0.2 * k);
        this._noise(t, 0.05, out, { gain: 0.25 * k, freq: 3000, Q: 1 });
        break;
      case 'glass':
        this._partials(t, rand(2600, 3800), [1, 2.32, 4.1], 0.6, out, 0.18 * k);
        break;
      case 'metal':
        this._partials(t, rand(520, 760), [1, 2.4, 3.9, 5.3], 1.1, out, 0.2 * k);
        this._noise(t, 0.06, out, { gain: 0.2 * k, freq: 2000, Q: 1 });
        break;
      case 'plastic':
        this._osc('triangle', rand(380, 520), t, 0.09, out, 0.3 * k, 0.002, 240);
        break;
      case 'paper':
        this._noise(t, 0.12, out, { gain: 0.3 * k, freq: 1800, Q: 0.7 });
        break;
      case 'soil':
        this._noise(t, 0.18, out, { gain: 0.5 * k, type: 'lowpass', freq: 700, Q: 0.7 });
        for (let i = 0; i < 6; i++) this._noise(t + 0.05 + i * 0.03, 0.04, out, { gain: 0.12 * k, freq: rand(1500, 3000), Q: 2 });
        this._osc('sine', 140, t, 0.12, out, 0.3 * k, 0.002, 60);
        break;
      case 'egg':
        this._noise(t, 0.25, out, { gain: 0.45 * k, type: 'lowpass', freq: 2500, freqEnd: 250, Q: 3 });
        this._osc('sine', 300, t, 0.08, out, 0.15 * k, 0.002, 90);
        break;
      case 'fish':
        this._noise(t, 0.16, out, { gain: 0.5 * k, freq: 900, freqEnd: 300, Q: 2 });
        this._osc('sine', 160, t, 0.1, out, 0.25 * k, 0.002, 70);
        break;
      case 'fruit':
        this._osc('sine', rand(170, 230), t, 0.1, out, 0.35 * k, 0.002, 90);
        this._noise(t, 0.06, out, { gain: 0.15 * k, type: 'lowpass', freq: 900 });
        break;
      case 'wood':
      default:
        this._noise(t, 0.1, out, { gain: 0.4 * k, type: 'lowpass', freq: 650, Q: 0.8 });
        this._osc('sine', 150, t, 0.09, out, 0.3 * k, 0.002, 70);
    }
    if (shatter) this.shatter(pan, material === 'glass' ? 1 : 0.7);
  }

  shatter(pan = 0, bright = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const out = this._out(1, pan, 0.4);
    this._noise(t, 0.35, out, { gain: 0.45, type: 'highpass', freq: 2500 * bright });
    const n = 14 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      const tt = t + Math.pow(Math.random(), 1.8) * 0.4;
      this._osc('sine', rand(2200, 7000) * bright, tt, rand(0.05, 0.18), out, rand(0.03, 0.09), 0.001);
    }
  }

  // ---------- feedback ----------

  ding(level = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const m = 72 + scale[Math.min(scale.length - 1, level)];
    const out = this._out(0.9, 0, 0.35);
    this._fmNote(t, mtof(m), 0.5, out, 0.16, 3.5);
    this._fmNote(t + 0.07, mtof(m + 7), 0.5, out, 0.1, 3.5);
  }

  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const out = this._out(0.9, 0, 0.4);
    [60, 64, 67, 72, 76].forEach((m, i) => this._fmNote(t + i * 0.08, mtof(m + 5), 0.9, out, 0.13, 2.5));
    this._fmNote(t + 0.45, mtof(84 + 5), 1.4, out, 0.12, 3);
  }

  ui(kind = 'click') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.6, 0, 0.05);
    if (kind === 'hover') this._osc('sine', 1400, t, 0.03, out, 0.04, 0.002);
    else if (kind === 'back') this._osc('triangle', 600, t, 0.07, out, 0.12, 0.002, 400);
    else if (kind === 'buy') { this.ding(4); this._noise(t, 0.2, out, { gain: 0.15, freq: 5000, Q: 3 }); }
    else if (kind === 'deny') this._osc('square', 180, t, 0.12, out, 0.08, 0.002, 140);
    else this._osc('triangle', 900, t, 0.05, out, 0.12, 0.002, 1200);
  }

  pop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 500, t, 0.08, this._out(0.7, 0, 0.1), 0.15, 0.002, 900);
  }

  phone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this._out(1.2, 0.3, 0.2);
    this._osc('sine', 1318, t, 0.09, out, 0.12, 0.003);
    this._osc('sine', 1760, t + 0.1, 0.14, out, 0.12, 0.003);
  }

  typing() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const out = this._out(0.6, 0, 0.1);
    for (let i = 0; i < 14; i++) this._noise(t0 + i * rand(0.04, 0.09), 0.02, out, { gain: 0.2, freq: rand(2500, 4500), Q: 5 });
  }

  chirp(pan = 0, vol = 1) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.01;
    const out = this._out(0.5 * vol, pan, 0.3);
    const n = 2 + Math.floor(Math.random() * 4);
    const base = rand(2800, 4200);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * rand(0.09, 0.14);
      this._osc('sine', base * rand(0.9, 1.1), t, 0.07, out, 0.12, 0.004, base * rand(1.2, 1.5));
    }
  }

  door() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const out = this._out(1, 0.5, 0.4);
    // keys
    for (let i = 0; i < 8; i++) this._partials(t + i * 0.05 + Math.random() * 0.03, rand(3000, 5200), [1, 2.7], 0.12, out, 0.04);
    // lock clunk + creak
    this._noise(t + 0.55, 0.08, out, { gain: 0.5, type: 'lowpass', freq: 900 });
    this._osc('sawtooth', 180, t + 0.8, 0.6, out, 0.05, 0.1, 120);
  }

  tick(tock = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.02, this._out(0.6, 0, 0.1), { gain: 0.25, freq: tock ? 1800 : 2600, Q: 8 });
  }

  // continuous robot vacuum hum; level 0 stops it
  hum(level, pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this._hum && level > 0.001) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 92;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 0.8;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const g = c.createGain();
      g.gain.value = 0;
      const p = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      o.connect(lp).connect(g);
      const ng = c.createGain();
      ng.gain.value = 0.35;
      s.connect(f).connect(ng).connect(g);
      g.connect(p).connect(this.sfxBus);
      o.start(); s.start();
      this._hum = { o, s, g, p };
    }
    if (this._hum) {
      const t = c.currentTime;
      this._hum.g.gain.setTargetAtTime(Math.min(0.08, level * 0.08), t, 0.15);
      if (this._hum.p.pan) this._hum.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
    }
  }

  // ---------- music ----------

  _fmNote(t, freq, dur, dest, gain = 0.1, index = 1.5, ratio = 1) {
    const c = this.ctx;
    const car = c.createOscillator();
    car.frequency.value = freq;
    const mod = c.createOscillator();
    mod.frequency.value = freq * ratio;
    const mg = c.createGain();
    mg.gain.setValueAtTime(freq * index, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.08 + 1, t + Math.min(dur, 0.6));
    mod.connect(mg).connect(car.frequency);
    // tine: a high partial that dies fast
    const tine = c.createOscillator();
    tine.frequency.value = freq * 7.01;
    const tg = c.createGain();
    this._env(tg.gain, t, gain * 0.12, 0.001, 0.08);
    tine.connect(tg).connect(dest);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.setTargetAtTime(gain * 0.35, t + 0.01, 0.35);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
    car.connect(g).connect(dest);
    const end = t + dur + 0.6;
    car.start(t); mod.start(t); tine.start(t);
    car.stop(end); mod.stop(end); tine.stop(t + 0.2);
  }

  _startMusic() {
    const c = this.ctx;
    this.musicOut = c.createGain();
    this.musicOut.gain.value = 1;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    this.musicOut.connect(lp).connect(this.musicBus);
    const send = c.createGain();
    send.gain.value = 0.35;
    lp.connect(send).connect(this.musicWet);
    this.musicLP = lp;

    // F major-ish lounge loop, eight bars.  [root, voicing semitones above C3]
    this.chords = [
      { root: 41, notes: [57, 60, 64, 69] }, // Fmaj7  (A C E A)
      { root: 38, notes: [57, 60, 65, 69] }, // Dm7    (A C F A)
      { root: 43, notes: [58, 62, 65, 69] }, // Gm7    (Bb D F A)
      { root: 36, notes: [58, 62, 64, 67] }, // C7     (Bb D E G)
      { root: 45, notes: [55, 60, 64, 67] }, // Am7    (G C E G)
      { root: 38, notes: [54, 57, 60, 66] }, // D7     (F# A C F#)
      { root: 43, notes: [58, 62, 65, 70] }, // Gm7
      { root: 36, notes: [58, 62, 64, 69] }, // C13ish
    ];
    this.scale = [65, 67, 69, 72, 74, 77, 79, 81, 84];
    this.beat = 0;
    this.nextT = c.currentTime + 0.2;
    this.bpm = 92;
    this._timer = setInterval(() => this._schedule(), 60);
  }

  _schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') { if (c) this.nextT = c.currentTime + 0.1; return; }
    const spb = 60 / (this.bpm + this.intensity * 14);
    while (this.nextT < c.currentTime + 0.25) {
      this._playBeat(this.beat, this.nextT, spb);
      this.nextT += spb;
      this.beat++;
    }
  }

  _playBeat(beat, t, spb) {
    const out = this.musicOut;
    const bar = Math.floor(beat / 4) % 8;
    const b = beat % 4;
    const ch = this.chords[bar];
    const swing = spb * 0.62; // swung eighth
    const I = this.intensity;

    // electric piano comping: beat 1 and the "and" of 2 (and some variation)
    if (b === 0 || (b === 1 && Math.random() < 0.85)) {
      const tt = b === 0 ? t : t + swing;
      const dur = b === 0 ? spb * 1.4 : spb * 1.8;
      ch.notes.forEach((n, i) => this._fmNote(tt + i * 0.008, mtof(n), dur, out, 0.045, 1.2));
    }
    if (b === 3 && Math.random() < 0.3) {
      ch.notes.slice(1).forEach((n, i) => this._fmNote(t + swing + i * 0.01, mtof(n), spb * 0.5, out, 0.03, 1.2));
    }

    // walking bass
    const next = this.chords[(bar + 1) % 8];
    let bn;
    if (b === 0) bn = ch.root;
    else if (b === 1) bn = ch.root + (Math.random() < 0.5 ? 7 : 3 + (ch.notes[1] % 12 === (ch.root + 4) % 12 ? 1 : 0));
    else if (b === 2) bn = ch.root + (Math.random() < 0.5 ? 12 : 7);
    else bn = next.root + (Math.random() < 0.5 ? 1 : -1);
    this._bass(t, mtof(bn), spb * 0.9, out);

    // brushes: swish on 2 and 4, ride-ish taps with swing
    if (b === 1 || b === 3) this._noiseMusic(t, spb * 0.6, out, 0.05, 4000, 0.04);
    this._noiseMusic(t, 0.05, out, 0.03, 8000, 0.001);
    if (Math.random() < 0.55 + I * 0.4) this._noiseMusic(t + swing, 0.04, out, 0.022 + I * 0.02, 8000, 0.001);
    if (b === 0) this._kick(t, out, 0.12 + I * 0.08);
    if (I > 0.55 && b === 2) this._kick(t, out, 0.1);

    // vibraphone melody, denser with intensity
    const pNote = 0.18 + I * 0.45;
    for (const off of [0, swing]) {
      if (Math.random() < pNote) {
        const pool = ch.notes.map((n) => n + 12).concat(this.scale);
        const n = pool[Math.floor(Math.random() * pool.length)];
        this._vibe(t + off, mtof(n), spb * rand(0.6, 1.4), out, 0.035 + I * 0.015);
      }
    }

    if (this.ticking) {
      this.tick(b % 2 === 1);
    }
  }

  _bass(t, f, dur, dest) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.01);
    g.gain.setTargetAtTime(0.1, t + 0.02, 0.15);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    o.connect(lp).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.3);
  }

  _vibe(t, f, dur, dest, gain) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.value = f;
    const o2 = c.createOscillator();
    o2.frequency.value = f * 4;
    const trem = c.createOscillator();
    trem.frequency.value = 5.5;
    const tg = c.createGain();
    tg.gain.value = 0.3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.01, dur * 0.5);
    const g2 = c.createGain();
    this._env(g2.gain, t, gain * 0.3, 0.002, 0.15);
    const am = c.createGain();
    am.gain.value = 0.85;
    trem.connect(tg).connect(am.gain);
    o.connect(g).connect(am).connect(dest);
    o2.connect(g2).connect(dest);
    const end = t + dur * 3;
    o.start(t); o2.start(t); trem.start(t);
    o.stop(end); o2.stop(t + 0.3); trem.stop(end);
  }

  _noiseMusic(t, dur, dest, gain, freq, attack) {
    this._noise(t, dur, dest, { gain, type: 'highpass', freq, attack });
  }

  _kick(t, dest, gain) {
    this._osc('sine', 120, t, 0.18, dest, gain, 0.002, 45);
  }
}
